-- 2026-08-18: Tek-profil Faz 2a — player_match_log bridge sofascore legi
-- Avrupa kupasi maclarini da kapsar (competition filtresi genisletildi).
-- Boylece bir oyuncunun TEK football profili (slug) tum rekabetlerin mac
-- logunu gosterir (Super Lig + CL/EL/Con), competition kolonuyla etiketli.
-- Dual oyuncu (Talisca 329245) sofa id AYNI -> Phase 1 map ile opta slug.
-- Additive (mevcut Super Lig satirlari degismez). Mat refresh_tsl_mats ile.
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
  WHERE d.source = 'sofascore'::text AND (m.competition ~~ 'S%per Lig%'::text OR (m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text]))) AND m.season_label IS NOT NULL AND NOT (EXISTS ( SELECT 1
           FROM opta_seasons o
          WHERE o.player_source_id = pmap.opta_player_id AND o.season_label = m.season_label));;