-- 2026-10-01: Milli takim (ref.national_competitions) icin sizinti bekcileri +
-- tek-profil koprulerinin genisletilmesi. URETILMIS dosya (scratch gen_guards.py,
-- canli pg_get_viewdef uzerinden); mevcut kupa bekcilerine dokunulmadi, yanina
-- "milli turnuva degil" kosulu eklendi. Uygulama aninda milli mac verisi yoktu:
-- 7 view'in icerik md5'i oncesi/sonrasi birebir ayni dogrulandi.
--
-- BEKCI (haric tut): player_shot_zones_season_v1, player_shot_outcomes_season_v1,
--   msm_gsheet_v1, tff1_player_match_log_v1 -> milli maclar TSL/1.Lig PSM-MSM
--   ortalamalarina karismaz.
-- KOPRU (dahil et): player_match_log_sofascore_def_v1 (oyuncunun milli maclari
--   tek profildeki mac logunda rozetli gorunur), player_profile_sofascore_v1
--   (yalniz SL'de de kupada da verisi OLMAYAN sentetik oyuncuya milli takim
--   profil satiri), player_current_info_bridged_def_v1 (kulup maci oncelikli).
-- Yeni bir milli turnuva = ref.national_competitions'a satir; view degismez.

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
  WHERE (competition IS NULL OR (competition <> ALL (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text]))) AND NOT (EXISTS ( SELECT 1 FROM ref.national_competitions nc WHERE nc.competition = player_shot_zones_match_mat.competition))
  GROUP BY sofascore_player_id, season_label;

CREATE OR REPLACE VIEW analytics.player_shot_outcomes_season_v1 AS
 WITH cnt AS (
         SELECT s.source_player_id,
            m.season_label,
            count(*) FILTER (WHERE s.shot_type = ANY (ARRAY['miss'::text, 'post'::text])) AS off_target_total,
            count(*) FILTER (WHERE s.shot_type = 'block'::text) AS blocked_total
           FROM football.match_player_shots s
             JOIN football.matches m ON m.source = s.source AND m.source_match_id = s.source_match_id
          WHERE (m.competition IS NULL OR (m.competition <> ALL (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text]))) AND NOT (EXISTS ( SELECT 1 FROM ref.national_competitions nc WHERE nc.competition = m.competition))
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
          WHERE match_team_stats.source = 'sofascore'::text AND ((match_team_stats.competition IS NULL OR (match_team_stats.competition <> ALL (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text]))) AND NOT (EXISTS ( SELECT 1 FROM ref.national_competitions nc WHERE nc.competition = match_team_stats.competition)))
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
   FROM football.mpsd_with_raw d
     JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
  WHERE d.source = 'sofascore'::text AND ((m.competition IS NULL OR (m.competition <> ALL (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text]))) AND NOT (EXISTS ( SELECT 1 FROM ref.national_competitions nc WHERE nc.competition = m.competition)));

CREATE OR REPLACE VIEW analytics.player_profile_sofascore_v1 AS
 WITH sl_players AS (
         SELECT DISTINCT d.source_player_id
           FROM football.mpsd_with_raw d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition ~~ 'S%per Lig%'::text
        ), cup_players AS (
         SELECT DISTINCT d.source_player_id
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND (m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text]))
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
           FROM football.mpsd_with_raw d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
             JOIN ref.sofascore_opta_player_map pmap ON pmap.sofascore_player_id = d.source_player_id
             LEFT JOIN ref.team_mapping tm ON tm.source_team_id = d.source_team_id AND tm.is_active = true
          WHERE d.source = 'sofascore'::text AND m.season_label IS NOT NULL AND (m.competition ~~ 'S%per Lig%'::text AND tm.team_slug IS NOT NULL OR (m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])) AND pmap.match_method = 'synthetic'::text AND NOT (EXISTS ( SELECT 1
                   FROM sl_players sp
                  WHERE sp.source_player_id = d.source_player_id)) OR (EXISTS ( SELECT 1 FROM ref.national_competitions nc WHERE nc.competition = m.competition)) AND pmap.match_method = 'synthetic'::text AND NOT (EXISTS ( SELECT 1 FROM sl_players sp2 WHERE sp2.source_player_id = d.source_player_id)) AND NOT (EXISTS ( SELECT 1 FROM cup_players cp WHERE cp.source_player_id = d.source_player_id)))
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

CREATE OR REPLACE VIEW analytics.player_match_log_sofascore_def_v1 AS
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
           FROM football.mpsd_with_raw fd
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
   FROM football.mpsd_with_raw d
     JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
     JOIN ref.sofascore_opta_player_map pmap ON pmap.sofascore_player_id = d.source_player_id
     JOIN slug_map sm ON sm.player_source_id = pmap.opta_player_id
     LEFT JOIN ref.team_mapping tm ON tm.source_team_id = d.source_team_id AND tm.is_active = true
     LEFT JOIN ref.team_mapping home_map ON home_map.source_team_id = m.home_team_source_id AND home_map.is_active = true
     LEFT JOIN ref.team_mapping away_map ON away_map.source_team_id = m.away_team_source_id AND away_map.is_active = true
  WHERE d.source = 'sofascore'::text AND (m.competition ~~ 'S%per Lig%'::text OR ((m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])) OR (EXISTS ( SELECT 1 FROM ref.national_competitions nc WHERE nc.competition = m.competition)))) AND m.season_label IS NOT NULL AND (((m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])) OR (EXISTS ( SELECT 1 FROM ref.national_competitions nc WHERE nc.competition = m.competition))) OR NOT (EXISTS ( SELECT 1
           FROM opta_seasons o
          WHERE o.player_source_id = pmap.opta_player_id AND o.season_label = m.season_label))) AND NOT (((m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])) OR (EXISTS ( SELECT 1 FROM ref.national_competitions nc WHERE nc.competition = m.competition))) AND NOT d.raw_stats ? 'minutesPlayed'::text AND (EXISTS ( SELECT 1
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
   FROM football.mpsd_with_raw fd
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
           FROM football.mpsd_with_raw d2
          WHERE d2.source = 'sofascore'::text AND d2.source_match_id = mm.sofascore_match_id AND d2.source_player_id = ppm.sofascore_player_id AND d2.raw_stats ? 'minutesPlayed'::text));

CREATE OR REPLACE VIEW analytics.player_current_info_bridged_def_v1 AS
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
           FROM football.mpsd_with_raw d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
             JOIN ref.sofascore_opta_player_map pmap ON pmap.sofascore_player_id = d.source_player_id
          WHERE d.source = 'sofascore'::text AND (m.competition ~~ 'S%per Lig%'::text OR ((m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])) OR (EXISTS ( SELECT 1 FROM ref.national_competitions nc WHERE nc.competition = m.competition))))
          ORDER BY pmap.opta_player_id, ((EXISTS ( SELECT 1 FROM ref.national_competitions nc WHERE nc.competition = m.competition))), m.match_datetime DESC
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

notify pgrst, 'reload schema';
