-- TFF 1. Lig (SofaScore, source='sofascore') sezon bazli oyuncu + takim istatistik view'lari
-- Kaynak: football.match_player_stats_details (raw_stats jsonb) + football.matches
-- Play-off maclari haric (competition='Trendyol 1. Lig'); play-off satirlari competition='Trendyol 1. Lig Play-off'.
-- Uygulandi: 2026-07-27

create or replace view analytics.tff1_player_season_stats_v1 as
with base as (
  select
    m.season_label,
    d.source_player_id,
    d.player_name,
    d.team_name,
    d.source_team_id,
    d.position_code,
    d.lineup_status,
    m.match_datetime,
    coalesce((d.raw_stats->>'minutesPlayed')::int, 0)            as minutes,
    (d.raw_stats->>'rating')::numeric                            as rating,
    coalesce((d.raw_stats->>'goals')::int, 0)                    as goals,
    coalesce((d.raw_stats->>'goalAssist')::int, 0)               as assists,
    coalesce((d.raw_stats->>'ownGoals')::int, 0)                 as own_goals,
    coalesce((d.raw_stats->>'totalShots')::int, 0)               as shots,
    coalesce((d.raw_stats->>'onTargetScoringAttempt')::int, 0)   as shots_on_target,
    coalesce((d.raw_stats->>'bigChanceMissed')::int, 0)          as big_chances_missed,
    coalesce((d.raw_stats->>'hitWoodwork')::int, 0)              as hit_woodwork,
    coalesce((d.raw_stats->>'totalPass')::int, 0)                as total_passes,
    coalesce((d.raw_stats->>'accuratePass')::int, 0)             as accurate_passes,
    coalesce((d.raw_stats->>'keyPass')::int, 0)                  as key_passes,
    coalesce((d.raw_stats->>'bigChanceCreated')::int, 0)         as big_chances_created,
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
    coalesce((d.raw_stats->>'errorLeadToAShot')::int, 0)         as errors_leading_to_shot,
    coalesce((d.raw_stats->>'errorLeadToAGoal')::int, 0)         as errors_leading_to_goal,
    (d.raw_stats->>'kilometersCovered')::numeric                 as km_covered,
    (d.raw_stats->>'numberOfSprints')::int                       as sprints,
    (d.raw_stats->>'topSpeed')::numeric                          as top_speed
  from football.match_player_stats_details d
  join football.matches m
    on m.source = d.source and m.source_match_id = d.source_match_id
  where d.source = 'sofascore'
    and m.competition = 'Trendyol 1. Lig'
)
select
  season_label,
  source_player_id                                              as player_id,
  max(player_name)                                              as player_name,
  (array_agg(team_name order by match_datetime desc))[1]        as team_name,
  (array_agg(source_team_id order by match_datetime desc))[1]   as team_id,
  string_agg(distinct team_name, ', ')                          as teams,
  mode() within group (order by position_code)                  as position_code,
  count(*) filter (where minutes > 0)                           as appearances,
  count(*) filter (where lineup_status = 'starter')             as starts,
  sum(minutes)                                                  as minutes,
  sum(goals)                                                    as goals,
  sum(assists)                                                  as assists,
  sum(own_goals)                                                as own_goals,
  sum(shots)                                                    as shots,
  sum(shots_on_target)                                          as shots_on_target,
  sum(big_chances_missed)                                       as big_chances_missed,
  sum(hit_woodwork)                                             as hit_woodwork,
  sum(total_passes)                                             as total_passes,
  sum(accurate_passes)                                          as accurate_passes,
  case when sum(total_passes) > 0
       then round(100.0 * sum(accurate_passes) / sum(total_passes), 1) end as pass_accuracy,
  sum(key_passes)                                               as key_passes,
  sum(big_chances_created)                                      as big_chances_created,
  sum(crosses)                                                  as crosses,
  sum(accurate_crosses)                                         as accurate_crosses,
  sum(long_balls)                                               as long_balls,
  sum(accurate_long_balls)                                      as accurate_long_balls,
  sum(tackles)                                                  as tackles,
  sum(tackles_won)                                              as tackles_won,
  sum(interceptions)                                            as interceptions,
  sum(clearances)                                               as clearances,
  sum(blocks)                                                   as blocks,
  sum(ball_recoveries)                                          as ball_recoveries,
  sum(duels_won)                                                as duels_won,
  sum(duels_lost)                                               as duels_lost,
  sum(aerials_won)                                              as aerials_won,
  sum(aerials_lost)                                             as aerials_lost,
  sum(fouls)                                                    as fouls,
  sum(was_fouled)                                               as was_fouled,
  sum(offsides)                                                 as offsides,
  sum(dispossessed)                                             as dispossessed,
  sum(possession_lost)                                          as possession_lost,
  sum(dribbles_won)                                             as dribbles_won,
  sum(dribbles_attempted)                                       as dribbles_attempted,
  sum(touches)                                                  as touches,
  sum(saves)                                                    as saves,
  sum(penalties_saved)                                          as penalties_saved,
  sum(errors_leading_to_shot)                                   as errors_leading_to_shot,
  sum(errors_leading_to_goal)                                   as errors_leading_to_goal,
  round(avg(rating) filter (where minutes > 0), 2)              as rating_avg,
  round(sum(km_covered), 1)                                     as km_covered,
  sum(sprints)                                                  as sprints,
  max(top_speed)                                                as top_speed
from base
group by season_label, source_player_id;

create or replace view analytics.tff1_team_season_stats_v1 as
with team_matches as (
  select season_label, home_team_source_id as team_id, home_team_name as team_name,
         home_score as gf, away_score as ga
  from football.matches
  where source = 'sofascore' and competition = 'Trendyol 1. Lig'
  union all
  select season_label, away_team_source_id, away_team_name, away_score, home_score
  from football.matches
  where source = 'sofascore' and competition = 'Trendyol 1. Lig'
),
standings as (
  select
    season_label,
    team_id,
    max(team_name)                                   as team_name,
    count(*)                                         as played,
    count(*) filter (where gf > ga)                  as wins,
    count(*) filter (where gf = ga)                  as draws,
    count(*) filter (where gf < ga)                  as losses,
    sum(gf)                                          as goals_for,
    sum(ga)                                          as goals_against,
    sum(gf) - sum(ga)                                as goal_diff,
    3 * count(*) filter (where gf > ga) + count(*) filter (where gf = ga) as points,
    count(*) filter (where ga = 0)                   as clean_sheets
  from team_matches
  group by 1, 2
),
player_agg as (
  select
    m.season_label,
    d.source_team_id                                              as team_id,
    sum(coalesce((d.raw_stats->>'totalShots')::int, 0))           as shots,
    sum(coalesce((d.raw_stats->>'onTargetScoringAttempt')::int, 0)) as shots_on_target,
    sum(coalesce((d.raw_stats->>'totalPass')::int, 0))            as total_passes,
    sum(coalesce((d.raw_stats->>'accuratePass')::int, 0))         as accurate_passes,
    sum(coalesce((d.raw_stats->>'keyPass')::int, 0))              as key_passes,
    sum(coalesce((d.raw_stats->>'bigChanceCreated')::int, 0))     as big_chances_created,
    sum(coalesce((d.raw_stats->>'totalTackle')::int, 0))          as tackles,
    sum(coalesce((d.raw_stats->>'interceptionWon')::int, 0))      as interceptions,
    sum(coalesce((d.raw_stats->>'fouls')::int, 0))                as fouls,
    round(avg((d.raw_stats->>'rating')::numeric)
          filter (where coalesce((d.raw_stats->>'minutesPlayed')::int, 0) > 0), 2) as rating_avg,
    -- fiziksel veri her macta yok; payda sadece km verisi olan maclar
    round(sum((d.raw_stats->>'kilometersCovered')::numeric)
          / nullif(count(distinct d.source_match_id)
                   filter (where d.raw_stats ? 'kilometersCovered'), 0), 1) as km_per_match
  from football.match_player_stats_details d
  join football.matches m
    on m.source = d.source and m.source_match_id = d.source_match_id
  where d.source = 'sofascore'
    and m.competition = 'Trendyol 1. Lig'
  group by 1, 2
)
select
  s.*,
  case when s.played > 0 then round(100.0 * s.wins / s.played, 1) end as win_pct,
  p.shots,
  p.shots_on_target,
  p.total_passes,
  p.accurate_passes,
  case when p.total_passes > 0
       then round(100.0 * p.accurate_passes / p.total_passes, 1) end as pass_accuracy,
  p.key_passes,
  p.big_chances_created,
  p.tackles,
  p.interceptions,
  p.fouls,
  p.rating_avg,
  p.km_per_match
from standings s
left join player_agg p
  on p.season_label = s.season_label and p.team_id = s.team_id;

grant select on analytics.tff1_player_season_stats_v1 to anon, authenticated, service_role;
grant select on analytics.tff1_team_season_stats_v1 to anon, authenticated, service_role;
