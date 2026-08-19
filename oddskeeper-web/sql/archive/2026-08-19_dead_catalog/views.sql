-- 2026-08-19 olu katalog arsivi: view/matview tanimlari (topolojik sira).
-- Geri kurmak icin: semalari/tablolari once (tables.sql + csv), sonra bu dosya.

CREATE VIEW mapping.v_team_observed AS
 SELECT m.source,
    m.home_team_source_id AS source_team_id,
    m.home_team_name AS observed_team_name,
    m.competition,
    m.match_datetime
   FROM football.matches m
  WHERE m.home_team_source_id IS NOT NULL AND m.home_team_name IS NOT NULL
UNION ALL
 SELECT m.source,
    m.away_team_source_id AS source_team_id,
    m.away_team_name AS observed_team_name,
    m.competition,
    m.match_datetime
   FROM football.matches m
  WHERE m.away_team_source_id IS NOT NULL AND m.away_team_name IS NOT NULL
UNION ALL
 SELECT t.source,
    t.source_team_id,
    t.team_name AS observed_team_name,
    t.competition,
    t.match_datetime
   FROM football.match_team_stats t
  WHERE t.source_team_id IS NOT NULL AND t.team_name IS NOT NULL;

CREATE VIEW mapping.v_team_name_variants AS
 SELECT source,
    source_team_id,
    count(*) AS row_count,
    count(DISTINCT observed_team_name) AS distinct_name_count,
    string_agg(DISTINCT observed_team_name, ' | '::text ORDER BY observed_team_name) AS observed_team_names,
    min(match_datetime) AS first_seen_match_datetime,
    max(match_datetime) AS last_seen_match_datetime
   FROM mapping.v_team_observed
  GROUP BY source, source_team_id;

CREATE VIEW mapping.v_unmapped_team_candidates AS
 WITH latest_observed AS (
         SELECT v_team_observed.source,
            v_team_observed.source_team_id,
            v_team_observed.observed_team_name,
            v_team_observed.competition,
            v_team_observed.match_datetime,
            row_number() OVER (PARTITION BY v_team_observed.source, v_team_observed.source_team_id ORDER BY v_team_observed.match_datetime DESC NULLS LAST, v_team_observed.observed_team_name) AS rn
           FROM mapping.v_team_observed
        )
 SELECT l.source,
    l.source_team_id,
    l.observed_team_name AS latest_observed_team_name,
    l.competition,
    l.match_datetime
   FROM latest_observed l
     LEFT JOIN mapping.map_team mt ON mt.source = l.source AND mt.source_team_id = l.source_team_id
  WHERE l.rn = 1 AND mt.source_team_id IS NULL;

CREATE VIEW mapping.v_team_mapping_audit AS
 SELECT mt.source,
    mt.source_team_id,
    mt.canonical_team_name,
    mt.latest_observed_team_name,
    mt.first_seen_match_datetime,
    mt.last_seen_match_datetime,
    mt.latest_competition,
    v.distinct_name_count,
    v.observed_team_names
   FROM mapping.map_team mt
     LEFT JOIN mapping.v_team_name_variants v ON v.source = mt.source AND v.source_team_id = mt.source_team_id;

CREATE VIEW mapping.v_competition_observed AS
 SELECT m.source,
    m.competition AS observed_competition_name,
    regexp_replace(translate(lower(COALESCE(m.competition, ''::text)), 'çğıöşüâîûÇĞİÖŞÜÂÎÛ'::text, 'cgiosuaiucgiosuaiu'::text), '[^a-z0-9]+'::text, ''::text, 'g'::text) AS competition_norm,
    m.match_datetime
   FROM football.matches m
  WHERE m.competition IS NOT NULL AND m.competition <> ''::text
UNION ALL
 SELECT t.source,
    t.competition AS observed_competition_name,
    regexp_replace(translate(lower(COALESCE(t.competition, ''::text)), 'çğıöşüâîûÇĞİÖŞÜÂÎÛ'::text, 'cgiosuaiucgiosuaiu'::text), '[^a-z0-9]+'::text, ''::text, 'g'::text) AS competition_norm,
    t.match_datetime
   FROM football.match_team_stats t
  WHERE t.competition IS NOT NULL AND t.competition <> ''::text;

CREATE VIEW mapping.v_competition_name_variants AS
 SELECT source,
    competition_norm,
    count(*) AS row_count,
    count(DISTINCT observed_competition_name) AS distinct_name_count,
    string_agg(DISTINCT observed_competition_name, ' | '::text ORDER BY observed_competition_name) AS observed_competition_names,
    min(match_datetime) AS first_seen_match_datetime,
    max(match_datetime) AS last_seen_match_datetime
   FROM mapping.v_competition_observed
  WHERE competition_norm <> ''::text
  GROUP BY source, competition_norm;

CREATE VIEW mapping.v_competition_mapping_audit AS
 SELECT mc.source,
    mc.competition_norm,
    mc.canonical_competition_name,
    mc.latest_observed_competition,
    mc.first_seen_match_datetime,
    mc.last_seen_match_datetime,
    v.distinct_name_count,
    v.observed_competition_names
   FROM mapping.map_competition mc
     LEFT JOIN mapping.v_competition_name_variants v ON v.source = mc.source AND v.competition_norm = mc.competition_norm;

CREATE VIEW mapping.v_position_observed AS
 SELECT d.source,
    TRIM(BOTH FROM d.position_code) AS observed_position_code,
    upper(TRIM(BOTH FROM d.position_code)) AS raw_position_code,
    m.match_datetime
   FROM football.match_player_stats_details d
     LEFT JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
  WHERE d.position_code IS NOT NULL AND TRIM(BOTH FROM d.position_code) <> ''::text
UNION ALL
 SELECT o.source,
    TRIM(BOTH FROM o.position_code) AS observed_position_code,
    upper(TRIM(BOTH FROM o.position_code)) AS raw_position_code,
    m.match_datetime
   FROM football.match_player_stats_opta_points o
     LEFT JOIN football.matches m ON m.source = o.source AND m.source_match_id = o.source_match_id
  WHERE o.position_code IS NOT NULL AND TRIM(BOTH FROM o.position_code) <> ''::text;

CREATE VIEW mapping.v_position_code_variants AS
 SELECT source,
    raw_position_code,
    count(*) AS row_count,
    count(DISTINCT observed_position_code) AS distinct_format_count,
    string_agg(DISTINCT observed_position_code, ' | '::text ORDER BY observed_position_code) AS observed_position_codes,
    min(match_datetime) AS first_seen_match_datetime,
    max(match_datetime) AS last_seen_match_datetime
   FROM mapping.v_position_observed
  GROUP BY source, raw_position_code;

CREATE VIEW mapping.v_position_mapping_audit AS
 SELECT mp.source,
    mp.raw_position_code,
    mp.canonical_position_code,
    mp.canonical_position_group,
    mp.latest_observed_position_code,
    mp.observed_row_count,
    mp.first_seen_match_datetime,
    mp.last_seen_match_datetime,
    v.distinct_format_count,
    v.observed_position_codes
   FROM mapping.map_position mp
     LEFT JOIN mapping.v_position_code_variants v ON v.source = mp.source AND v.raw_position_code = mp.raw_position_code;

CREATE VIEW mapping.v_player_observed AS
 SELECT d.source,
    d.source_player_id,
    d.player_name AS observed_player_name,
    d.source_team_id,
    d.team_name AS observed_team_name,
    upper(TRIM(BOTH FROM d.position_code)) AS raw_position_code,
    d.lineup_status,
    d.player_side,
    m.match_datetime
   FROM football.match_player_stats_details d
     LEFT JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
  WHERE d.source_player_id IS NOT NULL AND d.player_name IS NOT NULL AND TRIM(BOTH FROM d.player_name) <> ''::text
UNION ALL
 SELECT o.source,
    o.source_player_id,
    o.player_name AS observed_player_name,
    o.source_team_id,
    o.team_name AS observed_team_name,
    upper(TRIM(BOTH FROM o.position_code)) AS raw_position_code,
    o.lineup_status,
    o.player_side,
    m.match_datetime
   FROM football.match_player_stats_opta_points o
     LEFT JOIN football.matches m ON m.source = o.source AND m.source_match_id = o.source_match_id
  WHERE o.source_player_id IS NOT NULL AND o.player_name IS NOT NULL AND TRIM(BOTH FROM o.player_name) <> ''::text;

CREATE VIEW mapping.v_player_name_variants AS
 SELECT source,
    source_player_id,
    count(*) AS row_count,
    count(DISTINCT observed_player_name) AS distinct_name_count,
    string_agg(DISTINCT observed_player_name, ' | '::text ORDER BY observed_player_name) AS observed_player_names,
    min(match_datetime) AS first_seen_match_datetime,
    max(match_datetime) AS last_seen_match_datetime
   FROM mapping.v_player_observed
  GROUP BY source, source_player_id;

CREATE VIEW mapping.v_player_team_variants AS
 SELECT source,
    source_player_id,
    count(DISTINCT source_team_id) AS distinct_team_count,
    string_agg(DISTINCT COALESCE(observed_team_name, source_team_id), ' | '::text ORDER BY (COALESCE(observed_team_name, source_team_id))) AS observed_team_names
   FROM mapping.v_player_observed
  GROUP BY source, source_player_id;

CREATE VIEW mapping.v_player_mapping_audit AS
 SELECT mp.source,
    mp.source_player_id,
    mp.canonical_player_name,
    mp.latest_observed_player_name,
    mp.latest_source_team_id,
    mp.latest_team_name,
    mp.latest_position_code,
    mp.latest_position_group,
    mp.first_seen_match_datetime,
    mp.last_seen_match_datetime,
    nv.distinct_name_count,
    nv.observed_player_names,
    tv.distinct_team_count,
    tv.observed_team_names
   FROM mapping.map_player mp
     LEFT JOIN mapping.v_player_name_variants nv ON nv.source = mp.source AND nv.source_player_id = mp.source_player_id
     LEFT JOIN mapping.v_player_team_variants tv ON tv.source = mp.source AND tv.source_player_id = mp.source_player_id;

CREATE VIEW analytics.v_player_team_membership_history AS
 WITH base AS (
         SELECT p.source,
            p.source_player_id,
            p.source_team_id,
            p.observed_player_name,
            p.observed_team_name,
            p.raw_position_code,
            p.lineup_status,
            p.player_side,
            p.match_datetime
           FROM mapping.v_player_observed p
        ), agg AS (
         SELECT base.source,
            base.source_player_id,
            base.source_team_id,
            min(base.match_datetime) AS first_seen_match_datetime,
            max(base.match_datetime) AS last_seen_match_datetime,
            count(*) AS observed_row_count
           FROM base
          GROUP BY base.source, base.source_player_id, base.source_team_id
        ), latest_team_row AS (
         SELECT b.source,
            b.source_player_id,
            b.source_team_id,
            b.observed_player_name,
            b.observed_team_name,
            b.raw_position_code,
            b.lineup_status,
            b.player_side,
            b.match_datetime,
            row_number() OVER (PARTITION BY b.source, b.source_player_id, b.source_team_id ORDER BY b.match_datetime DESC NULLS LAST, b.observed_player_name) AS rn
           FROM base b
        ), latest_player_row AS (
         SELECT b.source,
            b.source_player_id,
            b.source_team_id AS current_source_team_id,
            b.observed_team_name AS current_team_name,
            b.match_datetime AS current_team_last_seen_match_datetime,
            row_number() OVER (PARTITION BY b.source, b.source_player_id ORDER BY b.match_datetime DESC NULLS LAST, b.observed_player_name) AS rn
           FROM base b
        ), team_counts AS (
         SELECT base.source,
            base.source_player_id,
            count(DISTINCT base.source_team_id) AS distinct_team_count
           FROM base
          GROUP BY base.source, base.source_player_id
        )
 SELECT a.source,
    a.source_player_id,
    a.source_team_id,
    ltr.observed_player_name AS latest_player_name,
    ltr.observed_team_name AS latest_team_name,
    ltr.raw_position_code AS latest_position_code,
    mp.canonical_position_group AS latest_position_group,
    a.first_seen_match_datetime,
    a.last_seen_match_datetime,
    a.observed_row_count,
    tc.distinct_team_count,
    lpr.current_source_team_id,
    lpr.current_team_name,
    lpr.current_team_last_seen_match_datetime,
        CASE
            WHEN lpr.current_source_team_id = a.source_team_id THEN true
            ELSE false
        END AS is_current_team
   FROM agg a
     LEFT JOIN latest_team_row ltr ON ltr.source = a.source AND ltr.source_player_id = a.source_player_id AND ltr.source_team_id = a.source_team_id AND ltr.rn = 1
     LEFT JOIN team_counts tc ON tc.source = a.source AND tc.source_player_id = a.source_player_id
     LEFT JOIN latest_player_row lpr ON lpr.source = a.source AND lpr.source_player_id = a.source_player_id AND lpr.rn = 1
     LEFT JOIN mapping.map_position mp ON mp.source = a.source AND mp.raw_position_code = ltr.raw_position_code;

CREATE VIEW analytics.v_player_current_team AS
 SELECT source,
    source_player_id,
    current_source_team_id AS source_team_id,
    latest_player_name AS player_name,
    current_team_name AS team_name,
    latest_position_code AS position_code,
    latest_position_group AS position_group,
    current_team_last_seen_match_datetime AS last_seen_match_datetime,
    distinct_team_count
   FROM analytics.v_player_team_membership_history
  WHERE is_current_team = true;

CREATE VIEW analytics.v_player_transfer_candidates AS
 SELECT source,
    source_player_id,
    source_team_id,
    latest_player_name,
    latest_team_name,
    latest_position_code,
    latest_position_group,
    first_seen_match_datetime,
    last_seen_match_datetime,
    observed_row_count,
    distinct_team_count,
    current_source_team_id,
    current_team_name,
    current_team_last_seen_match_datetime,
    is_current_team
   FROM analytics.v_player_team_membership_history
  WHERE distinct_team_count > 1
  ORDER BY last_seen_match_datetime DESC, latest_player_name;

CREATE VIEW analytics.dim_team AS
 SELECT mt.source,
    mt.source_team_id,
    (mt.source || '|'::text) || mt.source_team_id AS team_bk,
    mt.canonical_team_name AS team_name,
    regexp_replace(translate(lower(COALESCE(mt.canonical_team_name, ''::text)), 'çğıöşüâîûÇĞİÖŞÜÂÎÛ'::text, 'cgiosuaiucgiosuaiu'::text), '[^a-z0-9]+'::text, ''::text, 'g'::text) AS team_name_norm,
    mt.latest_observed_team_name,
    mt.latest_competition,
    mt.first_seen_match_datetime,
    mt.last_seen_match_datetime,
    mt.is_active,
    v.distinct_name_count,
    v.observed_team_names,
    mt.created_at,
    mt.updated_at
   FROM mapping.map_team mt
     LEFT JOIN mapping.v_team_name_variants v ON v.source = mt.source AND v.source_team_id = mt.source_team_id;

CREATE VIEW analytics.dim_competition AS
 SELECT mc.source,
    mc.competition_norm,
    (mc.source || '|'::text) || mc.competition_norm AS competition_bk,
    mc.canonical_competition_name AS competition_name,
    mc.latest_observed_competition,
    mc.first_seen_match_datetime,
    mc.last_seen_match_datetime,
    mc.is_active,
    v.distinct_name_count,
    v.observed_competition_names,
    mc.created_at,
    mc.updated_at
   FROM mapping.map_competition mc
     LEFT JOIN mapping.v_competition_name_variants v ON v.source = mc.source AND v.competition_norm = mc.competition_norm;

CREATE VIEW analytics.dim_position AS
 SELECT source,
    raw_position_code,
    (source || '|'::text) || raw_position_code AS position_bk,
    canonical_position_code,
    canonical_position_group,
    latest_observed_position_code,
    observed_row_count,
    first_seen_match_datetime,
    last_seen_match_datetime,
    is_active,
    created_at,
    updated_at
   FROM mapping.map_position mp;

CREATE VIEW analytics.dim_player AS
 SELECT mp.source,
    mp.source_player_id,
    (mp.source || '|'::text) || mp.source_player_id AS player_bk,
    mp.canonical_player_name AS player_name,
    regexp_replace(translate(lower(COALESCE(mp.canonical_player_name, ''::text)), 'çğıöşüâîûÇĞİÖŞÜÂÎÛ'::text, 'cgiosuaiucgiosuaiu'::text), '[^a-z0-9]+'::text, ''::text, 'g'::text) AS player_name_norm,
    mp.latest_observed_player_name,
    mp.latest_source_team_id AS current_source_team_id,
    mp.latest_team_name AS current_team_name,
        CASE
            WHEN mp.latest_source_team_id IS NOT NULL THEN (mp.source || '|'::text) || mp.latest_source_team_id
            ELSE NULL::text
        END AS current_team_bk,
    mp.latest_position_code,
    mp.latest_position_group,
    nv.distinct_name_count,
    nv.observed_player_names,
    tv.distinct_team_count,
    tv.observed_team_names,
    mp.first_seen_match_datetime,
    mp.last_seen_match_datetime,
    mp.is_active,
    mp.created_at,
    mp.updated_at
   FROM mapping.map_player mp
     LEFT JOIN mapping.v_player_name_variants nv ON nv.source = mp.source AND nv.source_player_id = mp.source_player_id
     LEFT JOIN mapping.v_player_team_variants tv ON tv.source = mp.source AND tv.source_player_id = mp.source_player_id;

CREATE VIEW analytics.player_match_unified AS
 WITH merged AS (
         SELECT COALESCE(d.source, o.source) AS source,
            COALESCE(d.source_match_id, o.source_match_id) AS source_match_id,
            COALESCE(d.source_team_id, o.source_team_id) AS source_team_id,
            COALESCE(d.source_player_id, o.source_player_id) AS source_player_id,
            COALESCE(d.match_bk, o.match_bk) AS match_bk,
            COALESCE(d.team_bk, o.team_bk) AS team_bk,
            COALESCE(d.player_bk, o.player_bk) AS player_bk,
            COALESCE(d.player_match_bk, o.player_match_bk) AS player_match_bk,
            COALESCE(d.team_name, o.team_name) AS team_name,
            COALESCE(d.player_name, o.player_name) AS player_name,
            COALESCE(d.player_side, o.player_side) AS player_side,
            COALESCE(d.lineup_status, o.lineup_status) AS lineup_status,
            COALESCE(d.position_code, o.position_code) AS position_code,
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
            d.fantasy_assist,
            o.active_mode,
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
            d.raw_stats AS raw_details_stats,
            o.raw_stats AS raw_opta_stats,
            COALESCE(d.payload_last_seen_at, o.payload_last_seen_at) AS payload_last_seen_at,
            COALESCE(d.updated_at, o.updated_at) AS updated_at
           FROM analytics.v_player_match_details_base d
             FULL JOIN analytics.v_player_match_opta_base o ON d.source = o.source AND d.source_match_id = o.source_match_id AND d.source_team_id = o.source_team_id AND d.source_player_id = o.source_player_id
        )
 SELECT m.source,
    m.source_match_id,
    m.source_team_id,
    m.source_player_id,
    m.match_bk,
    m.team_bk,
    m.player_bk,
    m.player_match_bk,
    vb.competition,
    regexp_replace(translate(lower(COALESCE(vb.competition, ''::text)), 'çğıöşüâîûÇĞİÖŞÜÂÎÛ'::text, 'cgiosuaiucgiosuaiu'::text), '[^a-z0-9]+'::text, ''::text, 'g'::text) AS competition_norm,
    vb.match_datetime,
    vb.match_date_text,
    vb.match_url,
    vb.home_team_source_id,
    vb.away_team_source_id,
    vb.home_team_name,
    vb.away_team_name,
    vb.home_score,
    vb.away_score,
    vb.winner_team_source_id,
    vb.winner_side,
    vb.venue,
    vb.referee,
    m.team_name,
    m.player_name,
    m.player_side,
    m.lineup_status,
    m.position_code,
    dp.canonical_position_group AS position_group,
    m.accurate_pass,
    m.hit_woodwork,
    m.attempts_ibox,
    m.attempts_obox,
    m.headed_shots,
    m.expected_goals,
    m.goal_kicks,
    m.total_throws,
    m.out_of_box_goals,
    m.right_foot_goals,
    m.left_foot_goals,
    m.headed_goals,
    m.penalty_goals,
    m.freekick_goals,
    m.fantasy_assist,
    m.active_mode,
    m.team_rank,
    m.points,
    m.minutes_played,
    m.goals,
    m.shots_on_target,
    m.shots_off_target,
    m.shots_blocked,
    m.own_goals,
    m.assists,
    m.passes,
    m.crosses,
    m.tackles,
    m.interceptions,
    m.fouls_won,
    m.fouls_conceded,
    m.offsides,
    m.cards_yellow,
    m.cards_red,
    m.goals_conceded,
    m.penalties_won,
    m.saves_total,
    m.penalties_saved,
    m.raw_details_stats,
    m.raw_opta_stats,
    m.payload_last_seen_at,
    m.updated_at
   FROM merged m
     LEFT JOIN analytics.v_matches_base vb ON vb.source = m.source AND vb.source_match_id = m.source_match_id
     LEFT JOIN analytics.dim_position dp ON dp.source = m.source AND dp.raw_position_code = m.position_code;

CREATE VIEW analytics.team_match_unified AS
 SELECT t.source,
    t.source_match_id,
    t.source_team_id,
    t.match_bk,
    t.team_bk,
    t.team_match_bk,
    t.team_name,
    dt.team_name AS canonical_team_name,
    dt.team_name_norm,
    t.opponent_team_source_id,
        CASE
            WHEN t.opponent_team_source_id IS NOT NULL THEN (t.source || '|'::text) || t.opponent_team_source_id
            ELSE NULL::text
        END AS opponent_team_bk,
    t.opponent_team_name,
    dto.team_name AS canonical_opponent_team_name,
    t.competition,
    regexp_replace(translate(lower(COALESCE(t.competition, ''::text)), 'çğıöşüâîûÇĞİÖŞÜÂÎÛ'::text, 'cgiosuaiucgiosuaiu'::text), '[^a-z0-9]+'::text, ''::text, 'g'::text) AS competition_norm,
    t.match_datetime,
    t.match_date_text,
    t.team_side,
    t.score_for,
    t.score_against,
    t.result_code,
    t.summary_goals,
    t.summary_assists,
    t.summary_red_cards,
    t.summary_yellow_cards,
    t.summary_corners_won,
    t.summary_shots,
    t.summary_shots_on_target,
    t.summary_blocked_shots,
    t.summary_passes,
    t.summary_crosses,
    t.summary_tackles,
    t.summary_offsides,
    t.summary_fouls_conceded,
    t.summary_fouls_won,
    t.summary_saves,
    t.details_accurate_pass,
    t.details_hit_woodwork,
    t.details_attempts_ibox,
    t.details_attempts_obox,
    t.details_headed_shots,
    t.details_expected_goals,
    t.details_goal_kicks,
    t.details_total_throws,
    t.details_out_of_box_goals,
    t.details_right_foot_goals,
    t.details_left_foot_goals,
    t.details_headed_goals,
    t.details_penalty_goals,
    t.details_freekick_goals,
    t.details_fantasy_assist,
    t.opta_player_count,
    t.opta_starter_count,
    t.opta_substitute_count,
    t.opta_points_total,
    t.opta_minutes_total,
    t.opta_goals_total,
    t.opta_shots_on_target_total,
    t.opta_shots_off_target_total,
    t.opta_shots_blocked_total,
    t.opta_own_goals_total,
    t.opta_assists_total,
    t.opta_passes_total,
    t.opta_crosses_total,
    t.opta_tackles_total,
    t.opta_interceptions_total,
    t.opta_fouls_won_total,
    t.opta_fouls_conceded_total,
    t.opta_offsides_total,
    t.opta_cards_yellow_total,
    t.opta_cards_red_total,
    t.opta_goals_conceded_total,
    t.opta_penalties_won_total,
    t.opta_saves_total,
    t.opta_penalties_saved_total,
    t.raw_summary_totals,
    t.raw_details_totals,
    t.raw_opta_totals,
    t.payload_last_seen_at,
    t.updated_at
   FROM analytics.v_team_match_base t
     LEFT JOIN analytics.dim_team dt ON dt.source = t.source AND dt.source_team_id = t.source_team_id
     LEFT JOIN analytics.dim_team dto ON dto.source = t.source AND dto.source_team_id = t.opponent_team_source_id;

CREATE VIEW analytics.fact_match AS
 SELECT m.source,
    m.source_match_id,
    m.match_bk,
    m.competition,
    regexp_replace(translate(lower(COALESCE(m.competition, ''::text)), 'çğıöşüâîûÇĞİÖŞÜÂÎÛ'::text, 'cgiosuaiucgiosuaiu'::text), '[^a-z0-9]+'::text, ''::text, 'g'::text) AS competition_norm,
    dc.competition_bk,
    m.match_datetime,
    m.match_date_text,
    m.match_url,
    m.venue,
    m.referee,
    m.attendance,
    m.attendance_text,
    m.home_team_source_id,
        CASE
            WHEN m.home_team_source_id IS NOT NULL THEN (m.source || '|'::text) || m.home_team_source_id
            ELSE NULL::text
        END AS home_team_bk,
    m.home_team_name,
    dth.team_name AS canonical_home_team_name,
    m.away_team_source_id,
        CASE
            WHEN m.away_team_source_id IS NOT NULL THEN (m.source || '|'::text) || m.away_team_source_id
            ELSE NULL::text
        END AS away_team_bk,
    m.away_team_name,
    dta.team_name AS canonical_away_team_name,
    m.home_score,
    m.away_score,
    COALESCE(m.home_score, 0) - COALESCE(m.away_score, 0) AS goal_diff_home,
        CASE
            WHEN m.home_score > m.away_score THEN 'HOME_WIN'::text
            WHEN m.home_score < m.away_score THEN 'AWAY_WIN'::text
            WHEN m.home_score = m.away_score THEN 'DRAW'::text
            ELSE NULL::text
        END AS match_result_code,
    m.winner_team_source_id,
    m.winner_side,
    m.payload_last_seen_at,
    m.updated_at
   FROM analytics.v_matches_base m
     LEFT JOIN analytics.dim_team dth ON dth.source = m.source AND dth.source_team_id = m.home_team_source_id
     LEFT JOIN analytics.dim_team dta ON dta.source = m.source AND dta.source_team_id = m.away_team_source_id
     LEFT JOIN analytics.dim_competition dc ON dc.source = m.source AND dc.competition_norm = regexp_replace(translate(lower(COALESCE(m.competition, ''::text)), 'çğıöşüâîûÇĞİÖŞÜÂÎÛ'::text, 'cgiosuaiucgiosuaiu'::text), '[^a-z0-9]+'::text, ''::text, 'g'::text);

CREATE VIEW analytics.fact_team_match AS
 SELECT t.source,
    t.source_match_id,
    t.source_team_id,
    t.match_bk,
    t.team_bk,
    t.team_match_bk,
    t.competition,
    t.competition_norm,
    dc.competition_bk,
    t.match_datetime,
    t.match_date_text,
    t.team_name,
    t.canonical_team_name,
    t.team_name_norm,
    t.opponent_team_source_id,
    t.opponent_team_bk,
    t.opponent_team_name,
    t.canonical_opponent_team_name,
    t.team_side,
        CASE
            WHEN lower(COALESCE(t.team_side, ''::text)) = 'home'::text THEN true
            ELSE false
        END AS is_home,
        CASE
            WHEN lower(COALESCE(t.team_side, ''::text)) = 'away'::text THEN true
            ELSE false
        END AS is_away,
    t.score_for,
    t.score_against,
    COALESCE(t.score_for, 0) - COALESCE(t.score_against, 0) AS goal_diff,
    t.result_code,
        CASE
            WHEN t.score_for > t.score_against THEN 3
            WHEN t.score_for = t.score_against THEN 1
            WHEN t.score_for < t.score_against THEN 0
            ELSE NULL::integer
        END AS points_earned,
    t.summary_goals,
    t.summary_assists,
    t.summary_red_cards,
    t.summary_yellow_cards,
    t.summary_corners_won,
    t.summary_shots,
    t.summary_shots_on_target,
    t.summary_blocked_shots,
    t.summary_passes,
    t.summary_crosses,
    t.summary_tackles,
    t.summary_offsides,
    t.summary_fouls_conceded,
    t.summary_fouls_won,
    t.summary_saves,
    t.details_accurate_pass,
    t.details_hit_woodwork,
    t.details_attempts_ibox,
    t.details_attempts_obox,
    t.details_headed_shots,
    t.details_expected_goals,
    t.details_goal_kicks,
    t.details_total_throws,
    t.details_out_of_box_goals,
    t.details_right_foot_goals,
    t.details_left_foot_goals,
    t.details_headed_goals,
    t.details_penalty_goals,
    t.details_freekick_goals,
    t.details_fantasy_assist,
    t.opta_player_count,
    t.opta_starter_count,
    t.opta_substitute_count,
    t.opta_points_total,
    t.opta_minutes_total,
    t.opta_goals_total,
    t.opta_shots_on_target_total,
    t.opta_shots_off_target_total,
    t.opta_shots_blocked_total,
    t.opta_own_goals_total,
    t.opta_assists_total,
    t.opta_passes_total,
    t.opta_crosses_total,
    t.opta_tackles_total,
    t.opta_interceptions_total,
    t.opta_fouls_won_total,
    t.opta_fouls_conceded_total,
    t.opta_offsides_total,
    t.opta_cards_yellow_total,
    t.opta_cards_red_total,
    t.opta_goals_conceded_total,
    t.opta_penalties_won_total,
    t.opta_saves_total,
    t.opta_penalties_saved_total,
    t.raw_summary_totals,
    t.raw_details_totals,
    t.raw_opta_totals,
    t.payload_last_seen_at,
    t.updated_at
   FROM analytics.team_match_unified t
     LEFT JOIN analytics.dim_competition dc ON dc.source = t.source AND dc.competition_norm = t.competition_norm;

CREATE VIEW analytics.fact_player_match AS
 SELECT p.source,
    p.source_match_id,
    p.source_team_id,
    p.source_player_id,
    p.match_bk,
    p.team_bk,
    p.player_bk,
    p.player_match_bk,
    p.competition,
    p.competition_norm,
    dc.competition_bk,
    p.match_datetime,
    p.match_date_text,
    p.match_url,
    p.venue,
    p.referee,
    p.team_name,
    dt.team_name AS canonical_team_name,
    p.player_name,
    dp.player_name AS canonical_player_name,
    dp.player_name_norm,
    p.player_side,
    p.lineup_status,
    p.position_code,
    p.position_group,
    p.accurate_pass,
    p.hit_woodwork,
    p.attempts_ibox,
    p.attempts_obox,
    p.headed_shots,
    p.expected_goals,
    p.goal_kicks,
    p.total_throws,
    p.out_of_box_goals,
    p.right_foot_goals,
    p.left_foot_goals,
    p.headed_goals,
    p.penalty_goals,
    p.freekick_goals,
    p.fantasy_assist,
    p.active_mode,
    p.team_rank,
    p.points,
    p.minutes_played,
    p.goals,
    p.shots_on_target,
    p.shots_off_target,
    p.shots_blocked,
    p.own_goals,
    p.assists,
    p.passes,
    p.crosses,
    p.tackles,
    p.interceptions,
    p.fouls_won,
    p.fouls_conceded,
    p.offsides,
    p.cards_yellow,
    p.cards_red,
    p.goals_conceded,
    p.penalties_won,
    p.saves_total,
    p.penalties_saved,
    COALESCE(p.shots_on_target, 0) + COALESCE(p.shots_off_target, 0) + COALESCE(p.shots_blocked, 0) AS shots_total,
    COALESCE(p.cards_yellow, 0) + COALESCE(p.cards_red, 0) AS cards_total,
    p.raw_details_stats,
    p.raw_opta_stats,
    p.payload_last_seen_at,
    p.updated_at
   FROM analytics.player_match_unified p
     LEFT JOIN analytics.dim_competition dc ON dc.source = p.source AND dc.competition_norm = p.competition_norm
     LEFT JOIN analytics.dim_team dt ON dt.source = p.source AND dt.source_team_id = p.source_team_id
     LEFT JOIN analytics.dim_player dp ON dp.source = p.source AND dp.source_player_id = p.source_player_id;

CREATE VIEW analytics.fact_match_incident AS
 SELECT i.source,
    i.source_match_id,
    (i.source || '|'::text) || i.source_match_id AS match_bk,
    (((i.source || '|'::text) || i.source_match_id) || '|'::text) || i.incident_key AS incident_bk,
    i.incident_key,
    i.source_incident_id,
    fm.competition,
    fm.competition_norm,
    fm.competition_bk,
    fm.match_datetime,
    fm.match_date_text,
    fm.match_url,
    fm.home_team_source_id,
    fm.away_team_source_id,
    fm.canonical_home_team_name,
    fm.canonical_away_team_name,
    i.side,
    i.event_type_code,
    i.event_title,
    i.minute_text,
    i.minute_sort,
    i.player_texts,
    i.primary_player_text,
    i.secondary_player_text,
    i.raw_text,
    i.payload_last_seen_at,
    i.updated_at
   FROM football.match_incidents i
     LEFT JOIN analytics.fact_match fm ON fm.source = i.source AND fm.source_match_id = i.source_match_id;

CREATE VIEW analytics.dim_match_date AS
 WITH d AS (
         SELECT DISTINCT (fact_match.match_datetime AT TIME ZONE 'UTC'::text)::date AS match_date
           FROM analytics.fact_match
          WHERE fact_match.match_datetime IS NOT NULL
        )
 SELECT to_char(match_date::timestamp with time zone, 'YYYYMMDD'::text)::integer AS date_key,
    match_date,
    EXTRACT(year FROM match_date)::integer AS calendar_year,
    EXTRACT(month FROM match_date)::integer AS calendar_month,
    EXTRACT(day FROM match_date)::integer AS calendar_day,
    EXTRACT(quarter FROM match_date)::integer AS calendar_quarter,
    TRIM(BOTH FROM to_char(match_date::timestamp with time zone, 'Day'::text)) AS day_name,
    EXTRACT(isodow FROM match_date)::integer AS iso_day_of_week,
        CASE
            WHEN EXTRACT(isodow FROM match_date) = ANY (ARRAY[6::numeric, 7::numeric]) THEN true
            ELSE false
        END AS is_weekend
   FROM d;

CREATE VIEW analytics.dim_season AS
 WITH s AS (
         SELECT DISTINCT fact_match.source,
            fact_match.competition_norm,
                CASE
                    WHEN EXTRACT(month FROM (fact_match.match_datetime AT TIME ZONE 'UTC'::text)) >= 7::numeric THEN EXTRACT(year FROM (fact_match.match_datetime AT TIME ZONE 'UTC'::text))::integer
                    ELSE EXTRACT(year FROM (fact_match.match_datetime AT TIME ZONE 'UTC'::text))::integer - 1
                END AS season_start_year
           FROM analytics.fact_match
          WHERE fact_match.match_datetime IS NOT NULL
        )
 SELECT source,
    competition_norm,
    (((((source || '|'::text) || competition_norm) || '|'::text) || season_start_year::text) || '_'::text) || ((season_start_year + 1)::text) AS season_bk,
    season_start_year,
    season_start_year + 1 AS season_end_year,
    (season_start_year::text || '/'::text) || ((season_start_year + 1)::text) AS season_label,
    make_date(season_start_year, 7, 1) AS season_start_date,
    make_date(season_start_year + 1, 6, 30) AS season_end_date
   FROM s;

CREATE VIEW analytics.fact_match_enriched AS
 SELECT fm.source,
    fm.source_match_id,
    fm.match_bk,
    fm.competition,
    fm.competition_norm,
    fm.competition_bk,
    fm.match_datetime,
    fm.match_date_text,
    fm.match_url,
    fm.venue,
    fm.referee,
    fm.attendance,
    fm.attendance_text,
    fm.home_team_source_id,
    fm.home_team_bk,
    fm.home_team_name,
    fm.canonical_home_team_name,
    fm.away_team_source_id,
    fm.away_team_bk,
    fm.away_team_name,
    fm.canonical_away_team_name,
    fm.home_score,
    fm.away_score,
    fm.goal_diff_home,
    fm.match_result_code,
    fm.winner_team_source_id,
    fm.winner_side,
    fm.payload_last_seen_at,
    fm.updated_at,
    dmd.date_key,
    dmd.match_date,
    dmd.calendar_year,
    dmd.calendar_month,
    dmd.calendar_day,
    dmd.calendar_quarter,
    dmd.day_name,
    dmd.iso_day_of_week,
    dmd.is_weekend,
    ds.season_bk,
    ds.season_start_year,
    ds.season_end_year,
    ds.season_label,
    ds.season_start_date,
    ds.season_end_date
   FROM analytics.fact_match fm
     LEFT JOIN analytics.dim_match_date dmd ON dmd.match_date = (fm.match_datetime AT TIME ZONE 'UTC'::text)::date
     LEFT JOIN analytics.dim_season ds ON ds.source = fm.source AND ds.competition_norm = fm.competition_norm AND (fm.match_datetime AT TIME ZONE 'UTC'::text)::date >= ds.season_start_date AND (fm.match_datetime AT TIME ZONE 'UTC'::text)::date <= ds.season_end_date;

CREATE VIEW analytics.fact_team_match_enriched AS
 SELECT ftm.source,
    ftm.source_match_id,
    ftm.source_team_id,
    ftm.match_bk,
    ftm.team_bk,
    ftm.team_match_bk,
    ftm.competition,
    ftm.competition_norm,
    ftm.competition_bk,
    ftm.match_datetime,
    ftm.match_date_text,
    ftm.team_name,
    ftm.canonical_team_name,
    ftm.team_name_norm,
    ftm.opponent_team_source_id,
    ftm.opponent_team_bk,
    ftm.opponent_team_name,
    ftm.canonical_opponent_team_name,
    ftm.team_side,
    ftm.is_home,
    ftm.is_away,
    ftm.score_for,
    ftm.score_against,
    ftm.goal_diff,
    ftm.result_code,
    ftm.points_earned,
    ftm.summary_goals,
    ftm.summary_assists,
    ftm.summary_red_cards,
    ftm.summary_yellow_cards,
    ftm.summary_corners_won,
    ftm.summary_shots,
    ftm.summary_shots_on_target,
    ftm.summary_blocked_shots,
    ftm.summary_passes,
    ftm.summary_crosses,
    ftm.summary_tackles,
    ftm.summary_offsides,
    ftm.summary_fouls_conceded,
    ftm.summary_fouls_won,
    ftm.summary_saves,
    ftm.details_accurate_pass,
    ftm.details_hit_woodwork,
    ftm.details_attempts_ibox,
    ftm.details_attempts_obox,
    ftm.details_headed_shots,
    ftm.details_expected_goals,
    ftm.details_goal_kicks,
    ftm.details_total_throws,
    ftm.details_out_of_box_goals,
    ftm.details_right_foot_goals,
    ftm.details_left_foot_goals,
    ftm.details_headed_goals,
    ftm.details_penalty_goals,
    ftm.details_freekick_goals,
    ftm.details_fantasy_assist,
    ftm.opta_player_count,
    ftm.opta_starter_count,
    ftm.opta_substitute_count,
    ftm.opta_points_total,
    ftm.opta_minutes_total,
    ftm.opta_goals_total,
    ftm.opta_shots_on_target_total,
    ftm.opta_shots_off_target_total,
    ftm.opta_shots_blocked_total,
    ftm.opta_own_goals_total,
    ftm.opta_assists_total,
    ftm.opta_passes_total,
    ftm.opta_crosses_total,
    ftm.opta_tackles_total,
    ftm.opta_interceptions_total,
    ftm.opta_fouls_won_total,
    ftm.opta_fouls_conceded_total,
    ftm.opta_offsides_total,
    ftm.opta_cards_yellow_total,
    ftm.opta_cards_red_total,
    ftm.opta_goals_conceded_total,
    ftm.opta_penalties_won_total,
    ftm.opta_saves_total,
    ftm.opta_penalties_saved_total,
    ftm.raw_summary_totals,
    ftm.raw_details_totals,
    ftm.raw_opta_totals,
    ftm.payload_last_seen_at,
    ftm.updated_at,
    dmd.date_key,
    dmd.match_date,
    dmd.calendar_year,
    dmd.calendar_month,
    dmd.calendar_day,
    dmd.calendar_quarter,
    dmd.day_name,
    dmd.iso_day_of_week,
    dmd.is_weekend,
    ds.season_bk,
    ds.season_start_year,
    ds.season_end_year,
    ds.season_label,
    ds.season_start_date,
    ds.season_end_date
   FROM analytics.fact_team_match ftm
     LEFT JOIN analytics.dim_match_date dmd ON dmd.match_date = (ftm.match_datetime AT TIME ZONE 'UTC'::text)::date
     LEFT JOIN analytics.dim_season ds ON ds.source = ftm.source AND ds.competition_norm = ftm.competition_norm AND (ftm.match_datetime AT TIME ZONE 'UTC'::text)::date >= ds.season_start_date AND (ftm.match_datetime AT TIME ZONE 'UTC'::text)::date <= ds.season_end_date;

CREATE VIEW analytics.fact_player_match_enriched AS
 SELECT fpm.source,
    fpm.source_match_id,
    fpm.source_team_id,
    fpm.source_player_id,
    fpm.match_bk,
    fpm.team_bk,
    fpm.player_bk,
    fpm.player_match_bk,
    fpm.competition,
    fpm.competition_norm,
    fpm.competition_bk,
    fpm.match_datetime,
    fpm.match_date_text,
    fpm.match_url,
    fpm.venue,
    fpm.referee,
    fpm.team_name,
    fpm.canonical_team_name,
    fpm.player_name,
    fpm.canonical_player_name,
    fpm.player_name_norm,
    fpm.player_side,
    fpm.lineup_status,
    fpm.position_code,
    fpm.position_group,
    fpm.accurate_pass,
    fpm.hit_woodwork,
    fpm.attempts_ibox,
    fpm.attempts_obox,
    fpm.headed_shots,
    fpm.expected_goals,
    fpm.goal_kicks,
    fpm.total_throws,
    fpm.out_of_box_goals,
    fpm.right_foot_goals,
    fpm.left_foot_goals,
    fpm.headed_goals,
    fpm.penalty_goals,
    fpm.freekick_goals,
    fpm.fantasy_assist,
    fpm.active_mode,
    fpm.team_rank,
    fpm.points,
    fpm.minutes_played,
    fpm.goals,
    fpm.shots_on_target,
    fpm.shots_off_target,
    fpm.shots_blocked,
    fpm.own_goals,
    fpm.assists,
    fpm.passes,
    fpm.crosses,
    fpm.tackles,
    fpm.interceptions,
    fpm.fouls_won,
    fpm.fouls_conceded,
    fpm.offsides,
    fpm.cards_yellow,
    fpm.cards_red,
    fpm.goals_conceded,
    fpm.penalties_won,
    fpm.saves_total,
    fpm.penalties_saved,
    fpm.shots_total,
    fpm.cards_total,
    fpm.raw_details_stats,
    fpm.raw_opta_stats,
    fpm.payload_last_seen_at,
    fpm.updated_at,
    dmd.date_key,
    dmd.match_date,
    dmd.calendar_year,
    dmd.calendar_month,
    dmd.calendar_day,
    dmd.calendar_quarter,
    dmd.day_name,
    dmd.iso_day_of_week,
    dmd.is_weekend,
    ds.season_bk,
    ds.season_start_year,
    ds.season_end_year,
    ds.season_label,
    ds.season_start_date,
    ds.season_end_date
   FROM analytics.fact_player_match fpm
     LEFT JOIN analytics.dim_match_date dmd ON dmd.match_date = (fpm.match_datetime AT TIME ZONE 'UTC'::text)::date
     LEFT JOIN analytics.dim_season ds ON ds.source = fpm.source AND ds.competition_norm = fpm.competition_norm AND (fpm.match_datetime AT TIME ZONE 'UTC'::text)::date >= ds.season_start_date AND (fpm.match_datetime AT TIME ZONE 'UTC'::text)::date <= ds.season_end_date;

CREATE VIEW analytics.team_match_feature_base AS
 SELECT source,
    source_match_id,
    source_team_id,
    match_bk,
    team_bk,
    team_match_bk,
    competition,
    competition_norm,
    competition_bk,
    match_datetime,
    match_date_text,
    team_name,
    canonical_team_name,
    team_name_norm,
    opponent_team_source_id,
    opponent_team_bk,
    opponent_team_name,
    canonical_opponent_team_name,
    team_side,
    is_home,
    is_away,
    score_for,
    score_against,
    goal_diff,
    result_code,
    points_earned,
    summary_goals,
    summary_assists,
    summary_red_cards,
    summary_yellow_cards,
    summary_corners_won,
    summary_shots,
    summary_shots_on_target,
    summary_blocked_shots,
    summary_passes,
    summary_crosses,
    summary_tackles,
    summary_offsides,
    summary_fouls_conceded,
    summary_fouls_won,
    summary_saves,
    details_accurate_pass,
    details_hit_woodwork,
    details_attempts_ibox,
    details_attempts_obox,
    details_headed_shots,
    details_expected_goals,
    details_goal_kicks,
    details_total_throws,
    details_out_of_box_goals,
    details_right_foot_goals,
    details_left_foot_goals,
    details_headed_goals,
    details_penalty_goals,
    details_freekick_goals,
    details_fantasy_assist,
    opta_player_count,
    opta_starter_count,
    opta_substitute_count,
    opta_points_total,
    opta_minutes_total,
    opta_goals_total,
    opta_shots_on_target_total,
    opta_shots_off_target_total,
    opta_shots_blocked_total,
    opta_own_goals_total,
    opta_assists_total,
    opta_passes_total,
    opta_crosses_total,
    opta_tackles_total,
    opta_interceptions_total,
    opta_fouls_won_total,
    opta_fouls_conceded_total,
    opta_offsides_total,
    opta_cards_yellow_total,
    opta_cards_red_total,
    opta_goals_conceded_total,
    opta_penalties_won_total,
    opta_saves_total,
    opta_penalties_saved_total,
    raw_summary_totals,
    raw_details_totals,
    raw_opta_totals,
    payload_last_seen_at,
    updated_at,
    date_key,
    match_date,
    calendar_year,
    calendar_month,
    calendar_day,
    calendar_quarter,
    day_name,
    iso_day_of_week,
    is_weekend,
    season_bk,
    season_start_year,
    season_end_year,
    season_label,
    season_start_date,
    season_end_date,
    row_number() OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id) AS season_match_number,
    lag(match_datetime) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id) AS prev_match_datetime,
    lag(score_for) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id) AS prev_score_for,
    lag(score_against) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id) AS prev_score_against,
    lag(points_earned) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id) AS prev_points_earned,
    lag(summary_shots) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id) AS prev_summary_shots,
    lag(summary_shots_on_target) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id) AS prev_summary_shots_on_target,
    lag(details_expected_goals) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id) AS prev_expected_goals
   FROM analytics.fact_team_match_enriched x;

CREATE VIEW analytics.team_match_rolling_features AS
 SELECT source,
    source_match_id,
    source_team_id,
    match_bk,
    team_bk,
    team_match_bk,
    competition,
    competition_norm,
    competition_bk,
    match_datetime,
    match_date_text,
    team_name,
    canonical_team_name,
    team_name_norm,
    opponent_team_source_id,
    opponent_team_bk,
    opponent_team_name,
    canonical_opponent_team_name,
    team_side,
    is_home,
    is_away,
    score_for,
    score_against,
    goal_diff,
    result_code,
    points_earned,
    summary_goals,
    summary_assists,
    summary_red_cards,
    summary_yellow_cards,
    summary_corners_won,
    summary_shots,
    summary_shots_on_target,
    summary_blocked_shots,
    summary_passes,
    summary_crosses,
    summary_tackles,
    summary_offsides,
    summary_fouls_conceded,
    summary_fouls_won,
    summary_saves,
    details_accurate_pass,
    details_hit_woodwork,
    details_attempts_ibox,
    details_attempts_obox,
    details_headed_shots,
    details_expected_goals,
    details_goal_kicks,
    details_total_throws,
    details_out_of_box_goals,
    details_right_foot_goals,
    details_left_foot_goals,
    details_headed_goals,
    details_penalty_goals,
    details_freekick_goals,
    details_fantasy_assist,
    opta_player_count,
    opta_starter_count,
    opta_substitute_count,
    opta_points_total,
    opta_minutes_total,
    opta_goals_total,
    opta_shots_on_target_total,
    opta_shots_off_target_total,
    opta_shots_blocked_total,
    opta_own_goals_total,
    opta_assists_total,
    opta_passes_total,
    opta_crosses_total,
    opta_tackles_total,
    opta_interceptions_total,
    opta_fouls_won_total,
    opta_fouls_conceded_total,
    opta_offsides_total,
    opta_cards_yellow_total,
    opta_cards_red_total,
    opta_goals_conceded_total,
    opta_penalties_won_total,
    opta_saves_total,
    opta_penalties_saved_total,
    raw_summary_totals,
    raw_details_totals,
    raw_opta_totals,
    payload_last_seen_at,
    updated_at,
    date_key,
    match_date,
    calendar_year,
    calendar_month,
    calendar_day,
    calendar_quarter,
    day_name,
    iso_day_of_week,
    is_weekend,
    season_bk,
    season_start_year,
    season_end_year,
    season_label,
    season_start_date,
    season_end_date,
    season_match_number,
    prev_match_datetime,
    prev_score_for,
    prev_score_against,
    prev_points_earned,
    prev_summary_shots,
    prev_summary_shots_on_target,
    prev_expected_goals,
        CASE
            WHEN prev_match_datetime IS NOT NULL THEN round(EXTRACT(epoch FROM match_datetime - prev_match_datetime) / 86400.0, 2)
            ELSE NULL::numeric
        END AS days_since_prev_match,
    count(*) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS matches_played_before_match,
    sum(points_earned) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS season_points_before_match,
    avg(points_earned::numeric) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS points_avg_last3,
    avg(points_earned::numeric) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS points_avg_last5,
    sum(points_earned) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS points_sum_last3,
    sum(points_earned) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS points_sum_last5,
    avg(score_for::numeric) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS goals_for_avg_last3,
    avg(score_for::numeric) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS goals_for_avg_last5,
    avg(score_against::numeric) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS goals_against_avg_last3,
    avg(score_against::numeric) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS goals_against_avg_last5,
    avg(summary_shots::numeric) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS shots_avg_last3,
    avg(summary_shots::numeric) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS shots_avg_last5,
    avg(summary_shots_on_target::numeric) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS shots_on_target_avg_last3,
    avg(summary_shots_on_target::numeric) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS shots_on_target_avg_last5,
    avg(details_expected_goals) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS xg_avg_last3,
    avg(details_expected_goals) OVER (PARTITION BY source, source_team_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS xg_avg_last5,
    avg(points_earned::numeric) OVER (PARTITION BY source, source_team_id, season_label, is_home ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS venue_points_avg_last5,
    avg(score_for::numeric) OVER (PARTITION BY source, source_team_id, season_label, is_home ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS venue_goals_for_avg_last5,
    avg(score_against::numeric) OVER (PARTITION BY source, source_team_id, season_label, is_home ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS venue_goals_against_avg_last5,
    avg(summary_shots::numeric) OVER (PARTITION BY source, source_team_id, season_label, is_home ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS venue_shots_avg_last5,
    avg(details_expected_goals) OVER (PARTITION BY source, source_team_id, season_label, is_home ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS venue_xg_avg_last5
   FROM analytics.team_match_feature_base x;

CREATE VIEW analytics.team_match_matchup_features AS
 SELECT s.source,
    s.source_match_id,
    s.source_team_id,
    s.match_bk,
    s.team_bk,
    s.team_match_bk,
    s.season_bk,
    s.season_label,
    s.match_datetime,
    s.match_date,
    s.competition,
    s.competition_norm,
    s.competition_bk,
    s.canonical_team_name,
    s.canonical_opponent_team_name,
    s.team_side,
    s.is_home,
    s.is_away,
    s.score_for,
    s.score_against,
    s.goal_diff,
    s.points_earned,
    s.result_code,
    s.matches_played_before_match,
    s.season_points_before_match,
    s.days_since_prev_match,
    s.points_avg_last3,
    s.points_avg_last5,
    s.points_sum_last3,
    s.points_sum_last5,
    s.goals_for_avg_last3,
    s.goals_for_avg_last5,
    s.goals_against_avg_last3,
    s.goals_against_avg_last5,
    s.shots_avg_last3,
    s.shots_avg_last5,
    s.shots_on_target_avg_last3,
    s.shots_on_target_avg_last5,
    s.xg_avg_last3,
    s.xg_avg_last5,
    s.venue_points_avg_last5,
    s.venue_goals_for_avg_last5,
    s.venue_goals_against_avg_last5,
    s.venue_shots_avg_last5,
    s.venue_xg_avg_last5,
    o.source_team_id AS opponent_source_team_id,
    o.team_bk AS opponent_team_bk,
    o.matches_played_before_match AS opp_matches_played_before_match,
    o.season_points_before_match AS opp_season_points_before_match,
    o.days_since_prev_match AS opp_days_since_prev_match,
    o.points_avg_last3 AS opp_points_avg_last3,
    o.points_avg_last5 AS opp_points_avg_last5,
    o.points_sum_last3 AS opp_points_sum_last3,
    o.points_sum_last5 AS opp_points_sum_last5,
    o.goals_for_avg_last3 AS opp_goals_for_avg_last3,
    o.goals_for_avg_last5 AS opp_goals_for_avg_last5,
    o.goals_against_avg_last3 AS opp_goals_against_avg_last3,
    o.goals_against_avg_last5 AS opp_goals_against_avg_last5,
    o.shots_avg_last3 AS opp_shots_avg_last3,
    o.shots_avg_last5 AS opp_shots_avg_last5,
    o.shots_on_target_avg_last3 AS opp_shots_on_target_avg_last3,
    o.shots_on_target_avg_last5 AS opp_shots_on_target_avg_last5,
    o.xg_avg_last3 AS opp_xg_avg_last3,
    o.xg_avg_last5 AS opp_xg_avg_last5,
    o.venue_points_avg_last5 AS opp_venue_points_avg_last5,
    o.venue_goals_for_avg_last5 AS opp_venue_goals_for_avg_last5,
    o.venue_goals_against_avg_last5 AS opp_venue_goals_against_avg_last5,
    o.venue_shots_avg_last5 AS opp_venue_shots_avg_last5,
    o.venue_xg_avg_last5 AS opp_venue_xg_avg_last5,
    s.points_avg_last5 - o.points_avg_last5 AS diff_points_avg_last5,
    s.goals_for_avg_last5 - o.goals_for_avg_last5 AS diff_goals_for_avg_last5,
    s.goals_against_avg_last5 - o.goals_against_avg_last5 AS diff_goals_against_avg_last5,
    s.shots_avg_last5 - o.shots_avg_last5 AS diff_shots_avg_last5,
    s.shots_on_target_avg_last5 - o.shots_on_target_avg_last5 AS diff_shots_on_target_avg_last5,
    s.xg_avg_last5 - o.xg_avg_last5 AS diff_xg_avg_last5,
    s.venue_points_avg_last5 - o.venue_points_avg_last5 AS diff_venue_points_avg_last5,
    s.venue_goals_for_avg_last5 - o.venue_goals_for_avg_last5 AS diff_venue_goals_for_avg_last5,
    s.venue_goals_against_avg_last5 - o.venue_goals_against_avg_last5 AS diff_venue_goals_against_avg_last5,
    s.venue_shots_avg_last5 - o.venue_shots_avg_last5 AS diff_venue_shots_avg_last5,
    s.venue_xg_avg_last5 - o.venue_xg_avg_last5 AS diff_venue_xg_avg_last5
   FROM analytics.team_match_rolling_features s
     LEFT JOIN analytics.team_match_rolling_features o ON o.source = s.source AND o.source_match_id = s.source_match_id AND o.source_team_id = s.opponent_team_source_id;

CREATE VIEW analytics.model_input_team_match AS
 SELECT source,
    source_match_id,
    source_team_id,
    match_bk,
    team_bk,
    team_match_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    canonical_opponent_team_name,
    team_side,
    is_home,
    is_away,
    points_earned AS target_points,
        CASE
            WHEN score_for > score_against THEN 1
            ELSE 0
        END AS target_win,
        CASE
            WHEN score_for = score_against THEN 1
            ELSE 0
        END AS target_draw,
        CASE
            WHEN score_for < score_against THEN 1
            ELSE 0
        END AS target_loss,
    score_for AS target_goals_for,
    score_against AS target_goals_against,
    goal_diff AS target_goal_diff,
    summary_shots AS target_team_shots,
    summary_shots_on_target AS target_team_shots_on_target,
    details_expected_goals AS target_team_xg,
    summary_shots,
    summary_shots_on_target,
    details_expected_goals,
    days_since_prev_match,
    matches_played_before_match,
    season_points_before_match,
    points_avg_last3,
    points_avg_last5,
    points_sum_last3,
    points_sum_last5,
    goals_for_avg_last3,
    goals_for_avg_last5,
    goals_against_avg_last3,
    goals_against_avg_last5,
    shots_avg_last3,
    shots_avg_last5,
    shots_on_target_avg_last3,
    shots_on_target_avg_last5,
    xg_avg_last3,
    xg_avg_last5,
    venue_points_avg_last5,
    venue_goals_for_avg_last5,
    venue_goals_against_avg_last5,
    venue_shots_avg_last5,
    venue_xg_avg_last5,
    opp_matches_played_before_match,
    opp_season_points_before_match,
    opp_days_since_prev_match,
    opp_points_avg_last3,
    opp_points_avg_last5,
    opp_points_sum_last3,
    opp_points_sum_last5,
    opp_goals_for_avg_last3,
    opp_goals_for_avg_last5,
    opp_goals_against_avg_last3,
    opp_goals_against_avg_last5,
    opp_shots_avg_last3,
    opp_shots_avg_last5,
    opp_shots_on_target_avg_last3,
    opp_shots_on_target_avg_last5,
    opp_xg_avg_last3,
    opp_xg_avg_last5,
    opp_venue_points_avg_last5,
    opp_venue_goals_for_avg_last5,
    opp_venue_goals_against_avg_last5,
    opp_venue_shots_avg_last5,
    opp_venue_xg_avg_last5,
    diff_points_avg_last5,
    diff_goals_for_avg_last5,
    diff_goals_against_avg_last5,
    diff_shots_avg_last5,
    diff_shots_on_target_avg_last5,
    diff_xg_avg_last5,
    diff_venue_points_avg_last5,
    diff_venue_goals_for_avg_last5,
    diff_venue_goals_against_avg_last5,
    diff_venue_shots_avg_last5,
    diff_venue_xg_avg_last5
   FROM ( SELECT tmf.source,
            tmf.source_match_id,
            tmf.source_team_id,
            tmf.match_bk,
            tmf.team_bk,
            tmf.team_match_bk,
            tmf.season_bk,
            tmf.season_label,
            tmf.match_datetime,
            tmf.match_date,
            tmf.competition,
            tmf.competition_norm,
            tmf.competition_bk,
            tmf.canonical_team_name,
            tmf.canonical_opponent_team_name,
            tmf.team_side,
            tmf.is_home,
            tmf.is_away,
            tmf.score_for,
            tmf.score_against,
            tmf.goal_diff,
            tmf.points_earned,
            tmf.result_code,
            tmf.matches_played_before_match,
            tmf.season_points_before_match,
            tmf.days_since_prev_match,
            tmf.points_avg_last3,
            tmf.points_avg_last5,
            tmf.points_sum_last3,
            tmf.points_sum_last5,
            tmf.goals_for_avg_last3,
            tmf.goals_for_avg_last5,
            tmf.goals_against_avg_last3,
            tmf.goals_against_avg_last5,
            tmf.shots_avg_last3,
            tmf.shots_avg_last5,
            tmf.shots_on_target_avg_last3,
            tmf.shots_on_target_avg_last5,
            tmf.xg_avg_last3,
            tmf.xg_avg_last5,
            tmf.venue_points_avg_last5,
            tmf.venue_goals_for_avg_last5,
            tmf.venue_goals_against_avg_last5,
            tmf.venue_shots_avg_last5,
            tmf.venue_xg_avg_last5,
            tmf.opponent_source_team_id,
            tmf.opponent_team_bk,
            tmf.opp_matches_played_before_match,
            tmf.opp_season_points_before_match,
            tmf.opp_days_since_prev_match,
            tmf.opp_points_avg_last3,
            tmf.opp_points_avg_last5,
            tmf.opp_points_sum_last3,
            tmf.opp_points_sum_last5,
            tmf.opp_goals_for_avg_last3,
            tmf.opp_goals_for_avg_last5,
            tmf.opp_goals_against_avg_last3,
            tmf.opp_goals_against_avg_last5,
            tmf.opp_shots_avg_last3,
            tmf.opp_shots_avg_last5,
            tmf.opp_shots_on_target_avg_last3,
            tmf.opp_shots_on_target_avg_last5,
            tmf.opp_xg_avg_last3,
            tmf.opp_xg_avg_last5,
            tmf.opp_venue_points_avg_last5,
            tmf.opp_venue_goals_for_avg_last5,
            tmf.opp_venue_goals_against_avg_last5,
            tmf.opp_venue_shots_avg_last5,
            tmf.opp_venue_xg_avg_last5,
            tmf.diff_points_avg_last5,
            tmf.diff_goals_for_avg_last5,
            tmf.diff_goals_against_avg_last5,
            tmf.diff_shots_avg_last5,
            tmf.diff_shots_on_target_avg_last5,
            tmf.diff_xg_avg_last5,
            tmf.diff_venue_points_avg_last5,
            tmf.diff_venue_goals_for_avg_last5,
            tmf.diff_venue_goals_against_avg_last5,
            tmf.diff_venue_shots_avg_last5,
            tmf.diff_venue_xg_avg_last5,
            ftm.summary_shots,
            ftm.summary_shots_on_target,
            ftm.details_expected_goals
           FROM analytics.team_match_matchup_features tmf
             LEFT JOIN analytics.fact_team_match_enriched ftm ON ftm.source = tmf.source AND ftm.source_match_id = tmf.source_match_id AND ftm.source_team_id = tmf.source_team_id) z;

CREATE VIEW analytics.model_input_team_match_ready AS
 SELECT source,
    source_match_id,
    source_team_id,
    match_bk,
    team_bk,
    team_match_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    canonical_opponent_team_name,
    team_side,
    is_home,
    is_away,
    target_points,
    target_win,
    target_draw,
    target_loss,
    target_goals_for,
    target_goals_against,
    target_goal_diff,
    target_team_shots,
    target_team_shots_on_target,
    target_team_xg,
    summary_shots,
    summary_shots_on_target,
    details_expected_goals,
    days_since_prev_match,
    matches_played_before_match,
    season_points_before_match,
    points_avg_last3,
    points_avg_last5,
    points_sum_last3,
    points_sum_last5,
    goals_for_avg_last3,
    goals_for_avg_last5,
    goals_against_avg_last3,
    goals_against_avg_last5,
    shots_avg_last3,
    shots_avg_last5,
    shots_on_target_avg_last3,
    shots_on_target_avg_last5,
    xg_avg_last3,
    xg_avg_last5,
    venue_points_avg_last5,
    venue_goals_for_avg_last5,
    venue_goals_against_avg_last5,
    venue_shots_avg_last5,
    venue_xg_avg_last5,
    opp_matches_played_before_match,
    opp_season_points_before_match,
    opp_days_since_prev_match,
    opp_points_avg_last3,
    opp_points_avg_last5,
    opp_points_sum_last3,
    opp_points_sum_last5,
    opp_goals_for_avg_last3,
    opp_goals_for_avg_last5,
    opp_goals_against_avg_last3,
    opp_goals_against_avg_last5,
    opp_shots_avg_last3,
    opp_shots_avg_last5,
    opp_shots_on_target_avg_last3,
    opp_shots_on_target_avg_last5,
    opp_xg_avg_last3,
    opp_xg_avg_last5,
    opp_venue_points_avg_last5,
    opp_venue_goals_for_avg_last5,
    opp_venue_goals_against_avg_last5,
    opp_venue_shots_avg_last5,
    opp_venue_xg_avg_last5,
    diff_points_avg_last5,
    diff_goals_for_avg_last5,
    diff_goals_against_avg_last5,
    diff_shots_avg_last5,
    diff_shots_on_target_avg_last5,
    diff_xg_avg_last5,
    diff_venue_points_avg_last5,
    diff_venue_goals_for_avg_last5,
    diff_venue_goals_against_avg_last5,
    diff_venue_shots_avg_last5,
    diff_venue_xg_avg_last5
   FROM analytics.model_input_team_match
  WHERE season_label IS NOT NULL AND match_datetime IS NOT NULL AND matches_played_before_match >= 5 AND COALESCE(opp_matches_played_before_match, 0::bigint) >= 5;

CREATE VIEW analytics.model_input_team_match_qc AS
 SELECT count(*) AS total_rows,
    count(*) FILTER (WHERE season_label IS NULL) AS season_label_null_rows,
    count(*) FILTER (WHERE match_datetime IS NULL) AS match_datetime_null_rows,
    count(*) FILTER (WHERE matches_played_before_match IS NULL) AS matches_played_before_match_null_rows,
    count(*) FILTER (WHERE opp_matches_played_before_match IS NULL) AS opp_matches_played_before_match_null_rows,
    count(*) FILTER (WHERE xg_avg_last5 IS NULL) AS xg_avg_last5_null_rows,
    count(*) FILTER (WHERE opp_xg_avg_last5 IS NULL) AS opp_xg_avg_last5_null_rows,
    count(*) FILTER (WHERE target_points IS NULL) AS target_points_null_rows
   FROM analytics.model_input_team_match;

CREATE VIEW analytics.model_input_team_match_ready_qc AS
 SELECT count(*) AS total_rows,
    min(match_datetime) AS min_match_datetime,
    max(match_datetime) AS max_match_datetime,
    count(DISTINCT season_label) AS distinct_season_count,
    count(DISTINCT canonical_team_name) AS distinct_team_count,
    count(DISTINCT competition_norm) AS distinct_competition_count
   FROM analytics.model_input_team_match_ready;

CREATE VIEW analytics.player_match_feature_base AS
 SELECT source,
    source_match_id,
    source_team_id,
    source_player_id,
    match_bk,
    team_bk,
    player_bk,
    player_match_bk,
    competition,
    competition_norm,
    competition_bk,
    match_datetime,
    match_date_text,
    match_url,
    venue,
    referee,
    team_name,
    canonical_team_name,
    player_name,
    canonical_player_name,
    player_name_norm,
    player_side,
    lineup_status,
    position_code,
    position_group,
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
    active_mode,
    team_rank,
    points,
    minutes_played,
    goals,
    shots_on_target,
    shots_off_target,
    shots_blocked,
    own_goals,
    assists,
    passes,
    crosses,
    tackles,
    interceptions,
    fouls_won,
    fouls_conceded,
    offsides,
    cards_yellow,
    cards_red,
    goals_conceded,
    penalties_won,
    saves_total,
    penalties_saved,
    shots_total,
    cards_total,
    raw_details_stats,
    raw_opta_stats,
    payload_last_seen_at,
    updated_at,
    date_key,
    match_date,
    calendar_year,
    calendar_month,
    calendar_day,
    calendar_quarter,
    day_name,
    iso_day_of_week,
    is_weekend,
    season_bk,
    season_start_year,
    season_end_year,
    season_label,
    season_start_date,
    season_end_date,
    row_number() OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id) AS season_match_number,
    lag(match_datetime) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id) AS prev_match_datetime,
    lag(minutes_played) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id) AS prev_minutes_played,
    lag(goals) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id) AS prev_goals,
    lag(assists) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id) AS prev_assists,
    lag(shots_total) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id) AS prev_shots_total,
    lag(expected_goals) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id) AS prev_expected_goals
   FROM analytics.fact_player_match_enriched x;

CREATE VIEW analytics.player_match_rolling_features AS
 SELECT source,
    source_match_id,
    source_team_id,
    source_player_id,
    match_bk,
    team_bk,
    player_bk,
    player_match_bk,
    competition,
    competition_norm,
    competition_bk,
    match_datetime,
    match_date_text,
    match_url,
    venue,
    referee,
    team_name,
    canonical_team_name,
    player_name,
    canonical_player_name,
    player_name_norm,
    player_side,
    lineup_status,
    position_code,
    position_group,
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
    active_mode,
    team_rank,
    points,
    minutes_played,
    goals,
    shots_on_target,
    shots_off_target,
    shots_blocked,
    own_goals,
    assists,
    passes,
    crosses,
    tackles,
    interceptions,
    fouls_won,
    fouls_conceded,
    offsides,
    cards_yellow,
    cards_red,
    goals_conceded,
    penalties_won,
    saves_total,
    penalties_saved,
    shots_total,
    cards_total,
    raw_details_stats,
    raw_opta_stats,
    payload_last_seen_at,
    updated_at,
    date_key,
    match_date,
    calendar_year,
    calendar_month,
    calendar_day,
    calendar_quarter,
    day_name,
    iso_day_of_week,
    is_weekend,
    season_bk,
    season_start_year,
    season_end_year,
    season_label,
    season_start_date,
    season_end_date,
    season_match_number,
    prev_match_datetime,
    prev_minutes_played,
    prev_goals,
    prev_assists,
    prev_shots_total,
    prev_expected_goals,
        CASE
            WHEN prev_match_datetime IS NOT NULL THEN round(EXTRACT(epoch FROM match_datetime - prev_match_datetime) / 86400.0, 2)
            ELSE NULL::numeric
        END AS days_since_prev_match,
    count(*) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS matches_played_before_match,
    avg(minutes_played::numeric) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS minutes_avg_last3,
    avg(minutes_played::numeric) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS minutes_avg_last5,
    avg(goals::numeric) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS goals_avg_last3,
    avg(goals::numeric) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS goals_avg_last5,
    avg(assists::numeric) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS assists_avg_last3,
    avg(assists::numeric) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS assists_avg_last5,
    avg(points) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS opta_points_avg_last3,
    avg(points) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS opta_points_avg_last5,
    avg(shots_total::numeric) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS shots_avg_last3,
    avg(shots_total::numeric) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS shots_avg_last5,
    avg(shots_on_target::numeric) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS shots_on_target_avg_last3,
    avg(shots_on_target::numeric) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS shots_on_target_avg_last5,
    avg(expected_goals) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS xg_avg_last3,
    avg(expected_goals) OVER (PARTITION BY source, source_player_id, season_label ORDER BY match_datetime, source_match_id ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) AS xg_avg_last5
   FROM analytics.player_match_feature_base x;

CREATE VIEW analytics.model_input_player_match AS
 SELECT source,
    source_match_id,
    source_team_id,
    source_player_id,
    match_bk,
    team_bk,
    player_bk,
    player_match_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    canonical_player_name,
    player_name_norm,
    player_side,
    lineup_status,
    position_code,
    position_group,
    minutes_played AS target_minutes_played,
    goals AS target_goals,
    assists AS target_assists,
    points AS target_opta_points,
    shots_total AS target_shots_total,
    shots_on_target AS target_shots_on_target,
    expected_goals AS target_xg,
    days_since_prev_match,
    matches_played_before_match,
    minutes_avg_last3,
    minutes_avg_last5,
    goals_avg_last3,
    goals_avg_last5,
    assists_avg_last3,
    assists_avg_last5,
    opta_points_avg_last3,
    opta_points_avg_last5,
    shots_avg_last3,
    shots_avg_last5,
    shots_on_target_avg_last3,
    shots_on_target_avg_last5,
    xg_avg_last3,
    xg_avg_last5
   FROM analytics.player_match_rolling_features;

CREATE VIEW analytics.model_input_player_match_ready AS
 SELECT source,
    source_match_id,
    source_team_id,
    source_player_id,
    match_bk,
    team_bk,
    player_bk,
    player_match_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    canonical_player_name,
    player_name_norm,
    player_side,
    lineup_status,
    position_code,
    position_group,
    target_minutes_played,
    target_goals,
    target_assists,
    target_opta_points,
    target_shots_total,
    target_shots_on_target,
    target_xg,
    days_since_prev_match,
    matches_played_before_match,
    minutes_avg_last3,
    minutes_avg_last5,
    goals_avg_last3,
    goals_avg_last5,
    assists_avg_last3,
    assists_avg_last5,
    opta_points_avg_last3,
    opta_points_avg_last5,
    shots_avg_last3,
    shots_avg_last5,
    shots_on_target_avg_last3,
    shots_on_target_avg_last5,
    xg_avg_last3,
    xg_avg_last5
   FROM analytics.model_input_player_match
  WHERE season_label IS NOT NULL AND match_datetime IS NOT NULL AND matches_played_before_match >= 5;

CREATE VIEW analytics.model_input_player_match_qc AS
 SELECT count(*) AS total_rows,
    count(*) FILTER (WHERE season_label IS NULL) AS season_label_null_rows,
    count(*) FILTER (WHERE match_datetime IS NULL) AS match_datetime_null_rows,
    count(*) FILTER (WHERE matches_played_before_match IS NULL) AS matches_played_before_match_null_rows,
    count(*) FILTER (WHERE xg_avg_last5 IS NULL) AS xg_avg_last5_null_rows,
    count(*) FILTER (WHERE target_minutes_played IS NULL) AS target_minutes_played_null_rows,
    count(*) FILTER (WHERE target_opta_points IS NULL) AS target_opta_points_null_rows
   FROM analytics.model_input_player_match;

CREATE VIEW analytics.model_input_player_match_ready_qc AS
 SELECT count(*) AS total_rows,
    min(match_datetime) AS min_match_datetime,
    max(match_datetime) AS max_match_datetime,
    count(DISTINCT season_label) AS distinct_season_count,
    count(DISTINCT canonical_team_name) AS distinct_team_count,
    count(DISTINCT canonical_player_name) AS distinct_player_count,
    count(DISTINCT competition_norm) AS distinct_competition_count
   FROM analytics.model_input_player_match_ready;

CREATE VIEW analytics.team_squad_by_match AS
 SELECT source,
    source_match_id,
    source_team_id,
    source_player_id,
    match_bk,
    team_bk,
    player_bk,
    player_match_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    canonical_player_name,
    player_name_norm,
    player_side,
    lineup_status,
    position_code,
    position_group,
        CASE
            WHEN upper(COALESCE(position_code, ''::text)) = 'SUB'::text THEN 'SUBSTITUTE'::text
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%sub%'::text THEN 'SUBSTITUTE'::text
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%bench%'::text THEN 'SUBSTITUTE'::text
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%start%'::text THEN 'STARTER'::text
            WHEN upper(COALESCE(position_code, ''::text)) = ANY (ARRAY['GK'::text, 'DF'::text, 'MF'::text, 'FW'::text]) THEN 'STARTER'::text
            ELSE 'UNKNOWN'::text
        END AS squad_role,
        CASE
            WHEN upper(COALESCE(position_code, ''::text)) = 'SUB'::text THEN false
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%sub%'::text THEN false
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%bench%'::text THEN false
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%start%'::text THEN true
            WHEN upper(COALESCE(position_code, ''::text)) = ANY (ARRAY['GK'::text, 'DF'::text, 'MF'::text, 'FW'::text]) THEN true
            ELSE NULL::boolean
        END AS is_starter,
        CASE
            WHEN upper(COALESCE(position_code, ''::text)) = 'SUB'::text THEN true
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%sub%'::text THEN true
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%bench%'::text THEN true
            ELSE false
        END AS is_substitute,
        CASE
            WHEN COALESCE(minutes_played, 0) > 0 THEN true
            ELSE false
        END AS played_any_minutes,
    minutes_played,
    goals,
    assists,
    points AS opta_points,
    shots_total,
    shots_on_target,
    expected_goals,
    cards_total
   FROM analytics.fact_player_match_enriched p;

CREATE VIEW analytics.team_starting_xi_by_match AS
 SELECT source,
    source_match_id,
    source_team_id,
    source_player_id,
    match_bk,
    team_bk,
    player_bk,
    player_match_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    canonical_player_name,
    player_name_norm,
    player_side,
    lineup_status,
    position_code,
    position_group,
    squad_role,
    is_starter,
    is_substitute,
    played_any_minutes,
    minutes_played,
    goals,
    assists,
    opta_points,
    shots_total,
    shots_on_target,
    expected_goals,
    cards_total
   FROM analytics.team_squad_by_match
  WHERE is_starter = true;

CREATE VIEW analytics.team_bench_by_match AS
 SELECT source,
    source_match_id,
    source_team_id,
    source_player_id,
    match_bk,
    team_bk,
    player_bk,
    player_match_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    canonical_player_name,
    player_name_norm,
    player_side,
    lineup_status,
    position_code,
    position_group,
    squad_role,
    is_starter,
    is_substitute,
    played_any_minutes,
    minutes_played,
    goals,
    assists,
    opta_points,
    shots_total,
    shots_on_target,
    expected_goals,
    cards_total
   FROM analytics.team_squad_by_match
  WHERE is_substitute = true;

CREATE VIEW analytics.team_lineup_summary_by_match AS
 SELECT source,
    source_match_id,
    source_team_id,
    match_bk,
    team_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    count(*) AS squad_row_count,
    count(*) FILTER (WHERE is_starter = true) AS starter_count,
    count(*) FILTER (WHERE is_substitute = true) AS substitute_count,
    count(*) FILTER (WHERE played_any_minutes = true) AS players_with_minutes_count,
    sum(COALESCE(minutes_played, 0)) AS total_minutes_played,
    sum(COALESCE(goals, 0)) AS total_player_goals,
    sum(COALESCE(assists, 0)) AS total_player_assists,
    sum(COALESCE(opta_points, 0::numeric)) AS total_player_opta_points,
    sum(COALESCE(shots_total, 0)) AS total_player_shots,
    sum(COALESCE(shots_on_target, 0)) AS total_player_shots_on_target,
    sum(COALESCE(expected_goals, 0::numeric)) AS total_player_xg
   FROM analytics.team_squad_by_match
  GROUP BY source, source_match_id, source_team_id, match_bk, team_bk, season_bk, season_label, match_datetime, match_date, competition, competition_norm, competition_bk, canonical_team_name;

CREATE VIEW analytics.lineup_status_audit AS
 SELECT COALESCE(lineup_status, '[NULL]'::text) AS lineup_status,
    COALESCE(position_code, '[NULL]'::text) AS position_code,
    COALESCE(position_group, '[NULL]'::text) AS position_group,
    count(*) AS row_count
   FROM analytics.team_squad_by_match
  GROUP BY (COALESCE(lineup_status, '[NULL]'::text)), (COALESCE(position_code, '[NULL]'::text)), (COALESCE(position_group, '[NULL]'::text))
  ORDER BY (count(*)) DESC, (COALESCE(lineup_status, '[NULL]'::text)), (COALESCE(position_code, '[NULL]'::text));

CREATE VIEW analytics.team_participants_by_match AS
 SELECT source,
    source_match_id,
    source_team_id,
    source_player_id,
    match_bk,
    team_bk,
    player_bk,
    player_match_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    canonical_player_name,
    player_name_norm,
    player_side,
    lineup_status,
    upper(TRIM(BOTH FROM COALESCE(position_code, ''::text))) AS position_code_norm,
        CASE
            WHEN upper(TRIM(BOTH FROM COALESCE(position_code, ''::text))) = 'SUB'::text THEN 'SUBSTITUTE'::text
            ELSE position_group
        END AS position_group_norm,
        CASE
            WHEN upper(TRIM(BOTH FROM COALESCE(position_code, ''::text))) = 'SUB'::text THEN 'SUBSTITUTE'::text
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%sub%'::text THEN 'SUBSTITUTE'::text
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%bench%'::text THEN 'SUBSTITUTE'::text
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%start%'::text THEN 'STARTER'::text
            WHEN upper(TRIM(BOTH FROM COALESCE(position_code, ''::text))) = ANY (ARRAY['GK'::text, 'DF'::text, 'MF'::text, 'FW'::text]) THEN 'STARTER'::text
            ELSE 'UNKNOWN'::text
        END AS participant_role,
        CASE
            WHEN upper(TRIM(BOTH FROM COALESCE(position_code, ''::text))) = 'SUB'::text THEN false
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%sub%'::text THEN false
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%bench%'::text THEN false
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%start%'::text THEN true
            WHEN upper(TRIM(BOTH FROM COALESCE(position_code, ''::text))) = ANY (ARRAY['GK'::text, 'DF'::text, 'MF'::text, 'FW'::text]) THEN true
            ELSE NULL::boolean
        END AS is_starter,
        CASE
            WHEN upper(TRIM(BOTH FROM COALESCE(position_code, ''::text))) = 'SUB'::text THEN true
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%sub%'::text THEN true
            WHEN lower(COALESCE(lineup_status, ''::text)) ~~ '%bench%'::text THEN true
            ELSE false
        END AS is_substitute,
        CASE
            WHEN COALESCE(minutes_played, 0) > 0 THEN true
            ELSE false
        END AS played_any_minutes,
    minutes_played,
    goals,
    assists,
    points AS opta_points,
    shots_total,
    shots_on_target,
    expected_goals,
    cards_total
   FROM analytics.fact_player_match_enriched p;

CREATE VIEW analytics.team_starting_participants_by_match AS
 SELECT source,
    source_match_id,
    source_team_id,
    source_player_id,
    match_bk,
    team_bk,
    player_bk,
    player_match_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    canonical_player_name,
    player_name_norm,
    player_side,
    lineup_status,
    position_code_norm,
    position_group_norm,
    participant_role,
    is_starter,
    is_substitute,
    played_any_minutes,
    minutes_played,
    goals,
    assists,
    opta_points,
    shots_total,
    shots_on_target,
    expected_goals,
    cards_total
   FROM analytics.team_participants_by_match
  WHERE is_starter = true;

CREATE VIEW analytics.team_substitute_participants_by_match AS
 SELECT source,
    source_match_id,
    source_team_id,
    source_player_id,
    match_bk,
    team_bk,
    player_bk,
    player_match_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    canonical_player_name,
    player_name_norm,
    player_side,
    lineup_status,
    position_code_norm,
    position_group_norm,
    participant_role,
    is_starter,
    is_substitute,
    played_any_minutes,
    minutes_played,
    goals,
    assists,
    opta_points,
    shots_total,
    shots_on_target,
    expected_goals,
    cards_total
   FROM analytics.team_participants_by_match
  WHERE is_substitute = true;

CREATE VIEW analytics.team_participation_summary_by_match AS
 SELECT source,
    source_match_id,
    source_team_id,
    match_bk,
    team_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    count(*) AS participant_row_count,
    count(*) FILTER (WHERE is_starter = true) AS starter_count,
    count(*) FILTER (WHERE is_substitute = true) AS substitute_count,
    count(*) FILTER (WHERE played_any_minutes = true) AS players_with_minutes_count,
    sum(COALESCE(minutes_played, 0)) AS total_minutes_played,
    sum(COALESCE(goals, 0)) AS total_player_goals,
    sum(COALESCE(assists, 0)) AS total_player_assists,
    sum(COALESCE(opta_points, 0::numeric)) AS total_player_opta_points,
    sum(COALESCE(shots_total, 0)) AS total_player_shots,
    sum(COALESCE(shots_on_target, 0)) AS total_player_shots_on_target,
    sum(COALESCE(expected_goals, 0::numeric)) AS total_player_xg
   FROM analytics.team_participants_by_match
  GROUP BY source, source_match_id, source_team_id, match_bk, team_bk, season_bk, season_label, match_datetime, match_date, competition, competition_norm, competition_bk, canonical_team_name;

CREATE VIEW analytics.participant_role_audit AS
 SELECT COALESCE(lineup_status, '[NULL]'::text) AS lineup_status,
    COALESCE(position_code_norm, '[NULL]'::text) AS position_code_norm,
    COALESCE(position_group_norm, '[NULL]'::text) AS position_group_norm,
    COALESCE(participant_role, '[NULL]'::text) AS participant_role,
    count(*) AS row_count
   FROM analytics.team_participants_by_match
  GROUP BY (COALESCE(lineup_status, '[NULL]'::text)), (COALESCE(position_code_norm, '[NULL]'::text)), (COALESCE(position_group_norm, '[NULL]'::text)), (COALESCE(participant_role, '[NULL]'::text))
  ORDER BY (count(*)) DESC, (COALESCE(lineup_status, '[NULL]'::text)), (COALESCE(position_code_norm, '[NULL]'::text));

CREATE VIEW analytics.participation_minutes_qc AS
 SELECT source,
    source_match_id,
    source_team_id,
    match_bk,
    team_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    participant_row_count,
    starter_count,
    substitute_count,
    players_with_minutes_count,
    total_minutes_played,
    total_player_goals,
    total_player_assists,
    total_player_opta_points,
    total_player_shots,
    total_player_shots_on_target,
    total_player_xg,
    990 - total_minutes_played AS minute_gap_from_990
   FROM analytics.team_participation_summary_by_match
  ORDER BY (abs(990 - total_minutes_played)) DESC, match_datetime DESC;

CREATE VIEW analytics.participation_coverage_flags AS
 SELECT source,
    source_match_id,
    source_team_id,
    match_bk,
    team_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    participant_row_count,
    starter_count,
    substitute_count,
    players_with_minutes_count,
    total_minutes_played,
    total_player_goals,
    total_player_assists,
    total_player_opta_points,
    total_player_shots,
    total_player_shots_on_target,
    total_player_xg,
    minute_gap_from_990,
        CASE
            WHEN starter_count = 11 THEN true
            ELSE false
        END AS has_11_starters,
        CASE
            WHEN total_minutes_played >= 985 AND total_minutes_played <= 995 THEN true
            ELSE false
        END AS minutes_near_990,
        CASE
            WHEN participant_row_count >= 14 THEN true
            ELSE false
        END AS has_reasonable_participant_count,
        CASE
            WHEN minute_gap_from_990 <= 10 THEN 'HIGH'::text
            WHEN minute_gap_from_990 <= 30 THEN 'MEDIUM'::text
            ELSE 'LOW'::text
        END AS participation_coverage_level,
        CASE
            WHEN starter_count = 11 AND participant_row_count >= 14 AND minute_gap_from_990 <= 10 THEN true
            ELSE false
        END AS is_strong_participation_coverage
   FROM analytics.participation_minutes_qc s;

CREATE VIEW analytics.fact_player_match_enriched_with_coverage AS
 SELECT p.source,
    p.source_match_id,
    p.source_team_id,
    p.source_player_id,
    p.match_bk,
    p.team_bk,
    p.player_bk,
    p.player_match_bk,
    p.competition,
    p.competition_norm,
    p.competition_bk,
    p.match_datetime,
    p.match_date_text,
    p.match_url,
    p.venue,
    p.referee,
    p.team_name,
    p.canonical_team_name,
    p.player_name,
    p.canonical_player_name,
    p.player_name_norm,
    p.player_side,
    p.lineup_status,
    p.position_code,
    p.position_group,
    p.accurate_pass,
    p.hit_woodwork,
    p.attempts_ibox,
    p.attempts_obox,
    p.headed_shots,
    p.expected_goals,
    p.goal_kicks,
    p.total_throws,
    p.out_of_box_goals,
    p.right_foot_goals,
    p.left_foot_goals,
    p.headed_goals,
    p.penalty_goals,
    p.freekick_goals,
    p.fantasy_assist,
    p.active_mode,
    p.team_rank,
    p.points,
    p.minutes_played,
    p.goals,
    p.shots_on_target,
    p.shots_off_target,
    p.shots_blocked,
    p.own_goals,
    p.assists,
    p.passes,
    p.crosses,
    p.tackles,
    p.interceptions,
    p.fouls_won,
    p.fouls_conceded,
    p.offsides,
    p.cards_yellow,
    p.cards_red,
    p.goals_conceded,
    p.penalties_won,
    p.saves_total,
    p.penalties_saved,
    p.shots_total,
    p.cards_total,
    p.raw_details_stats,
    p.raw_opta_stats,
    p.payload_last_seen_at,
    p.updated_at,
    p.date_key,
    p.match_date,
    p.calendar_year,
    p.calendar_month,
    p.calendar_day,
    p.calendar_quarter,
    p.day_name,
    p.iso_day_of_week,
    p.is_weekend,
    p.season_bk,
    p.season_start_year,
    p.season_end_year,
    p.season_label,
    p.season_start_date,
    p.season_end_date,
    f.participant_row_count,
    f.starter_count,
    f.substitute_count,
    f.players_with_minutes_count,
    f.total_minutes_played,
    f.minute_gap_from_990,
    f.has_11_starters,
    f.minutes_near_990,
    f.has_reasonable_participant_count,
    f.participation_coverage_level,
    f.is_strong_participation_coverage
   FROM analytics.fact_player_match_enriched p
     LEFT JOIN analytics.participation_coverage_flags f ON f.source = p.source AND f.source_match_id = p.source_match_id AND f.source_team_id = p.source_team_id;

CREATE VIEW analytics.model_input_player_match_ready_strong_coverage AS
 SELECT source,
    source_match_id,
    source_team_id,
    source_player_id,
    match_bk,
    team_bk,
    player_bk,
    player_match_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    canonical_player_name,
    player_name_norm,
    player_side,
    lineup_status,
    position_code,
    position_group,
    target_minutes_played,
    target_goals,
    target_assists,
    target_opta_points,
    target_shots_total,
    target_shots_on_target,
    target_xg,
    days_since_prev_match,
    matches_played_before_match,
    minutes_avg_last3,
    minutes_avg_last5,
    goals_avg_last3,
    goals_avg_last5,
    assists_avg_last3,
    assists_avg_last5,
    opta_points_avg_last3,
    opta_points_avg_last5,
    shots_avg_last3,
    shots_avg_last5,
    shots_on_target_avg_last3,
    shots_on_target_avg_last5,
    xg_avg_last3,
    xg_avg_last5
   FROM analytics.model_input_player_match_ready p
  WHERE (EXISTS ( SELECT 1
           FROM analytics.participation_coverage_flags f
          WHERE f.source = p.source AND f.source_match_id = p.source_match_id AND f.source_team_id = p.source_team_id AND f.is_strong_participation_coverage = true));

CREATE VIEW analytics.participation_coverage_summary AS
 SELECT participation_coverage_level,
    count(*) AS team_match_count
   FROM analytics.participation_coverage_flags
  GROUP BY participation_coverage_level
  ORDER BY participation_coverage_level;

CREATE VIEW mapping.v_incident_type_observed AS
 SELECT source,
    COALESCE(NULLIF(TRIM(BOTH FROM event_type_code), ''::text), NULLIF(TRIM(BOTH FROM event_title), ''::text), '[UNKNOWN]'::text) AS observed_incident_type,
    regexp_replace(translate(lower(COALESCE(NULLIF(TRIM(BOTH FROM event_type_code), ''::text), NULLIF(TRIM(BOTH FROM event_title), ''::text), '[UNKNOWN]'::text)), 'çğıöşüâîûÇĞİÖŞÜÂÎÛ'::text, 'cgiosuaiucgiosuaiu'::text), '[^a-z0-9]+'::text, ''::text, 'g'::text) AS raw_incident_type,
    event_type_code,
    event_title,
    match_datetime
   FROM analytics.fact_match_incident i;

CREATE VIEW mapping.v_incident_type_variants AS
 SELECT source,
    raw_incident_type,
    count(*) AS row_count,
    count(DISTINCT COALESCE(event_type_code, '[NULL]'::text)) AS distinct_event_type_code_count,
    count(DISTINCT COALESCE(event_title, '[NULL]'::text)) AS distinct_event_title_count,
    string_agg(DISTINCT COALESCE(event_type_code, '[NULL]'::text), ' | '::text ORDER BY (COALESCE(event_type_code, '[NULL]'::text))) AS observed_event_type_codes,
    string_agg(DISTINCT COALESCE(event_title, '[NULL]'::text), ' | '::text ORDER BY (COALESCE(event_title, '[NULL]'::text))) AS observed_event_titles,
    min(match_datetime) AS first_seen_match_datetime,
    max(match_datetime) AS last_seen_match_datetime
   FROM mapping.v_incident_type_observed
  GROUP BY source, raw_incident_type;

CREATE VIEW mapping.v_incident_type_mapping_audit AS
 SELECT m.source,
    m.raw_incident_type,
    m.canonical_incident_type,
    m.canonical_incident_group,
    m.latest_observed_event_type_code,
    m.latest_observed_event_title,
    m.observed_row_count,
    m.first_seen_match_datetime,
    m.last_seen_match_datetime,
    v.distinct_event_type_code_count,
    v.distinct_event_title_count,
    v.observed_event_type_codes,
    v.observed_event_titles
   FROM mapping.map_incident_type m
     LEFT JOIN mapping.v_incident_type_variants v ON v.source = m.source AND v.raw_incident_type = m.raw_incident_type;

CREATE VIEW mapping.v_incident_subtype_observed AS
 SELECT source,
    COALESCE(NULLIF(TRIM(BOTH FROM event_type_code), ''::text), '[UNKNOWN]'::text) AS event_type_code,
    COALESCE(NULLIF(TRIM(BOTH FROM event_title), ''::text), '[UNKNOWN]'::text) AS event_title,
    regexp_replace(translate(lower(COALESCE(NULLIF(TRIM(BOTH FROM event_title), ''::text), '[UNKNOWN]'::text)), 'çğıöşüâîûÇĞİÖŞÜÂÎÛ'::text, 'cgiosuaiucgiosuaiu'::text), '[^a-z0-9]+'::text, ''::text, 'g'::text) AS event_title_norm,
    match_datetime
   FROM analytics.fact_match_incident i;

CREATE VIEW mapping.v_incident_subtype_mapping_audit AS
 SELECT source,
    event_type_code,
    event_title_norm,
    canonical_incident_type,
    canonical_incident_group,
    observed_row_count,
    first_seen_match_datetime,
    last_seen_match_datetime,
    latest_observed_event_title
   FROM mapping.map_incident_subtype;

CREATE VIEW analytics.fact_match_incident_enriched AS
 SELECT f.source,
    f.source_match_id,
    f.match_bk,
    f.incident_bk,
    f.incident_key,
    f.source_incident_id,
    f.competition,
    f.competition_norm,
    f.competition_bk,
    f.match_datetime,
    f.match_date_text,
    f.match_url,
    f.home_team_source_id,
    f.away_team_source_id,
    f.canonical_home_team_name,
    f.canonical_away_team_name,
    f.side,
    f.event_type_code,
    f.event_title,
    f.minute_text,
    f.minute_sort,
    f.player_texts,
    f.primary_player_text,
    f.secondary_player_text,
    f.raw_text,
    f.payload_last_seen_at,
    f.updated_at,
    m.canonical_incident_type,
    m.canonical_incident_group
   FROM analytics.fact_match_incident f
     LEFT JOIN mapping.map_incident_subtype m ON m.source = f.source AND m.event_type_code = COALESCE(NULLIF(TRIM(BOTH FROM f.event_type_code), ''::text), '[UNKNOWN]'::text) AND m.event_title_norm = regexp_replace(translate(lower(COALESCE(NULLIF(TRIM(BOTH FROM f.event_title), ''::text), '[UNKNOWN]'::text)), 'çğıöşüâîûÇĞİÖŞÜÂÎÛ'::text, 'cgiosuaiucgiosuaiu'::text), '[^a-z0-9]+'::text, ''::text, 'g'::text);

CREATE VIEW analytics.team_match_incident_summary AS
 WITH base AS (
         SELECT i.source,
            i.source_match_id,
            fm.match_bk,
                CASE
                    WHEN lower(COALESCE(i.side, ''::text)) = 'home'::text THEN fm.home_team_source_id
                    WHEN lower(COALESCE(i.side, ''::text)) = 'away'::text THEN fm.away_team_source_id
                    ELSE NULL::text
                END AS source_team_id,
                CASE
                    WHEN lower(COALESCE(i.side, ''::text)) = 'home'::text THEN fm.canonical_home_team_name
                    WHEN lower(COALESCE(i.side, ''::text)) = 'away'::text THEN fm.canonical_away_team_name
                    ELSE NULL::text
                END AS canonical_team_name,
            i.side,
            i.canonical_incident_type,
            i.canonical_incident_group,
            i.minute_sort
           FROM analytics.fact_match_incident_enriched i
             LEFT JOIN analytics.fact_match fm ON fm.source = i.source AND fm.source_match_id = i.source_match_id
          WHERE lower(COALESCE(i.side, ''::text)) = ANY (ARRAY['home'::text, 'away'::text])
        )
 SELECT source,
    source_match_id,
    match_bk,
    source_team_id,
    canonical_team_name,
    count(*) AS incident_row_count,
    count(*) FILTER (WHERE canonical_incident_group = 'SUBSTITUTION'::text) AS substitutions_count,
    count(*) FILTER (WHERE canonical_incident_type = 'yellow_card'::text) AS yellow_cards_count,
    count(*) FILTER (WHERE canonical_incident_type = 'red_card'::text) AS red_cards_count,
    count(*) FILTER (WHERE canonical_incident_type = 'second_yellow_red'::text) AS second_yellow_red_count,
    count(*) FILTER (WHERE canonical_incident_type = 'goal'::text) AS goals_count,
    count(*) FILTER (WHERE canonical_incident_type = 'own_goal'::text) AS own_goals_count,
    count(*) FILTER (WHERE canonical_incident_type = 'penalty_scored'::text) AS penalties_scored_count,
    count(*) FILTER (WHERE canonical_incident_type = 'missed_penalty'::text) AS penalties_missed_count,
    min(minute_sort) FILTER (WHERE canonical_incident_type = 'goal'::text) AS first_goal_minute,
    max(minute_sort) FILTER (WHERE canonical_incident_type = 'goal'::text) AS last_goal_minute,
    min(minute_sort) FILTER (WHERE canonical_incident_type = 'yellow_card'::text) AS first_yellow_card_minute,
    min(minute_sort) FILTER (WHERE canonical_incident_type = ANY (ARRAY['red_card'::text, 'second_yellow_red'::text])) AS first_red_event_minute
   FROM base
  WHERE source_team_id IS NOT NULL
  GROUP BY source, source_match_id, match_bk, source_team_id, canonical_team_name;

CREATE VIEW analytics.fact_team_match_enriched_with_incidents AS
 SELECT t.source,
    t.source_match_id,
    t.source_team_id,
    t.match_bk,
    t.team_bk,
    t.team_match_bk,
    t.competition,
    t.competition_norm,
    t.competition_bk,
    t.match_datetime,
    t.match_date_text,
    t.team_name,
    t.canonical_team_name,
    t.team_name_norm,
    t.opponent_team_source_id,
    t.opponent_team_bk,
    t.opponent_team_name,
    t.canonical_opponent_team_name,
    t.team_side,
    t.is_home,
    t.is_away,
    t.score_for,
    t.score_against,
    t.goal_diff,
    t.result_code,
    t.points_earned,
    t.summary_goals,
    t.summary_assists,
    t.summary_red_cards,
    t.summary_yellow_cards,
    t.summary_corners_won,
    t.summary_shots,
    t.summary_shots_on_target,
    t.summary_blocked_shots,
    t.summary_passes,
    t.summary_crosses,
    t.summary_tackles,
    t.summary_offsides,
    t.summary_fouls_conceded,
    t.summary_fouls_won,
    t.summary_saves,
    t.details_accurate_pass,
    t.details_hit_woodwork,
    t.details_attempts_ibox,
    t.details_attempts_obox,
    t.details_headed_shots,
    t.details_expected_goals,
    t.details_goal_kicks,
    t.details_total_throws,
    t.details_out_of_box_goals,
    t.details_right_foot_goals,
    t.details_left_foot_goals,
    t.details_headed_goals,
    t.details_penalty_goals,
    t.details_freekick_goals,
    t.details_fantasy_assist,
    t.opta_player_count,
    t.opta_starter_count,
    t.opta_substitute_count,
    t.opta_points_total,
    t.opta_minutes_total,
    t.opta_goals_total,
    t.opta_shots_on_target_total,
    t.opta_shots_off_target_total,
    t.opta_shots_blocked_total,
    t.opta_own_goals_total,
    t.opta_assists_total,
    t.opta_passes_total,
    t.opta_crosses_total,
    t.opta_tackles_total,
    t.opta_interceptions_total,
    t.opta_fouls_won_total,
    t.opta_fouls_conceded_total,
    t.opta_offsides_total,
    t.opta_cards_yellow_total,
    t.opta_cards_red_total,
    t.opta_goals_conceded_total,
    t.opta_penalties_won_total,
    t.opta_saves_total,
    t.opta_penalties_saved_total,
    t.raw_summary_totals,
    t.raw_details_totals,
    t.raw_opta_totals,
    t.payload_last_seen_at,
    t.updated_at,
    t.date_key,
    t.match_date,
    t.calendar_year,
    t.calendar_month,
    t.calendar_day,
    t.calendar_quarter,
    t.day_name,
    t.iso_day_of_week,
    t.is_weekend,
    t.season_bk,
    t.season_start_year,
    t.season_end_year,
    t.season_label,
    t.season_start_date,
    t.season_end_date,
    s.incident_row_count,
    s.substitutions_count,
    s.yellow_cards_count,
    s.red_cards_count,
    s.second_yellow_red_count,
    s.goals_count AS incident_goals_count,
    s.own_goals_count AS incident_own_goals_count,
    s.penalties_scored_count,
    s.penalties_missed_count,
    s.first_goal_minute,
    s.last_goal_minute,
    s.first_yellow_card_minute,
    s.first_red_event_minute
   FROM analytics.fact_team_match_enriched t
     LEFT JOIN analytics.team_match_incident_summary s ON s.source = t.source AND s.source_match_id = t.source_match_id AND s.source_team_id = t.source_team_id;

CREATE VIEW analytics.data_health_overview AS
 WITH match_cnt AS (
         SELECT count(*) AS row_count
           FROM analytics.fact_match
        ), team_match_cnt AS (
         SELECT count(*) AS row_count
           FROM analytics.fact_team_match
        ), player_match_cnt AS (
         SELECT count(*) AS row_count
           FROM analytics.fact_player_match
        ), incident_cnt AS (
         SELECT count(*) AS row_count
           FROM analytics.fact_match_incident_enriched
        ), team_ready_cnt AS (
         SELECT count(*) AS row_count
           FROM analytics.model_input_team_match_ready
        ), player_ready_cnt AS (
         SELECT count(*) AS row_count
           FROM analytics.model_input_player_match_ready
        ), player_ready_strong_cnt AS (
         SELECT count(*) AS row_count
           FROM analytics.model_input_player_match_ready_strong_coverage
        ), coverage_cnt AS (
         SELECT count(*) FILTER (WHERE participation_coverage_flags.participation_coverage_level = 'HIGH'::text) AS high_coverage_team_matches,
            count(*) FILTER (WHERE participation_coverage_flags.participation_coverage_level = 'MEDIUM'::text) AS medium_coverage_team_matches,
            count(*) FILTER (WHERE participation_coverage_flags.participation_coverage_level = 'LOW'::text) AS low_coverage_team_matches
           FROM analytics.participation_coverage_flags
        ), team_dup AS (
         SELECT count(*) AS duplicate_count
           FROM ( SELECT fact_team_match.source,
                    fact_team_match.source_match_id,
                    fact_team_match.source_team_id,
                    count(*) AS cnt
                   FROM analytics.fact_team_match
                  GROUP BY fact_team_match.source, fact_team_match.source_match_id, fact_team_match.source_team_id
                 HAVING count(*) > 1) x
        ), player_dup AS (
         SELECT count(*) AS duplicate_count
           FROM ( SELECT fact_player_match.source,
                    fact_player_match.source_match_id,
                    fact_player_match.source_team_id,
                    fact_player_match.source_player_id,
                    count(*) AS cnt
                   FROM analytics.fact_player_match
                  GROUP BY fact_player_match.source, fact_player_match.source_match_id, fact_player_match.source_team_id, fact_player_match.source_player_id
                 HAVING count(*) > 1) x
        ), incident_unmapped AS (
         SELECT count(*) AS unmapped_incident_rows
           FROM analytics.fact_match_incident_enriched
          WHERE fact_match_incident_enriched.canonical_incident_group IS NULL
        ), team_nulls AS (
         SELECT count(*) FILTER (WHERE model_input_team_match.season_label IS NULL) AS season_label_null_rows,
            count(*) FILTER (WHERE model_input_team_match.match_datetime IS NULL) AS match_datetime_null_rows,
            count(*) FILTER (WHERE model_input_team_match.competition_norm IS NULL) AS competition_norm_null_rows
           FROM analytics.model_input_team_match
        ), player_nulls AS (
         SELECT count(*) FILTER (WHERE model_input_player_match.season_label IS NULL) AS season_label_null_rows,
            count(*) FILTER (WHERE model_input_player_match.match_datetime IS NULL) AS match_datetime_null_rows,
            count(*) FILTER (WHERE model_input_player_match.canonical_player_name IS NULL) AS canonical_player_name_null_rows
           FROM analytics.model_input_player_match
        )
 SELECT mc.row_count AS fact_match_rows,
    tmc.row_count AS fact_team_match_rows,
    pmc.row_count AS fact_player_match_rows,
    ic.row_count AS fact_match_incident_rows,
    trc.row_count AS team_model_ready_rows,
    prc.row_count AS player_model_ready_rows,
    prsc.row_count AS player_model_ready_strong_coverage_rows,
    cc.high_coverage_team_matches,
    cc.medium_coverage_team_matches,
    cc.low_coverage_team_matches,
    td.duplicate_count AS fact_team_match_duplicate_groups,
    pd.duplicate_count AS fact_player_match_duplicate_groups,
    iu.unmapped_incident_rows,
    tn.season_label_null_rows AS team_model_season_label_null_rows,
    tn.match_datetime_null_rows AS team_model_match_datetime_null_rows,
    tn.competition_norm_null_rows AS team_model_competition_norm_null_rows,
    pn.season_label_null_rows AS player_model_season_label_null_rows,
    pn.match_datetime_null_rows AS player_model_match_datetime_null_rows,
    pn.canonical_player_name_null_rows AS player_model_canonical_player_name_null_rows
   FROM match_cnt mc
     CROSS JOIN team_match_cnt tmc
     CROSS JOIN player_match_cnt pmc
     CROSS JOIN incident_cnt ic
     CROSS JOIN team_ready_cnt trc
     CROSS JOIN player_ready_cnt prc
     CROSS JOIN player_ready_strong_cnt prsc
     CROSS JOIN coverage_cnt cc
     CROSS JOIN team_dup td
     CROSS JOIN player_dup pd
     CROSS JOIN incident_unmapped iu
     CROSS JOIN team_nulls tn
     CROSS JOIN player_nulls pn;

CREATE VIEW analytics.team_scoring_incident_summary AS
 SELECT source,
    source_match_id,
    match_bk,
    source_team_id,
    canonical_team_name,
    goals_count,
    own_goals_count,
    penalties_scored_count,
    penalties_missed_count,
    COALESCE(goals_count, 0::bigint) + COALESCE(own_goals_count, 0::bigint) + COALESCE(penalties_scored_count, 0::bigint) AS total_scoring_incidents
   FROM analytics.team_match_incident_summary;

CREATE VIEW analytics.fact_team_match_final AS
 SELECT t.source,
    t.source_match_id,
    t.source_team_id,
    t.match_bk,
    t.team_bk,
    t.team_match_bk,
    t.competition,
    t.competition_norm,
    t.competition_bk,
    t.match_datetime,
    t.match_date_text,
    t.team_name,
    t.canonical_team_name,
    t.team_name_norm,
    t.opponent_team_source_id,
    t.opponent_team_bk,
    t.opponent_team_name,
    t.canonical_opponent_team_name,
    t.team_side,
    t.is_home,
    t.is_away,
    t.score_for,
    t.score_against,
    t.goal_diff,
    t.result_code,
    t.points_earned,
    t.summary_goals,
    t.summary_assists,
    t.summary_red_cards,
    t.summary_yellow_cards,
    t.summary_corners_won,
    t.summary_shots,
    t.summary_shots_on_target,
    t.summary_blocked_shots,
    t.summary_passes,
    t.summary_crosses,
    t.summary_tackles,
    t.summary_offsides,
    t.summary_fouls_conceded,
    t.summary_fouls_won,
    t.summary_saves,
    t.details_accurate_pass,
    t.details_hit_woodwork,
    t.details_attempts_ibox,
    t.details_attempts_obox,
    t.details_headed_shots,
    t.details_expected_goals,
    t.details_goal_kicks,
    t.details_total_throws,
    t.details_out_of_box_goals,
    t.details_right_foot_goals,
    t.details_left_foot_goals,
    t.details_headed_goals,
    t.details_penalty_goals,
    t.details_freekick_goals,
    t.details_fantasy_assist,
    t.opta_player_count,
    t.opta_starter_count,
    t.opta_substitute_count,
    t.opta_points_total,
    t.opta_minutes_total,
    t.opta_goals_total,
    t.opta_shots_on_target_total,
    t.opta_shots_off_target_total,
    t.opta_shots_blocked_total,
    t.opta_own_goals_total,
    t.opta_assists_total,
    t.opta_passes_total,
    t.opta_crosses_total,
    t.opta_tackles_total,
    t.opta_interceptions_total,
    t.opta_fouls_won_total,
    t.opta_fouls_conceded_total,
    t.opta_offsides_total,
    t.opta_cards_yellow_total,
    t.opta_cards_red_total,
    t.opta_goals_conceded_total,
    t.opta_penalties_won_total,
    t.opta_saves_total,
    t.opta_penalties_saved_total,
    t.raw_summary_totals,
    t.raw_details_totals,
    t.raw_opta_totals,
    t.payload_last_seen_at,
    t.updated_at,
    t.date_key,
    t.match_date,
    t.calendar_year,
    t.calendar_month,
    t.calendar_day,
    t.calendar_quarter,
    t.day_name,
    t.iso_day_of_week,
    t.is_weekend,
    t.season_bk,
    t.season_start_year,
    t.season_end_year,
    t.season_label,
    t.season_start_date,
    t.season_end_date,
    i.incident_row_count,
    i.substitutions_count,
    i.yellow_cards_count,
    i.red_cards_count,
    i.second_yellow_red_count,
    i.incident_goals_count,
    i.incident_own_goals_count,
    i.penalties_scored_count,
    i.penalties_missed_count,
    i.first_goal_minute,
    i.last_goal_minute,
    i.first_yellow_card_minute,
    i.first_red_event_minute,
    COALESCE(i.incident_goals_count, 0::bigint) + COALESCE(i.incident_own_goals_count, 0::bigint) + COALESCE(i.penalties_scored_count, 0::bigint) AS total_scoring_incidents
   FROM analytics.fact_team_match_enriched_with_incidents i
     RIGHT JOIN analytics.fact_team_match_enriched t ON t.source = i.source AND t.source_match_id = i.source_match_id AND t.source_team_id = i.source_team_id;

CREATE VIEW analytics.model_dataset_team_final AS
 SELECT source,
    source_match_id,
    source_team_id,
    match_bk,
    team_bk,
    team_match_bk,
    season_bk,
    season_label,
    match_datetime,
    match_date,
    competition,
    competition_norm,
    competition_bk,
    canonical_team_name,
    canonical_opponent_team_name,
    team_side,
    is_home,
    is_away,
    target_points,
    target_win,
    target_draw,
    target_loss,
    target_goals_for,
    target_goals_against,
    target_goal_diff,
    target_team_shots,
    target_team_shots_on_target,
    target_team_xg,
    days_since_prev_match,
    matches_played_before_match,
    season_points_before_match,
    points_avg_last3,
    points_avg_last5,
    points_sum_last3,
    points_sum_last5,
    goals_for_avg_last3,
    goals_for_avg_last5,
    goals_against_avg_last3,
    goals_against_avg_last5,
    shots_avg_last3,
    shots_avg_last5,
    shots_on_target_avg_last3,
    shots_on_target_avg_last5,
    xg_avg_last3,
    xg_avg_last5,
    venue_points_avg_last5,
    venue_goals_for_avg_last5,
    venue_goals_against_avg_last5,
    venue_shots_avg_last5,
    venue_xg_avg_last5,
    opp_matches_played_before_match,
    opp_season_points_before_match,
    opp_days_since_prev_match,
    opp_points_avg_last3,
    opp_points_avg_last5,
    opp_points_sum_last3,
    opp_points_sum_last5,
    opp_goals_for_avg_last3,
    opp_goals_for_avg_last5,
    opp_goals_against_avg_last3,
    opp_goals_against_avg_last5,
    opp_shots_avg_last3,
    opp_shots_avg_last5,
    opp_shots_on_target_avg_last3,
    opp_shots_on_target_avg_last5,
    opp_xg_avg_last3,
    opp_xg_avg_last5,
    opp_venue_points_avg_last5,
    opp_venue_goals_for_avg_last5,
    opp_venue_goals_against_avg_last5,
    opp_venue_shots_avg_last5,
    opp_venue_xg_avg_last5,
    diff_points_avg_last5,
    diff_goals_for_avg_last5,
    diff_goals_against_avg_last5,
    diff_shots_avg_last5,
    diff_shots_on_target_avg_last5,
    diff_xg_avg_last5,
    diff_venue_points_avg_last5,
    diff_venue_goals_for_avg_last5,
    diff_venue_goals_against_avg_last5,
    diff_venue_shots_avg_last5,
    diff_venue_xg_avg_last5
   FROM analytics.model_input_team_match_ready t;

CREATE VIEW analytics.model_dataset_player_final AS
 SELECT p.source,
    p.source_match_id,
    p.source_team_id,
    p.source_player_id,
    p.match_bk,
    p.team_bk,
    p.player_bk,
    p.player_match_bk,
    p.season_bk,
    p.season_label,
    p.match_datetime,
    p.match_date,
    p.competition,
    p.competition_norm,
    p.competition_bk,
    p.canonical_team_name,
    p.canonical_player_name,
    p.player_name_norm,
    c.participant_row_count,
    c.starter_count,
    c.substitute_count,
    c.players_with_minutes_count,
    c.total_minutes_played,
    c.minute_gap_from_990,
    c.participation_coverage_level,
    c.is_strong_participation_coverage,
    p.target_minutes_played,
    p.target_goals,
    p.target_assists,
    p.target_opta_points,
    p.target_shots_total,
    p.target_shots_on_target,
    p.target_xg,
    p.days_since_prev_match,
    p.matches_played_before_match,
    p.minutes_avg_last3,
    p.minutes_avg_last5,
    p.goals_avg_last3,
    p.goals_avg_last5,
    p.assists_avg_last3,
    p.assists_avg_last5,
    p.opta_points_avg_last3,
    p.opta_points_avg_last5,
    p.shots_avg_last3,
    p.shots_avg_last5,
    p.shots_on_target_avg_last3,
    p.shots_on_target_avg_last5,
    p.xg_avg_last3,
    p.xg_avg_last5
   FROM analytics.model_input_player_match_ready_strong_coverage p
     LEFT JOIN analytics.fact_player_match_enriched_with_coverage c ON c.source = p.source AND c.source_match_id = p.source_match_id AND c.source_team_id = p.source_team_id AND c.source_player_id = p.source_player_id;

CREATE VIEW analytics.player_detailed_metrics_v3 AS
 WITH base_v2 AS (
         SELECT v.season_label,
            v.competition,
            v.player_source_id,
            v.player_name,
            v.position_code,
            v.role_group,
            v.source_team_id,
            v.team_slug,
            v.team_name,
            v.metric_key,
            v.metric_label,
            v.category_key,
            v.category_label,
            v.display_priority,
            v.total_value,
            v.per_match_value,
            v.per90_value,
            v.home_value,
            v.away_value,
            v.last5_value,
            v.rank_direction,
            v.is_higher_better,
            v.value_format,
            v.home_away_gap_abs,
            v.sample_matches,
            v.coverage_flag,
                CASE
                    WHEN upper(COALESCE(v.position_code, ''::text)) = 'GK'::text OR upper(COALESCE(v.role_group, ''::text)) = 'GOALKEEPER'::text THEN 'GOALKEEPER'::text
                    ELSE 'OUTFIELD'::text
                END AS player_pool
           FROM analytics.player_detailed_metrics_v2 v
        ), metric_rules AS (
         SELECT t.metric_key,
            t.eligibility_scope,
            t.ranking_basis
           FROM ( VALUES ('cards_yellow_total'::text,'ALL'::text,'PER90'::text), ('cards_red_total'::text,'ALL'::text,'PER90'::text), ('passes_total'::text,'ALL'::text,'PER90'::text), ('accurate_pass_total'::text,'ALL'::text,'PER90'::text), ('pass_accuracy_pct'::text,'ALL'::text,'PRIMARY'::text), ('appearances'::text,'ALL'::text,'TOTAL'::text), ('starts'::text,'ALL'::text,'TOTAL'::text), ('starter_rate_pct'::text,'ALL'::text,'PRIMARY'::text), ('total_minutes'::text,'ALL'::text,'TOTAL'::text), ('avg_minutes'::text,'ALL'::text,'PRIMARY'::text), ('tackles_total'::text,'OUTFIELD'::text,'PER90'::text), ('interceptions_total'::text,'OUTFIELD'::text,'PER90'::text), ('fouls_conceded_total'::text,'OUTFIELD'::text,'PER90'::text), ('fouls_won_total'::text,'OUTFIELD'::text,'PER90'::text), ('goals_total'::text,'OUTFIELD'::text,'PER90'::text), ('assists_total'::text,'OUTFIELD'::text,'PER90'::text), ('expected_goals_total'::text,'OUTFIELD'::text,'PER90'::text), ('penalties_won_total'::text,'OUTFIELD'::text,'PER90'::text), ('shots_on_target_total'::text,'OUTFIELD'::text,'PER90'::text), ('attempts_ibox_total'::text,'OUTFIELD'::text,'PER90'::text), ('attempts_obox_total'::text,'OUTFIELD'::text,'PER90'::text), ('shot_accuracy_pct'::text,'OUTFIELD'::text,'PRIMARY'::text), ('xg_per90'::text,'OUTFIELD'::text,'PER90'::text), ('offsides_total'::text,'OUTFIELD'::text,'PER90'::text), ('saves_total_total'::text,'GOALKEEPER'::text,'PER90'::text), ('goals_conceded_total'::text,'GOALKEEPER'::text,'PER90'::text), ('penalties_saved_total'::text,'GOALKEEPER'::text,'PER90'::text)) t(metric_key, eligibility_scope, ranking_basis)
        ), usage_profile AS (
         SELECT b.season_label,
            b.competition,
            b.player_source_id,
            max(b.player_name) AS player_name,
            max(b.position_code) AS position_code,
            max(b.role_group) AS role_group,
            max(b.source_team_id) AS source_team_id,
            max(b.team_slug) AS team_slug,
            max(b.team_name) AS team_name,
            max(b.player_pool) AS player_pool,
            max(
                CASE
                    WHEN b.metric_key = 'appearances'::text THEN COALESCE(b.total_value, b.per_match_value)
                    ELSE NULL::numeric
                END)::integer AS appearances,
            max(
                CASE
                    WHEN b.metric_key = 'starts'::text THEN COALESCE(b.total_value, b.per_match_value)
                    ELSE NULL::numeric
                END)::integer AS starts,
            max(
                CASE
                    WHEN b.metric_key = 'starter_rate_pct'::text THEN COALESCE(b.total_value, b.per_match_value, b.per90_value)
                    ELSE NULL::numeric
                END) AS starter_rate_pct,
            max(
                CASE
                    WHEN b.metric_key = 'total_minutes'::text THEN COALESCE(b.total_value, b.per_match_value)
                    ELSE NULL::numeric
                END) AS total_minutes,
            max(
                CASE
                    WHEN b.metric_key = 'avg_minutes'::text THEN COALESCE(b.total_value, b.per_match_value, b.per90_value)
                    ELSE NULL::numeric
                END) AS avg_minutes
           FROM base_v2 b
          GROUP BY b.season_label, b.competition, b.player_source_id
        ), team_match_index AS (
         SELECT fp.season_label,
            fp.competition,
            fp.source_team_id,
            fp.source_match_id,
            max(fp.match_datetime) AS match_datetime,
            row_number() OVER (PARTITION BY fp.season_label, fp.competition, fp.source_team_id ORDER BY (max(fp.match_datetime)) DESC, fp.source_match_id DESC) AS team_match_recency_rank,
            count(*) OVER (PARTITION BY fp.season_label, fp.competition, fp.source_team_id) AS team_matches_played,
            max(max(fp.match_datetime)) OVER (PARTITION BY fp.season_label, fp.competition, fp.source_team_id) AS latest_team_match_datetime
           FROM analytics.fact_player_match_enriched fp
          GROUP BY fp.season_label, fp.competition, fp.source_team_id, fp.source_match_id
        ), team_profile AS (
         SELECT team_match_index.season_label,
            team_match_index.competition,
            team_match_index.source_team_id,
            max(team_match_index.team_matches_played) AS team_matches_played,
            max(team_match_index.latest_team_match_datetime) AS latest_team_match_datetime
           FROM team_match_index
          GROUP BY team_match_index.season_label, team_match_index.competition, team_match_index.source_team_id
        ), player_recent_activity AS (
         SELECT fp.season_label,
            fp.competition,
            fp.source_player_id AS player_source_id,
            fp.source_team_id,
            max(fp.match_datetime) AS last_appearance_at,
            max(
                CASE
                    WHEN tmi.team_match_recency_rank <= 8 THEN 1
                    ELSE 0
                END) AS appeared_in_last_8_team_matches,
            max(
                CASE
                    WHEN tmi.team_match_recency_rank <= 6 THEN 1
                    ELSE 0
                END) AS appeared_in_last_6_team_matches
           FROM analytics.fact_player_match_enriched fp
             JOIN team_match_index tmi ON tmi.season_label = fp.season_label AND tmi.competition = fp.competition AND tmi.source_team_id = fp.source_team_id AND tmi.source_match_id = fp.source_match_id
          GROUP BY fp.season_label, fp.competition, fp.source_player_id, fp.source_team_id
        ), player_profile AS (
         SELECT u.season_label,
            u.competition,
            u.player_source_id,
            u.player_name,
            u.position_code,
            u.role_group,
            u.source_team_id,
            u.team_slug,
            u.team_name,
            u.player_pool,
            COALESCE(u.appearances, 0) AS appearances,
            COALESCE(u.starts, 0) AS starts,
            u.starter_rate_pct,
            COALESCE(u.total_minutes, 0::numeric) AS total_minutes,
            u.avg_minutes,
            COALESCE(tp.team_matches_played, 0::bigint) AS team_matches_played,
            tp.latest_team_match_datetime,
            pra.last_appearance_at,
            COALESCE(pra.appeared_in_last_8_team_matches, 0) AS appeared_in_last_8_team_matches,
            COALESCE(pra.appeared_in_last_6_team_matches, 0) AS appeared_in_last_6_team_matches,
                CASE
                    WHEN u.player_pool = 'GOALKEEPER'::text THEN GREATEST(600::bigint, COALESCE(tp.team_matches_played, 0::bigint) * 30)
                    ELSE GREATEST(300::bigint, COALESCE(tp.team_matches_played, 0::bigint) * 20)
                END AS qualification_minutes_threshold,
                CASE
                    WHEN u.player_pool = 'GOALKEEPER'::text THEN GREATEST(6, floor(COALESCE(tp.team_matches_played, 0::bigint)::numeric * 0.30)::integer)
                    ELSE GREATEST(4, floor(COALESCE(tp.team_matches_played, 0::bigint)::numeric * 0.25)::integer)
                END AS qualification_apps_threshold,
                CASE
                    WHEN u.player_pool = 'GOALKEEPER'::text THEN COALESCE(pra.appeared_in_last_6_team_matches, 0) = 1 OR pra.last_appearance_at IS NOT NULL AND tp.latest_team_match_datetime IS NOT NULL AND pra.last_appearance_at >= (tp.latest_team_match_datetime - '60 days'::interval)
                    ELSE COALESCE(pra.appeared_in_last_8_team_matches, 0) = 1 OR pra.last_appearance_at IS NOT NULL AND tp.latest_team_match_datetime IS NOT NULL AND pra.last_appearance_at >= (tp.latest_team_match_datetime - '60 days'::interval)
                END AS recent_activity_flag
           FROM usage_profile u
             LEFT JOIN team_profile tp ON tp.season_label = u.season_label AND tp.competition = u.competition AND tp.source_team_id = u.source_team_id
             LEFT JOIN player_recent_activity pra ON pra.season_label = u.season_label AND pra.competition = u.competition AND pra.player_source_id = u.player_source_id AND pra.source_team_id = u.source_team_id
        ), offside_match_source AS (
         SELECT fp.season_label,
            fp.competition,
            fp.source_player_id AS player_source_id,
            max(fp.player_name) AS player_name,
            max(fp.position_code) AS position_code,
            max(fp.position_group) AS role_group,
            max(fp.source_team_id) AS source_team_id,
            max(fp.source_team_id) AS team_slug,
            max(fp.team_name) AS team_name,
            sum(COALESCE(fp.offsides, 0))::numeric AS offsides_total
           FROM analytics.fact_player_match_enriched fp
          GROUP BY fp.season_label, fp.competition, fp.source_player_id
        ), offside_metric_rows AS (
         SELECT p.season_label,
            p.competition,
            p.player_source_id,
            p.player_name,
            p.position_code,
            p.role_group,
            p.source_team_id,
            p.team_slug,
            p.team_name,
            'offsides_total'::text AS metric_key,
            'Offsides'::text AS metric_label,
            'attacking'::text AS category_key,
            'Attacking'::text AS category_label,
            70 AS display_priority,
            COALESCE(o.offsides_total, 0::numeric) AS total_value,
                CASE
                    WHEN COALESCE(p.appearances, 0) > 0 THEN COALESCE(o.offsides_total, 0::numeric) / p.appearances::numeric
                    ELSE NULL::numeric
                END AS per_match_value,
                CASE
                    WHEN COALESCE(p.total_minutes, 0::numeric) > 0::numeric THEN COALESCE(o.offsides_total, 0::numeric) * 90.0 / p.total_minutes
                    ELSE NULL::numeric
                END AS per90_value,
            NULL::numeric AS home_value,
            NULL::numeric AS away_value,
            NULL::numeric AS last5_value,
            'asc'::text AS rank_direction,
            false AS is_higher_better,
            'decimal_2'::text AS value_format,
            NULL::numeric AS home_away_gap_abs,
            p.appearances AS sample_matches,
            true AS coverage_flag,
            p.player_pool
           FROM player_profile p
             LEFT JOIN offside_match_source o ON o.season_label = p.season_label AND o.competition = p.competition AND o.player_source_id = p.player_source_id
          WHERE p.player_pool <> 'GOALKEEPER'::text
        ), source_rows AS (
         SELECT b.season_label,
            b.competition,
            b.player_source_id,
            b.player_name,
            b.position_code,
            b.role_group,
            b.source_team_id,
            b.team_slug,
            b.team_name,
            b.metric_key,
            b.metric_label,
            b.category_key,
            b.category_label,
            b.display_priority,
            b.total_value,
            b.per_match_value,
            b.per90_value,
            b.home_value,
            b.away_value,
            b.last5_value,
            b.rank_direction,
            b.is_higher_better,
            b.value_format,
            b.home_away_gap_abs,
            b.sample_matches,
            b.coverage_flag,
            b.player_pool
           FROM base_v2 b
        UNION ALL
         SELECT o.season_label,
            o.competition,
            o.player_source_id,
            o.player_name,
            o.position_code,
            o.role_group,
            o.source_team_id,
            o.team_slug,
            o.team_name,
            o.metric_key,
            o.metric_label,
            o.category_key,
            o.category_label,
            o.display_priority,
            o.total_value,
            o.per_match_value,
            o.per90_value,
            o.home_value,
            o.away_value,
            o.last5_value,
            o.rank_direction,
            o.is_higher_better,
            o.value_format,
            o.home_away_gap_abs,
            o.sample_matches,
            o.coverage_flag,
            o.player_pool
           FROM offside_metric_rows o
        ), eligible_metric_rows AS (
         SELECT s.season_label,
            s.competition,
            s.player_source_id,
            s.player_name,
            s.position_code,
            s.role_group,
            s.source_team_id,
            s.team_slug,
            s.team_name,
            s.metric_key,
            s.metric_label,
            s.category_key,
            s.category_label,
            s.display_priority,
            s.total_value,
            s.per_match_value,
            s.per90_value,
            s.home_value,
            s.away_value,
            s.last5_value,
            s.rank_direction,
            s.is_higher_better,
            s.value_format,
            s.home_away_gap_abs,
            s.sample_matches,
            s.coverage_flag,
            s.player_pool,
            mr.eligibility_scope,
            mr.ranking_basis,
                CASE
                    WHEN mr.eligibility_scope = 'ALL'::text THEN 'ALL_PLAYERS'::text
                    WHEN mr.eligibility_scope = 'GOALKEEPER'::text THEN 'GOALKEEPERS'::text
                    ELSE 'OUTFIELD_PLAYERS'::text
                END AS ranking_pool,
            pp.appearances,
            pp.starts,
            pp.starter_rate_pct,
            pp.total_minutes,
            pp.avg_minutes,
            pp.team_matches_played,
            pp.latest_team_match_datetime,
            pp.last_appearance_at,
            pp.recent_activity_flag,
            pp.qualification_minutes_threshold,
            pp.qualification_apps_threshold,
                CASE
                    WHEN mr.ranking_basis = 'TOTAL'::text THEN s.total_value
                    WHEN mr.ranking_basis = 'PER90'::text THEN COALESCE(s.per90_value, s.per_match_value, s.total_value)
                    ELSE COALESCE(s.per90_value, s.per_match_value, s.total_value)
                END AS ranking_value,
                CASE
                    WHEN COALESCE(pp.total_minutes, 0::numeric) < pp.qualification_minutes_threshold::numeric AND COALESCE(pp.appearances, 0) < pp.qualification_apps_threshold AND COALESCE(pp.recent_activity_flag, false) = false THEN 'low_minutes_low_appearances_inactive'::text
                    WHEN COALESCE(pp.total_minutes, 0::numeric) < pp.qualification_minutes_threshold::numeric AND COALESCE(pp.appearances, 0) < pp.qualification_apps_threshold THEN 'low_minutes_low_appearances'::text
                    WHEN COALESCE(pp.total_minutes, 0::numeric) < pp.qualification_minutes_threshold::numeric AND COALESCE(pp.recent_activity_flag, false) = false THEN 'low_minutes_and_inactive'::text
                    WHEN COALESCE(pp.appearances, 0) < pp.qualification_apps_threshold AND COALESCE(pp.recent_activity_flag, false) = false THEN 'low_appearances_and_inactive'::text
                    WHEN COALESCE(pp.total_minutes, 0::numeric) < pp.qualification_minutes_threshold::numeric THEN 'low_minutes'::text
                    WHEN COALESCE(pp.appearances, 0) < pp.qualification_apps_threshold THEN 'low_appearances'::text
                    WHEN COALESCE(pp.recent_activity_flag, false) = false THEN 'inactive_recently'::text
                    ELSE 'qualified'::text
                END AS qualification_reason,
                CASE
                    WHEN COALESCE(pp.total_minutes, 0::numeric) >= pp.qualification_minutes_threshold::numeric AND COALESCE(pp.appearances, 0) >= pp.qualification_apps_threshold AND COALESCE(pp.recent_activity_flag, false) = true THEN true
                    ELSE false
                END AS is_qualified
           FROM source_rows s
             JOIN metric_rules mr ON mr.metric_key = s.metric_key
             JOIN player_profile pp ON pp.season_label = s.season_label AND pp.competition = s.competition AND pp.player_source_id = s.player_source_id
          WHERE mr.eligibility_scope = 'ALL'::text OR mr.eligibility_scope = 'GOALKEEPER'::text AND s.player_pool = 'GOALKEEPER'::text OR mr.eligibility_scope = 'OUTFIELD'::text AND s.player_pool <> 'GOALKEEPER'::text
        ), qualified_league_stats AS (
         SELECT eligible_metric_rows.season_label,
            eligible_metric_rows.competition,
            eligible_metric_rows.metric_key,
            eligible_metric_rows.ranking_pool,
            avg(eligible_metric_rows.ranking_value) AS league_avg,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (eligible_metric_rows.ranking_value::double precision)) AS league_median
           FROM eligible_metric_rows
          WHERE eligible_metric_rows.is_qualified = true
          GROUP BY eligible_metric_rows.season_label, eligible_metric_rows.competition, eligible_metric_rows.metric_key, eligible_metric_rows.ranking_pool
        ), qualified_ranked_rows AS (
         SELECT e_1.season_label,
            e_1.competition,
            e_1.player_source_id,
            e_1.metric_key,
            e_1.ranking_pool,
            qls.league_avg,
            qls.league_median,
                CASE
                    WHEN e_1.rank_direction = 'asc'::text THEN rank() OVER (PARTITION BY e_1.season_label, e_1.competition, e_1.metric_key, e_1.ranking_pool ORDER BY e_1.ranking_value)
                    ELSE rank() OVER (PARTITION BY e_1.season_label, e_1.competition, e_1.metric_key, e_1.ranking_pool ORDER BY e_1.ranking_value DESC NULLS LAST)
                END AS league_rank,
                CASE
                    WHEN e_1.rank_direction = 'asc'::text THEN percent_rank() OVER (PARTITION BY e_1.season_label, e_1.competition, e_1.metric_key, e_1.ranking_pool ORDER BY e_1.ranking_value DESC NULLS LAST)
                    ELSE percent_rank() OVER (PARTITION BY e_1.season_label, e_1.competition, e_1.metric_key, e_1.ranking_pool ORDER BY e_1.ranking_value)
                END AS league_percentile
           FROM eligible_metric_rows e_1
             JOIN qualified_league_stats qls ON qls.season_label = e_1.season_label AND qls.competition = e_1.competition AND qls.metric_key = e_1.metric_key AND qls.ranking_pool = e_1.ranking_pool
          WHERE e_1.is_qualified = true
        )
 SELECT e.season_label,
    e.competition,
    e.player_source_id,
    e.player_name,
    e.position_code,
    e.role_group,
    e.source_team_id,
    e.team_slug,
    e.team_name,
    e.metric_key,
    e.metric_label,
    e.category_key,
    e.category_label,
    e.display_priority,
    e.total_value,
    e.per_match_value,
    e.per90_value,
    e.home_value,
    e.away_value,
    e.last5_value,
    qr.league_avg,
    qr.league_median,
    qr.league_rank,
    qr.league_percentile,
        CASE
            WHEN qr.league_avg IS NULL THEN NULL::numeric
            ELSE e.ranking_value - qr.league_avg
        END AS vs_league_avg_abs,
        CASE
            WHEN qr.league_avg IS NULL THEN NULL::numeric
            WHEN e.value_format ~~ 'pct_%'::text AND abs(qr.league_avg) < 0.01 THEN NULL::numeric
            WHEN e.value_format !~~ 'pct_%'::text AND abs(qr.league_avg) < 0.5 THEN NULL::numeric
            WHEN qr.league_avg = 0::numeric THEN NULL::numeric
            ELSE (e.ranking_value - qr.league_avg) / qr.league_avg
        END AS vs_league_avg_pct,
    e.rank_direction,
    e.is_higher_better,
    e.value_format,
    e.home_away_gap_abs,
    e.sample_matches,
    e.coverage_flag,
    e.player_pool,
    e.ranking_pool,
    e.ranking_value,
    e.is_qualified,
    e.recent_activity_flag,
    e.qualification_minutes_threshold,
    e.qualification_apps_threshold,
    e.qualification_reason
   FROM eligible_metric_rows e
     LEFT JOIN qualified_ranked_rows qr ON qr.season_label = e.season_label AND qr.competition = e.competition AND qr.player_source_id = e.player_source_id AND qr.metric_key = e.metric_key AND qr.ranking_pool = e.ranking_pool;

CREATE VIEW analytics.player_detailed_metrics_v2_1 AS
 WITH base_v2 AS (
         SELECT player_detailed_metrics_v2.season_label,
            player_detailed_metrics_v2.competition,
            player_detailed_metrics_v2.player_source_id,
            player_detailed_metrics_v2.player_name,
            player_detailed_metrics_v2.position_code,
            player_detailed_metrics_v2.role_group,
            player_detailed_metrics_v2.source_team_id,
            player_detailed_metrics_v2.team_slug,
            player_detailed_metrics_v2.team_name,
            player_detailed_metrics_v2.metric_key,
            player_detailed_metrics_v2.metric_label,
            player_detailed_metrics_v2.category_key,
            player_detailed_metrics_v2.category_label,
            player_detailed_metrics_v2.display_priority,
            player_detailed_metrics_v2.total_value,
            player_detailed_metrics_v2.per_match_value,
            player_detailed_metrics_v2.per90_value,
            player_detailed_metrics_v2.home_value,
            player_detailed_metrics_v2.away_value,
            player_detailed_metrics_v2.last5_value,
            player_detailed_metrics_v2.league_avg,
            player_detailed_metrics_v2.league_median,
            player_detailed_metrics_v2.league_rank,
            player_detailed_metrics_v2.league_percentile,
            player_detailed_metrics_v2.vs_league_avg_abs,
            player_detailed_metrics_v2.vs_league_avg_pct,
            player_detailed_metrics_v2.rank_direction,
            player_detailed_metrics_v2.is_higher_better,
            player_detailed_metrics_v2.value_format,
            player_detailed_metrics_v2.home_away_gap_abs,
            player_detailed_metrics_v2.sample_matches,
            player_detailed_metrics_v2.coverage_flag
           FROM analytics.player_detailed_metrics_v2
        ), player_dim AS (
         SELECT DISTINCT ON (player_detailed_metrics_v2.season_label, player_detailed_metrics_v2.competition, player_detailed_metrics_v2.player_source_id) player_detailed_metrics_v2.season_label,
            player_detailed_metrics_v2.competition,
            player_detailed_metrics_v2.player_source_id,
            player_detailed_metrics_v2.player_name,
            player_detailed_metrics_v2.position_code,
            player_detailed_metrics_v2.role_group,
            player_detailed_metrics_v2.source_team_id,
            player_detailed_metrics_v2.team_slug,
            player_detailed_metrics_v2.team_name
           FROM analytics.player_detailed_metrics_v2
          ORDER BY player_detailed_metrics_v2.season_label, player_detailed_metrics_v2.competition, player_detailed_metrics_v2.player_source_id, player_detailed_metrics_v2.metric_key
        ), offside_agg AS (
         SELECT fact_player_match_enriched.season_label,
            fact_player_match_enriched.competition,
            fact_player_match_enriched.source_player_id AS player_source_id,
            sum(COALESCE(fact_player_match_enriched.offsides, 0))::numeric AS offsides_total
           FROM analytics.fact_player_match_enriched
          GROUP BY fact_player_match_enriched.season_label, fact_player_match_enriched.competition, fact_player_match_enriched.source_player_id
        ), offside_base AS (
         SELECT pd.season_label,
            pd.competition,
            pd.player_source_id,
            pd.player_name,
            pd.position_code,
            pd.role_group,
            pd.source_team_id,
            pd.team_slug,
            pd.team_name,
            'offsides_total'::text AS metric_key,
            'Offsides'::text AS metric_label,
            'attacking'::text AS category_key,
            'Attacking'::text AS category_label,
            70 AS display_priority,
            COALESCE(oa.offsides_total, 0::numeric) AS total_value,
                CASE
                    WHEN q.appearances > 0 THEN COALESCE(oa.offsides_total, 0::numeric) / q.appearances::numeric
                    ELSE NULL::numeric
                END AS per_match_value,
                CASE
                    WHEN q.total_minutes > 0::numeric THEN COALESCE(oa.offsides_total, 0::numeric) * 90.0 / q.total_minutes
                    ELSE NULL::numeric
                END AS per90_value,
            NULL::numeric AS home_value,
            NULL::numeric AS away_value,
            NULL::numeric AS last5_value,
            'asc'::text AS rank_direction,
            false AS is_higher_better,
            'decimal_2'::text AS value_format,
            NULL::numeric AS home_away_gap_abs,
            q.appearances AS sample_matches,
            true AS coverage_flag
           FROM player_dim pd
             JOIN analytics.player_qualification_v1 q ON q.season_label = pd.season_label AND q.competition = pd.competition AND q.player_source_id = pd.player_source_id
             LEFT JOIN offside_agg oa ON oa.season_label = pd.season_label AND oa.competition = pd.competition AND oa.player_source_id = pd.player_source_id
          WHERE q.player_pool <> 'GOALKEEPER'::text
        ), offside_rank_input AS (
         SELECT ob.season_label,
            ob.competition,
            ob.player_source_id,
            ob.player_name,
            ob.position_code,
            ob.role_group,
            ob.source_team_id,
            ob.team_slug,
            ob.team_name,
            ob.metric_key,
            ob.metric_label,
            ob.category_key,
            ob.category_label,
            ob.display_priority,
            ob.total_value,
            ob.per_match_value,
            ob.per90_value,
            ob.home_value,
            ob.away_value,
            ob.last5_value,
            ob.rank_direction,
            ob.is_higher_better,
            ob.value_format,
            ob.home_away_gap_abs,
            ob.sample_matches,
            ob.coverage_flag,
            COALESCE(ob.per90_value, ob.per_match_value, ob.total_value) AS ranking_value
           FROM offside_base ob
        ), offside_stats AS (
         SELECT offside_rank_input.season_label,
            offside_rank_input.competition,
            avg(offside_rank_input.ranking_value) AS league_avg,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (offside_rank_input.ranking_value::double precision)) AS league_median
           FROM offside_rank_input
          GROUP BY offside_rank_input.season_label, offside_rank_input.competition
        ), offside_ranked AS (
         SELECT ori.season_label,
            ori.competition,
            ori.player_source_id,
            ori.player_name,
            ori.position_code,
            ori.role_group,
            ori.source_team_id,
            ori.team_slug,
            ori.team_name,
            ori.metric_key,
            ori.metric_label,
            ori.category_key,
            ori.category_label,
            ori.display_priority,
            ori.total_value,
            ori.per_match_value,
            ori.per90_value,
            ori.home_value,
            ori.away_value,
            ori.last5_value,
            os.league_avg,
            os.league_median,
            rank() OVER (PARTITION BY ori.season_label, ori.competition ORDER BY ori.ranking_value)::integer AS league_rank,
            percent_rank() OVER (PARTITION BY ori.season_label, ori.competition ORDER BY ori.ranking_value DESC NULLS LAST)::numeric AS league_percentile,
                CASE
                    WHEN os.league_avg IS NULL THEN NULL::numeric
                    ELSE ori.ranking_value - os.league_avg
                END AS vs_league_avg_abs,
                CASE
                    WHEN os.league_avg IS NULL THEN NULL::numeric
                    WHEN abs(os.league_avg) < 0.5 THEN NULL::numeric
                    WHEN os.league_avg = 0::numeric THEN NULL::numeric
                    ELSE (ori.ranking_value - os.league_avg) / os.league_avg
                END AS vs_league_avg_pct,
            ori.rank_direction,
            ori.is_higher_better,
            ori.value_format,
            ori.home_away_gap_abs,
            ori.sample_matches,
            ori.coverage_flag
           FROM offside_rank_input ori
             JOIN offside_stats os ON os.season_label = ori.season_label AND os.competition = ori.competition
        )
 SELECT base_v2.season_label,
    base_v2.competition,
    base_v2.player_source_id,
    base_v2.player_name,
    base_v2.position_code,
    base_v2.role_group,
    base_v2.source_team_id,
    base_v2.team_slug,
    base_v2.team_name,
    base_v2.metric_key,
    base_v2.metric_label,
    base_v2.category_key,
    base_v2.category_label,
    base_v2.display_priority,
    base_v2.total_value,
    base_v2.per_match_value,
    base_v2.per90_value,
    base_v2.home_value,
    base_v2.away_value,
    base_v2.last5_value,
    base_v2.league_avg,
    base_v2.league_median,
    base_v2.league_rank,
    base_v2.league_percentile,
    base_v2.vs_league_avg_abs,
    base_v2.vs_league_avg_pct,
    base_v2.rank_direction,
    base_v2.is_higher_better,
    base_v2.value_format,
    base_v2.home_away_gap_abs,
    base_v2.sample_matches,
    base_v2.coverage_flag
   FROM base_v2
UNION ALL
 SELECT offside_ranked.season_label,
    offside_ranked.competition,
    offside_ranked.player_source_id,
    offside_ranked.player_name,
    offside_ranked.position_code,
    offside_ranked.role_group,
    offside_ranked.source_team_id,
    offside_ranked.team_slug,
    offside_ranked.team_name,
    offside_ranked.metric_key,
    offside_ranked.metric_label,
    offside_ranked.category_key,
    offside_ranked.category_label,
    offside_ranked.display_priority,
    offside_ranked.total_value,
    offside_ranked.per_match_value,
    offside_ranked.per90_value,
    offside_ranked.home_value,
    offside_ranked.away_value,
    offside_ranked.last5_value,
    offside_ranked.league_avg,
    offside_ranked.league_median,
    offside_ranked.league_rank,
    offside_ranked.league_percentile,
    offside_ranked.vs_league_avg_abs,
    offside_ranked.vs_league_avg_pct,
    offside_ranked.rank_direction,
    offside_ranked.is_higher_better,
    offside_ranked.value_format,
    offside_ranked.home_away_gap_abs,
    offside_ranked.sample_matches,
    offside_ranked.coverage_flag
   FROM offside_ranked;

CREATE VIEW analytics.player_detailed_metrics_v2_2 AS
 SELECT player_detailed_metrics_v2_1.season_label,
    player_detailed_metrics_v2_1.competition,
    player_detailed_metrics_v2_1.player_source_id,
    player_detailed_metrics_v2_1.player_name,
    player_detailed_metrics_v2_1.position_code,
    player_detailed_metrics_v2_1.role_group,
    player_detailed_metrics_v2_1.source_team_id,
    player_detailed_metrics_v2_1.team_slug,
    player_detailed_metrics_v2_1.team_name,
    player_detailed_metrics_v2_1.metric_key,
    player_detailed_metrics_v2_1.metric_label,
        CASE
            WHEN player_detailed_metrics_v2_1.metric_key = ANY (ARRAY['goals_total'::text, 'assists_total'::text, 'expected_goals_total'::text, 'penalties_won_total'::text, 'offsides_total'::text]) THEN 'attacking'::text
            WHEN player_detailed_metrics_v2_1.metric_key = ANY (ARRAY['shots_on_target_total'::text, 'attempts_ibox_total'::text, 'attempts_obox_total'::text, 'shot_accuracy_pct'::text, 'xg_per90'::text, 'shots_total'::text]) THEN 'shooting'::text
            ELSE player_detailed_metrics_v2_1.category_key
        END AS category_key,
        CASE
            WHEN player_detailed_metrics_v2_1.metric_key = ANY (ARRAY['goals_total'::text, 'assists_total'::text, 'expected_goals_total'::text, 'penalties_won_total'::text, 'offsides_total'::text]) THEN 'Attacking'::text
            WHEN player_detailed_metrics_v2_1.metric_key = ANY (ARRAY['shots_on_target_total'::text, 'attempts_ibox_total'::text, 'attempts_obox_total'::text, 'shot_accuracy_pct'::text, 'xg_per90'::text, 'shots_total'::text]) THEN 'Shooting'::text
            ELSE player_detailed_metrics_v2_1.category_label
        END AS category_label,
    player_detailed_metrics_v2_1.display_priority,
    player_detailed_metrics_v2_1.total_value,
    player_detailed_metrics_v2_1.per_match_value,
    player_detailed_metrics_v2_1.per90_value,
    player_detailed_metrics_v2_1.home_value,
    player_detailed_metrics_v2_1.away_value,
    player_detailed_metrics_v2_1.last5_value,
    player_detailed_metrics_v2_1.league_avg,
    player_detailed_metrics_v2_1.league_median,
    player_detailed_metrics_v2_1.league_rank,
    player_detailed_metrics_v2_1.league_percentile,
    player_detailed_metrics_v2_1.vs_league_avg_abs,
    player_detailed_metrics_v2_1.vs_league_avg_pct,
    player_detailed_metrics_v2_1.rank_direction,
    player_detailed_metrics_v2_1.is_higher_better,
    player_detailed_metrics_v2_1.value_format,
    player_detailed_metrics_v2_1.home_away_gap_abs,
    player_detailed_metrics_v2_1.sample_matches,
    player_detailed_metrics_v2_1.coverage_flag
   FROM analytics.player_detailed_metrics_v2_1
UNION ALL
 SELECT a.season_label,
    a.competition,
    a.player_source_id,
    a.player_name,
    a.position_code,
    a.role_group,
    a.source_team_id,
    a.team_slug,
    a.team_name,
    'shots_total'::text AS metric_key,
    'Shots'::text AS metric_label,
    'shooting'::text AS category_key,
    'Shooting'::text AS category_label,
    1 AS display_priority,
    a.total_value + b.total_value AS total_value,
    a.per_match_value + b.per_match_value AS per_match_value,
    a.per90_value + b.per90_value AS per90_value,
    a.home_value + b.home_value AS home_value,
    a.away_value + b.away_value AS away_value,
    a.last5_value + b.last5_value AS last5_value,
    NULL::numeric AS league_avg,
    NULL::double precision AS league_median,
    NULL::bigint AS league_rank,
    NULL::double precision AS league_percentile,
    NULL::numeric AS vs_league_avg_abs,
    NULL::numeric AS vs_league_avg_pct,
    'desc'::text AS rank_direction,
    true AS is_higher_better,
    'integer'::text AS value_format,
    NULL::numeric AS home_away_gap_abs,
    a.sample_matches,
    a.coverage_flag
   FROM analytics.player_detailed_metrics_v2_1 a
     JOIN analytics.player_detailed_metrics_v2_1 b ON a.player_source_id = b.player_source_id AND a.season_label = b.season_label AND a.competition = b.competition
  WHERE a.metric_key = 'attempts_ibox_total'::text AND b.metric_key = 'attempts_obox_total'::text;

CREATE MATERIALIZED VIEW analytics.player_detailed_metrics_v2_2_mat AS
 WITH shots_base AS (
         SELECT a.season_label,
            a.competition,
            a.player_source_id,
            a.player_name,
            a.position_code,
            a.role_group,
            a.source_team_id,
            a.team_slug,
            a.team_name,
            'shots_total'::text AS metric_key,
            'Shots'::text AS metric_label,
            'shooting'::text AS category_key,
            'Shooting'::text AS category_label,
            1 AS display_priority,
            a.total_value + b.total_value AS total_value,
            a.per_match_value + b.per_match_value AS per_match_value,
            a.per90_value + b.per90_value AS per90_value,
            a.home_value + b.home_value AS home_value,
            a.away_value + b.away_value AS away_value,
            a.last5_value + b.last5_value AS last5_value,
            'desc'::text AS rank_direction,
            true AS is_higher_better,
            'integer'::text AS value_format,
            NULL::numeric AS home_away_gap_abs,
            a.sample_matches,
            a.coverage_flag,
            a.per90_value + b.per90_value AS ranking_value
           FROM analytics.player_detailed_metrics_v2_1 a
             JOIN analytics.player_detailed_metrics_v2_1 b ON a.player_source_id = b.player_source_id AND a.season_label = b.season_label AND a.competition = b.competition
          WHERE a.metric_key = 'attempts_ibox_total'::text AND b.metric_key = 'attempts_obox_total'::text
        ), shots_stats AS (
         SELECT shots_base.season_label,
            shots_base.competition,
            avg(shots_base.ranking_value) AS league_avg,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (shots_base.ranking_value::double precision)) AS league_median
           FROM shots_base
          GROUP BY shots_base.season_label, shots_base.competition
        ), shots_ranked AS (
         SELECT s.season_label,
            s.competition,
            s.player_source_id,
            s.player_name,
            s.position_code,
            s.role_group,
            s.source_team_id,
            s.team_slug,
            s.team_name,
            s.metric_key,
            s.metric_label,
            s.category_key,
            s.category_label,
            s.display_priority,
            s.total_value,
            s.per_match_value,
            s.per90_value,
            s.home_value,
            s.away_value,
            s.last5_value,
            st.league_avg,
            st.league_median,
            rank() OVER (PARTITION BY s.season_label, s.competition ORDER BY s.ranking_value DESC NULLS LAST)::integer AS league_rank,
            percent_rank() OVER (PARTITION BY s.season_label, s.competition ORDER BY s.ranking_value DESC NULLS LAST)::numeric AS league_percentile,
            s.ranking_value - st.league_avg AS vs_league_avg_abs,
                CASE
                    WHEN st.league_avg IS NULL OR abs(st.league_avg) < 0.5 OR st.league_avg = 0::numeric THEN NULL::numeric
                    ELSE (s.ranking_value - st.league_avg) / st.league_avg
                END AS vs_league_avg_pct,
            s.rank_direction,
            s.is_higher_better,
            s.value_format,
            s.home_away_gap_abs,
            s.sample_matches,
            s.coverage_flag
           FROM shots_base s
             JOIN shots_stats st ON st.season_label = s.season_label AND st.competition = s.competition
        )
 SELECT player_detailed_metrics_v2_1.season_label,
    player_detailed_metrics_v2_1.competition,
    player_detailed_metrics_v2_1.player_source_id,
    player_detailed_metrics_v2_1.player_name,
    player_detailed_metrics_v2_1.position_code,
    player_detailed_metrics_v2_1.role_group,
    player_detailed_metrics_v2_1.source_team_id,
    player_detailed_metrics_v2_1.team_slug,
    player_detailed_metrics_v2_1.team_name,
    player_detailed_metrics_v2_1.metric_key,
    player_detailed_metrics_v2_1.metric_label,
    player_detailed_metrics_v2_1.category_key,
    player_detailed_metrics_v2_1.category_label,
    player_detailed_metrics_v2_1.display_priority,
    player_detailed_metrics_v2_1.total_value,
    player_detailed_metrics_v2_1.per_match_value,
    player_detailed_metrics_v2_1.per90_value,
    player_detailed_metrics_v2_1.home_value,
    player_detailed_metrics_v2_1.away_value,
    player_detailed_metrics_v2_1.last5_value,
    player_detailed_metrics_v2_1.league_avg,
    player_detailed_metrics_v2_1.league_median,
    player_detailed_metrics_v2_1.league_rank,
    player_detailed_metrics_v2_1.league_percentile,
    player_detailed_metrics_v2_1.vs_league_avg_abs,
    player_detailed_metrics_v2_1.vs_league_avg_pct,
    player_detailed_metrics_v2_1.rank_direction,
    player_detailed_metrics_v2_1.is_higher_better,
    player_detailed_metrics_v2_1.value_format,
    player_detailed_metrics_v2_1.home_away_gap_abs,
    player_detailed_metrics_v2_1.sample_matches,
    player_detailed_metrics_v2_1.coverage_flag
   FROM analytics.player_detailed_metrics_v2_1
UNION ALL
 SELECT shots_ranked.season_label,
    shots_ranked.competition,
    shots_ranked.player_source_id,
    shots_ranked.player_name,
    shots_ranked.position_code,
    shots_ranked.role_group,
    shots_ranked.source_team_id,
    shots_ranked.team_slug,
    shots_ranked.team_name,
    shots_ranked.metric_key,
    shots_ranked.metric_label,
    shots_ranked.category_key,
    shots_ranked.category_label,
    shots_ranked.display_priority,
    shots_ranked.total_value,
    shots_ranked.per_match_value,
    shots_ranked.per90_value,
    shots_ranked.home_value,
    shots_ranked.away_value,
    shots_ranked.last5_value,
    shots_ranked.league_avg,
    shots_ranked.league_median,
    shots_ranked.league_rank,
    shots_ranked.league_percentile,
    shots_ranked.vs_league_avg_abs,
    shots_ranked.vs_league_avg_pct,
    shots_ranked.rank_direction,
    shots_ranked.is_higher_better,
    shots_ranked.value_format,
    shots_ranked.home_away_gap_abs,
    shots_ranked.sample_matches,
    shots_ranked.coverage_flag
   FROM shots_ranked;

CREATE VIEW analytics.player_detailed_metrics_current AS
 SELECT season_label,
    competition,
    player_source_id,
    player_name,
    position_code,
    role_group,
    source_team_id,
    team_slug,
    team_name,
    metric_key,
    metric_label,
    category_key,
    category_label,
    display_priority,
    total_value,
    per_match_value,
    per90_value,
    home_value,
    away_value,
    last5_value,
    league_avg,
    league_median,
    league_rank,
    league_percentile,
    vs_league_avg_abs,
    vs_league_avg_pct,
    rank_direction,
    is_higher_better,
    value_format,
    home_away_gap_abs,
    sample_matches,
    coverage_flag
   FROM analytics.player_detailed_metrics_v2_2_mat;

CREATE VIEW analytics.league_player_metric_leaderboard_v1 AS
 SELECT season_label,
    competition,
    player_source_id,
    player_name,
    position_code,
    role_group,
    source_team_id,
    team_slug,
    team_name,
    metric_key,
    metric_label,
    category_key,
    category_label,
    display_priority,
    total_value,
    per_match_value,
    per90_value,
    home_value,
    away_value,
    last5_value,
    league_avg,
    league_median,
    league_rank,
    league_percentile,
    vs_league_avg_abs,
    vs_league_avg_pct,
    rank_direction,
    is_higher_better,
    value_format,
    home_away_gap_abs,
    sample_matches,
    coverage_flag
   FROM analytics.player_detailed_metrics_current;

CREATE VIEW analytics.player_detailed_metrics_global_v1 AS
 WITH agg AS (
         SELECT player_detailed_metrics_v2_2_mat.season_label,
            player_detailed_metrics_v2_2_mat.competition,
            player_detailed_metrics_v2_2_mat.player_source_id,
            player_detailed_metrics_v2_2_mat.metric_key,
            (array_agg(player_detailed_metrics_v2_2_mat.player_name ORDER BY player_detailed_metrics_v2_2_mat.sample_matches DESC NULLS LAST))[1] AS player_name,
            (array_agg(player_detailed_metrics_v2_2_mat.position_code ORDER BY player_detailed_metrics_v2_2_mat.sample_matches DESC NULLS LAST))[1] AS position_code,
            (array_agg(player_detailed_metrics_v2_2_mat.role_group ORDER BY player_detailed_metrics_v2_2_mat.sample_matches DESC NULLS LAST))[1] AS role_group,
            (array_agg(player_detailed_metrics_v2_2_mat.source_team_id ORDER BY player_detailed_metrics_v2_2_mat.sample_matches DESC NULLS LAST))[1] AS source_team_id,
            (array_agg(player_detailed_metrics_v2_2_mat.team_slug ORDER BY player_detailed_metrics_v2_2_mat.sample_matches DESC NULLS LAST))[1] AS team_slug,
            (array_agg(player_detailed_metrics_v2_2_mat.team_name ORDER BY player_detailed_metrics_v2_2_mat.sample_matches DESC NULLS LAST))[1] AS team_name,
            max(player_detailed_metrics_v2_2_mat.metric_label) AS metric_label,
            max(player_detailed_metrics_v2_2_mat.category_key) AS category_key,
            max(player_detailed_metrics_v2_2_mat.category_label) AS category_label,
            max(player_detailed_metrics_v2_2_mat.display_priority) AS display_priority,
            sum(player_detailed_metrics_v2_2_mat.total_value) AS total_value,
            sum(player_detailed_metrics_v2_2_mat.sample_matches) AS sample_matches,
                CASE
                    WHEN bool_and(player_detailed_metrics_v2_2_mat.per_match_value = player_detailed_metrics_v2_2_mat.total_value) THEN sum(player_detailed_metrics_v2_2_mat.total_value)
                    ELSE sum(player_detailed_metrics_v2_2_mat.per_match_value * player_detailed_metrics_v2_2_mat.sample_matches::numeric) FILTER (WHERE player_detailed_metrics_v2_2_mat.per_match_value IS NOT NULL) / NULLIF(sum(player_detailed_metrics_v2_2_mat.sample_matches) FILTER (WHERE player_detailed_metrics_v2_2_mat.per_match_value IS NOT NULL), 0::numeric)
                END AS per_match_value,
            sum(player_detailed_metrics_v2_2_mat.per90_value * player_detailed_metrics_v2_2_mat.sample_matches::numeric) FILTER (WHERE player_detailed_metrics_v2_2_mat.per90_value IS NOT NULL) / NULLIF(sum(player_detailed_metrics_v2_2_mat.sample_matches) FILTER (WHERE player_detailed_metrics_v2_2_mat.per90_value IS NOT NULL), 0::numeric) AS per90_value,
            sum(player_detailed_metrics_v2_2_mat.home_value) AS home_value,
            sum(player_detailed_metrics_v2_2_mat.away_value) AS away_value,
            (array_agg(player_detailed_metrics_v2_2_mat.last5_value ORDER BY player_detailed_metrics_v2_2_mat.sample_matches DESC NULLS LAST))[1] AS last5_value,
            bool_or(player_detailed_metrics_v2_2_mat.is_higher_better) AS is_higher_better,
            (array_agg(player_detailed_metrics_v2_2_mat.rank_direction ORDER BY player_detailed_metrics_v2_2_mat.sample_matches DESC NULLS LAST))[1] AS rank_direction,
            max(player_detailed_metrics_v2_2_mat.value_format) AS value_format,
            bool_or(player_detailed_metrics_v2_2_mat.coverage_flag) AS coverage_flag
           FROM analytics.player_detailed_metrics_v2_2_mat
          GROUP BY player_detailed_metrics_v2_2_mat.season_label, player_detailed_metrics_v2_2_mat.competition, player_detailed_metrics_v2_2_mat.player_source_id, player_detailed_metrics_v2_2_mat.metric_key
        ), ranked AS (
         SELECT agg.season_label,
            agg.competition,
            agg.player_source_id,
            agg.metric_key,
            agg.player_name,
            agg.position_code,
            agg.role_group,
            agg.source_team_id,
            agg.team_slug,
            agg.team_name,
            agg.metric_label,
            agg.category_key,
            agg.category_label,
            agg.display_priority,
            agg.total_value,
            agg.sample_matches,
            agg.per_match_value,
            agg.per90_value,
            agg.home_value,
            agg.away_value,
            agg.last5_value,
            agg.is_higher_better,
            agg.rank_direction,
            agg.value_format,
            agg.coverage_flag,
            COALESCE(agg.per90_value, agg.per_match_value, agg.total_value) AS ranking_value
           FROM agg
        ), stats AS (
         SELECT ranked.season_label,
            ranked.competition,
            ranked.metric_key,
            avg(ranked.ranking_value) AS league_avg,
            percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (ranked.ranking_value::double precision)) AS league_median
           FROM ranked
          GROUP BY ranked.season_label, ranked.competition, ranked.metric_key
        )
 SELECT r.season_label,
    r.competition,
    r.player_source_id,
    r.player_name,
    r.position_code,
    r.role_group,
    r.source_team_id,
    r.team_slug,
    r.team_name,
    r.metric_key,
    r.metric_label,
    r.category_key,
    r.category_label,
    r.display_priority,
    r.total_value,
    r.per_match_value,
    r.per90_value,
    r.home_value,
    r.away_value,
    r.last5_value,
    st.league_avg,
    st.league_median,
    rank() OVER (PARTITION BY r.season_label, r.competition, r.metric_key ORDER BY (
        CASE
            WHEN r.rank_direction = 'asc'::text THEN r.ranking_value
            ELSE NULL::numeric
        END), (
        CASE
            WHEN r.rank_direction <> 'asc'::text THEN r.ranking_value
            ELSE NULL::numeric
        END) DESC NULLS LAST)::integer AS league_rank,
    percent_rank() OVER (PARTITION BY r.season_label, r.competition, r.metric_key ORDER BY (
        CASE
            WHEN r.rank_direction = 'asc'::text THEN r.ranking_value
            ELSE NULL::numeric
        END), (
        CASE
            WHEN r.rank_direction <> 'asc'::text THEN r.ranking_value
            ELSE NULL::numeric
        END) DESC NULLS LAST)::numeric AS league_percentile,
    r.ranking_value - st.league_avg AS vs_league_avg_abs,
        CASE
            WHEN st.league_avg IS NULL OR abs(st.league_avg) < 0.5 OR st.league_avg = 0::numeric THEN NULL::numeric
            ELSE (r.ranking_value - st.league_avg) / st.league_avg
        END AS vs_league_avg_pct,
    r.rank_direction,
    r.is_higher_better,
    r.value_format,
    abs(COALESCE(r.home_value, 0::numeric) - COALESCE(r.away_value, 0::numeric)) AS home_away_gap_abs,
    r.sample_matches,
    r.coverage_flag
   FROM ranked r
     JOIN stats st USING (season_label, competition, metric_key);

