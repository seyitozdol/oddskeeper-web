-- 2026-07-22  analytics.player_log_season_avg_v1
-- Amac: Player Market Prediction'a eklenen Shots Off Target ve Blocked Shots
--   marketleri icin sezon ortalamasi. Bu iki metrik player_metric_leaderboard
--   tablosunda yok; mac loglarindan hesaplanir (avg null degerleri saymaz).
-- Fouls Suffered (fouls_won) ve xG (expected_goals) leaderboard'da zaten var,
--   bu view sadece eksik iki metrigi kapatir.

CREATE OR REPLACE VIEW analytics.player_log_season_avg_v1 AS
SELECT
  player_source_id,
  season_label,
  count(*)                AS matches,
  avg(shots_off_target)   AS shots_off_target,
  avg(shots_blocked)      AS shots_blocked
FROM analytics.player_match_log_v1
GROUP BY player_source_id, season_label;

GRANT SELECT ON analytics.player_log_season_avg_v1 TO anon, authenticated, service_role;
