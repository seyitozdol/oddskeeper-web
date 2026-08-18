-- 2026-08-18: Kupa mac-detay oyuncu logu (tff1_player_match_log_v1 klonu, guard TERSI:
-- competition = ANY kupalar). Kupa mac detay sayfasi oyuncu tablosunu besler.

CREATE OR REPLACE VIEW analytics.eurocup_player_match_log_v1 AS
 SELECT m.season_label,
    m.competition,
    m.source_match_id AS match_id,
    m.match_datetime,
    d.source_player_id AS player_id,
    d.player_name,
    d.source_team_id AS team_id,
    d.team_name,
        CASE
            WHEN d.player_side = 'home'::text THEN m.away_team_source_id
            ELSE m.home_team_source_id
        END AS opponent_id,
        CASE
            WHEN d.player_side = 'home'::text THEN m.away_team_name
            ELSE m.home_team_name
        END AS opponent_name,
    d.player_side = 'home'::text AS is_home,
    m.home_score,
    m.away_score,
    d.lineup_status,
    d.position_code,
    COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0) AS minutes,
    (d.raw_stats ->> 'rating'::text)::numeric AS rating,
    COALESCE((d.raw_stats ->> 'goals'::text)::integer, 0) AS goals,
    COALESCE((d.raw_stats ->> 'goalAssist'::text)::integer, 0) AS assists,
    COALESCE((d.raw_stats ->> 'totalShots'::text)::integer, 0) AS shots,
    COALESCE((d.raw_stats ->> 'onTargetScoringAttempt'::text)::integer, 0) AS shots_on_target,
    COALESCE((d.raw_stats ->> 'totalPass'::text)::integer, 0) AS total_passes,
    COALESCE((d.raw_stats ->> 'accuratePass'::text)::integer, 0) AS accurate_passes,
    COALESCE((d.raw_stats ->> 'keyPass'::text)::integer, 0) AS key_passes,
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
    (d.raw_stats ->> 'kilometersCovered'::text)::numeric AS km_covered,
    (d.raw_stats ->> 'numberOfSprints'::text)::integer AS sprints,
    (d.raw_stats ->> 'topSpeed'::text)::numeric AS top_speed
   FROM football.match_player_stats_details d
     JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
  WHERE d.source = 'sofascore'::text AND m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text]);
GRANT SELECT ON analytics.eurocup_player_match_log_v1 TO anon, authenticated;
