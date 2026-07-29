-- 2026-07-29: TFF 1. Lig "TSL paritesi" veri katmani.
-- 1) tff1_player_match_log_v1/_mat : mac bazli oyuncu logu (source='sofascore', TUM ligler;
--    competition kolonuyla ayrilir. Super Lig satirlari 26/27'de kume dusen kulup oyunculari icin gerekli).
-- 2) tff1_pm_player_season_v1/_mat : log uzerinden sezon x oyuncu agregati (Player Market Avg/LY Avg + kadro zenginlestirme).
-- 3) tff1_fixtures_v1              : football.fixtures (source='sofascore') yaklasan fikstur.
-- 4) ref.tff1_club_map             : Transfermarkt tm_club -> sofascore team id (26/27 1. Lig 20 kulup).
-- 5) tff1_squad_v1/_mat            : guncel kadro = TM 26/27 kadrolari UNION 25/26 roster fallback.

-- ---------------------------------------------------------------- 1) mac logu
create or replace view analytics.tff1_player_match_log_v1 as
select
  m.season_label,
  m.competition,
  m.source_match_id                                            as match_id,
  m.match_datetime,
  d.source_player_id                                           as player_id,
  d.player_name,
  d.source_team_id                                             as team_id,
  d.team_name,
  case when d.player_side = 'home' then m.away_team_source_id else m.home_team_source_id end as opponent_id,
  case when d.player_side = 'home' then m.away_team_name else m.home_team_name end           as opponent_name,
  (d.player_side = 'home')                                     as is_home,
  m.home_score,
  m.away_score,
  d.lineup_status,
  d.position_code,
  coalesce((d.raw_stats->>'minutesPlayed')::int, 0)            as minutes,
  (d.raw_stats->>'rating')::numeric                            as rating,
  coalesce((d.raw_stats->>'goals')::int, 0)                    as goals,
  coalesce((d.raw_stats->>'goalAssist')::int, 0)               as assists,
  coalesce((d.raw_stats->>'totalShots')::int, 0)               as shots,
  coalesce((d.raw_stats->>'onTargetScoringAttempt')::int, 0)   as shots_on_target,
  coalesce((d.raw_stats->>'totalPass')::int, 0)                as total_passes,
  coalesce((d.raw_stats->>'accuratePass')::int, 0)             as accurate_passes,
  coalesce((d.raw_stats->>'keyPass')::int, 0)                  as key_passes,
  coalesce((d.raw_stats->>'totalCross')::int, 0)               as crosses,
  coalesce((d.raw_stats->>'accurateCross')::int, 0)            as accurate_crosses,
  coalesce((d.raw_stats->>'totalLongBalls')::int, 0)           as long_balls,
  coalesce((d.raw_stats->>'accurateLongBalls')::int, 0)        as accurate_long_balls,
  coalesce((d.raw_stats->>'totalTackle')::int, 0)              as tackles,
  coalesce((d.raw_stats->>'wonTackle')::int, 0)                as tackles_won,
  coalesce((d.raw_stats->>'interceptionWon')::int, 0)          as interceptions,
  coalesce((d.raw_stats->>'totalClearance')::int, 0)           as clearances,
  coalesce((d.raw_stats->>'outfielderBlock')::int, 0)          as blocks,
  coalesce((d.raw_stats->>'ballRecovery')::int, 0)             as ball_recoveries,
  coalesce((d.raw_stats->>'duelWon')::int, 0)                  as duels_won,
  coalesce((d.raw_stats->>'duelLost')::int, 0)                 as duels_lost,
  coalesce((d.raw_stats->>'aerialWon')::int, 0)                as aerials_won,
  coalesce((d.raw_stats->>'aerialLost')::int, 0)               as aerials_lost,
  coalesce((d.raw_stats->>'fouls')::int, 0)                    as fouls,
  coalesce((d.raw_stats->>'wasFouled')::int, 0)                as was_fouled,
  coalesce((d.raw_stats->>'totalOffside')::int, 0)             as offsides,
  coalesce((d.raw_stats->>'dispossessed')::int, 0)             as dispossessed,
  coalesce((d.raw_stats->>'possessionLostCtrl')::int, 0)       as possession_lost,
  coalesce((d.raw_stats->>'wonContest')::int, 0)               as dribbles_won,
  coalesce((d.raw_stats->>'totalContest')::int, 0)             as dribbles_attempted,
  coalesce((d.raw_stats->>'touches')::int, 0)                  as touches,
  coalesce((d.raw_stats->>'saves')::int, 0)                    as saves,
  coalesce((d.raw_stats->>'penaltySave')::int, 0)              as penalties_saved,
  (d.raw_stats->>'kilometersCovered')::numeric                 as km_covered,
  (d.raw_stats->>'numberOfSprints')::int                       as sprints,
  (d.raw_stats->>'topSpeed')::numeric                          as top_speed
from football.match_player_stats_details d
join football.matches m
  on m.source = d.source and m.source_match_id = d.source_match_id
where d.source = 'sofascore';

drop materialized view if exists analytics.tff1_squad_mat;
drop materialized view if exists analytics.tff1_pm_player_season_mat;
drop materialized view if exists analytics.tff1_player_match_log_mat;
create materialized view analytics.tff1_player_match_log_mat as
  select * from analytics.tff1_player_match_log_v1;
create unique index uq_tff1_match_log_mat on analytics.tff1_player_match_log_mat (match_id, player_id, team_id);
create index ix_tff1_match_log_mat_player on analytics.tff1_player_match_log_mat (player_id, match_datetime desc);
create index ix_tff1_match_log_mat_match on analytics.tff1_player_match_log_mat (match_id);

-- ------------------------------------------- 2) PM sezon agregati (tum sofascore ligleri)
create or replace view analytics.tff1_pm_player_season_v1 as
select
  season_label,
  player_id,
  max(player_name)                                              as player_name,
  (array_agg(team_id order by match_datetime desc))[1]          as team_id,
  (array_agg(team_name order by match_datetime desc))[1]        as team_name,
  mode() within group (order by position_code)                  as position_code,
  count(*) filter (where minutes > 0)                           as appearances,
  count(*) filter (where lineup_status = 'starter')             as starts,
  sum(minutes)                                                  as minutes,
  max(match_datetime) filter (where minutes > 0)                as last_match_datetime,
  sum(goals) as goals, sum(assists) as assists,
  sum(shots) as shots, sum(shots_on_target) as shots_on_target,
  sum(total_passes) as total_passes, sum(accurate_passes) as accurate_passes,
  sum(key_passes) as key_passes, sum(crosses) as crosses,
  sum(tackles) as tackles, sum(interceptions) as interceptions,
  sum(clearances) as clearances, sum(blocks) as blocks,
  sum(ball_recoveries) as ball_recoveries,
  sum(duels_won) as duels_won, sum(aerials_won) as aerials_won,
  sum(fouls) as fouls, sum(was_fouled) as was_fouled,
  sum(offsides) as offsides, sum(dribbles_won) as dribbles_won,
  sum(touches) as touches, sum(saves) as saves
from analytics.tff1_player_match_log_v1
group by season_label, player_id;

create materialized view analytics.tff1_pm_player_season_mat as
  select * from analytics.tff1_pm_player_season_v1;
create unique index uq_tff1_pm_season_mat on analytics.tff1_pm_player_season_mat (season_label, player_id);

-- ---------------------------------------------------------------- 3) fikstur
create or replace view analytics.tff1_fixtures_v1 as
select
  fixture_id,
  season_label,
  competition,
  round_number,
  fixture_date,
  fixture_datetime,
  home_team_source_id                                          as home_team_id,
  home_team_name,
  away_team_source_id                                          as away_team_id,
  away_team_name,
  fixture_status
from football.fixtures
where source = 'sofascore' and competition = 'Trendyol 1. Lig';

-- ---------------------------------------------------------------- 4) kulup haritasi
create table if not exists ref.tff1_club_map (
  tm_club            text primary key,
  sofascore_team_id  text not null,
  team_name          text not null
);
insert into ref.tff1_club_map (tm_club, sofascore_team_id, team_name) values
  ('antalyaspor', '3056', 'Antalyaspor'),
  ('bandirmaspor', '44320', 'Bandırmaspor'),
  ('batman-petrolspor', '3099', 'Batman Petrolspor'),
  ('bodrumspor', '202390', 'Bodrum FK'),
  ('boluspor', '6414', 'Boluspor'),
  ('bursaspor', '3055', 'Bursaspor'),
  ('esenler-erokspor', '262480', 'Esenler Erokspor'),
  ('fatih-karagumruk', '4954', 'Fatih Karagümrük'),
  ('76-igdir-belediye-spor', '388264', 'Iğdır FK'),
  ('istanbulspor', '3066', 'İstanbulspor'),
  ('kayserispor', '3072', 'Kayserispor'),
  ('ankara-keciorengucu', '6366', 'Keçiörengücü'),
  ('manisa-fk', '202391', 'Manisa FK'),
  ('mardin-fosfat-spor', '296730', 'Mardin 1969 Spor'),
  ('muglaspor', '7034', 'Muğlaspor'),
  ('pendikspor', '7032', 'Pendikspor'),
  ('sariyer', '4952', 'Sarıyer'),
  ('sivasspor', '3076', 'Sivasspor'),
  ('umraniyespor', '55625', 'Ümraniyespor'),
  ('van-spor-fk', '24750', 'Vanspor FK')
on conflict (tm_club) do update
  set sofascore_team_id = excluded.sofascore_team_id, team_name = excluded.team_name;

-- ---------------------------------------------------------------- 5) guncel kadro
-- TM 26/27 kadrolari (sofascore id eslesmis) + fallback: 25/26'da son maci bu kulupte olan
-- ve TM'de BASKA kulupte gorunmeyen oyuncular. TM kapsami kismi oldugundan ikisi birlesir.
create or replace view analytics.tff1_squad_v1 as
with season_stats as (
  select distinct on (player_id) *
  from analytics.tff1_pm_player_season_v1
  where season_label = '2025/2026'
  order by player_id
),
tm_squad as (
  select
    cm.sofascore_team_id as team_id,
    cm.team_name,
    mv.sofascore_player_id as player_id,
    'tm' as membership_source
  from football.tff1_player_market_values mv
  join ref.tff1_club_map cm on cm.tm_club = mv.tm_club
),
roster_fallback as (
  select
    s.team_id,
    s.team_name,
    s.player_id,
    'roster' as membership_source
  from season_stats s
  join ref.tff1_club_map cm on cm.sofascore_team_id = s.team_id
  where s.player_id not in (select sofascore_player_id from football.tff1_player_market_values)
),
membership as (
  select * from tm_squad
  union all
  select * from roster_fallback
)
select
  mb.team_id,
  mb.team_name,
  mb.player_id,
  coalesce(i.player_name, ss.player_name, mv.tm_player_name)   as player_name,
  coalesce(i.position, ss.position_code)                       as position,
  i.photo_url,
  i.birth_date,
  i.country,
  mv.market_value_eur,
  mb.membership_source,
  ss.appearances,
  ss.starts,
  ss.minutes,
  case when ss.appearances > 0
       then round(100.0 * ss.starts / ss.appearances, 1) end   as starter_rate_pct,
  ss.last_match_datetime
from membership mb
left join football.sofascore_player_info i on i.sofascore_player_id = mb.player_id
left join football.tff1_player_market_values mv on mv.sofascore_player_id = mb.player_id
left join season_stats ss on ss.player_id = mb.player_id;

create materialized view analytics.tff1_squad_mat as
  select * from analytics.tff1_squad_v1;
create unique index uq_tff1_squad_mat on analytics.tff1_squad_mat (team_id, player_id);

-- ---------------------------------------------------------------- haklar
grant select on analytics.tff1_player_match_log_v1  to anon, authenticated, service_role;
grant select on analytics.tff1_player_match_log_mat to anon, authenticated, service_role;
grant select on analytics.tff1_pm_player_season_v1  to anon, authenticated, service_role;
grant select on analytics.tff1_pm_player_season_mat to anon, authenticated, service_role;
grant select on analytics.tff1_fixtures_v1          to anon, authenticated, service_role;
grant select on analytics.tff1_squad_v1             to anon, authenticated, service_role;
grant select on analytics.tff1_squad_mat            to anon, authenticated, service_role;
grant select on ref.tff1_club_map                   to anon, authenticated, service_role;
