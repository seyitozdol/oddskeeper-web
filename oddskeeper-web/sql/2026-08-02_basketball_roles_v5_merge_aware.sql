-- Rol v5: bb_player_role_v1 artık MÜKERRER-BİRLEŞTİRME (merge) uygular.
-- SORUN: rol view'ı doğrudan basketball.player_match_stats'tan okuyordu; oyuncu
-- birleştirmelerini (bb_pm_player_merges) UYGULAMIYORDU → aynı kişi iki slug'la iki
-- rol satırı (ör. "Shane Larkin" + "Deshane Davıs Larkın"). Diğer view'lar (windows/
-- season/leaderboard) game_enriched üzerinden zaten merge-aware.
-- ÇÖZÜM: pp CTE'de alias→canonical uygula, kanonik slug'a göre grupla (maçlar birleşir).
-- el_player_role_v1 DEĞİŞMEZ (euroleague person_code stabil, mükerrer yok).

create or replace view analytics.bb_player_role_v1 as
with cfg as (
  select
    coalesce(max(value) filter (where key='role_starter_min'),      22)  as starter_min,
    coalesce(max(value) filter (where key='role_rotation_min'),     14)  as rotation_min,
    coalesce(max(value) filter (where key='role_bench_min'),         8)  as bench_min,
    coalesce(max(value) filter (where key='role_avail_share'),     0.5)  as avail_share,
    coalesce(max(value) filter (where key='role_early_games_max'),   6)  as early_games_max,
    coalesce(max(value) filter (where key='role_gap_weeks'),         5)  as gap_weeks,
    coalesce(max(value) filter (where key='role_recent_join_weeks'), 8)  as recent_join_weeks
  from basketball.model_config
),
tg as (
  select season_label, team_slug, count(*) as team_games, max(week) as team_last_week
  from basketball.team_match_stats group by season_label, team_slug
),
pp as (
  select
    p.season_label, p.team_slug,
    coalesce(m.canonical_slug, p.player_slug)              as player_slug,
    max(coalesce(m.canonical_name, p.player_name))         as player_name,
    count(*)                                               as games,
    round(avg(coalesce(p.minutes,0)), 1)                  as avg_minutes,
    min(p.week)                                            as first_week,
    max(p.week)                                            as last_week
  from basketball.player_match_stats p
  left join analytics.bb_pm_player_merges m
    on m.league = 'basketball' and m.alias_slug = p.player_slug
  group by p.season_label, p.team_slug, coalesce(m.canonical_slug, p.player_slug)
),
ea as (
  select distinct l.bsl_player_slug, tl.bsl_team_slug, er.season_label
  from euroleague.player_bsl_link l
  join analytics.el_player_role_v1 er on er.player_slug = l.person_code
  join euroleague.team_bsl_link tl on tl.team_code = er.team_slug
  where er.role <> 'departed'
)
select
  pp.season_label, pp.team_slug, pp.player_slug, pp.player_name,
  pl.position,
  pp.games, pp.avg_minutes, pp.first_week, pp.last_week,
  tg.team_games, tg.team_last_week,
  exists (select 1 from euroleague.team_bsl_link tl where tl.bsl_team_slug = pp.team_slug) as euro_team,
  case
    when pp.last_week <= tg.team_last_week - cfg.gap_weeks then
      case when exists (
        select 1 from ea
        where ea.bsl_player_slug = pp.player_slug
          and ea.bsl_team_slug   = pp.team_slug
          and ea.season_label    = pp.season_label
      ) then 'euro_focus' else 'departed' end
    when pp.games <= cfg.early_games_max and pp.first_week >= tg.team_last_week - cfg.recent_join_weeks then 'newcomer'
    when pp.avg_minutes >= cfg.starter_min and pp.games >= cfg.avail_share * tg.team_games then 'starter'
    when pp.avg_minutes >= cfg.rotation_min then 'rotation'
    when pp.avg_minutes >= cfg.bench_min    then 'limited'
    else 'garbage'
  end as role
from pp
join tg on tg.season_label = pp.season_label and tg.team_slug = pp.team_slug
cross join cfg
left join basketball.players pl on pl.player_slug = pp.player_slug;

grant select on analytics.bb_player_role_v1 to anon, authenticated;
