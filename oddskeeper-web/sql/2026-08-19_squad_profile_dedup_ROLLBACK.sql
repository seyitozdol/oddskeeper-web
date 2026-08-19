-- GERI ALMA: team_current_squad_profile_v1'i dedup'suz ince passthrough'a dondurur
-- (2026-08-19_squad_profile_dedup.sql'in tersi). Mat degismedi.
CREATE OR REPLACE VIEW analytics.team_current_squad_profile_v1 AS
SELECT team_slug, team_source_id, team_name, af_player_id, opta_player_id, player_key,
       player_name, player_slug, primary_position_code, position_group, shirt_number,
       appearances, starts, sub_appearances, starter_rate_pct, last_match_datetime,
       stats_season_label, display_name
FROM analytics.team_current_squad_profile_mat;
