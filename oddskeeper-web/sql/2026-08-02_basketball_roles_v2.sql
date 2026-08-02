-- Rol sistemi v2: "Yeni Katılan" (newcomer) rolü + takım-lideri tag ayarları.
-- Kullanıcı sorusu: bir oyuncu ligin sonuna doğru gelip birkaç maç oynadıysa
-- sistem bunu "Ayrıldı" sanmasın; takıma KATILIM tarihi (first_week/round) dikkate
-- alınsın. Çözüm: departed'dan sonra newcomer kontrolü (ilk hafta geç + az maç).

-- ============================================================
-- 1) Yeni config anahtarları (varsa dokunma)
-- ============================================================
insert into basketball.model_config (key, value, note) values
  ('role_recent_join_weeks', 8, 'Rol: Yeni Katılan icin ilk hafta ile takim son haftasi farki (son N hafta)'),
  -- Takim-lideri tag toggle'lari (Player Dist rozetleri): 1=goster 0=gizle
  ('leader_minutes',  1, 'Takim lideri rozeti: en cok dakika'),
  ('leader_points',   1, 'Takim lideri rozeti: en cok sayi'),
  ('leader_rebounds', 1, 'Takim lideri rozeti: en cok ribaund'),
  ('leader_assists',  1, 'Takim lideri rozeti: en cok asist'),
  ('leader_blocks',   1, 'Takim lideri rozeti: en cok blok'),
  ('leader_steals',   0, 'Takim lideri rozeti: en cok top calma'),
  ('leader_threes',   0, 'Takim lideri rozeti: en cok 3 sayi')
on conflict (key) do nothing;

-- ============================================================
-- 2) BSL rol view'ı — newcomer eklendi (hafta bazlı)
-- ============================================================
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
         max(player_name)                    as player_name,
         count(*)                            as games,
         round(avg(coalesce(minutes,0)), 1)  as avg_minutes,
         min(week)                           as first_week,
         max(week)                           as last_week
  from basketball.player_match_stats
  group by season_label, team_slug, player_slug
)
select
  pp.season_label, pp.team_slug, pp.player_slug, pp.player_name,
  pl.position,
  pp.games, pp.avg_minutes, pp.first_week, pp.last_week,
  tg.team_games, tg.team_last_week,
  exists (select 1 from euroleague.team_bsl_link tl where tl.bsl_team_slug = pp.team_slug) as euro_team,
  case
    when pp.games <= cfg.early_games_max and pp.last_week  <= tg.team_last_week - cfg.gap_weeks         then 'departed'
    when pp.games <= cfg.early_games_max and pp.first_week >= tg.team_last_week - cfg.recent_join_weeks then 'newcomer'
    when pp.avg_minutes >= cfg.starter_min and pp.games >= cfg.avail_share * tg.team_games              then 'starter'
    when pp.avg_minutes >= cfg.rotation_min then 'rotation'
    when pp.avg_minutes >= cfg.bench_min    then 'limited'
    else 'garbage'
  end as role
from pp
join tg on tg.season_label = pp.season_label and tg.team_slug = pp.team_slug
cross join cfg
left join basketball.players pl on pl.player_slug = pp.player_slug;

grant select on analytics.bb_player_role_v1 to anon, authenticated;

-- ============================================================
-- 3) EL/EC rol view'ı — newcomer eklendi (round bazlı)
-- ============================================================
create or replace view analytics.el_player_role_v1 as
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
  select competition, season_label, team_code,
         count(*) as team_games, max(round) as team_last_round
  from euroleague.team_match_stats group by competition, season_label, team_code
),
pp as (
  select competition, season_label, season_code, team_code, person_code,
         max(player_name)                    as player_name,
         count(*)                            as games,
         round(avg(coalesce(minutes,0)), 1)  as avg_minutes,
         min(round)                          as first_round,
         max(round)                          as last_round
  from euroleague.player_match_stats
  group by competition, season_label, season_code, team_code, person_code
)
select
  pp.competition, pp.season_label,
  pp.team_code   as team_slug,
  pp.person_code as player_slug,
  pp.player_name,
  pl.position_name as position,
  pp.games, pp.avg_minutes,
  false as euro_team,
  case
    when pp.games <= cfg.early_games_max and pp.last_round  <= tg.team_last_round - cfg.gap_weeks         then 'departed'
    when pp.games <= cfg.early_games_max and pp.first_round >= tg.team_last_round - cfg.recent_join_weeks then 'newcomer'
    when pp.avg_minutes >= cfg.starter_min and pp.games >= cfg.avail_share * tg.team_games                then 'starter'
    when pp.avg_minutes >= cfg.rotation_min then 'rotation'
    when pp.avg_minutes >= cfg.bench_min    then 'limited'
    else 'garbage'
  end as role
from pp
join tg on tg.competition = pp.competition and tg.season_label = pp.season_label and tg.team_code = pp.team_code
cross join cfg
left join euroleague.players pl
  on pl.competition = pp.competition and pl.season_code = pp.season_code and pl.person_code = pp.person_code;

grant select on analytics.el_player_role_v1 to anon, authenticated;
