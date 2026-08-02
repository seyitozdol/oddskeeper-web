-- Rol v4: "Euro-öncelik" (euro_focus) rolü.
-- SORUN: EuroLeague/EuroCup da oynayan takımların (Efes/FB/BJK/Bahçeşehir/TT)
-- yıldızları BSL'de erken oynamayı bırakıp Euro'ya odaklanıyor. BSL verisinde son
-- maçları sezon sonundan çok önce → v3'te "Ayrıldı" (Left) etiketleniyorlar. Ama
-- AYRILMADILAR; aynı kulüpte Euro oynamaya devam ettiler (ör. Cordinier, Saben Lee,
-- Kamagate, Devoe). Bu yanlış "Left" oluyor.
-- ÇÖZÜM: BSL-departed + euro takım + AYNI kulüpte EL/EC'de hâlâ aktif (el rolü
-- 'departed' değil, player_bsl_link + team_bsl_link köprüsüyle) → 'euro_focus'.
-- Gerçekten erken ayrılan (Euro'da da departed, ör. Papagiannis) 'departed' kalır.
-- NOT: player_bsl_link kapsamı kısmi → linksiz euro oyuncuları hâlâ 'departed'
-- görünebilir (link iyileştirmesi ayrı iş). Mükerrer slug'lar (2 maçlık Türkçe-yazım
-- kopyaları) ayrı dedup konusu (bb_pm_player_merges).
-- Sadece BSL view'ı değişir (el_player_role_v1 = euro'nun kendisi, gerek yok).

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
  select season_label, team_slug, player_slug,
         max(player_name) as player_name, count(*) as games,
         round(avg(coalesce(minutes,0)), 1) as avg_minutes,
         min(week) as first_week, max(week) as last_week
  from basketball.player_match_stats
  group by season_label, team_slug, player_slug
),
ea as (   -- AYNI kulüpte EL/EC'de hâlâ aktif (departed değil) oyuncular
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
