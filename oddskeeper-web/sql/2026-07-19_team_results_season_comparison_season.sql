-- 2026-07-19: Takim detay sekmelerine gecmis sezon destegi icin DB degisiklikleri
--
-- 1) analytics.team_results_v1: season_label kolonu eklendi (sona; mevcut
--    kolon sirasi korunarak CREATE OR REPLACE ile). Sonuclar sekmesi artik
--    sezona gore filtrelenebiliyor.
-- 2) analytics.get_team_comparison_v1: p_season_label parametresi eklendi
--    (DEFAULT NULL = en guncel sezon, ORDER BY season_label DESC ile
--    deterministik). Eski 3 parametreli surumler DROP edildi; public
--    sarmalayici da 4 parametreli olarak yeniden olusturuldu.
--
-- UYGULANDI: 2026-07-19

CREATE OR REPLACE VIEW analytics.team_results_v1 AS
 SELECT tm.team_slug,
    tm.source_team_id AS team_source_id,
    tm.display_name AS team_name,
    m.source_match_id,
    m.competition,
    m.match_datetime,
        CASE
            WHEN m.home_team_source_id = tm.source_team_id THEN true
            ELSE false
        END AS is_home,
        CASE
            WHEN m.away_team_source_id = tm.source_team_id THEN true
            ELSE false
        END AS is_away,
        CASE
            WHEN m.home_team_source_id = tm.source_team_id THEN m.away_team_name
            ELSE m.home_team_name
        END AS opponent_name,
        CASE
            WHEN m.home_team_source_id = tm.source_team_id THEN m.away_team_source_id
            ELSE m.home_team_source_id
        END AS opponent_source_team_id,
        CASE
            WHEN m.home_team_source_id = tm.source_team_id THEN m.home_score
            ELSE m.away_score
        END AS team_score,
        CASE
            WHEN m.home_team_source_id = tm.source_team_id THEN m.away_score
            ELSE m.home_score
        END AS opponent_score,
        CASE
            WHEN m.home_score IS NULL OR m.away_score IS NULL THEN NULL::text
            WHEN m.home_team_source_id = tm.source_team_id THEN concat(m.home_score, '-', m.away_score)
            ELSE concat(m.away_score, '-', m.home_score)
        END AS score_display,
        CASE
            WHEN m.home_score IS NULL OR m.away_score IS NULL THEN NULL::text
            WHEN m.winner_team_source_id = tm.source_team_id THEN 'W'::text
            WHEN m.winner_team_source_id IS NULL THEN 'D'::text
            ELSE 'L'::text
        END AS result_code,
        CASE
            WHEN m.home_score IS NULL OR m.away_score IS NULL THEN NULL::integer
            WHEN m.winner_team_source_id = tm.source_team_id THEN 3
            WHEN m.winner_team_source_id IS NULL THEN 1
            ELSE 0
        END AS result_points,
    m.venue,
        CASE
            WHEN m.home_team_source_id = tm.source_team_id THEN away_map.team_slug
            ELSE home_map.team_slug
        END AS opponent_team_slug,
    m.season_label
   FROM ref.team_mapping tm
     JOIN football.matches m ON m.home_team_source_id = tm.source_team_id OR m.away_team_source_id = tm.source_team_id
     LEFT JOIN ref.team_mapping home_map ON home_map.source_team_id = m.home_team_source_id AND home_map.is_active = true
     LEFT JOIN ref.team_mapping away_map ON away_map.source_team_id = m.away_team_source_id AND away_map.is_active = true
  WHERE tm.source_team_id IS NOT NULL AND tm.is_active = true;

DROP FUNCTION IF EXISTS public.get_team_comparison_v1(text, text, text);
DROP FUNCTION IF EXISTS analytics.get_team_comparison_v1(text, text, text);

CREATE OR REPLACE FUNCTION analytics.get_team_comparison_v1(
  p_team_slug_a text,
  p_team_slug_b text,
  p_split_key text DEFAULT 'overall'::text,
  p_season_label text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_competition  TEXT;
  v_season_label TEXT;
  v_team_a       JSONB;
  v_team_b       JSONB;
  v_league_avg   JSONB;
BEGIN

  -- competition + season_label'i A takimindan al; sezon verilmemisse en guncel
  SELECT competition, season_label
  INTO v_competition, v_season_label
  FROM analytics.team_statistics_split_v1
  WHERE team_slug = p_team_slug_a
    AND split_key = p_split_key
    AND (p_season_label IS NULL OR season_label = p_season_label)
  ORDER BY season_label DESC
  LIMIT 1;

  IF v_competition IS NULL THEN
    RETURN jsonb_build_object('error', 'team_a not found: ' || p_team_slug_a);
  END IF;

  SELECT jsonb_build_object(
    'team_slug',              team_slug,
    'team_name',              team_name,
    'split_key',              split_key,
    'split_label',            split_label,
    'played',                 played,
    'wins',                   wins,
    'draws',                  draws,
    'losses',                 losses,
    'goals_for',              goals_for,
    'goals_against',          goals_against,
    'goal_difference',        goal_difference,
    'points',                 points,
    'points_per_game',        ROUND(points_per_game::NUMERIC, 2),
    'win_rate_pct',           ROUND(win_rate_pct::NUMERIC, 1),
    'goals_for_per_game',     ROUND((goals_for::NUMERIC / NULLIF(played,0)), 2),
    'goals_against_per_game', ROUND((goals_against::NUMERIC / NULLIF(played,0)), 2)
  )
  INTO v_team_a
  FROM analytics.team_statistics_split_v1
  WHERE team_slug    = p_team_slug_a
    AND split_key    = p_split_key
    AND competition  = v_competition
    AND season_label = v_season_label
  LIMIT 1;

  SELECT jsonb_build_object(
    'team_slug',              team_slug,
    'team_name',              team_name,
    'split_key',              split_key,
    'split_label',            split_label,
    'played',                 played,
    'wins',                   wins,
    'draws',                  draws,
    'losses',                 losses,
    'goals_for',              goals_for,
    'goals_against',          goals_against,
    'goal_difference',        goal_difference,
    'points',                 points,
    'points_per_game',        ROUND(points_per_game::NUMERIC, 2),
    'win_rate_pct',           ROUND(win_rate_pct::NUMERIC, 1),
    'goals_for_per_game',     ROUND((goals_for::NUMERIC / NULLIF(played,0)), 2),
    'goals_against_per_game', ROUND((goals_against::NUMERIC / NULLIF(played,0)), 2)
  )
  INTO v_team_b
  FROM analytics.team_statistics_split_v1
  WHERE team_slug    = p_team_slug_b
    AND split_key    = p_split_key
    AND competition  = v_competition
    AND season_label = v_season_label
  LIMIT 1;

  IF v_team_b IS NULL THEN
    RETURN jsonb_build_object('error', 'team_b not found: ' || p_team_slug_b);
  END IF;

  SELECT jsonb_build_object(
    'played',                 ROUND(AVG(played), 1),
    'wins',                   ROUND(AVG(wins), 1),
    'draws',                  ROUND(AVG(draws), 1),
    'losses',                 ROUND(AVG(losses), 1),
    'goals_for',              ROUND(AVG(goals_for), 1),
    'goals_against',          ROUND(AVG(goals_against), 1),
    'goal_difference',        ROUND(AVG(goal_difference), 1),
    'points',                 ROUND(AVG(points), 1),
    'points_per_game',        ROUND(AVG(points_per_game::NUMERIC), 2),
    'win_rate_pct',           ROUND(AVG(win_rate_pct::NUMERIC), 1),
    'goals_for_per_game',     ROUND(AVG(goals_for::NUMERIC / NULLIF(played,0)), 2),
    'goals_against_per_game', ROUND(AVG(goals_against::NUMERIC / NULLIF(played,0)), 2)
  )
  INTO v_league_avg
  FROM analytics.team_statistics_split_v1
  WHERE competition  = v_competition
    AND season_label = v_season_label
    AND split_key    = p_split_key;

  RETURN jsonb_build_object(
    'competition',  v_competition,
    'season_label', v_season_label,
    'split_key',    p_split_key,
    'team_a',       v_team_a,
    'team_b',       v_team_b,
    'league_avg',   v_league_avg
  );

END;
$function$;

CREATE OR REPLACE FUNCTION public.get_team_comparison_v1(
  p_team_slug_a text,
  p_team_slug_b text,
  p_split_key text DEFAULT 'overall'::text,
  p_season_label text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN analytics.get_team_comparison_v1(p_team_slug_a, p_team_slug_b, p_split_key, p_season_label);
END;
$function$;
