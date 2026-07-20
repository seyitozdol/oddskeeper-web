-- 2026-07-20  analytics.team_current_squad_profile_v1: display_name kolonu
-- Amac: Player Market Prediction tablosunda kisa Opta isimleri ("E. Shomurodov")
--   yerine uzun isimler ("Eldor Shomurodov") gosterilsin.
-- Kaynak: analytics.player_current_info_v1 (first_name + last_name, yoksa full_name).
--   Slug bazinda mukerrer satir olabildigi icin DISTINCT ON ile tekillestirilir.
-- Not: CREATE OR REPLACE ile mevcut kolon sirasi korunur, display_name sona eklenir.

CREATE OR REPLACE VIEW analytics.team_current_squad_profile_v1 AS
WITH prof AS (
  SELECT DISTINCT ON (player_source_id)
    player_source_id, season_label, player_name, player_slug,
    primary_position_code, appearances, starts, sub_appearances,
    starter_rate_pct, last_match_datetime
  FROM analytics.player_profile_v1
  ORDER BY player_source_id, season_label DESC, appearances DESC
),
info AS (
  SELECT DISTINCT ON (player_slug)
    player_slug, full_name, first_name, last_name
  FROM analytics.player_current_info_v1
  ORDER BY player_slug, fetched_at DESC NULLS LAST
)
SELECT
  s.team_slug,
  s.team_source_id,
  s.team_name,
  s.player_source_id                                        AS af_player_id,
  pm.opta_player_id,
  COALESCE(pm.opta_player_id, 'af-' || s.player_source_id)  AS player_key,
  COALESCE(prof.player_name, s.player_name)                 AS player_name,
  COALESCE(prof.player_slug, s.player_slug)                 AS player_slug,
  COALESCE(
    prof.primary_position_code,
    CASE s.position_group
      WHEN 'GOALKEEPER' THEN 'GK'
      WHEN 'DEFENDER'   THEN 'DF'
      WHEN 'MIDFIELDER' THEN 'MF'
      WHEN 'FORWARD'    THEN 'FW'
      ELSE 'NA'
    END)                                                    AS primary_position_code,
  s.position_group,
  s.shirt_number,
  COALESCE(prof.appearances, 0)                             AS appearances,
  COALESCE(prof.starts, 0)                                  AS starts,
  COALESCE(prof.sub_appearances, 0)                         AS sub_appearances,
  prof.starter_rate_pct,
  prof.last_match_datetime,
  prof.season_label                                         AS stats_season_label,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' ', info.first_name, info.last_name)), ''),
    info.full_name,
    prof.player_name,
    s.player_name)                                          AS display_name
FROM analytics.team_current_squad_v1 s
LEFT JOIN ref.player_mapping pm
  ON pm.apifootball_player_id = s.player_source_id
LEFT JOIN prof
  ON prof.player_source_id = pm.opta_player_id
LEFT JOIN info
  ON info.player_slug = COALESCE(prof.player_slug, s.player_slug);

GRANT SELECT ON analytics.team_current_squad_profile_v1 TO anon, authenticated, service_role;
