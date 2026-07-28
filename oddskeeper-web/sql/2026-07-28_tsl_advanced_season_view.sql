-- Super Lig oyuncu GELISMIS sezon metrikleri (opta_player_id bazli, sezon basina satir).
-- Kaynak birlesimi:
--   * FlashScore (source='flashscore', sadece 2025/26): olay metrikleri
--   * SofaScore  (source='sofascore', 2024/25 + 2025/26): olay metrikleri (24/25'in tek
--     kaynagi) + fiziksel veriler (km, sprint, maks hiz, tasima mesafeleri; yalniz Sofa'da)
-- Olay metriklerinde 25/26 icin FlashScore tercih edilir (coalesce fs, sofa).
-- Eslesme tablolari: ref.flashscore_player_map (fs->opta), ref.sofascore_opta_player_map (sofa->opta).
-- Frontend MAT okur; veri yenilenince refresh gerekir.
-- Uygulandi: 2026-07-28

create or replace view analytics.tsl_player_advanced_season_v1 as
with fs as (
  select
    m.season_label,
    fmap.opta_player_id,
    round(sum((d.raw_stats->>'EXPECTED_GOALS_ON_TARGET')::numeric), 2) as xgot,
    round(sum((d.raw_stats->>'EXPECTED_ASSISTS')::numeric), 2)      as xa,
    sum(coalesce((d.raw_stats->>'KEY_PASSES')::int, 0))             as key_passes,
    sum(coalesce((d.raw_stats->>'LONG_BALLS_TOTAL')::int, 0))       as long_balls,
    sum(coalesce((d.raw_stats->>'LONG_BALLS_ACCURATE')::int, 0))    as accurate_long_balls,
    sum(coalesce((d.raw_stats->>'DUELS_WON')::int, 0))              as duels_won,
    sum(coalesce((d.raw_stats->>'DUELS_TOTAL')::int, 0)
        - coalesce((d.raw_stats->>'DUELS_WON')::int, 0))            as duels_lost,
    sum(coalesce((d.raw_stats->>'DUELS_AERIAL_WON')::int, 0))       as aerials_won,
    sum(coalesce((d.raw_stats->>'DUELS_AERIAL_TOTAL')::int, 0)
        - coalesce((d.raw_stats->>'DUELS_AERIAL_WON')::int, 0))     as aerials_lost,
    sum(coalesce((d.raw_stats->>'DRIBBLES_WON')::int, 0))           as dribbles_won,
    sum(coalesce((d.raw_stats->>'DRIBBLES_TOTAL')::int, 0))         as dribbles_attempted,
    sum(coalesce((d.raw_stats->>'CLEARANCES')::int, 0))             as clearances,
    sum(coalesce((d.raw_stats->>'BALL_RECOVERIES')::int, 0))        as ball_recoveries,
    sum(coalesce((d.raw_stats->>'BIG_CHANCES_CREATED')::int, 0))    as big_chances_created,
    sum(coalesce((d.raw_stats->>'BIG_CHANCES_MISSED')::int, 0))     as big_chances_missed,
    sum(coalesce((d.raw_stats->>'ERRORS_LEAD_TO_SHOT')::int, 0))    as errors_leading_to_shot,
    sum(coalesce((d.raw_stats->>'ERRORS_LEAD_TO_GOAL')::int, 0))    as errors_leading_to_goal
  from football.match_player_stats_details d
  join football.matches m
    on m.source = d.source and m.source_match_id = d.source_match_id
  join ref.flashscore_player_map fmap
    on fmap.flashscore_player_id = d.source_player_id and fmap.opta_player_id is not null
  where d.source = 'flashscore' and m.competition = 'Süper Lig'
  group by 1, 2
),
sofa as (
  select
    m.season_label,
    smap.opta_player_id,
    count(*) filter (where coalesce((d.raw_stats->>'minutesPlayed')::int, 0) > 0) as appearances,
    sum(coalesce((d.raw_stats->>'minutesPlayed')::int, 0))          as minutes,
    round(sum((d.raw_stats->>'expectedGoalsOnTarget')::numeric), 2) as xgot,
    round(sum((d.raw_stats->>'expectedAssists')::numeric), 2)       as xa,
    sum(coalesce((d.raw_stats->>'keyPass')::int, 0))                as key_passes,
    sum(coalesce((d.raw_stats->>'totalLongBalls')::int, 0))         as long_balls,
    sum(coalesce((d.raw_stats->>'accurateLongBalls')::int, 0))      as accurate_long_balls,
    sum(coalesce((d.raw_stats->>'duelWon')::int, 0))                as duels_won,
    sum(coalesce((d.raw_stats->>'duelLost')::int, 0))               as duels_lost,
    sum(coalesce((d.raw_stats->>'aerialWon')::int, 0))              as aerials_won,
    sum(coalesce((d.raw_stats->>'aerialLost')::int, 0))             as aerials_lost,
    sum(coalesce((d.raw_stats->>'wonContest')::int, 0))             as dribbles_won,
    sum(coalesce((d.raw_stats->>'totalContest')::int, 0))           as dribbles_attempted,
    sum(coalesce((d.raw_stats->>'totalClearance')::int, 0))         as clearances,
    sum(coalesce((d.raw_stats->>'ballRecovery')::int, 0))           as ball_recoveries,
    sum(coalesce((d.raw_stats->>'bigChanceCreated')::int, 0))       as big_chances_created,
    sum(coalesce((d.raw_stats->>'bigChanceMissed')::int, 0))        as big_chances_missed,
    sum(coalesce((d.raw_stats->>'errorLeadToAShot')::int, 0))       as errors_leading_to_shot,
    sum(coalesce((d.raw_stats->>'errorLeadToAGoal')::int, 0))       as errors_leading_to_goal,
    round(sum((d.raw_stats->>'kilometersCovered')::numeric), 1)     as km_covered,
    sum((d.raw_stats->>'numberOfSprints')::int)                     as sprints,
    max((d.raw_stats->>'topSpeed')::numeric)                        as top_speed,
    round(sum((d.raw_stats->>'totalBallCarriesDistance')::numeric)) as carry_distance_m,
    round(sum((d.raw_stats->>'totalProgressiveBallCarriesDistance')::numeric)) as progressive_carry_distance_m
  from football.match_player_stats_details d
  join football.matches m
    on m.source = d.source and m.source_match_id = d.source_match_id
  join ref.sofascore_opta_player_map smap
    on smap.sofascore_player_id = d.source_player_id
  where d.source = 'sofascore' and m.competition = 'Süper Lig'
  group by 1, 2
)
select
  coalesce(fs.season_label, sofa.season_label)       as season_label,
  coalesce(fs.opta_player_id, sofa.opta_player_id)   as opta_player_id,
  sofa.appearances,
  sofa.minutes,
  coalesce(fs.xgot, sofa.xgot)                       as xgot,
  coalesce(fs.xa, sofa.xa)                           as xa,
  coalesce(fs.key_passes, sofa.key_passes)           as key_passes,
  coalesce(fs.long_balls, sofa.long_balls)           as long_balls,
  coalesce(fs.accurate_long_balls, sofa.accurate_long_balls) as accurate_long_balls,
  coalesce(fs.duels_won, sofa.duels_won)             as duels_won,
  coalesce(fs.duels_lost, sofa.duels_lost)           as duels_lost,
  coalesce(fs.aerials_won, sofa.aerials_won)         as aerials_won,
  coalesce(fs.aerials_lost, sofa.aerials_lost)       as aerials_lost,
  coalesce(fs.dribbles_won, sofa.dribbles_won)       as dribbles_won,
  coalesce(fs.dribbles_attempted, sofa.dribbles_attempted) as dribbles_attempted,
  coalesce(fs.clearances, sofa.clearances)           as clearances,
  coalesce(fs.ball_recoveries, sofa.ball_recoveries) as ball_recoveries,
  coalesce(fs.big_chances_created, sofa.big_chances_created) as big_chances_created,
  coalesce(fs.big_chances_missed, sofa.big_chances_missed)   as big_chances_missed,
  coalesce(fs.errors_leading_to_shot, sofa.errors_leading_to_shot) as errors_leading_to_shot,
  coalesce(fs.errors_leading_to_goal, sofa.errors_leading_to_goal) as errors_leading_to_goal,
  sofa.km_covered,
  sofa.sprints,
  sofa.top_speed,
  sofa.carry_distance_m,
  sofa.progressive_carry_distance_m
from fs
full outer join sofa
  on sofa.season_label = fs.season_label and sofa.opta_player_id = fs.opta_player_id;

drop materialized view if exists analytics.tsl_player_advanced_season_mat;
create materialized view analytics.tsl_player_advanced_season_mat as
  select * from analytics.tsl_player_advanced_season_v1;
create unique index uq_tsl_adv_season_mat on analytics.tsl_player_advanced_season_mat (season_label, opta_player_id);

grant select on analytics.tsl_player_advanced_season_v1 to anon, authenticated, service_role;
grant select on analytics.tsl_player_advanced_season_mat to anon, authenticated, service_role;
