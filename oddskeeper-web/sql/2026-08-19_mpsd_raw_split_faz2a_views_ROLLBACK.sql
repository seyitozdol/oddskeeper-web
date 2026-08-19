-- mpsd Faz 2 ADIM A GERI ALMA: 18 view gecis ONCESI tanimlari (pg_get_viewdef, 2026-08-19).

-- analytics._af_match_player_v1
create or replace view analytics._af_match_player_v1 as
 SELECT pm.opta_player_id AS player_source_id,
    m.season_label,
    d.source_match_id,
    COALESCE(((d.raw_stats -> 'games'::text) ->> 'minutes'::text)::integer, 0) AS minutes,
    COALESCE(((d.raw_stats -> 'goals'::text) ->> 'total'::text)::numeric, 0::numeric) AS goals,
    COALESCE(((d.raw_stats -> 'goals'::text) ->> 'assists'::text)::numeric, 0::numeric) AS assists,
    COALESCE(((d.raw_stats -> 'goals'::text) ->> 'saves'::text)::numeric, 0::numeric) AS saves,
    COALESCE(((d.raw_stats -> 'shots'::text) ->> 'total'::text)::numeric, 0::numeric) AS shots_total,
    COALESCE(((d.raw_stats -> 'shots'::text) ->> 'on'::text)::numeric, 0::numeric) AS shots_on,
    COALESCE(((d.raw_stats -> 'passes'::text) ->> 'total'::text)::numeric, 0::numeric) AS passes,
    COALESCE(d.accurate_pass, 0) AS accurate_pass,
    COALESCE(((d.raw_stats -> 'fouls'::text) ->> 'committed'::text)::numeric, 0::numeric) AS fouls_committed,
    COALESCE(((d.raw_stats -> 'fouls'::text) ->> 'drawn'::text)::numeric, 0::numeric) AS fouls_drawn,
    COALESCE(((d.raw_stats -> 'cards'::text) ->> 'yellow'::text)::numeric, 0::numeric) AS yellow,
    COALESCE(((d.raw_stats -> 'cards'::text) ->> 'red'::text)::numeric, 0::numeric) AS red,
    COALESCE(((d.raw_stats -> 'tackles'::text) ->> 'total'::text)::numeric, 0::numeric) AS tackles,
    COALESCE((d.raw_stats ->> 'offsides'::text)::numeric, 0::numeric) AS offsides
   FROM football.match_player_stats_details d
     JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
     JOIN analytics._af_player_map_v1 pm ON pm.apifootball_player_id = d.source_player_id
  WHERE d.source = 'apifootball'::text AND (m.season_label = ANY (ARRAY['2023/2024'::text, '2024/2025'::text]));

-- analytics.eurocup_fs_player_match_log_v1
create or replace view analytics.eurocup_fs_player_match_log_v1 as
 SELECT m.season_label,
    m.competition,
    map.sofascore_match_id AS match_id,
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
    COALESCE(((d.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text)::numeric)::integer, 0) AS minutes,
    (d.raw_stats ->> '_rating'::text)::numeric AS rating,
    COALESCE(((d.raw_stats ->> 'GOALS'::text)::numeric)::integer, 0) AS goals,
    COALESCE(((d.raw_stats ->> 'ASSISTS_GOAL'::text)::numeric)::integer, 0) AS assists,
    COALESCE(((d.raw_stats ->> 'SHOTS_TOTAL'::text)::numeric)::integer, 0) AS shots,
    COALESCE(((d.raw_stats ->> 'SHOTS_ON_TARGET'::text)::numeric)::integer, 0) AS shots_on_target,
    COALESCE(((d.raw_stats ->> 'PASSES_TOTAL'::text)::numeric)::integer, 0) AS total_passes,
    COALESCE(((d.raw_stats ->> 'PASSES_ACCURATE'::text)::numeric)::integer, 0) AS accurate_passes,
    COALESCE(((d.raw_stats ->> 'KEY_PASSES'::text)::numeric)::integer, 0) AS key_passes,
    COALESCE(((d.raw_stats ->> 'TACKLES_TOTAL'::text)::numeric)::integer, 0) AS tackles,
    COALESCE(((d.raw_stats ->> 'INTERCEPTIONS'::text)::numeric)::integer, 0) AS interceptions,
    COALESCE(((d.raw_stats ->> 'CLEARANCES'::text)::numeric)::integer, 0) AS clearances,
    COALESCE(((d.raw_stats ->> 'BALL_RECOVERIES'::text)::numeric)::integer, 0) AS ball_recoveries,
    COALESCE(((d.raw_stats ->> 'DUELS_WON'::text)::numeric)::integer, 0) AS duels_won,
    COALESCE(((d.raw_stats ->> 'DUELS_AERIAL_WON'::text)::numeric)::integer, 0) AS aerials_won,
    COALESCE(((d.raw_stats ->> 'FOULS_COMMITTED'::text)::numeric)::integer, 0) AS fouls,
    COALESCE(((d.raw_stats ->> 'FOULS_SUFFERED'::text)::numeric)::integer, 0) AS was_fouled,
    COALESCE(((d.raw_stats ->> 'OFFSIDES'::text)::numeric)::integer, 0) AS offsides,
    COALESCE(((d.raw_stats ->> 'DRIBBLES_WON'::text)::numeric)::integer, 0) AS dribbles_won,
    COALESCE(((d.raw_stats ->> 'DRIBBLES_TOTAL'::text)::numeric)::integer, 0) AS dribbles_attempted,
    COALESCE(((d.raw_stats ->> 'TOUCHES_TOTAL'::text)::numeric)::integer, 0) AS touches,
    COALESCE(((d.raw_stats ->> 'SAVES_TOTAL'::text)::numeric)::integer, 0) AS saves
   FROM football.match_player_stats_details d
     JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
     JOIN ref.flashscore_sofa_match_map map ON map.flashscore_match_id = d.source_match_id
  WHERE d.source = 'flashscore'::text AND (m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text]));

-- analytics.eurocup_player_match_log_v1
create or replace view analytics.eurocup_player_match_log_v1 as
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
  WHERE d.source = 'sofascore'::text AND (m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text]));

-- analytics.player_current_info_bridged_def_v1
create or replace view analytics.player_current_info_bridged_def_v1 as
 WITH missing AS (
         SELECT p.player_source_id,
            p.player_slug,
            p.player_name,
            p.team_slug,
            p.team_name,
            p.season_label
           FROM analytics.player_profile_bridged_mat p
          WHERE NOT (EXISTS ( SELECT 1
                   FROM analytics.player_current_info_v1 ci
                  WHERE ci.opta_player_id = p.player_source_id))
        ), latest_match AS (
         SELECT DISTINCT ON (pmap.opta_player_id) pmap.opta_player_id AS player_source_id,
            d.source_player_id AS sofascore_player_id,
            NULLIF(d.raw_stats ->> 'jerseyNumber'::text, ''::text)::integer AS shirt_number,
            upper(NULLIF(d.position_code, ''::text)) AS position_code
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
             JOIN ref.sofascore_opta_player_map pmap ON pmap.sofascore_player_id = d.source_player_id
          WHERE d.source = 'sofascore'::text AND (m.competition ~~ 'S%per Lig%'::text OR (m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])))
          ORDER BY pmap.opta_player_id, m.match_datetime DESC
        )
 SELECT player_current_info_v1.player_slug,
    player_current_info_v1.opta_player_id,
    player_current_info_v1.apifootball_player_id,
    player_current_info_v1.current_team_slug,
    player_current_info_v1.current_team_name,
    player_current_info_v1.player_name,
    player_current_info_v1.age,
    player_current_info_v1.shirt_number,
    player_current_info_v1."position",
    player_current_info_v1.photo_url,
    player_current_info_v1.fetched_at,
    player_current_info_v1.full_name,
    player_current_info_v1.nationality,
    player_current_info_v1.height_cm,
    player_current_info_v1.weight_kg,
    player_current_info_v1.birth_date,
    player_current_info_v1.birth_place,
    player_current_info_v1.first_name,
    player_current_info_v1.last_name
   FROM analytics.player_current_info_v1
UNION ALL
 SELECT mi.player_slug,
    mi.player_source_id AS opta_player_id,
    NULL::text AS apifootball_player_id,
    mi.team_slug AS current_team_slug,
    mi.team_name AS current_team_name,
    COALESCE(spi.player_name, mi.player_name) AS player_name,
        CASE
            WHEN spi.birth_date IS NOT NULL THEN EXTRACT(year FROM age(spi.birth_date::timestamp with time zone))::integer
            ELSE NULL::integer
        END AS age,
    lm.shirt_number,
        CASE lm.position_code
            WHEN 'G'::text THEN 'Goalkeeper'::text
            WHEN 'D'::text THEN 'Defender'::text
            WHEN 'M'::text THEN 'Midfielder'::text
            WHEN 'F'::text THEN 'Attacker'::text
            ELSE NULL::text
        END AS "position",
    spi.photo_url,
    spi.updated_at AS fetched_at,
    COALESCE(spi.player_name, mi.player_name) AS full_name,
    spi.country AS nationality,
    spi.height_cm,
    NULL::integer AS weight_kg,
    spi.birth_date,
    NULL::text AS birth_place,
    NULL::text AS first_name,
    NULL::text AS last_name
   FROM missing mi
     LEFT JOIN latest_match lm ON lm.player_source_id = mi.player_source_id
     LEFT JOIN football.sofascore_player_info spi ON spi.sofascore_player_id = lm.sofascore_player_id;

-- analytics.player_match_log_sofascore_def_v1
create or replace view analytics.player_match_log_sofascore_def_v1 as
 WITH slug_map AS (
         SELECT player_profile_bridged_mat.player_source_id,
            player_profile_bridged_mat.player_slug,
            player_profile_bridged_mat.player_name
           FROM analytics.player_profile_bridged_mat
          WHERE player_profile_bridged_mat.player_source_id IS NOT NULL AND player_profile_bridged_mat.player_slug IS NOT NULL
        ), opta_seasons AS (
         SELECT DISTINCT ps.source_player_id AS player_source_id,
            m_1.season_label
           FROM football.match_player_stats_opta_points ps
             JOIN football.matches m_1 ON m_1.source_match_id = ps.source_match_id
          WHERE m_1.season_label IS NOT NULL
        ), fs_pairs AS (
         SELECT DISTINCT mm.sofascore_match_id,
            ppm.sofascore_player_id
           FROM football.match_player_stats_details fd
             JOIN ref.flashscore_sofa_match_map mm ON mm.flashscore_match_id = fd.source_match_id
             JOIN ref.flashscore_sofa_cup_player_map ppm ON ppm.flashscore_player_id = fd.source_player_id
          WHERE fd.source = 'flashscore'::text
        )
 SELECT sm.player_slug,
    pmap.opta_player_id AS player_source_id,
    COALESCE(sm.player_name, d.player_name) AS player_name,
    tm.team_slug,
    d.source_team_id AS team_source_id,
    d.team_name,
    m.source_match_id,
    m.competition,
    m.season_label,
    m.match_datetime,
    m.home_team_source_id = d.source_team_id AS is_home,
    m.away_team_source_id = d.source_team_id AS is_away,
        CASE
            WHEN m.home_team_source_id = d.source_team_id THEN m.away_team_name
            ELSE m.home_team_name
        END AS opponent_name,
        CASE
            WHEN m.home_team_source_id = d.source_team_id THEN away_map.team_slug
            ELSE home_map.team_slug
        END AS opponent_team_slug,
        CASE
            WHEN m.home_score IS NULL OR m.away_score IS NULL THEN NULL::text
            WHEN m.home_team_source_id = d.source_team_id THEN concat(m.home_score, '-', m.away_score)
            ELSE concat(m.away_score, '-', m.home_score)
        END AS score_display,
        CASE
            WHEN m.home_score IS NULL OR m.away_score IS NULL THEN NULL::text
            WHEN m.winner_team_source_id = d.source_team_id THEN 'W'::text
            WHEN m.winner_team_source_id IS NULL THEN 'D'::text
            ELSE 'L'::text
        END AS result_code,
    d.lineup_status,
    d.position_code,
    NULL::numeric AS points,
    (d.raw_stats ->> 'minutesPlayed'::text)::integer AS minutes_played,
    COALESCE((d.raw_stats ->> 'goals'::text)::integer, 0) AS goals,
    COALESCE((d.raw_stats ->> 'goalAssist'::text)::integer, 0) AS assists,
    COALESCE((d.raw_stats ->> 'onTargetScoringAttempt'::text)::integer, 0) AS shots_on_target,
    COALESCE((d.raw_stats ->> 'shotOffTarget'::text)::integer, 0) AS shots_off_target,
    COALESCE((d.raw_stats ->> 'blockedScoringAttempt'::text)::integer, 0) AS shots_blocked,
    COALESCE((d.raw_stats ->> 'totalPass'::text)::integer, 0) AS passes,
    COALESCE((d.raw_stats ->> 'totalCross'::text)::integer, 0) AS crosses,
    COALESCE((d.raw_stats ->> 'totalTackle'::text)::integer, 0) AS tackles,
    COALESCE((d.raw_stats ->> 'interceptionWon'::text)::integer, 0) AS interceptions,
    COALESCE((d.raw_stats ->> 'wasFouled'::text)::integer, 0) AS fouls_won,
    COALESCE((d.raw_stats ->> 'fouls'::text)::integer, 0) AS fouls_conceded,
    COALESCE((d.raw_stats ->> 'totalOffside'::text)::integer, 0) AS offsides,
    NULL::integer AS cards_yellow,
    NULL::integer AS cards_red,
    NULL::integer AS penalties_won,
    COALESCE((d.raw_stats ->> 'saves'::text)::integer, 0) AS saves_total,
    (d.raw_stats ->> 'expectedGoals'::text)::numeric AS expected_goals,
    COALESCE((d.raw_stats ->> 'accuratePass'::text)::integer, 0) AS accurate_pass
   FROM football.match_player_stats_details d
     JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
     JOIN ref.sofascore_opta_player_map pmap ON pmap.sofascore_player_id = d.source_player_id
     JOIN slug_map sm ON sm.player_source_id = pmap.opta_player_id
     LEFT JOIN ref.team_mapping tm ON tm.source_team_id = d.source_team_id AND tm.is_active = true
     LEFT JOIN ref.team_mapping home_map ON home_map.source_team_id = m.home_team_source_id AND home_map.is_active = true
     LEFT JOIN ref.team_mapping away_map ON away_map.source_team_id = m.away_team_source_id AND away_map.is_active = true
  WHERE d.source = 'sofascore'::text AND (m.competition ~~ 'S%per Lig%'::text OR (m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text]))) AND m.season_label IS NOT NULL AND ((m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])) OR NOT (EXISTS ( SELECT 1
           FROM opta_seasons o
          WHERE o.player_source_id = pmap.opta_player_id AND o.season_label = m.season_label))) AND NOT ((m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])) AND NOT d.raw_stats ? 'minutesPlayed'::text AND (EXISTS ( SELECT 1
           FROM fs_pairs fp
          WHERE fp.sofascore_match_id = m.source_match_id AND fp.sofascore_player_id = d.source_player_id)))
UNION ALL
 SELECT sm.player_slug,
    pmap.opta_player_id AS player_source_id,
    COALESCE(sm.player_name, fd.player_name) AS player_name,
    tm.team_slug,
        CASE
            WHEN fd.player_side = 'home'::text THEN ms.home_team_source_id
            ELSE ms.away_team_source_id
        END AS team_source_id,
        CASE
            WHEN fd.player_side = 'home'::text THEN ms.home_team_name
            ELSE ms.away_team_name
        END AS team_name,
    ms.source_match_id,
    ms.competition,
    ms.season_label,
    ms.match_datetime,
    fd.player_side = 'home'::text AS is_home,
    fd.player_side <> 'home'::text AS is_away,
        CASE
            WHEN fd.player_side = 'home'::text THEN ms.away_team_name
            ELSE ms.home_team_name
        END AS opponent_name,
        CASE
            WHEN fd.player_side = 'home'::text THEN away_map.team_slug
            ELSE home_map.team_slug
        END AS opponent_team_slug,
        CASE
            WHEN ms.home_score IS NULL OR ms.away_score IS NULL THEN NULL::text
            WHEN fd.player_side = 'home'::text THEN concat(ms.home_score, '-', ms.away_score)
            ELSE concat(ms.away_score, '-', ms.home_score)
        END AS score_display,
        CASE
            WHEN ms.home_score IS NULL OR ms.away_score IS NULL THEN NULL::text
            WHEN ms.winner_team_source_id =
            CASE
                WHEN fd.player_side = 'home'::text THEN ms.home_team_source_id
                ELSE ms.away_team_source_id
            END THEN 'W'::text
            WHEN ms.winner_team_source_id IS NULL THEN 'D'::text
            ELSE 'L'::text
        END AS result_code,
    fd.lineup_status,
    fd.position_code,
    NULL::numeric AS points,
    NULLIF(fd.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text, ''::text)::numeric::integer AS minutes_played,
    COALESCE(NULLIF(fd.raw_stats ->> 'GOALS'::text, ''::text)::numeric::integer, 0) AS goals,
    COALESCE(NULLIF(fd.raw_stats ->> 'ASSISTS_GOAL'::text, ''::text)::numeric::integer, 0) AS assists,
    COALESCE(NULLIF(fd.raw_stats ->> 'SHOTS_ON_TARGET'::text, ''::text)::numeric::integer, 0) AS shots_on_target,
    GREATEST(COALESCE(NULLIF(fd.raw_stats ->> 'SHOTS_TOTAL'::text, ''::text)::numeric::integer, 0) - COALESCE(NULLIF(fd.raw_stats ->> 'SHOTS_ON_TARGET'::text, ''::text)::numeric::integer, 0), 0) AS shots_off_target,
    0 AS shots_blocked,
    COALESCE(NULLIF(fd.raw_stats ->> 'PASSES_TOTAL'::text, ''::text)::numeric::integer, 0) AS passes,
    0 AS crosses,
    COALESCE(NULLIF(fd.raw_stats ->> 'TACKLES_TOTAL'::text, ''::text)::numeric::integer, 0) AS tackles,
    COALESCE(NULLIF(fd.raw_stats ->> 'INTERCEPTIONS'::text, ''::text)::numeric::integer, 0) AS interceptions,
    COALESCE(NULLIF(fd.raw_stats ->> 'FOULS_SUFFERED'::text, ''::text)::numeric::integer, 0) AS fouls_won,
    COALESCE(NULLIF(fd.raw_stats ->> 'FOULS_COMMITTED'::text, ''::text)::numeric::integer, 0) AS fouls_conceded,
    COALESCE(NULLIF(fd.raw_stats ->> 'OFFSIDES'::text, ''::text)::numeric::integer, 0) AS offsides,
    NULL::integer AS cards_yellow,
    NULL::integer AS cards_red,
    NULL::integer AS penalties_won,
    COALESCE(NULLIF(fd.raw_stats ->> 'SAVES_TOTAL'::text, ''::text)::numeric::integer, 0) AS saves_total,
    NULLIF(fd.raw_stats ->> 'EXPECTED_GOALS'::text, ''::text)::numeric AS expected_goals,
    COALESCE(NULLIF(fd.raw_stats ->> 'PASSES_ACCURATE'::text, ''::text)::numeric::integer, 0) AS accurate_pass
   FROM football.match_player_stats_details fd
     JOIN ref.flashscore_sofa_match_map mm ON mm.flashscore_match_id = fd.source_match_id
     JOIN ref.flashscore_sofa_cup_player_map ppm ON ppm.flashscore_player_id = fd.source_player_id
     JOIN football.matches ms ON ms.source = 'sofascore'::text AND ms.source_match_id = mm.sofascore_match_id
     JOIN ref.sofascore_opta_player_map pmap ON pmap.sofascore_player_id = ppm.sofascore_player_id
     JOIN slug_map sm ON sm.player_source_id = pmap.opta_player_id
     LEFT JOIN ref.team_mapping tm ON tm.source_team_id =
        CASE
            WHEN fd.player_side = 'home'::text THEN ms.home_team_source_id
            ELSE ms.away_team_source_id
        END AND tm.is_active = true
     LEFT JOIN ref.team_mapping home_map ON home_map.source_team_id = ms.home_team_source_id AND home_map.is_active = true
     LEFT JOIN ref.team_mapping away_map ON away_map.source_team_id = ms.away_team_source_id AND away_map.is_active = true
  WHERE fd.source = 'flashscore'::text AND (ms.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])) AND ms.season_label IS NOT NULL AND NOT (EXISTS ( SELECT 1
           FROM football.match_player_stats_details d2
          WHERE d2.source = 'sofascore'::text AND d2.source_match_id = mm.sofascore_match_id AND d2.source_player_id = ppm.sofascore_player_id AND d2.raw_stats ? 'minutesPlayed'::text));

-- analytics.player_match_metrics_base_v1
create or replace view analytics.player_match_metrics_base_v1 as
 WITH merged_player_stats AS (
         SELECT COALESCE(o.source_match_id, d.source_match_id) AS source_match_id,
            COALESCE(o.source_team_id, d.source_team_id) AS source_team_id,
            COALESCE(o.team_name, d.team_name) AS team_name,
            COALESCE(o.source_player_id, d.source_player_id) AS source_player_id,
            COALESCE(o.player_name, d.player_name) AS player_name,
            COALESCE(o.player_side, d.player_side) AS player_side,
            COALESCE(o.lineup_status, d.lineup_status) AS lineup_status,
            COALESCE(o.position_code, d.position_code) AS position_code,
            o.team_rank,
            o.points,
            o.minutes_played,
            o.goals,
            o.shots_on_target,
            o.shots_off_target,
            o.shots_blocked,
            o.own_goals,
            o.assists,
            o.passes,
            o.crosses,
            o.tackles,
            o.interceptions,
            o.fouls_won,
            o.fouls_conceded,
            o.offsides,
            o.cards_yellow,
            o.cards_red,
            o.goals_conceded,
            o.penalties_won,
            o.saves_total,
            o.penalties_saved,
            d.accurate_pass,
            d.hit_woodwork,
            d.attempts_ibox,
            d.attempts_obox,
            d.headed_shots,
            d.expected_goals,
            d.goal_kicks,
            d.total_throws,
            d.out_of_box_goals,
            d.right_foot_goals,
            d.left_foot_goals,
            d.headed_goals,
            d.penalty_goals,
            d.freekick_goals,
            d.fantasy_assist
           FROM football.match_player_stats_opta_points o
             FULL JOIN ( SELECT match_player_stats_details.id,
                    match_player_stats_details.source,
                    match_player_stats_details.source_match_id,
                    match_player_stats_details.source_team_id,
                    match_player_stats_details.team_name,
                    match_player_stats_details.source_player_id,
                    match_player_stats_details.player_name,
                    match_player_stats_details.player_side,
                    match_player_stats_details.lineup_status,
                    match_player_stats_details.position_code,
                    match_player_stats_details.accurate_pass,
                    match_player_stats_details.hit_woodwork,
                    match_player_stats_details.attempts_ibox,
                    match_player_stats_details.attempts_obox,
                    match_player_stats_details.headed_shots,
                    match_player_stats_details.expected_goals,
                    match_player_stats_details.goal_kicks,
                    match_player_stats_details.total_throws,
                    match_player_stats_details.out_of_box_goals,
                    match_player_stats_details.right_foot_goals,
                    match_player_stats_details.left_foot_goals,
                    match_player_stats_details.headed_goals,
                    match_player_stats_details.penalty_goals,
                    match_player_stats_details.freekick_goals,
                    match_player_stats_details.fantasy_assist,
                    match_player_stats_details.raw_stats,
                    match_player_stats_details.payload_last_seen_at,
                    match_player_stats_details.created_at,
                    match_player_stats_details.updated_at
                   FROM football.match_player_stats_details
                  WHERE match_player_stats_details.source = 'opta'::text) d ON o.source_match_id = d.source_match_id AND o.source_team_id = d.source_team_id AND o.source_player_id = d.source_player_id
        ), enriched AS (
         SELECT ps.source_match_id,
            m.competition,
            m.season_label,
            m.match_datetime,
            ps.source_team_id,
                CASE
                    WHEN ps.source_team_id = m.home_team_source_id THEN 'home'::text
                    WHEN ps.source_team_id = m.away_team_source_id THEN 'away'::text
                    WHEN lower(COALESCE(ps.player_side, ''::text)) = ANY (ARRAY['home'::text, 'h'::text]) THEN 'home'::text
                    WHEN lower(COALESCE(ps.player_side, ''::text)) = ANY (ARRAY['away'::text, 'a'::text]) THEN 'away'::text
                    ELSE NULL::text
                END AS team_side,
                CASE
                    WHEN ps.source_team_id = m.home_team_source_id THEN true
                    WHEN lower(COALESCE(ps.player_side, ''::text)) = ANY (ARRAY['home'::text, 'h'::text]) THEN true
                    ELSE false
                END AS is_home,
                CASE
                    WHEN ps.source_team_id = m.away_team_source_id THEN true
                    WHEN lower(COALESCE(ps.player_side, ''::text)) = ANY (ARRAY['away'::text, 'a'::text]) THEN true
                    ELSE false
                END AS is_away,
            ps.team_name,
                CASE
                    WHEN ps.source_team_id = m.home_team_source_id THEN m.away_team_source_id
                    WHEN ps.source_team_id = m.away_team_source_id THEN m.home_team_source_id
                    ELSE NULL::text
                END AS opponent_team_source_id,
                CASE
                    WHEN ps.source_team_id = m.home_team_source_id THEN m.away_team_name
                    WHEN ps.source_team_id = m.away_team_source_id THEN m.home_team_name
                    ELSE NULL::text
                END AS opponent_team_name,
            ps.source_player_id,
            ps.player_name,
            ps.player_side,
            ps.lineup_status,
            ps.position_code,
                CASE
                    WHEN lower(COALESCE(ps.lineup_status, ''::text)) ~~ '%start%'::text THEN true
                    WHEN lower(COALESCE(ps.lineup_status, ''::text)) = ANY (ARRAY['starter'::text, 'starting xi'::text, 'starting_xi'::text, 'startingxi'::text]) THEN true
                    ELSE false
                END AS started_flag,
                CASE
                    WHEN lower(COALESCE(ps.lineup_status, ''::text)) ~~ '%sub%'::text THEN true
                    WHEN lower(COALESCE(ps.lineup_status, ''::text)) ~~ '%bench%'::text THEN true
                    ELSE false
                END AS sub_flag,
            m.home_score,
            m.away_score,
                CASE
                    WHEN ps.source_team_id = m.home_team_source_id THEN m.home_score
                    WHEN ps.source_team_id = m.away_team_source_id THEN m.away_score
                    ELSE NULL::integer
                END AS score_for,
                CASE
                    WHEN ps.source_team_id = m.home_team_source_id THEN m.away_score
                    WHEN ps.source_team_id = m.away_team_source_id THEN m.home_score
                    ELSE NULL::integer
                END AS score_against,
                CASE
                    WHEN ps.source_team_id = m.home_team_source_id AND m.home_score > m.away_score THEN 'W'::text
                    WHEN ps.source_team_id = m.home_team_source_id AND m.home_score = m.away_score THEN 'D'::text
                    WHEN ps.source_team_id = m.home_team_source_id AND m.home_score < m.away_score THEN 'L'::text
                    WHEN ps.source_team_id = m.away_team_source_id AND m.away_score > m.home_score THEN 'W'::text
                    WHEN ps.source_team_id = m.away_team_source_id AND m.away_score = m.home_score THEN 'D'::text
                    WHEN ps.source_team_id = m.away_team_source_id AND m.away_score < m.home_score THEN 'L'::text
                    ELSE NULL::text
                END AS result_code,
            ps.team_rank,
            ps.points,
            ps.minutes_played,
            ps.goals,
            ps.assists,
            ps.expected_goals,
            ps.penalties_won,
            ps.own_goals,
            ps.shots_on_target,
            ps.shots_off_target,
            ps.shots_blocked,
            ps.attempts_ibox,
            ps.attempts_obox,
            ps.headed_shots,
            ps.hit_woodwork,
            ps.passes,
            ps.accurate_pass,
            ps.crosses,
            ps.fantasy_assist,
            ps.tackles,
            ps.interceptions,
            ps.fouls_conceded,
            ps.fouls_won,
            ps.offsides,
            ps.cards_yellow,
            ps.cards_red,
            ps.saves_total,
            ps.penalties_saved,
            ps.goals_conceded,
            ps.goal_kicks,
            ps.total_throws,
            ps.out_of_box_goals,
            ps.right_foot_goals,
            ps.left_foot_goals,
            ps.headed_goals,
            ps.penalty_goals,
            ps.freekick_goals
           FROM merged_player_stats ps
             JOIN football.matches m ON m.source_match_id = ps.source_match_id
        ), slug_enriched AS (
         SELECT e.source_match_id,
            e.competition,
            e.season_label,
            e.match_datetime,
            e.source_team_id,
            e.team_side,
            e.is_home,
            e.is_away,
            e.team_name,
            e.opponent_team_source_id,
            e.opponent_team_name,
            e.source_player_id,
            e.player_name,
            e.player_side,
            e.lineup_status,
            e.position_code,
            e.started_flag,
            e.sub_flag,
            e.home_score,
            e.away_score,
            e.score_for,
            e.score_against,
            e.result_code,
            e.team_rank,
            e.points,
            e.minutes_played,
            e.goals,
            e.assists,
            e.expected_goals,
            e.penalties_won,
            e.own_goals,
            e.shots_on_target,
            e.shots_off_target,
            e.shots_blocked,
            e.attempts_ibox,
            e.attempts_obox,
            e.headed_shots,
            e.hit_woodwork,
            e.passes,
            e.accurate_pass,
            e.crosses,
            e.fantasy_assist,
            e.tackles,
            e.interceptions,
            e.fouls_conceded,
            e.fouls_won,
            e.offsides,
            e.cards_yellow,
            e.cards_red,
            e.saves_total,
            e.penalties_saved,
            e.goals_conceded,
            e.goal_kicks,
            e.total_throws,
            e.out_of_box_goals,
            e.right_foot_goals,
            e.left_foot_goals,
            e.headed_goals,
            e.penalty_goals,
            e.freekick_goals,
            mp.team_slug,
            mp.player_slug
           FROM enriched e
             LEFT JOIN analytics.match_participants_v1 mp ON mp.source_match_id = e.source_match_id AND mp.source_team_id = e.source_team_id AND mp.player_source_id = e.source_player_id
        )
 SELECT source_match_id,
    competition,
    season_label,
    match_datetime,
    team_side,
    is_home,
    is_away,
    team_slug,
    source_team_id,
    team_name,
    opponent_team_source_id,
    opponent_team_name,
    player_slug,
    source_player_id AS player_source_id,
    player_name,
    player_side,
    lineup_status,
    position_code,
    started_flag,
    sub_flag,
    home_score,
    away_score,
    score_for,
    score_against,
    result_code,
    team_rank,
    points,
    minutes_played,
    goals,
    assists,
    expected_goals,
    penalties_won,
    own_goals,
    shots_on_target,
    shots_off_target,
    shots_blocked,
    attempts_ibox,
    attempts_obox,
    headed_shots,
    hit_woodwork,
    passes,
    accurate_pass,
    crosses,
    fantasy_assist,
    tackles,
    interceptions,
    fouls_conceded,
    fouls_won,
    offsides,
    cards_yellow,
    cards_red,
    saves_total,
    penalties_saved,
    goals_conceded,
    goal_kicks,
    total_throws,
    out_of_box_goals,
    right_foot_goals,
    left_foot_goals,
    headed_goals,
    penalty_goals,
    freekick_goals
   FROM slug_enriched;

-- analytics.player_profile_sofascore_v1
create or replace view analytics.player_profile_sofascore_v1 as
 WITH sl_players AS (
         SELECT DISTINCT d.source_player_id
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition ~~ 'S%per Lig%'::text
        ), base AS (
         SELECT tm.team_slug,
            d.source_team_id AS team_source_id,
            COALESCE(tm.display_name, d.team_name) AS team_name,
            m.competition,
            m.season_label,
            m.match_datetime,
            d.source_match_id,
            pmap.opta_player_id AS player_source_id,
            d.player_name,
            d.lineup_status,
            upper(NULLIF(d.position_code, ''::text)) AS position_code,
            COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0) AS minutes_played,
            COALESCE((d.raw_stats ->> 'goals'::text)::integer, 0) AS goals,
            COALESCE((d.raw_stats ->> 'goalAssist'::text)::integer, 0) AS assists
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
             JOIN ref.sofascore_opta_player_map pmap ON pmap.sofascore_player_id = d.source_player_id
             LEFT JOIN ref.team_mapping tm ON tm.source_team_id = d.source_team_id AND tm.is_active = true
          WHERE d.source = 'sofascore'::text AND m.season_label IS NOT NULL AND (m.competition ~~ 'S%per Lig%'::text AND tm.team_slug IS NOT NULL OR (m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])) AND pmap.match_method = 'synthetic'::text AND NOT (EXISTS ( SELECT 1
                   FROM sl_players sp
                  WHERE sp.source_player_id = d.source_player_id)))
        ), pos_ranked AS (
         SELECT base.team_source_id,
            base.season_label,
            base.player_source_id,
            base.position_code,
            row_number() OVER (PARTITION BY base.team_source_id, base.season_label, base.player_source_id ORDER BY (
                CASE base.position_code
                    WHEN 'G'::text THEN 1
                    WHEN 'D'::text THEN 2
                    WHEN 'M'::text THEN 3
                    WHEN 'F'::text THEN 4
                    ELSE 100
                END), (count(*)) DESC) AS rn
           FROM base
          WHERE base.position_code IS NOT NULL
          GROUP BY base.team_source_id, base.season_label, base.player_source_id, base.position_code
        ), agg AS (
         SELECT base.team_slug,
            base.team_source_id,
            base.team_name,
            base.competition,
            base.season_label,
            base.player_source_id,
            (array_agg(base.player_name ORDER BY base.match_datetime DESC))[1] AS player_name,
            count(DISTINCT base.source_match_id) FILTER (WHERE base.minutes_played > 0)::integer AS appearances,
            count(DISTINCT base.source_match_id) FILTER (WHERE base.lineup_status = 'starter'::text)::integer AS starts,
            count(DISTINCT base.source_match_id) FILTER (WHERE base.lineup_status = 'substitute'::text AND base.minutes_played > 0)::integer AS sub_appearances,
            sum(base.minutes_played)::integer AS total_minutes,
            sum(base.goals)::integer AS goals,
            sum(base.assists)::integer AS assists,
            min(base.match_datetime) AS first_match_datetime,
            max(base.match_datetime) AS last_match_datetime
           FROM base
          GROUP BY base.team_slug, base.team_source_id, base.team_name, base.competition, base.season_label, base.player_source_id
        )
 SELECT a.team_slug,
    a.team_source_id,
    a.team_name,
    a.competition,
    a.season_label,
    a.player_source_id,
    a.player_name,
    (lower(TRIM(BOTH '-'::text FROM regexp_replace(regexp_replace(translate(a.player_name, 'ÇĞİÖŞÜçğıöşüÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÑñĆćČčŠšŽžŁłŃń'::text, 'CGIOSUcgiosuAAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCcCcSsZzLlNn'::text), '[^a-zA-Z0-9]+'::text, '-'::text, 'g'::text), '-{2,}'::text, '-'::text, 'g'::text))) || '--'::text) || a.player_source_id AS player_slug,
        CASE pr.position_code
            WHEN 'G'::text THEN 'GK'::text
            WHEN 'D'::text THEN 'DF'::text
            WHEN 'M'::text THEN 'MF'::text
            WHEN 'F'::text THEN 'FW'::text
            ELSE 'OTHER'::text
        END AS primary_position_code,
        CASE pr.position_code
            WHEN 'G'::text THEN 'GOALKEEPER'::text
            WHEN 'D'::text THEN 'DEFENDER'::text
            WHEN 'M'::text THEN 'MIDFIELDER'::text
            WHEN 'F'::text THEN 'FORWARD'::text
            ELSE 'OTHER'::text
        END AS position_group,
    a.appearances,
    a.starts,
    a.sub_appearances,
    round(a.starts::numeric / NULLIF(a.appearances, 0)::numeric * 100::numeric, 2) AS starter_rate_pct,
    a.total_minutes,
    round(a.total_minutes::numeric / NULLIF(a.appearances, 0)::numeric, 2) AS avg_minutes,
    a.goals,
    a.assists,
    a.first_match_datetime,
    a.last_match_datetime
   FROM agg a
     LEFT JOIN pos_ranked pr ON pr.team_source_id = a.team_source_id AND pr.season_label = a.season_label AND pr.player_source_id = a.player_source_id AND pr.rn = 1;

-- analytics.tff1_player_match_log_v1
create or replace view analytics.tff1_player_match_log_v1 as
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
  WHERE d.source = 'sofascore'::text AND (m.competition IS NULL OR (m.competition <> ALL (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])));

-- analytics.tff1_player_season_stats_v1
create or replace view analytics.tff1_player_season_stats_v1 as
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
          WHERE d.source = 'sofascore'::text AND m.competition = 'Trendyol 1. Lig'::text
        ), fs_agg AS (
         SELECT m.season_label,
            fmap.sofascore_player_id AS player_id,
            round(sum((d.raw_stats ->> 'EXPECTED_GOALS'::text)::numeric), 2) AS xg,
            round(sum((d.raw_stats ->> 'EXPECTED_GOALS_ON_TARGET'::text)::numeric), 2) AS xgot,
            round(sum((d.raw_stats ->> 'EXPECTED_ASSISTS'::text)::numeric), 2) AS xa,
            mode() WITHIN GROUP (ORDER BY (d.raw_stats ->> '_position'::text)) AS fs_position
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
             JOIN ref.flashscore_player_map fmap ON fmap.flashscore_player_id = d.source_player_id
          WHERE d.source = 'flashscore'::text AND m.competition = 'Trendyol 1. Lig'::text
          GROUP BY m.season_label, fmap.sofascore_player_id
        ), card_agg AS (
         SELECT m.season_label,
            pc.source_player_id AS player_id,
            count(*) FILTER (WHERE pc.card_class = 'yellow'::text) AS yellow_cards,
            count(*) FILTER (WHERE pc.card_class = ANY (ARRAY['red'::text, 'yellowRed'::text])) AS red_cards
           FROM football.match_player_cards pc
             JOIN football.matches m ON m.source = pc.source AND m.source_match_id = pc.source_match_id
          WHERE pc.source = 'sofascore'::text AND pc.on_pitch AND NOT pc.rescinded AND m.competition = 'Trendyol 1. Lig'::text
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

-- analytics.tff1_team_season_stats_v1
create or replace view analytics.tff1_team_season_stats_v1 as
 WITH team_matches AS (
         SELECT matches.season_label,
            matches.home_team_source_id AS team_id,
            matches.home_team_name AS team_name,
            matches.home_score AS gf,
            matches.away_score AS ga
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'Trendyol 1. Lig'::text
        UNION ALL
         SELECT matches.season_label,
            matches.away_team_source_id,
            matches.away_team_name,
            matches.away_score,
            matches.home_score
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'Trendyol 1. Lig'::text
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
          WHERE d.source = 'sofascore'::text AND m.competition = 'Trendyol 1. Lig'::text
          GROUP BY m.season_label, d.source_team_id
        ), team_xg AS (
         SELECT tff1_player_season_stats_mat.season_label,
            tff1_player_season_stats_mat.team_id,
            round(sum(tff1_player_season_stats_mat.xg), 2) AS xg
           FROM analytics.tff1_player_season_stats_mat
          WHERE tff1_player_season_stats_mat.xg IS NOT NULL
          GROUP BY tff1_player_season_stats_mat.season_label, tff1_player_season_stats_mat.team_id
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

-- analytics.tsl_player_advanced_season_v1
create or replace view analytics.tsl_player_advanced_season_v1 as
 WITH fs AS (
         SELECT m.season_label,
            fmap.opta_player_id,
            round(sum((d.raw_stats ->> 'EXPECTED_GOALS_ON_TARGET'::text)::numeric), 2) AS xgot,
            round(sum((d.raw_stats ->> 'EXPECTED_ASSISTS'::text)::numeric), 2) AS xa,
            sum(COALESCE((d.raw_stats ->> 'KEY_PASSES'::text)::integer, 0)) AS key_passes,
            sum(COALESCE((d.raw_stats ->> 'LONG_BALLS_TOTAL'::text)::integer, 0)) AS long_balls,
            sum(COALESCE((d.raw_stats ->> 'LONG_BALLS_ACCURATE'::text)::integer, 0)) AS accurate_long_balls,
            sum(COALESCE((d.raw_stats ->> 'DUELS_WON'::text)::integer, 0)) AS duels_won,
            sum(COALESCE((d.raw_stats ->> 'DUELS_TOTAL'::text)::integer, 0) - COALESCE((d.raw_stats ->> 'DUELS_WON'::text)::integer, 0)) AS duels_lost,
            sum(COALESCE((d.raw_stats ->> 'DUELS_AERIAL_WON'::text)::integer, 0)) AS aerials_won,
            sum(COALESCE((d.raw_stats ->> 'DUELS_AERIAL_TOTAL'::text)::integer, 0) - COALESCE((d.raw_stats ->> 'DUELS_AERIAL_WON'::text)::integer, 0)) AS aerials_lost,
            sum(COALESCE((d.raw_stats ->> 'DRIBBLES_WON'::text)::integer, 0)) AS dribbles_won,
            sum(COALESCE((d.raw_stats ->> 'DRIBBLES_TOTAL'::text)::integer, 0)) AS dribbles_attempted,
            sum(COALESCE((d.raw_stats ->> 'CLEARANCES'::text)::integer, 0)) AS clearances,
            sum(COALESCE((d.raw_stats ->> 'BALL_RECOVERIES'::text)::integer, 0)) AS ball_recoveries,
            sum(COALESCE((d.raw_stats ->> 'BIG_CHANCES_CREATED'::text)::integer, 0)) AS big_chances_created,
            sum(COALESCE((d.raw_stats ->> 'BIG_CHANCES_MISSED'::text)::integer, 0)) AS big_chances_missed,
            sum(COALESCE((d.raw_stats ->> 'ERRORS_LEAD_TO_SHOT'::text)::integer, 0)) AS errors_leading_to_shot,
            sum(COALESCE((d.raw_stats ->> 'ERRORS_LEAD_TO_GOAL'::text)::integer, 0)) AS errors_leading_to_goal
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
             JOIN ref.flashscore_player_map fmap ON fmap.flashscore_player_id = d.source_player_id AND fmap.opta_player_id IS NOT NULL
          WHERE d.source = 'flashscore'::text AND m.competition = 'Süper Lig'::text
          GROUP BY m.season_label, fmap.opta_player_id
        ), sofa AS (
         SELECT m.season_label,
            smap.opta_player_id,
            count(*) FILTER (WHERE COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0) > 0) AS appearances,
            sum(COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0)) AS minutes,
            round(sum((d.raw_stats ->> 'expectedGoalsOnTarget'::text)::numeric), 2) AS xgot,
            round(sum((d.raw_stats ->> 'expectedAssists'::text)::numeric), 2) AS xa,
            sum(COALESCE((d.raw_stats ->> 'keyPass'::text)::integer, 0)) AS key_passes,
            sum(COALESCE((d.raw_stats ->> 'totalLongBalls'::text)::integer, 0)) AS long_balls,
            sum(COALESCE((d.raw_stats ->> 'accurateLongBalls'::text)::integer, 0)) AS accurate_long_balls,
            sum(COALESCE((d.raw_stats ->> 'duelWon'::text)::integer, 0)) AS duels_won,
            sum(COALESCE((d.raw_stats ->> 'duelLost'::text)::integer, 0)) AS duels_lost,
            sum(COALESCE((d.raw_stats ->> 'aerialWon'::text)::integer, 0)) AS aerials_won,
            sum(COALESCE((d.raw_stats ->> 'aerialLost'::text)::integer, 0)) AS aerials_lost,
            sum(COALESCE((d.raw_stats ->> 'wonContest'::text)::integer, 0)) AS dribbles_won,
            sum(COALESCE((d.raw_stats ->> 'totalContest'::text)::integer, 0)) AS dribbles_attempted,
            sum(COALESCE((d.raw_stats ->> 'totalClearance'::text)::integer, 0)) AS clearances,
            sum(COALESCE((d.raw_stats ->> 'ballRecovery'::text)::integer, 0)) AS ball_recoveries,
            sum(COALESCE((d.raw_stats ->> 'bigChanceCreated'::text)::integer, 0)) AS big_chances_created,
            sum(COALESCE((d.raw_stats ->> 'bigChanceMissed'::text)::integer, 0)) AS big_chances_missed,
            sum(COALESCE((d.raw_stats ->> 'errorLeadToAShot'::text)::integer, 0)) AS errors_leading_to_shot,
            sum(COALESCE((d.raw_stats ->> 'errorLeadToAGoal'::text)::integer, 0)) AS errors_leading_to_goal,
            round(sum((d.raw_stats ->> 'kilometersCovered'::text)::numeric), 1) AS km_covered,
            sum((d.raw_stats ->> 'numberOfSprints'::text)::integer) AS sprints,
            max((d.raw_stats ->> 'topSpeed'::text)::numeric) AS top_speed,
            round(sum((d.raw_stats ->> 'totalBallCarriesDistance'::text)::numeric)) AS carry_distance_m,
            round(sum((d.raw_stats ->> 'totalProgressiveBallCarriesDistance'::text)::numeric)) AS progressive_carry_distance_m
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
             JOIN ref.sofascore_opta_player_map smap ON smap.sofascore_player_id = d.source_player_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'Süper Lig'::text
          GROUP BY m.season_label, smap.opta_player_id
        )
 SELECT COALESCE(fs.season_label, sofa.season_label) AS season_label,
    COALESCE(fs.opta_player_id, sofa.opta_player_id) AS opta_player_id,
    sofa.appearances,
    sofa.minutes,
    COALESCE(fs.xgot, sofa.xgot) AS xgot,
    COALESCE(fs.xa, sofa.xa) AS xa,
    COALESCE(fs.key_passes, sofa.key_passes) AS key_passes,
    COALESCE(fs.long_balls, sofa.long_balls) AS long_balls,
    COALESCE(fs.accurate_long_balls, sofa.accurate_long_balls) AS accurate_long_balls,
    COALESCE(fs.duels_won, sofa.duels_won) AS duels_won,
    COALESCE(fs.duels_lost, sofa.duels_lost) AS duels_lost,
    COALESCE(fs.aerials_won, sofa.aerials_won) AS aerials_won,
    COALESCE(fs.aerials_lost, sofa.aerials_lost) AS aerials_lost,
    COALESCE(fs.dribbles_won, sofa.dribbles_won) AS dribbles_won,
    COALESCE(fs.dribbles_attempted, sofa.dribbles_attempted) AS dribbles_attempted,
    COALESCE(fs.clearances, sofa.clearances) AS clearances,
    COALESCE(fs.ball_recoveries, sofa.ball_recoveries) AS ball_recoveries,
    COALESCE(fs.big_chances_created, sofa.big_chances_created) AS big_chances_created,
    COALESCE(fs.big_chances_missed, sofa.big_chances_missed) AS big_chances_missed,
    COALESCE(fs.errors_leading_to_shot, sofa.errors_leading_to_shot) AS errors_leading_to_shot,
    COALESCE(fs.errors_leading_to_goal, sofa.errors_leading_to_goal) AS errors_leading_to_goal,
    sofa.km_covered,
    sofa.sprints,
    sofa.top_speed,
    sofa.carry_distance_m,
    sofa.progressive_carry_distance_m
   FROM fs
     FULL JOIN sofa ON sofa.season_label = fs.season_label AND sofa.opta_player_id = fs.opta_player_id;

-- analytics.tsl_player_flashscore_season_v1
create or replace view analytics.tsl_player_flashscore_season_v1 as
 SELECT m.season_label,
    fmap.opta_player_id,
    max(d.player_name) AS fs_player_name,
    count(*) FILTER (WHERE COALESCE((d.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text)::integer, 0) > 0) AS appearances,
    sum(COALESCE((d.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text)::integer, 0)) AS minutes,
    sum(COALESCE((d.raw_stats ->> 'GOALS'::text)::integer, 0)) AS goals,
    sum(COALESCE((d.raw_stats ->> 'ASSISTS_GOAL'::text)::integer, 0)) AS assists,
    round(sum((d.raw_stats ->> 'EXPECTED_GOALS'::text)::numeric), 2) AS xg,
    round(sum((d.raw_stats ->> 'EXPECTED_GOALS_ON_TARGET'::text)::numeric), 2) AS xgot,
    round(sum((d.raw_stats ->> 'EXPECTED_ASSISTS'::text)::numeric), 2) AS xa,
    sum(COALESCE((d.raw_stats ->> 'SHOTS_TOTAL'::text)::integer, 0)) AS shots,
    sum(COALESCE((d.raw_stats ->> 'SHOTS_ON_TARGET'::text)::integer, 0)) AS shots_on_target,
    sum(COALESCE((d.raw_stats ->> 'BIG_CHANCES_CREATED'::text)::integer, 0)) AS big_chances_created,
    sum(COALESCE((d.raw_stats ->> 'BIG_CHANCES_MISSED'::text)::integer, 0)) AS big_chances_missed,
    sum(COALESCE((d.raw_stats ->> 'KEY_PASSES'::text)::integer, 0)) AS key_passes,
    sum(COALESCE((d.raw_stats ->> 'PROGRESSIVE_PASSES_ACCURATE'::text)::integer, 0)) AS progressive_passes,
    sum(COALESCE((d.raw_stats ->> 'PROGRESSIVE_CARRIES'::text)::integer, 0)) AS progressive_carries,
    sum(COALESCE((d.raw_stats ->> 'BOX_ENTRIES_ACCURATE'::text)::integer, 0)) AS box_entries,
    sum(COALESCE((d.raw_stats ->> 'FINAL_THIRD_ENTRIES_SUCCESSFUL'::text)::integer, 0)) AS final_third_entries,
    sum(COALESCE((d.raw_stats ->> 'TOUCHES_TOTAL'::text)::integer, 0)) AS touches,
    sum(COALESCE((d.raw_stats ->> 'TOUCHES_BOX_OPPOSITE'::text)::integer, 0)) AS touches_opp_box,
    sum(COALESCE((d.raw_stats ->> 'CARDS_YELLOW'::text)::integer, 0)) AS yellow_cards,
    sum(COALESCE((d.raw_stats ->> 'CARDS_RED'::text)::integer, 0)) AS red_cards,
    round(sum((d.raw_stats ->> 'GOALS_PREVENTED'::text)::numeric), 2) AS goals_prevented,
    round(avg((d.raw_stats ->> '_rating'::text)::numeric) FILTER (WHERE COALESCE((d.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text)::integer, 0) > 0), 2) AS rating_avg
   FROM football.match_player_stats_details d
     JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
     JOIN ref.flashscore_player_map fmap ON fmap.flashscore_player_id = d.source_player_id AND fmap.opta_player_id IS NOT NULL
  WHERE d.source = 'flashscore'::text AND m.competition = 'Süper Lig'::text
  GROUP BY m.season_label, fmap.opta_player_id;

-- analytics.tsl_ss_player_detailed_metrics_v1
create or replace view analytics.tsl_ss_player_detailed_metrics_v1 as
 WITH pm_match AS (
         SELECT pmap.opta_player_id AS player_source_id,
            m.season_label,
            d.source_match_id,
            d.source_team_id,
            d.team_name,
            d.player_name,
            d.position_code,
            m.match_datetime,
            COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::numeric, 0::numeric) AS minutes,
            d.lineup_status = 'starter'::text AS is_start,
            m.home_team_source_id = d.source_team_id AS is_home,
            d.raw_stats
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
             JOIN ref.sofascore_opta_player_map pmap ON pmap.sofascore_player_id = d.source_player_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'Süper Lig'::text
        ), psum AS (
         SELECT pm_match.player_source_id,
            pm_match.season_label,
            pm_match.source_team_id,
            (array_agg(pm_match.team_name ORDER BY pm_match.match_datetime DESC))[1] AS team_name,
            (array_agg(pm_match.player_name ORDER BY pm_match.match_datetime DESC))[1] AS player_name,
            mode() WITHIN GROUP (ORDER BY pm_match.position_code) AS position_code,
            count(DISTINCT pm_match.source_match_id) FILTER (WHERE pm_match.minutes > 0::numeric) AS apps,
            count(DISTINCT pm_match.source_match_id) FILTER (WHERE pm_match.is_start) AS starts,
            sum(pm_match.minutes) AS tot_min,
            sum((pm_match.raw_stats ->> 'onTargetScoringAttempt'::text)::numeric) AS sot,
            sum((pm_match.raw_stats ->> 'totalShots'::text)::numeric) AS sh,
            sum((pm_match.raw_stats ->> 'accuratePass'::text)::numeric) AS acc_pass,
            sum((pm_match.raw_stats ->> 'totalPass'::text)::numeric) AS tot_pass,
            sum((pm_match.raw_stats ->> 'expectedGoals'::text)::numeric) AS xg
           FROM pm_match
          GROUP BY pm_match.player_source_id, pm_match.season_label, pm_match.source_team_id
        ), direct AS (
         SELECT b.player_source_id,
            b.season_label,
            b.source_team_id,
            b.source_match_id,
            b.match_datetime,
            b.minutes,
            b.is_home,
            c.metric_key,
            c.agg_kind,
            c.per90_eligible,
                CASE
                    WHEN c.agg_kind = 'sum'::text THEN COALESCE((b.raw_stats ->> c.sofa_key)::numeric, 0::numeric)
                    ELSE (b.raw_stats ->> c.sofa_key)::numeric
                END AS val
           FROM pm_match b
             JOIN analytics.tsl_ss_metric_catalog_v1 c ON c.source_note = 'sofascore'::text AND (c.agg_kind = ANY (ARRAY['sum'::text, 'avg'::text, 'max'::text]))
        ), direct_agg AS (
         SELECT direct.player_source_id,
            direct.season_label,
            direct.source_team_id,
            direct.metric_key,
            max(direct.agg_kind) AS agg_kind,
            bool_or(direct.per90_eligible) AS per90_eligible,
            count(DISTINCT direct.source_match_id) FILTER (WHERE direct.minutes > 0::numeric) AS apps,
            count(DISTINCT direct.source_match_id) FILTER (WHERE direct.val IS NOT NULL AND direct.minutes > 0::numeric) AS sample_matches,
            sum(direct.val) AS sum_all,
            sum(direct.val) FILTER (WHERE direct.is_home) AS home_sum,
            sum(direct.val) FILTER (WHERE NOT direct.is_home) AS away_sum,
            sum(direct.minutes) FILTER (WHERE direct.val IS NOT NULL AND direct.minutes > 0::numeric) AS min_all,
            round(avg(direct.val) FILTER (WHERE direct.minutes > 0::numeric), 2) AS avg_val,
            max(direct.val) AS max_val
           FROM direct
          GROUP BY direct.player_source_id, direct.season_label, direct.source_team_id, direct.metric_key
        ), last5 AS (
         SELECT t.player_source_id,
            t.season_label,
            t.source_team_id,
            t.metric_key,
            round(avg(t.val), 2) AS last5_value
           FROM ( SELECT d.player_source_id,
                    d.season_label,
                    d.source_team_id,
                    d.source_match_id,
                    d.match_datetime,
                    d.minutes,
                    d.is_home,
                    d.metric_key,
                    d.agg_kind,
                    d.per90_eligible,
                    d.val,
                    row_number() OVER (PARTITION BY d.player_source_id, d.season_label, d.source_team_id, d.metric_key ORDER BY d.match_datetime DESC) AS rn
                   FROM direct d
                  WHERE d.minutes > 0::numeric) t
          WHERE t.rn <= 5
          GROUP BY t.player_source_id, t.season_label, t.source_team_id, t.metric_key
        ), direct_rows AS (
         SELECT a.season_label,
            'Süper Lig'::text AS competition,
            a.player_source_id,
            a.metric_key,
            p.player_name,
            p.position_code,
                CASE "left"(COALESCE(p.position_code, ''::text), 1)
                    WHEN 'G'::text THEN 'goalkeeper'::text
                    WHEN 'D'::text THEN 'defender'::text
                    WHEN 'M'::text THEN 'midfielder'::text
                    WHEN 'F'::text THEN 'forward'::text
                    ELSE NULL::text
                END AS role_group,
            a.source_team_id,
            NULL::text AS team_slug,
            p.team_name,
            c.metric_label,
            c.category_key,
            c.category_label,
            c.display_priority,
                CASE a.agg_kind
                    WHEN 'sum'::text THEN a.sum_all
                    WHEN 'avg'::text THEN a.avg_val
                    WHEN 'max'::text THEN a.max_val
                    ELSE NULL::numeric
                END AS total_value,
            a.sample_matches,
                CASE a.agg_kind
                    WHEN 'sum'::text THEN
                    CASE
                        WHEN a.apps > 0 THEN round(a.sum_all / a.apps::numeric, 2)
                        ELSE NULL::numeric
                    END
                    ELSE
                    CASE a.agg_kind
                        WHEN 'avg'::text THEN a.avg_val
                        ELSE a.max_val
                    END
                END AS per_match_value,
                CASE
                    WHEN a.agg_kind = 'sum'::text AND a.per90_eligible AND a.min_all > 0::numeric THEN round(a.sum_all / a.min_all * 90::numeric, 3)
                    ELSE NULL::numeric
                END AS per90_value,
                CASE
                    WHEN a.agg_kind = 'sum'::text THEN a.home_sum
                    ELSE NULL::numeric
                END AS home_value,
                CASE
                    WHEN a.agg_kind = 'sum'::text THEN a.away_sum
                    ELSE NULL::numeric
                END AS away_value,
            l.last5_value,
            c.is_higher_better,
            c.rank_direction,
            c.value_format,
            a.sample_matches > 0 AS coverage_flag
           FROM direct_agg a
             JOIN psum p USING (player_source_id, season_label, source_team_id)
             JOIN analytics.tsl_ss_metric_catalog_v1 c USING (metric_key)
             LEFT JOIN last5 l USING (player_source_id, season_label, source_team_id, metric_key)
        ), derived_rows AS (
         SELECT p.season_label,
            'Süper Lig'::text AS competition,
            p.player_source_id,
            c.metric_key,
            p.player_name,
            p.position_code,
                CASE "left"(COALESCE(p.position_code, ''::text), 1)
                    WHEN 'G'::text THEN 'goalkeeper'::text
                    WHEN 'D'::text THEN 'defender'::text
                    WHEN 'M'::text THEN 'midfielder'::text
                    WHEN 'F'::text THEN 'forward'::text
                    ELSE NULL::text
                END AS role_group,
            p.source_team_id,
            NULL::text AS team_slug,
            p.team_name,
            c.metric_label,
            c.category_key,
            c.category_label,
            c.display_priority,
                CASE c.metric_key
                    WHEN 'appearances'::text THEN p.apps::numeric
                    WHEN 'starts'::text THEN p.starts::numeric
                    WHEN 'starter_rate_pct'::text THEN
                    CASE
                        WHEN p.apps > 0 THEN round(100.0 * p.starts::numeric / p.apps::numeric, 1)
                        ELSE NULL::numeric
                    END
                    WHEN 'total_minutes'::text THEN p.tot_min
                    WHEN 'avg_minutes'::text THEN
                    CASE
                        WHEN p.apps > 0 THEN round(p.tot_min / p.apps::numeric, 1)
                        ELSE NULL::numeric
                    END
                    WHEN 'shot_accuracy_pct'::text THEN
                    CASE
                        WHEN p.sh > 0::numeric THEN round(100.0 * p.sot / p.sh, 1)
                        ELSE NULL::numeric
                    END
                    WHEN 'pass_accuracy_pct'::text THEN
                    CASE
                        WHEN p.tot_pass > 0::numeric THEN round(100.0 * p.acc_pass / p.tot_pass, 1)
                        ELSE NULL::numeric
                    END
                    WHEN 'xg_per90'::text THEN
                    CASE
                        WHEN p.tot_min > 0::numeric THEN round(p.xg / p.tot_min * 90::numeric, 2)
                        ELSE NULL::numeric
                    END
                    ELSE NULL::numeric
                END AS total_value,
            p.apps AS sample_matches,
                CASE c.metric_key
                    WHEN 'appearances'::text THEN p.apps::numeric
                    WHEN 'starts'::text THEN p.starts::numeric
                    WHEN 'starter_rate_pct'::text THEN
                    CASE
                        WHEN p.apps > 0 THEN round(100.0 * p.starts::numeric / p.apps::numeric, 1)
                        ELSE NULL::numeric
                    END
                    WHEN 'total_minutes'::text THEN p.tot_min
                    WHEN 'avg_minutes'::text THEN
                    CASE
                        WHEN p.apps > 0 THEN round(p.tot_min / p.apps::numeric, 1)
                        ELSE NULL::numeric
                    END
                    WHEN 'shot_accuracy_pct'::text THEN
                    CASE
                        WHEN p.sh > 0::numeric THEN round(100.0 * p.sot / p.sh, 1)
                        ELSE NULL::numeric
                    END
                    WHEN 'pass_accuracy_pct'::text THEN
                    CASE
                        WHEN p.tot_pass > 0::numeric THEN round(100.0 * p.acc_pass / p.tot_pass, 1)
                        ELSE NULL::numeric
                    END
                    WHEN 'xg_per90'::text THEN
                    CASE
                        WHEN p.tot_min > 0::numeric THEN round(p.xg / p.tot_min * 90::numeric, 2)
                        ELSE NULL::numeric
                    END
                    ELSE NULL::numeric
                END AS per_match_value,
            NULL::numeric AS per90_value,
            NULL::numeric AS home_value,
            NULL::numeric AS away_value,
            NULL::numeric AS last5_value,
            c.is_higher_better,
            c.rank_direction,
            c.value_format,
            true AS coverage_flag
           FROM psum p
             JOIN analytics.tsl_ss_metric_catalog_v1 c ON c.agg_kind = 'derived'::text
        ), fs_match AS (
         SELECT b.player_source_id,
            b.season_label,
            b.source_match_id,
            b.source_team_id,
            b.team_name,
            b.player_name,
            b.match_datetime,
            b.minutes,
            b.is_home,
            COALESCE(pc.yellow, 0::bigint) AS yellow,
            COALESCE(pc.red, 0::bigint) AS red
           FROM pm_match b
             LEFT JOIN ( SELECT m.season_label,
                    smap.opta_player_id,
                    pc0.source_match_id,
                    count(*) FILTER (WHERE pc0.card_class = 'yellow'::text) AS yellow,
                    count(*) FILTER (WHERE pc0.card_class = ANY (ARRAY['red'::text, 'yellowRed'::text])) AS red
                   FROM football.match_player_cards pc0
                     JOIN football.matches m ON m.source = pc0.source AND m.source_match_id = pc0.source_match_id
                     JOIN ref.sofascore_opta_player_map smap ON smap.sofascore_player_id = pc0.source_player_id AND smap.opta_player_id IS NOT NULL
                  WHERE pc0.source = 'sofascore'::text AND pc0.on_pitch AND NOT pc0.rescinded AND m.competition = 'Süper Lig'::text
                  GROUP BY m.season_label, smap.opta_player_id, pc0.source_match_id) pc ON pc.source_match_id = b.source_match_id AND pc.opta_player_id = b.player_source_id
        ), fs_card_long AS (
         SELECT fs_match.player_source_id,
            fs_match.season_label,
            fs_match.source_team_id,
            fs_match.team_name,
            fs_match.player_name,
            fs_match.source_match_id,
            fs_match.match_datetime,
            fs_match.minutes,
            fs_match.is_home,
            x.metric_key,
            x.val
           FROM fs_match
             CROSS JOIN LATERAL ( VALUES ('cards_yellow_total'::text,fs_match.yellow), ('cards_red_total'::text,fs_match.red)) x(metric_key, val)
        ), fs_card_agg AS (
         SELECT fs_card_long.player_source_id,
            fs_card_long.season_label,
            fs_card_long.source_team_id,
            fs_card_long.metric_key,
            (array_agg(fs_card_long.team_name ORDER BY fs_card_long.match_datetime DESC))[1] AS team_name,
            (array_agg(fs_card_long.player_name ORDER BY fs_card_long.match_datetime DESC))[1] AS player_name,
            count(DISTINCT fs_card_long.source_match_id) FILTER (WHERE fs_card_long.minutes > 0::numeric) AS apps,
            count(DISTINCT fs_card_long.source_match_id) FILTER (WHERE fs_card_long.minutes > 0::numeric) AS sample_matches,
            sum(fs_card_long.val) AS sum_all,
            sum(fs_card_long.val) FILTER (WHERE fs_card_long.is_home) AS home_sum,
            sum(fs_card_long.val) FILTER (WHERE NOT fs_card_long.is_home) AS away_sum,
            sum(fs_card_long.minutes) FILTER (WHERE fs_card_long.minutes > 0::numeric) AS min_all
           FROM fs_card_long
          GROUP BY fs_card_long.player_source_id, fs_card_long.season_label, fs_card_long.source_team_id, fs_card_long.metric_key
        ), fs_card_last5 AS (
         SELECT t.player_source_id,
            t.season_label,
            t.source_team_id,
            t.metric_key,
            round(avg(t.val), 2) AS last5_value
           FROM ( SELECT fcl.player_source_id,
                    fcl.season_label,
                    fcl.source_team_id,
                    fcl.team_name,
                    fcl.player_name,
                    fcl.source_match_id,
                    fcl.match_datetime,
                    fcl.minutes,
                    fcl.is_home,
                    fcl.metric_key,
                    fcl.val,
                    row_number() OVER (PARTITION BY fcl.player_source_id, fcl.season_label, fcl.source_team_id, fcl.metric_key ORDER BY fcl.match_datetime DESC) AS rn
                   FROM fs_card_long fcl
                  WHERE fcl.minutes > 0::numeric) t
          WHERE t.rn <= 5
          GROUP BY t.player_source_id, t.season_label, t.source_team_id, t.metric_key
        ), fs_card_rows AS (
         SELECT a.season_label,
            'Süper Lig'::text AS competition,
            a.player_source_id,
            a.metric_key,
            a.player_name,
            NULL::text AS position_code,
            NULL::text AS role_group,
            a.source_team_id,
            NULL::text AS team_slug,
            a.team_name,
            c.metric_label,
            c.category_key,
            c.category_label,
            c.display_priority,
            a.sum_all AS total_value,
            a.sample_matches,
                CASE
                    WHEN a.apps > 0 THEN round(a.sum_all / a.apps::numeric, 2)
                    ELSE NULL::numeric
                END AS per_match_value,
                CASE
                    WHEN a.min_all > 0::numeric THEN round(a.sum_all / a.min_all * 90::numeric, 3)
                    ELSE NULL::numeric
                END AS per90_value,
            a.home_sum AS home_value,
            a.away_sum AS away_value,
            l.last5_value,
            c.is_higher_better,
            c.rank_direction,
            c.value_format,
            a.sample_matches > 0 AS coverage_flag
           FROM fs_card_agg a
             JOIN analytics.tsl_ss_metric_catalog_v1 c USING (metric_key)
             LEFT JOIN fs_card_last5 l USING (player_source_id, season_label, source_team_id, metric_key)
        )
 SELECT direct_rows.season_label,
    direct_rows.competition,
    direct_rows.player_source_id,
    direct_rows.metric_key,
    direct_rows.player_name,
    direct_rows.position_code,
    direct_rows.role_group,
    direct_rows.source_team_id,
    direct_rows.team_slug,
    direct_rows.team_name,
    direct_rows.metric_label,
    direct_rows.category_key,
    direct_rows.category_label,
    direct_rows.display_priority,
    direct_rows.total_value,
    direct_rows.sample_matches,
    direct_rows.per_match_value,
    direct_rows.per90_value,
    direct_rows.home_value,
    direct_rows.away_value,
    direct_rows.last5_value,
    direct_rows.is_higher_better,
    direct_rows.rank_direction,
    direct_rows.value_format,
    direct_rows.coverage_flag
   FROM direct_rows
UNION ALL
 SELECT derived_rows.season_label,
    derived_rows.competition,
    derived_rows.player_source_id,
    derived_rows.metric_key,
    derived_rows.player_name,
    derived_rows.position_code,
    derived_rows.role_group,
    derived_rows.source_team_id,
    derived_rows.team_slug,
    derived_rows.team_name,
    derived_rows.metric_label,
    derived_rows.category_key,
    derived_rows.category_label,
    derived_rows.display_priority,
    derived_rows.total_value,
    derived_rows.sample_matches,
    derived_rows.per_match_value,
    derived_rows.per90_value,
    derived_rows.home_value,
    derived_rows.away_value,
    derived_rows.last5_value,
    derived_rows.is_higher_better,
    derived_rows.rank_direction,
    derived_rows.value_format,
    derived_rows.coverage_flag
   FROM derived_rows
UNION ALL
 SELECT fs_card_rows.season_label,
    fs_card_rows.competition,
    fs_card_rows.player_source_id,
    fs_card_rows.metric_key,
    fs_card_rows.player_name,
    fs_card_rows.position_code,
    fs_card_rows.role_group,
    fs_card_rows.source_team_id,
    fs_card_rows.team_slug,
    fs_card_rows.team_name,
    fs_card_rows.metric_label,
    fs_card_rows.category_key,
    fs_card_rows.category_label,
    fs_card_rows.display_priority,
    fs_card_rows.total_value,
    fs_card_rows.sample_matches,
    fs_card_rows.per_match_value,
    fs_card_rows.per90_value,
    fs_card_rows.home_value,
    fs_card_rows.away_value,
    fs_card_rows.last5_value,
    fs_card_rows.is_higher_better,
    fs_card_rows.rank_direction,
    fs_card_rows.value_format,
    fs_card_rows.coverage_flag
   FROM fs_card_rows;

-- analytics.tsl_ss_team_detailed_metrics_v1
create or replace view analytics.tsl_ss_team_detailed_metrics_v1 as
 WITH tm AS (
         SELECT m.season_label,
            d.source_team_id,
            m.source_match_id,
            m.match_datetime,
            m.home_team_source_id = d.source_team_id AS is_home,
                CASE
                    WHEN m.home_team_source_id = d.source_team_id THEN m.home_score
                    ELSE m.away_score
                END AS goals_for,
                CASE
                    WHEN m.home_team_source_id = d.source_team_id THEN m.away_score
                    ELSE m.home_score
                END AS goals_against,
            (array_agg(d.team_name ORDER BY d.source_player_id))[1] AS team_name,
            COALESCE(sum((d.raw_stats ->> 'expectedGoals'::text)::numeric), 0::numeric) AS xg,
            COALESCE(sum((d.raw_stats ->> 'totalShots'::text)::numeric), 0::numeric) AS shots,
            COALESCE(sum((d.raw_stats ->> 'onTargetScoringAttempt'::text)::numeric), 0::numeric) AS sot,
            COALESCE(sum((d.raw_stats ->> 'totalPass'::text)::numeric), 0::numeric) AS passes,
            COALESCE(sum((d.raw_stats ->> 'accuratePass'::text)::numeric), 0::numeric) AS acc_pass,
            COALESCE(sum((d.raw_stats ->> 'totalTackle'::text)::numeric), 0::numeric) AS tackles,
            COALESCE(sum((d.raw_stats ->> 'interceptionWon'::text)::numeric), 0::numeric) AS interceptions,
            COALESCE(sum((d.raw_stats ->> 'fouls'::text)::numeric), 0::numeric) AS fouls,
            COALESCE(sum((d.raw_stats ->> 'wasFouled'::text)::numeric), 0::numeric) AS fouls_won,
            COALESCE(sum((d.raw_stats ->> 'totalOffside'::text)::numeric), 0::numeric) AS offsides,
            COALESCE(sum((d.raw_stats ->> 'saves'::text)::numeric), 0::numeric) AS saves
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'Süper Lig'::text
          GROUP BY m.season_label, d.source_team_id, m.source_match_id, m.match_datetime, (m.home_team_source_id = d.source_team_id), (
                CASE
                    WHEN m.home_team_source_id = d.source_team_id THEN m.home_score
                    ELSE m.away_score
                END), (
                CASE
                    WHEN m.home_team_source_id = d.source_team_id THEN m.away_score
                    ELSE m.home_score
                END)
        ), tmo AS (
         SELECT a.season_label,
            a.source_team_id,
            a.source_match_id,
            a.match_datetime,
            a.is_home,
            a.goals_for,
            a.goals_against,
            a.team_name,
            a.xg,
            a.shots,
            a.sot,
            a.passes,
            a.acc_pass,
            a.tackles,
            a.interceptions,
            a.fouls,
            a.fouls_won,
            a.offsides,
            a.saves,
            COALESCE(b.shots, 0::numeric) AS shots_against,
            COALESCE(b.sot, 0::numeric) AS sot_against
           FROM tm a
             LEFT JOIN tm b ON b.source_match_id = a.source_match_id AND b.source_team_id <> a.source_team_id
        ), season AS (
         SELECT tmo.season_label,
            tmo.source_team_id,
            (array_agg(tmo.team_name ORDER BY tmo.match_datetime DESC))[1] AS team_name,
            count(*) AS matches,
            sum(tmo.goals_for) AS gf,
            sum(tmo.goals_for) FILTER (WHERE tmo.is_home) AS gf_h,
            sum(tmo.goals_for) FILTER (WHERE NOT tmo.is_home) AS gf_a,
            sum(tmo.goals_against) AS ga,
            sum(tmo.goals_against) FILTER (WHERE tmo.is_home) AS ga_h,
            sum(tmo.goals_against) FILTER (WHERE NOT tmo.is_home) AS ga_a,
            sum(tmo.xg) AS xg,
            sum(tmo.xg) FILTER (WHERE tmo.is_home) AS xg_h,
            sum(tmo.xg) FILTER (WHERE NOT tmo.is_home) AS xg_a,
            sum(tmo.shots) AS sh,
            sum(tmo.shots) FILTER (WHERE tmo.is_home) AS sh_h,
            sum(tmo.shots) FILTER (WHERE NOT tmo.is_home) AS sh_a,
            sum(tmo.sot) AS sot,
            sum(tmo.sot) FILTER (WHERE tmo.is_home) AS sot_h,
            sum(tmo.sot) FILTER (WHERE NOT tmo.is_home) AS sot_a,
            sum(tmo.shots_against) AS sha,
            sum(tmo.shots_against) FILTER (WHERE tmo.is_home) AS sha_h,
            sum(tmo.shots_against) FILTER (WHERE NOT tmo.is_home) AS sha_a,
            sum(tmo.sot_against) AS sota,
            sum(tmo.sot_against) FILTER (WHERE tmo.is_home) AS sota_h,
            sum(tmo.sot_against) FILTER (WHERE NOT tmo.is_home) AS sota_a,
            sum(tmo.passes) AS pa,
            sum(tmo.passes) FILTER (WHERE tmo.is_home) AS pa_h,
            sum(tmo.passes) FILTER (WHERE NOT tmo.is_home) AS pa_a,
            sum(tmo.acc_pass) AS ap,
            sum(tmo.acc_pass) FILTER (WHERE tmo.is_home) AS ap_h,
            sum(tmo.acc_pass) FILTER (WHERE NOT tmo.is_home) AS ap_a,
            sum(tmo.tackles) AS tk,
            sum(tmo.tackles) FILTER (WHERE tmo.is_home) AS tk_h,
            sum(tmo.tackles) FILTER (WHERE NOT tmo.is_home) AS tk_a,
            sum(tmo.interceptions) AS it,
            sum(tmo.interceptions) FILTER (WHERE tmo.is_home) AS it_h,
            sum(tmo.interceptions) FILTER (WHERE NOT tmo.is_home) AS it_a,
            sum(tmo.fouls) AS fl,
            sum(tmo.fouls) FILTER (WHERE tmo.is_home) AS fl_h,
            sum(tmo.fouls) FILTER (WHERE NOT tmo.is_home) AS fl_a,
            sum(tmo.fouls_won) AS fw,
            sum(tmo.fouls_won) FILTER (WHERE tmo.is_home) AS fw_h,
            sum(tmo.fouls_won) FILTER (WHERE NOT tmo.is_home) AS fw_a,
            sum(tmo.offsides) AS of,
            sum(tmo.offsides) FILTER (WHERE tmo.is_home) AS of_h,
            sum(tmo.offsides) FILTER (WHERE NOT tmo.is_home) AS of_a,
            sum(tmo.saves) AS sv,
            sum(tmo.saves) FILTER (WHERE tmo.is_home) AS sv_h,
            sum(tmo.saves) FILTER (WHERE NOT tmo.is_home) AS sv_a
           FROM tmo
          GROUP BY tmo.season_label, tmo.source_team_id
        ), long AS (
         SELECT s.season_label,
            s.source_team_id,
            s.team_name,
            s.matches,
            x.metric_key,
            x.category_key,
            x.category_label,
            x.metric_label,
            x.rank_direction,
            x.value_format,
            x.is_derived,
            x.display_priority,
            x.total_value,
            x.home_value,
            x.away_value
           FROM season s
             CROSS JOIN LATERAL ( VALUES ('team_goals_for'::text,'attacking'::text,'Hücum'::text,'Attığı Gol'::text,'desc'::text,'count'::text,false,10,s.gf,s.gf_h,s.gf_a), ('team_goals_against'::text,'defending'::text,'Savunma'::text,'Yediği Gol'::text,'asc'::text,'count'::text,false,11,s.ga,s.ga_h,s.ga_a), ('team_expected_goals'::text,'attacking'::text,'Hücum'::text,'xG'::text,'desc'::text,'decimal'::text,false,12,round(s.xg, 2),round(s.xg_h, 2),round(s.xg_a, 2)), ('team_shots'::text,'attacking'::text,'Hücum'::text,'Şut'::text,'desc'::text,'count'::text,false,13,s.sh,s.sh_h,s.sh_a), ('team_shots_on_target'::text,'attacking'::text,'Hücum'::text,'İsabetli Şut'::text,'desc'::text,'count'::text,false,14,s.sot,s.sot_h,s.sot_a), ('team_shot_accuracy_pct'::text,'attacking'::text,'Hücum'::text,'İsabet %'::text,'desc'::text,'pct'::text,true,15,
                        CASE
                            WHEN s.sh > 0::numeric THEN round(100.0 * s.sot / s.sh, 1)
                            ELSE NULL::numeric
                        END,NULL::numeric,NULL::numeric), ('team_xg_per_shot'::text,'attacking'::text,'Hücum'::text,'Şut Başı xG'::text,'desc'::text,'decimal'::text,true,16,
                        CASE
                            WHEN s.sh > 0::numeric THEN round(s.xg / s.sh, 3)
                            ELSE NULL::numeric
                        END,NULL::numeric,NULL::numeric), ('team_shots_against'::text,'defending'::text,'Savunma'::text,'Rakip Şut'::text,'asc'::text,'count'::text,false,20,s.sha,s.sha_h,s.sha_a), ('team_shots_on_target_against'::text,'defending'::text,'Savunma'::text,'Rakip İsabetli Şut'::text,'asc'::text,'count'::text,false,21,s.sota,s.sota_h,s.sota_a), ('team_passes'::text,'build_up'::text,'Oyun Kurma'::text,'Pas'::text,'desc'::text,'count'::text,false,30,s.pa,s.pa_h,s.pa_a), ('team_accurate_pass'::text,'build_up'::text,'Oyun Kurma'::text,'İsabetli Pas'::text,'desc'::text,'count'::text,false,31,s.ap,s.ap_h,s.ap_a), ('team_pass_accuracy_pct'::text,'build_up'::text,'Oyun Kurma'::text,'Pas İsabet %'::text,'desc'::text,'pct'::text,true,32,
                        CASE
                            WHEN s.pa > 0::numeric THEN round(100.0 * s.ap / s.pa, 1)
                            ELSE NULL::numeric
                        END,NULL::numeric,NULL::numeric), ('team_tackles'::text,'defending'::text,'Savunma'::text,'Müdahale'::text,'desc'::text,'count'::text,false,40,s.tk,s.tk_h,s.tk_a), ('team_interceptions'::text,'defending'::text,'Savunma'::text,'Top Kapma'::text,'desc'::text,'count'::text,false,41,s.it,s.it_h,s.it_a), ('team_saves'::text,'defending'::text,'Savunma'::text,'Kurtarış'::text,'desc'::text,'count'::text,false,42,s.sv,s.sv_h,s.sv_a), ('team_fouls_conceded'::text,'discipline'::text,'Disiplin'::text,'Yapılan Faul'::text,'asc'::text,'count'::text,false,50,s.fl,s.fl_h,s.fl_a), ('team_fouls_won'::text,'discipline'::text,'Disiplin'::text,'Kazanılan Faul'::text,'desc'::text,'count'::text,false,51,s.fw,s.fw_h,s.fw_a), ('team_offsides'::text,'discipline'::text,'Disiplin'::text,'Ofsayt'::text,'asc'::text,'count'::text,false,52,s.of,s.of_h,s.of_a)) x(metric_key, category_key, category_label, metric_label, rank_direction, value_format, is_derived, display_priority, total_value, home_value, away_value)
        ), enr AS (
         SELECT long.season_label,
            long.source_team_id,
            long.team_name,
            long.matches,
            long.metric_key,
            long.category_key,
            long.category_label,
            long.metric_label,
            long.rank_direction,
            long.value_format,
            long.is_derived,
            long.display_priority,
            long.total_value,
            long.home_value,
            long.away_value,
                CASE
                    WHEN long.value_format = 'pct'::text OR long.is_derived THEN long.total_value
                    WHEN long.matches > 0 THEN round(long.total_value / long.matches::numeric, 2)
                    ELSE NULL::numeric
                END AS per_match_value,
            long.rank_direction <> 'asc'::text AS is_higher_better
           FROM long
        ), stats AS (
         SELECT enr.season_label,
            enr.metric_key,
            avg(COALESCE(enr.per_match_value, enr.total_value)) AS league_avg,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (COALESCE(enr.per_match_value, enr.total_value)::double precision)) AS league_median
           FROM enr
          GROUP BY enr.season_label, enr.metric_key
        )
 SELECT e.season_label,
    'Süper Lig'::text AS competition,
    NULL::text AS team_slug,
    e.source_team_id,
    e.team_name,
    e.metric_key,
    e.metric_label,
    e.category_key,
    e.category_label,
    e.display_priority,
    e.total_value,
    e.per_match_value,
    e.home_value,
    e.away_value,
    round(st.league_avg, 3) AS league_avg,
    round(st.league_median::numeric, 3) AS league_median,
    rank() OVER (PARTITION BY e.season_label, e.metric_key ORDER BY (
        CASE
            WHEN e.rank_direction = 'asc'::text THEN COALESCE(e.per_match_value, e.total_value)
            ELSE NULL::numeric
        END), (
        CASE
            WHEN e.rank_direction <> 'asc'::text THEN COALESCE(e.per_match_value, e.total_value)
            ELSE NULL::numeric
        END) DESC NULLS LAST)::integer AS league_rank,
    round((1::double precision - percent_rank() OVER (PARTITION BY e.season_label, e.metric_key ORDER BY (
        CASE
            WHEN e.rank_direction = 'asc'::text THEN COALESCE(e.per_match_value, e.total_value)
            ELSE NULL::numeric
        END), (
        CASE
            WHEN e.rank_direction <> 'asc'::text THEN COALESCE(e.per_match_value, e.total_value)
            ELSE NULL::numeric
        END) DESC NULLS LAST))::numeric, 4) AS league_percentile,
    round(COALESCE(e.per_match_value, e.total_value) - st.league_avg, 3) AS vs_league_avg_abs,
        CASE
            WHEN st.league_avg IS NULL OR abs(st.league_avg) < 0.01 THEN NULL::numeric
            ELSE round(100.0 * (COALESCE(e.per_match_value, e.total_value) - st.league_avg) / st.league_avg, 2)
        END AS vs_league_avg_pct,
    e.rank_direction,
    e.is_higher_better,
    e.value_format,
    abs(COALESCE(e.home_value, 0::numeric) - COALESCE(e.away_value, 0::numeric)) AS home_away_gap_abs,
    e.matches AS sample_matches,
    true AS coverage_flag
   FROM enr e
     JOIN stats st USING (season_label, metric_key);

-- analytics.ucl_team_season_stats_v1
create or replace view analytics.ucl_team_season_stats_v1 as
 WITH team_matches AS (
         SELECT matches.season_label,
            matches.home_team_source_id AS team_id,
            matches.home_team_name AS team_name,
            matches.home_score AS gf,
            matches.away_score AS ga
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'UEFA Şampiyonlar Ligi'::text
        UNION ALL
         SELECT matches.season_label,
            matches.away_team_source_id,
            matches.away_team_name,
            matches.away_score,
            matches.home_score
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'UEFA Şampiyonlar Ligi'::text
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
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Şampiyonlar Ligi'::text
          GROUP BY m.season_label, d.source_team_id
        ), team_xg AS (
         SELECT ucl_player_season_stats_v1.season_label,
            ucl_player_season_stats_v1.team_id,
            round(sum(ucl_player_season_stats_v1.xg), 2) AS xg
           FROM analytics.ucl_player_season_stats_v1
          WHERE ucl_player_season_stats_v1.xg IS NOT NULL
          GROUP BY ucl_player_season_stats_v1.season_label, ucl_player_season_stats_v1.team_id
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

-- analytics.uecl_team_season_stats_v1
create or replace view analytics.uecl_team_season_stats_v1 as
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

-- analytics.uel_team_season_stats_v1
create or replace view analytics.uel_team_season_stats_v1 as
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

-- analytics.v_player_match_details_base
create or replace view analytics.v_player_match_details_base as
 SELECT source,
    source_match_id,
    source_team_id,
    source_player_id,
    (source || '|'::text) || source_match_id AS match_bk,
    (source || '|'::text) || source_team_id AS team_bk,
    (source || '|'::text) || source_player_id AS player_bk,
    (((((source || '|'::text) || source_match_id) || '|'::text) || source_team_id) || '|'::text) || source_player_id AS player_match_bk,
    team_name,
    player_name,
    player_side,
    lineup_status,
    position_code,
    accurate_pass,
    hit_woodwork,
    attempts_ibox,
    attempts_obox,
    headed_shots,
    expected_goals,
    goal_kicks,
    total_throws,
    out_of_box_goals,
    right_foot_goals,
    left_foot_goals,
    headed_goals,
    penalty_goals,
    freekick_goals,
    fantasy_assist,
    raw_stats,
    payload_last_seen_at,
    updated_at
   FROM football.match_player_stats_details d
  WHERE source = 'opta'::text;
