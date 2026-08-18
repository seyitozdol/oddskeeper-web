-- 2026-08-18: UL/Con frontend view'lari, CL'in ucl_* view'larindan klon
-- (xG-SofaScore fix miras). competition + ucl_->uel_/uecl_ swap.

CREATE OR REPLACE VIEW analytics.uel_matches_v1 AS
 SELECT season_label,
    source_match_id AS match_id,
    competition,
    match_datetime,
    home_team_source_id AS home_team_id,
    home_team_name,
    away_team_source_id AS away_team_id,
    away_team_name,
    home_score,
    away_score
   FROM football.matches
  WHERE source = 'sofascore'::text AND (competition = ANY (ARRAY['UEFA Avrupa Ligi'::text, 'UEFA Avrupa Ligi Play-off'::text]));

GRANT SELECT ON analytics.uel_matches_v1 TO anon, authenticated;

CREATE OR REPLACE VIEW analytics.uel_fixtures_v1 AS
 SELECT fixture_id,
    season_label,
    competition,
    round_number,
    fixture_date,
    fixture_datetime,
    home_team_source_id AS home_team_id,
    home_team_name,
    away_team_source_id AS away_team_id,
    away_team_name,
    fixture_status
   FROM football.fixtures
  WHERE source = 'sofascore'::text AND competition = 'UEFA Avrupa Ligi'::text;

GRANT SELECT ON analytics.uel_fixtures_v1 TO anon, authenticated;

CREATE OR REPLACE VIEW analytics.uel_player_season_stats_v1 AS
 WITH base AS (
         SELECT m.season_label,
            d.source_player_id,
            d.player_name,
            d.team_name,
            d.source_team_id,
            d.position_code,
            d.lineup_status,
            m.match_datetime,
            COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0) AS minutes,
            (d.raw_stats ->> 'rating'::text)::numeric AS rating,
            COALESCE((d.raw_stats ->> 'goals'::text)::integer, 0) AS goals,
            COALESCE((d.raw_stats ->> 'goalAssist'::text)::integer, 0) AS assists,
            COALESCE((d.raw_stats ->> 'ownGoals'::text)::integer, 0) AS own_goals,
            COALESCE((d.raw_stats ->> 'totalShots'::text)::integer, 0) AS shots,
            COALESCE((d.raw_stats ->> 'onTargetScoringAttempt'::text)::integer, 0) AS shots_on_target,
            COALESCE((d.raw_stats ->> 'bigChanceMissed'::text)::integer, 0) AS big_chances_missed,
            COALESCE((d.raw_stats ->> 'hitWoodwork'::text)::integer, 0) AS hit_woodwork,
            COALESCE((d.raw_stats ->> 'totalPass'::text)::integer, 0) AS total_passes,
            COALESCE((d.raw_stats ->> 'accuratePass'::text)::integer, 0) AS accurate_passes,
            COALESCE((d.raw_stats ->> 'keyPass'::text)::integer, 0) AS key_passes,
            COALESCE((d.raw_stats ->> 'bigChanceCreated'::text)::integer, 0) AS big_chances_created,
            COALESCE((d.raw_stats ->> 'totalCross'::text)::integer, 0) AS crosses,
            COALESCE((d.raw_stats ->> 'accurateCross'::text)::integer, 0) AS accurate_crosses,
            COALESCE((d.raw_stats ->> 'totalLongBalls'::text)::integer, 0) AS long_balls,
            COALESCE((d.raw_stats ->> 'accurateLongBalls'::text)::integer, 0) AS accurate_long_balls,
            COALESCE((d.raw_stats ->> 'totalTackle'::text)::integer, 0) AS tackles,
            COALESCE((d.raw_stats ->> 'wonTackle'::text)::integer, 0) AS tackles_won,
            COALESCE((d.raw_stats ->> 'interceptionWon'::text)::integer, 0) AS interceptions,
            COALESCE((d.raw_stats ->> 'totalClearance'::text)::integer, 0) AS clearances,
            COALESCE((d.raw_stats ->> 'outfielderBlock'::text)::integer, 0) AS blocks,
            COALESCE((d.raw_stats ->> 'ballRecovery'::text)::integer, 0) AS ball_recoveries,
            COALESCE((d.raw_stats ->> 'duelWon'::text)::integer, 0) AS duels_won,
            COALESCE((d.raw_stats ->> 'duelLost'::text)::integer, 0) AS duels_lost,
            COALESCE((d.raw_stats ->> 'aerialWon'::text)::integer, 0) AS aerials_won,
            COALESCE((d.raw_stats ->> 'aerialLost'::text)::integer, 0) AS aerials_lost,
            COALESCE((d.raw_stats ->> 'fouls'::text)::integer, 0) AS fouls,
            COALESCE((d.raw_stats ->> 'wasFouled'::text)::integer, 0) AS was_fouled,
            COALESCE((d.raw_stats ->> 'totalOffside'::text)::integer, 0) AS offsides,
            COALESCE((d.raw_stats ->> 'dispossessed'::text)::integer, 0) AS dispossessed,
            COALESCE((d.raw_stats ->> 'possessionLostCtrl'::text)::integer, 0) AS possession_lost,
            COALESCE((d.raw_stats ->> 'wonContest'::text)::integer, 0) AS dribbles_won,
            COALESCE((d.raw_stats ->> 'totalContest'::text)::integer, 0) AS dribbles_attempted,
            COALESCE((d.raw_stats ->> 'touches'::text)::integer, 0) AS touches,
            COALESCE((d.raw_stats ->> 'saves'::text)::integer, 0) AS saves,
            COALESCE((d.raw_stats ->> 'penaltySave'::text)::integer, 0) AS penalties_saved,
            COALESCE((d.raw_stats ->> 'errorLeadToAShot'::text)::integer, 0) AS errors_leading_to_shot,
            COALESCE((d.raw_stats ->> 'errorLeadToAGoal'::text)::integer, 0) AS errors_leading_to_goal,
            (d.raw_stats ->> 'kilometersCovered'::text)::numeric AS km_covered,
            (d.raw_stats ->> 'numberOfSprints'::text)::integer AS sprints,
            (d.raw_stats ->> 'topSpeed'::text)::numeric AS top_speed
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Avrupa Ligi'::text
        ), fs_agg AS (
         SELECT m.season_label,
            d.source_player_id AS player_id,
            round(sum((d.raw_stats ->> 'expectedGoals'::text)::numeric), 2) AS xg,
            round(sum((d.raw_stats ->> 'expectedGoalsOnTarget'::text)::numeric), 2) AS xgot,
            round(sum((d.raw_stats ->> 'expectedAssists'::text)::numeric), 2) AS xa,
            mode() WITHIN GROUP (ORDER BY (d.raw_stats ->> 'position'::text)) AS fs_position
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Avrupa Ligi'::text
          GROUP BY m.season_label, d.source_player_id
        ), card_agg AS (
         SELECT m.season_label,
            pc.source_player_id AS player_id,
            count(*) FILTER (WHERE pc.card_class = 'yellow'::text) AS yellow_cards,
            count(*) FILTER (WHERE pc.card_class = ANY (ARRAY['red'::text, 'yellowRed'::text])) AS red_cards
           FROM football.match_player_cards pc
             JOIN football.matches m ON m.source = pc.source AND m.source_match_id = pc.source_match_id
          WHERE pc.source = 'sofascore'::text AND pc.on_pitch AND NOT pc.rescinded AND m.competition = 'UEFA Avrupa Ligi'::text
          GROUP BY m.season_label, pc.source_player_id
        ), agg AS (
         SELECT base.season_label,
            base.source_player_id AS player_id,
            max(base.player_name) AS player_name,
            (array_agg(base.team_name ORDER BY base.match_datetime DESC))[1] AS team_name,
            (array_agg(base.source_team_id ORDER BY base.match_datetime DESC))[1] AS team_id,
            string_agg(DISTINCT base.team_name, ', '::text) AS teams,
            mode() WITHIN GROUP (ORDER BY base.position_code) AS position_code,
            count(*) FILTER (WHERE base.minutes > 0) AS appearances,
            count(*) FILTER (WHERE base.lineup_status = 'starter'::text) AS starts,
            sum(base.minutes) AS minutes,
            sum(base.goals) AS goals,
            sum(base.assists) AS assists,
            sum(base.own_goals) AS own_goals,
            sum(base.shots) AS shots,
            sum(base.shots_on_target) AS shots_on_target,
            sum(base.big_chances_missed) AS big_chances_missed,
            sum(base.hit_woodwork) AS hit_woodwork,
            sum(base.total_passes) AS total_passes,
            sum(base.accurate_passes) AS accurate_passes,
                CASE
                    WHEN sum(base.total_passes) > 0 THEN round(100.0 * sum(base.accurate_passes)::numeric / sum(base.total_passes)::numeric, 1)
                    ELSE NULL::numeric
                END AS pass_accuracy,
            sum(base.key_passes) AS key_passes,
            sum(base.big_chances_created) AS big_chances_created,
            sum(base.crosses) AS crosses,
            sum(base.accurate_crosses) AS accurate_crosses,
            sum(base.long_balls) AS long_balls,
            sum(base.accurate_long_balls) AS accurate_long_balls,
            sum(base.tackles) AS tackles,
            sum(base.tackles_won) AS tackles_won,
            sum(base.interceptions) AS interceptions,
            sum(base.clearances) AS clearances,
            sum(base.blocks) AS blocks,
            sum(base.ball_recoveries) AS ball_recoveries,
            sum(base.duels_won) AS duels_won,
            sum(base.duels_lost) AS duels_lost,
            sum(base.aerials_won) AS aerials_won,
            sum(base.aerials_lost) AS aerials_lost,
            sum(base.fouls) AS fouls,
            sum(base.was_fouled) AS was_fouled,
            sum(base.offsides) AS offsides,
            sum(base.dispossessed) AS dispossessed,
            sum(base.possession_lost) AS possession_lost,
            sum(base.dribbles_won) AS dribbles_won,
            sum(base.dribbles_attempted) AS dribbles_attempted,
            sum(base.touches) AS touches,
            sum(base.saves) AS saves,
            sum(base.penalties_saved) AS penalties_saved,
            sum(base.errors_leading_to_shot) AS errors_leading_to_shot,
            sum(base.errors_leading_to_goal) AS errors_leading_to_goal,
            round(avg(base.rating) FILTER (WHERE base.minutes > 0), 2) AS rating_avg,
            round(sum(base.km_covered), 1) AS km_covered,
            sum(base.sprints) AS sprints,
            max(base.top_speed) AS top_speed
           FROM base
          GROUP BY base.season_label, base.source_player_id
        )
 SELECT agg.season_label,
    agg.player_id,
    agg.player_name,
    agg.team_name,
    agg.team_id,
    agg.teams,
    agg.position_code,
    agg.appearances,
    agg.starts,
    agg.minutes,
    agg.goals,
    agg.assists,
    agg.own_goals,
    agg.shots,
    agg.shots_on_target,
    agg.big_chances_missed,
    agg.hit_woodwork,
    agg.total_passes,
    agg.accurate_passes,
    agg.pass_accuracy,
    agg.key_passes,
    agg.big_chances_created,
    agg.crosses,
    agg.accurate_crosses,
    agg.long_balls,
    agg.accurate_long_balls,
    agg.tackles,
    agg.tackles_won,
    agg.interceptions,
    agg.clearances,
    agg.blocks,
    agg.ball_recoveries,
    agg.duels_won,
    agg.duels_lost,
    agg.aerials_won,
    agg.aerials_lost,
    agg.fouls,
    agg.was_fouled,
    agg.offsides,
    agg.dispossessed,
    agg.possession_lost,
    agg.dribbles_won,
    agg.dribbles_attempted,
    agg.touches,
    agg.saves,
    agg.penalties_saved,
    agg.errors_leading_to_shot,
    agg.errors_leading_to_goal,
    agg.rating_avg,
    agg.km_covered,
    agg.sprints,
    agg.top_speed,
    fs.xg,
    fs.xgot,
    fs.xa,
    COALESCE(cc.yellow_cards, 0::bigint) AS yellow_cards,
    COALESCE(cc.red_cards, 0::bigint) AS red_cards,
    fs.fs_position
   FROM agg
     LEFT JOIN fs_agg fs ON fs.season_label = agg.season_label AND fs.player_id = agg.player_id
     LEFT JOIN card_agg cc ON cc.season_label = agg.season_label AND cc.player_id = agg.player_id;

GRANT SELECT ON analytics.uel_player_season_stats_v1 TO anon, authenticated;

CREATE OR REPLACE VIEW analytics.uel_team_season_stats_v1 AS
 WITH team_matches AS (
         SELECT matches.season_label,
            matches.home_team_source_id AS team_id,
            matches.home_team_name AS team_name,
            matches.home_score AS gf,
            matches.away_score AS ga
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'UEFA Avrupa Ligi'::text
        UNION ALL
         SELECT matches.season_label,
            matches.away_team_source_id,
            matches.away_team_name,
            matches.away_score,
            matches.home_score
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'UEFA Avrupa Ligi'::text
        ), standings AS (
         SELECT team_matches.season_label,
            team_matches.team_id,
            max(team_matches.team_name) AS team_name,
            count(*) AS played,
            count(*) FILTER (WHERE team_matches.gf > team_matches.ga) AS wins,
            count(*) FILTER (WHERE team_matches.gf = team_matches.ga) AS draws,
            count(*) FILTER (WHERE team_matches.gf < team_matches.ga) AS losses,
            sum(team_matches.gf) AS goals_for,
            sum(team_matches.ga) AS goals_against,
            sum(team_matches.gf) - sum(team_matches.ga) AS goal_diff,
            3 * count(*) FILTER (WHERE team_matches.gf > team_matches.ga) + count(*) FILTER (WHERE team_matches.gf = team_matches.ga) AS points,
            count(*) FILTER (WHERE team_matches.ga = 0) AS clean_sheets
           FROM team_matches
          GROUP BY team_matches.season_label, team_matches.team_id
        ), player_agg AS (
         SELECT m.season_label,
            d.source_team_id AS team_id,
            sum(COALESCE((d.raw_stats ->> 'totalShots'::text)::integer, 0)) AS shots,
            sum(COALESCE((d.raw_stats ->> 'onTargetScoringAttempt'::text)::integer, 0)) AS shots_on_target,
            sum(COALESCE((d.raw_stats ->> 'totalPass'::text)::integer, 0)) AS total_passes,
            sum(COALESCE((d.raw_stats ->> 'accuratePass'::text)::integer, 0)) AS accurate_passes,
            sum(COALESCE((d.raw_stats ->> 'keyPass'::text)::integer, 0)) AS key_passes,
            sum(COALESCE((d.raw_stats ->> 'bigChanceCreated'::text)::integer, 0)) AS big_chances_created,
            sum(COALESCE((d.raw_stats ->> 'totalTackle'::text)::integer, 0)) AS tackles,
            sum(COALESCE((d.raw_stats ->> 'interceptionWon'::text)::integer, 0)) AS interceptions,
            sum(COALESCE((d.raw_stats ->> 'fouls'::text)::integer, 0)) AS fouls,
            round(avg((d.raw_stats ->> 'rating'::text)::numeric) FILTER (WHERE COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0) > 0), 2) AS rating_avg,
            round(sum((d.raw_stats ->> 'kilometersCovered'::text)::numeric) / NULLIF(count(DISTINCT d.source_match_id) FILTER (WHERE d.raw_stats ? 'kilometersCovered'::text), 0)::numeric, 1) AS km_per_match
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Avrupa Ligi'::text
          GROUP BY m.season_label, d.source_team_id
        ), team_xg AS (
         SELECT uel_player_season_stats_v1.season_label,
            uel_player_season_stats_v1.team_id,
            round(sum(uel_player_season_stats_v1.xg), 2) AS xg
           FROM analytics.uel_player_season_stats_v1
          WHERE uel_player_season_stats_v1.xg IS NOT NULL
          GROUP BY uel_player_season_stats_v1.season_label, uel_player_season_stats_v1.team_id
        )
 SELECT s.season_label,
    s.team_id,
    s.team_name,
    s.played,
    s.wins,
    s.draws,
    s.losses,
    s.goals_for,
    s.goals_against,
    s.goal_diff,
    s.points,
    s.clean_sheets,
        CASE
            WHEN s.played > 0 THEN round(100.0 * s.wins::numeric / s.played::numeric, 1)
            ELSE NULL::numeric
        END AS win_pct,
    p.shots,
    p.shots_on_target,
    p.total_passes,
    p.accurate_passes,
        CASE
            WHEN p.total_passes > 0 THEN round(100.0 * p.accurate_passes::numeric / p.total_passes::numeric, 1)
            ELSE NULL::numeric
        END AS pass_accuracy,
    p.key_passes,
    p.big_chances_created,
    p.tackles,
    p.interceptions,
    p.fouls,
    p.rating_avg,
    p.km_per_match,
    tx.xg
   FROM standings s
     LEFT JOIN player_agg p ON p.season_label = s.season_label AND p.team_id = s.team_id
     LEFT JOIN team_xg tx ON tx.season_label = s.season_label AND tx.team_id = s.team_id;

GRANT SELECT ON analytics.uel_team_season_stats_v1 TO anon, authenticated;

CREATE OR REPLACE VIEW analytics.uecl_matches_v1 AS
 SELECT season_label,
    source_match_id AS match_id,
    competition,
    match_datetime,
    home_team_source_id AS home_team_id,
    home_team_name,
    away_team_source_id AS away_team_id,
    away_team_name,
    home_score,
    away_score
   FROM football.matches
  WHERE source = 'sofascore'::text AND (competition = ANY (ARRAY['UEFA Konferans Ligi'::text, 'UEFA Konferans Ligi Play-off'::text]));

GRANT SELECT ON analytics.uecl_matches_v1 TO anon, authenticated;

CREATE OR REPLACE VIEW analytics.uecl_fixtures_v1 AS
 SELECT fixture_id,
    season_label,
    competition,
    round_number,
    fixture_date,
    fixture_datetime,
    home_team_source_id AS home_team_id,
    home_team_name,
    away_team_source_id AS away_team_id,
    away_team_name,
    fixture_status
   FROM football.fixtures
  WHERE source = 'sofascore'::text AND competition = 'UEFA Konferans Ligi'::text;

GRANT SELECT ON analytics.uecl_fixtures_v1 TO anon, authenticated;

CREATE OR REPLACE VIEW analytics.uecl_player_season_stats_v1 AS
 WITH base AS (
         SELECT m.season_label,
            d.source_player_id,
            d.player_name,
            d.team_name,
            d.source_team_id,
            d.position_code,
            d.lineup_status,
            m.match_datetime,
            COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0) AS minutes,
            (d.raw_stats ->> 'rating'::text)::numeric AS rating,
            COALESCE((d.raw_stats ->> 'goals'::text)::integer, 0) AS goals,
            COALESCE((d.raw_stats ->> 'goalAssist'::text)::integer, 0) AS assists,
            COALESCE((d.raw_stats ->> 'ownGoals'::text)::integer, 0) AS own_goals,
            COALESCE((d.raw_stats ->> 'totalShots'::text)::integer, 0) AS shots,
            COALESCE((d.raw_stats ->> 'onTargetScoringAttempt'::text)::integer, 0) AS shots_on_target,
            COALESCE((d.raw_stats ->> 'bigChanceMissed'::text)::integer, 0) AS big_chances_missed,
            COALESCE((d.raw_stats ->> 'hitWoodwork'::text)::integer, 0) AS hit_woodwork,
            COALESCE((d.raw_stats ->> 'totalPass'::text)::integer, 0) AS total_passes,
            COALESCE((d.raw_stats ->> 'accuratePass'::text)::integer, 0) AS accurate_passes,
            COALESCE((d.raw_stats ->> 'keyPass'::text)::integer, 0) AS key_passes,
            COALESCE((d.raw_stats ->> 'bigChanceCreated'::text)::integer, 0) AS big_chances_created,
            COALESCE((d.raw_stats ->> 'totalCross'::text)::integer, 0) AS crosses,
            COALESCE((d.raw_stats ->> 'accurateCross'::text)::integer, 0) AS accurate_crosses,
            COALESCE((d.raw_stats ->> 'totalLongBalls'::text)::integer, 0) AS long_balls,
            COALESCE((d.raw_stats ->> 'accurateLongBalls'::text)::integer, 0) AS accurate_long_balls,
            COALESCE((d.raw_stats ->> 'totalTackle'::text)::integer, 0) AS tackles,
            COALESCE((d.raw_stats ->> 'wonTackle'::text)::integer, 0) AS tackles_won,
            COALESCE((d.raw_stats ->> 'interceptionWon'::text)::integer, 0) AS interceptions,
            COALESCE((d.raw_stats ->> 'totalClearance'::text)::integer, 0) AS clearances,
            COALESCE((d.raw_stats ->> 'outfielderBlock'::text)::integer, 0) AS blocks,
            COALESCE((d.raw_stats ->> 'ballRecovery'::text)::integer, 0) AS ball_recoveries,
            COALESCE((d.raw_stats ->> 'duelWon'::text)::integer, 0) AS duels_won,
            COALESCE((d.raw_stats ->> 'duelLost'::text)::integer, 0) AS duels_lost,
            COALESCE((d.raw_stats ->> 'aerialWon'::text)::integer, 0) AS aerials_won,
            COALESCE((d.raw_stats ->> 'aerialLost'::text)::integer, 0) AS aerials_lost,
            COALESCE((d.raw_stats ->> 'fouls'::text)::integer, 0) AS fouls,
            COALESCE((d.raw_stats ->> 'wasFouled'::text)::integer, 0) AS was_fouled,
            COALESCE((d.raw_stats ->> 'totalOffside'::text)::integer, 0) AS offsides,
            COALESCE((d.raw_stats ->> 'dispossessed'::text)::integer, 0) AS dispossessed,
            COALESCE((d.raw_stats ->> 'possessionLostCtrl'::text)::integer, 0) AS possession_lost,
            COALESCE((d.raw_stats ->> 'wonContest'::text)::integer, 0) AS dribbles_won,
            COALESCE((d.raw_stats ->> 'totalContest'::text)::integer, 0) AS dribbles_attempted,
            COALESCE((d.raw_stats ->> 'touches'::text)::integer, 0) AS touches,
            COALESCE((d.raw_stats ->> 'saves'::text)::integer, 0) AS saves,
            COALESCE((d.raw_stats ->> 'penaltySave'::text)::integer, 0) AS penalties_saved,
            COALESCE((d.raw_stats ->> 'errorLeadToAShot'::text)::integer, 0) AS errors_leading_to_shot,
            COALESCE((d.raw_stats ->> 'errorLeadToAGoal'::text)::integer, 0) AS errors_leading_to_goal,
            (d.raw_stats ->> 'kilometersCovered'::text)::numeric AS km_covered,
            (d.raw_stats ->> 'numberOfSprints'::text)::integer AS sprints,
            (d.raw_stats ->> 'topSpeed'::text)::numeric AS top_speed
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Konferans Ligi'::text
        ), fs_agg AS (
         SELECT m.season_label,
            d.source_player_id AS player_id,
            round(sum((d.raw_stats ->> 'expectedGoals'::text)::numeric), 2) AS xg,
            round(sum((d.raw_stats ->> 'expectedGoalsOnTarget'::text)::numeric), 2) AS xgot,
            round(sum((d.raw_stats ->> 'expectedAssists'::text)::numeric), 2) AS xa,
            mode() WITHIN GROUP (ORDER BY (d.raw_stats ->> 'position'::text)) AS fs_position
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Konferans Ligi'::text
          GROUP BY m.season_label, d.source_player_id
        ), card_agg AS (
         SELECT m.season_label,
            pc.source_player_id AS player_id,
            count(*) FILTER (WHERE pc.card_class = 'yellow'::text) AS yellow_cards,
            count(*) FILTER (WHERE pc.card_class = ANY (ARRAY['red'::text, 'yellowRed'::text])) AS red_cards
           FROM football.match_player_cards pc
             JOIN football.matches m ON m.source = pc.source AND m.source_match_id = pc.source_match_id
          WHERE pc.source = 'sofascore'::text AND pc.on_pitch AND NOT pc.rescinded AND m.competition = 'UEFA Konferans Ligi'::text
          GROUP BY m.season_label, pc.source_player_id
        ), agg AS (
         SELECT base.season_label,
            base.source_player_id AS player_id,
            max(base.player_name) AS player_name,
            (array_agg(base.team_name ORDER BY base.match_datetime DESC))[1] AS team_name,
            (array_agg(base.source_team_id ORDER BY base.match_datetime DESC))[1] AS team_id,
            string_agg(DISTINCT base.team_name, ', '::text) AS teams,
            mode() WITHIN GROUP (ORDER BY base.position_code) AS position_code,
            count(*) FILTER (WHERE base.minutes > 0) AS appearances,
            count(*) FILTER (WHERE base.lineup_status = 'starter'::text) AS starts,
            sum(base.minutes) AS minutes,
            sum(base.goals) AS goals,
            sum(base.assists) AS assists,
            sum(base.own_goals) AS own_goals,
            sum(base.shots) AS shots,
            sum(base.shots_on_target) AS shots_on_target,
            sum(base.big_chances_missed) AS big_chances_missed,
            sum(base.hit_woodwork) AS hit_woodwork,
            sum(base.total_passes) AS total_passes,
            sum(base.accurate_passes) AS accurate_passes,
                CASE
                    WHEN sum(base.total_passes) > 0 THEN round(100.0 * sum(base.accurate_passes)::numeric / sum(base.total_passes)::numeric, 1)
                    ELSE NULL::numeric
                END AS pass_accuracy,
            sum(base.key_passes) AS key_passes,
            sum(base.big_chances_created) AS big_chances_created,
            sum(base.crosses) AS crosses,
            sum(base.accurate_crosses) AS accurate_crosses,
            sum(base.long_balls) AS long_balls,
            sum(base.accurate_long_balls) AS accurate_long_balls,
            sum(base.tackles) AS tackles,
            sum(base.tackles_won) AS tackles_won,
            sum(base.interceptions) AS interceptions,
            sum(base.clearances) AS clearances,
            sum(base.blocks) AS blocks,
            sum(base.ball_recoveries) AS ball_recoveries,
            sum(base.duels_won) AS duels_won,
            sum(base.duels_lost) AS duels_lost,
            sum(base.aerials_won) AS aerials_won,
            sum(base.aerials_lost) AS aerials_lost,
            sum(base.fouls) AS fouls,
            sum(base.was_fouled) AS was_fouled,
            sum(base.offsides) AS offsides,
            sum(base.dispossessed) AS dispossessed,
            sum(base.possession_lost) AS possession_lost,
            sum(base.dribbles_won) AS dribbles_won,
            sum(base.dribbles_attempted) AS dribbles_attempted,
            sum(base.touches) AS touches,
            sum(base.saves) AS saves,
            sum(base.penalties_saved) AS penalties_saved,
            sum(base.errors_leading_to_shot) AS errors_leading_to_shot,
            sum(base.errors_leading_to_goal) AS errors_leading_to_goal,
            round(avg(base.rating) FILTER (WHERE base.minutes > 0), 2) AS rating_avg,
            round(sum(base.km_covered), 1) AS km_covered,
            sum(base.sprints) AS sprints,
            max(base.top_speed) AS top_speed
           FROM base
          GROUP BY base.season_label, base.source_player_id
        )
 SELECT agg.season_label,
    agg.player_id,
    agg.player_name,
    agg.team_name,
    agg.team_id,
    agg.teams,
    agg.position_code,
    agg.appearances,
    agg.starts,
    agg.minutes,
    agg.goals,
    agg.assists,
    agg.own_goals,
    agg.shots,
    agg.shots_on_target,
    agg.big_chances_missed,
    agg.hit_woodwork,
    agg.total_passes,
    agg.accurate_passes,
    agg.pass_accuracy,
    agg.key_passes,
    agg.big_chances_created,
    agg.crosses,
    agg.accurate_crosses,
    agg.long_balls,
    agg.accurate_long_balls,
    agg.tackles,
    agg.tackles_won,
    agg.interceptions,
    agg.clearances,
    agg.blocks,
    agg.ball_recoveries,
    agg.duels_won,
    agg.duels_lost,
    agg.aerials_won,
    agg.aerials_lost,
    agg.fouls,
    agg.was_fouled,
    agg.offsides,
    agg.dispossessed,
    agg.possession_lost,
    agg.dribbles_won,
    agg.dribbles_attempted,
    agg.touches,
    agg.saves,
    agg.penalties_saved,
    agg.errors_leading_to_shot,
    agg.errors_leading_to_goal,
    agg.rating_avg,
    agg.km_covered,
    agg.sprints,
    agg.top_speed,
    fs.xg,
    fs.xgot,
    fs.xa,
    COALESCE(cc.yellow_cards, 0::bigint) AS yellow_cards,
    COALESCE(cc.red_cards, 0::bigint) AS red_cards,
    fs.fs_position
   FROM agg
     LEFT JOIN fs_agg fs ON fs.season_label = agg.season_label AND fs.player_id = agg.player_id
     LEFT JOIN card_agg cc ON cc.season_label = agg.season_label AND cc.player_id = agg.player_id;

GRANT SELECT ON analytics.uecl_player_season_stats_v1 TO anon, authenticated;

CREATE OR REPLACE VIEW analytics.uecl_team_season_stats_v1 AS
 WITH team_matches AS (
         SELECT matches.season_label,
            matches.home_team_source_id AS team_id,
            matches.home_team_name AS team_name,
            matches.home_score AS gf,
            matches.away_score AS ga
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'UEFA Konferans Ligi'::text
        UNION ALL
         SELECT matches.season_label,
            matches.away_team_source_id,
            matches.away_team_name,
            matches.away_score,
            matches.home_score
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'UEFA Konferans Ligi'::text
        ), standings AS (
         SELECT team_matches.season_label,
            team_matches.team_id,
            max(team_matches.team_name) AS team_name,
            count(*) AS played,
            count(*) FILTER (WHERE team_matches.gf > team_matches.ga) AS wins,
            count(*) FILTER (WHERE team_matches.gf = team_matches.ga) AS draws,
            count(*) FILTER (WHERE team_matches.gf < team_matches.ga) AS losses,
            sum(team_matches.gf) AS goals_for,
            sum(team_matches.ga) AS goals_against,
            sum(team_matches.gf) - sum(team_matches.ga) AS goal_diff,
            3 * count(*) FILTER (WHERE team_matches.gf > team_matches.ga) + count(*) FILTER (WHERE team_matches.gf = team_matches.ga) AS points,
            count(*) FILTER (WHERE team_matches.ga = 0) AS clean_sheets
           FROM team_matches
          GROUP BY team_matches.season_label, team_matches.team_id
        ), player_agg AS (
         SELECT m.season_label,
            d.source_team_id AS team_id,
            sum(COALESCE((d.raw_stats ->> 'totalShots'::text)::integer, 0)) AS shots,
            sum(COALESCE((d.raw_stats ->> 'onTargetScoringAttempt'::text)::integer, 0)) AS shots_on_target,
            sum(COALESCE((d.raw_stats ->> 'totalPass'::text)::integer, 0)) AS total_passes,
            sum(COALESCE((d.raw_stats ->> 'accuratePass'::text)::integer, 0)) AS accurate_passes,
            sum(COALESCE((d.raw_stats ->> 'keyPass'::text)::integer, 0)) AS key_passes,
            sum(COALESCE((d.raw_stats ->> 'bigChanceCreated'::text)::integer, 0)) AS big_chances_created,
            sum(COALESCE((d.raw_stats ->> 'totalTackle'::text)::integer, 0)) AS tackles,
            sum(COALESCE((d.raw_stats ->> 'interceptionWon'::text)::integer, 0)) AS interceptions,
            sum(COALESCE((d.raw_stats ->> 'fouls'::text)::integer, 0)) AS fouls,
            round(avg((d.raw_stats ->> 'rating'::text)::numeric) FILTER (WHERE COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0) > 0), 2) AS rating_avg,
            round(sum((d.raw_stats ->> 'kilometersCovered'::text)::numeric) / NULLIF(count(DISTINCT d.source_match_id) FILTER (WHERE d.raw_stats ? 'kilometersCovered'::text), 0)::numeric, 1) AS km_per_match
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Konferans Ligi'::text
          GROUP BY m.season_label, d.source_team_id
        ), team_xg AS (
         SELECT uecl_player_season_stats_v1.season_label,
            uecl_player_season_stats_v1.team_id,
            round(sum(uecl_player_season_stats_v1.xg), 2) AS xg
           FROM analytics.uecl_player_season_stats_v1
          WHERE uecl_player_season_stats_v1.xg IS NOT NULL
          GROUP BY uecl_player_season_stats_v1.season_label, uecl_player_season_stats_v1.team_id
        )
 SELECT s.season_label,
    s.team_id,
    s.team_name,
    s.played,
    s.wins,
    s.draws,
    s.losses,
    s.goals_for,
    s.goals_against,
    s.goal_diff,
    s.points,
    s.clean_sheets,
        CASE
            WHEN s.played > 0 THEN round(100.0 * s.wins::numeric / s.played::numeric, 1)
            ELSE NULL::numeric
        END AS win_pct,
    p.shots,
    p.shots_on_target,
    p.total_passes,
    p.accurate_passes,
        CASE
            WHEN p.total_passes > 0 THEN round(100.0 * p.accurate_passes::numeric / p.total_passes::numeric, 1)
            ELSE NULL::numeric
        END AS pass_accuracy,
    p.key_passes,
    p.big_chances_created,
    p.tackles,
    p.interceptions,
    p.fouls,
    p.rating_avg,
    p.km_per_match,
    tx.xg
   FROM standings s
     LEFT JOIN player_agg p ON p.season_label = s.season_label AND p.team_id = s.team_id
     LEFT JOIN team_xg tx ON tx.season_label = s.season_label AND tx.team_id = s.team_id;

GRANT SELECT ON analytics.uecl_team_season_stats_v1 TO anon, authenticated;
