-- 2026-08-18: Avrupa kupasi entegrasyonu ONCESI sizinti guard'lari.
-- Amac: CL/EL/ConL verisi (source='sofascore') yuklenince, competition
-- filtrelemeyen mevcut Super Lig/1.Lig ekranlarina (PSM sut, MSM, mac logu)
-- KARISMASINI onlemek. NULL-guvenli negatif haric-tutma; mevcut veride kupa
-- etiketi olmadigindan davranis BYTE-OZDES (uretici satir-sayisi ozdesligiyle
-- dogruladi). Yeni kupa eklenince etiket listesine ekle.
-- Not: player_shot_zones_match_mat (matview) KASITLI dokunulmadi; sizinti yalniz
-- sezon-agregasyonunda, onu toplayan sezon-view'lari guard'landi.

CREATE OR REPLACE VIEW analytics.player_shot_zones_season_v1 AS
 SELECT sofascore_player_id,
    max(opta_player_id) AS opta_player_id,
    season_label,
    count(*) AS matches,
    avg(shots_total) AS shots_total,
    avg(shots_ibox) AS shots_ibox,
    avg(shots_obox) AS shots_obox,
    avg(sot_total) AS sot_total,
    avg(sot_ibox) AS sot_ibox,
    avg(sot_obox) AS sot_obox,
    avg(goals_ibox) AS goals_ibox,
    avg(goals_obox) AS goals_obox
   FROM analytics.player_shot_zones_match_mat
  WHERE (competition IS NULL OR competition NOT IN ('UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text))
  GROUP BY sofascore_player_id, season_label;

CREATE OR REPLACE VIEW analytics.player_shot_outcomes_season_v1 AS
 WITH cnt AS (
         SELECT s.source_player_id,
            m.season_label,
            count(*) FILTER (WHERE s.shot_type = ANY (ARRAY['miss'::text, 'post'::text])) AS off_target_total,
            count(*) FILTER (WHERE s.shot_type = 'block'::text) AS blocked_total
           FROM football.match_player_shots s
             JOIN football.matches m ON m.source = s.source AND m.source_match_id = s.source_match_id
          WHERE (m.competition IS NULL OR m.competition NOT IN ('UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text))
          GROUP BY s.source_player_id, m.season_label
        )
 SELECT z.opta_player_id,
    z.season_label,
    z.matches,
    COALESCE(c.off_target_total, 0::bigint)::numeric / NULLIF(z.matches, 0)::numeric AS shots_off_target,
    COALESCE(c.blocked_total, 0::bigint)::numeric / NULLIF(z.matches, 0)::numeric AS shots_blocked
   FROM analytics.player_shot_zones_season_v1 z
     LEFT JOIN cnt c ON c.source_player_id = z.sofascore_player_id AND c.season_label = z.season_label;

CREATE OR REPLACE VIEW analytics.msm_gsheet_v1 AS
 WITH mt AS (
         SELECT match_team_stats.id,
            match_team_stats.source,
            match_team_stats.source_match_id,
            match_team_stats.source_team_id,
            match_team_stats.team_name,
            match_team_stats.team_side,
            match_team_stats.opponent_team_source_id,
            match_team_stats.opponent_team_name,
            match_team_stats.competition,
            match_team_stats.match_datetime,
            match_team_stats.match_date_text,
            match_team_stats.score_for,
            match_team_stats.score_against,
            match_team_stats.result_code,
            match_team_stats.summary_goals,
            match_team_stats.summary_assists,
            match_team_stats.summary_red_cards,
            match_team_stats.summary_yellow_cards,
            match_team_stats.summary_corners_won,
            match_team_stats.summary_shots,
            match_team_stats.summary_shots_on_target,
            match_team_stats.summary_blocked_shots,
            match_team_stats.summary_passes,
            match_team_stats.summary_crosses,
            match_team_stats.summary_tackles,
            match_team_stats.summary_offsides,
            match_team_stats.summary_fouls_conceded,
            match_team_stats.summary_fouls_won,
            match_team_stats.summary_saves,
            match_team_stats.details_accurate_pass,
            match_team_stats.details_hit_woodwork,
            match_team_stats.details_attempts_ibox,
            match_team_stats.details_attempts_obox,
            match_team_stats.details_headed_shots,
            match_team_stats.details_expected_goals,
            match_team_stats.details_goal_kicks,
            match_team_stats.details_total_throws,
            match_team_stats.details_out_of_box_goals,
            match_team_stats.details_right_foot_goals,
            match_team_stats.details_left_foot_goals,
            match_team_stats.details_headed_goals,
            match_team_stats.details_penalty_goals,
            match_team_stats.details_freekick_goals,
            match_team_stats.details_fantasy_assist,
            match_team_stats.opta_player_count,
            match_team_stats.opta_starter_count,
            match_team_stats.opta_substitute_count,
            match_team_stats.opta_points_total,
            match_team_stats.opta_minutes_total,
            match_team_stats.opta_goals_total,
            match_team_stats.opta_shots_on_target_total,
            match_team_stats.opta_shots_off_target_total,
            match_team_stats.opta_shots_blocked_total,
            match_team_stats.opta_own_goals_total,
            match_team_stats.opta_assists_total,
            match_team_stats.opta_passes_total,
            match_team_stats.opta_crosses_total,
            match_team_stats.opta_tackles_total,
            match_team_stats.opta_interceptions_total,
            match_team_stats.opta_fouls_won_total,
            match_team_stats.opta_fouls_conceded_total,
            match_team_stats.opta_offsides_total,
            match_team_stats.opta_cards_yellow_total,
            match_team_stats.opta_cards_red_total,
            match_team_stats.opta_goals_conceded_total,
            match_team_stats.opta_penalties_won_total,
            match_team_stats.opta_saves_total,
            match_team_stats.opta_penalties_saved_total,
            match_team_stats.raw_summary_totals,
            match_team_stats.raw_details_totals,
            match_team_stats.raw_opta_totals,
            match_team_stats.payload_last_seen_at,
            match_team_stats.created_at,
            match_team_stats.updated_at,
            match_team_stats.sofascore_extras
           FROM football.match_team_stats
          WHERE match_team_stats.source = 'sofascore'::text AND (match_team_stats.competition IS NULL OR match_team_stats.competition NOT IN ('UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text))
        )
 SELECT h.source_match_id,
        CASE h.competition
            WHEN 'Süper Lig'::text THEN 'tsl'::text
            WHEN 'Trendyol 1. Lig'::text THEN 'tff1'::text
            ELSE h.competition
        END AS league,
    h.competition,
    h.match_datetime,
        CASE
            WHEN EXTRACT(month FROM h.match_datetime) >= 7::numeric THEN (EXTRACT(year FROM h.match_datetime)::integer || '/'::text) || (EXTRACT(year FROM h.match_datetime)::integer + 1)
            ELSE ((EXTRACT(year FROM h.match_datetime)::integer - 1) || '/'::text) || EXTRACT(year FROM h.match_datetime)::integer
        END AS season_label,
    h.source_team_id AS home_team_id,
    h.team_name AS home_team_name,
    a.source_team_id AS away_team_id,
    a.team_name AS away_team_name,
    h.score_for AS ft_home,
    a.score_for AS ft_away,
    (h.sofascore_extras ->> 'added_time_1h'::text)::integer AS added_time_1h,
    (h.sofascore_extras ->> 'added_time_2h'::text)::integer AS added_time_2h,
    (h.sofascore_extras ->> 'card_total'::text)::integer AS card_home,
    (a.sofascore_extras ->> 'card_total'::text)::integer AS card_away,
    h.summary_corners_won AS corner_home,
    a.summary_corners_won AS corner_away,
    h.summary_shots AS shot_home,
    a.summary_shots AS shot_away,
    h.summary_shots_on_target AS sot_home,
    a.summary_shots_on_target AS sot_away,
    h.summary_fouls_conceded AS foul_home,
    a.summary_fouls_conceded AS foul_away,
    h.summary_offsides AS offside_home,
    a.summary_offsides AS offside_away,
    h.summary_saves AS saves_home,
    a.summary_saves AS saves_away,
    h.details_total_throws AS throwin_home,
    a.details_total_throws AS throwin_away,
    h.summary_tackles AS tackle_home,
    a.summary_tackles AS tackle_away,
    h.details_goal_kicks AS goalkick_home,
    a.details_goal_kicks AS goalkick_away,
    (h.sofascore_extras ->> 'possession_pct'::text)::numeric AS possession_home,
    (a.sofascore_extras ->> 'possession_pct'::text)::numeric AS possession_away,
    COALESCE(h.summary_red_cards, 0) + COALESCE(a.summary_red_cards, 0) AS rc_total,
    COALESCE((h.sofascore_extras ->> 'var_count'::text)::integer, 0) + COALESCE((a.sofascore_extras ->> 'var_count'::text)::integer, 0) AS var_total,
    COALESCE((h.sofascore_extras ->> 'penalties'::text)::integer, 0) + COALESCE((a.sofascore_extras ->> 'penalties'::text)::integer, 0) AS pen_total,
    COALESCE(h.details_hit_woodwork, 0) + COALESCE(a.details_hit_woodwork, 0) AS woodwork_total,
    COALESCE((h.sofascore_extras ->> 'own_goals'::text)::integer, 0) + COALESCE((a.sofascore_extras ->> 'own_goals'::text)::integer, 0) AS owngoal_total,
    tmh.team_slug AS home_team_slug,
    tma.team_slug AS away_team_slug
   FROM mt h
     JOIN mt a ON a.source_match_id = h.source_match_id AND h.team_side = 'home'::text AND a.team_side = 'away'::text
     LEFT JOIN ref.team_mapping tmh ON tmh.source_team_id = h.source_team_id
     LEFT JOIN ref.team_mapping tma ON tma.source_team_id = a.source_team_id;

CREATE OR REPLACE VIEW analytics.tff1_player_match_log_v1 AS
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
  WHERE d.source = 'sofascore'::text AND (m.competition IS NULL OR m.competition NOT IN ('UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text));
