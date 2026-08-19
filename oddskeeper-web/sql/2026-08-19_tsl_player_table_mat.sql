-- H4 (ARCHITECTURE_REVIEW): TSL Players sekmesi pivot mat.
-- getResmiPlayers tsl_ss_player_detailed_metrics_global_mat'i uzun-format cekiyordu
-- (28 metrik x ~691 oyuncu = ~19.348 satir, 1 count + 20 range istegi) ve JS'te
-- oyuncu-basina pivotluyordu (~700 satir). Bu mat pivot'u DB'de bir kez yapar:
-- oyuncu-basina 1 satir + tum metrikleri jsonb'de. Loader 1 istek/~691 satir okur.
--
-- (competition, season_label, player_source_id) benzersiz (GROUP BY garantisi) ->
-- unique index, CONCURRENTLY refresh. Descriptor (ad/poz sabit; source_team_id 5
-- transfer oyuncusunda min() ile deterministik). (comp,season,player,metric) TSL'de
-- 0 dup -> jsonb_object_agg dup-key sorunu YOK. Tum metrikler toplanir (component
-- belirli anahtarlari okur, fazlasi yok sayilir; yeni frontend metrigi otomatik gelir).
--
-- Refresh: kaynak mat (detailed_metrics_global) tazelendikten SONRA; refresh_tsl_mats.py
-- + loader.refresh_mats tsl_ss blogu. Geri alma: *_ROLLBACK.sql.
CREATE MATERIALIZED VIEW analytics.tsl_ss_player_table_mat AS
SELECT
  player_source_id,
  competition,
  season_label,
  min(player_name)     AS player_name,
  min(position_code)   AS position_code,
  min(source_team_id)  AS source_team_id,
  min(team_name)       AS team_name,
  jsonb_object_agg(
    metric_key,
    jsonb_build_object('total', total_value, 'perMatch', per_match_value, 'per90', per90_value)
  ) AS metrics
FROM analytics.tsl_ss_player_detailed_metrics_global_mat
GROUP BY player_source_id, competition, season_label;

CREATE UNIQUE INDEX tsl_ss_player_table_mat_uq
  ON analytics.tsl_ss_player_table_mat (competition, season_label, player_source_id);

GRANT SELECT ON analytics.tsl_ss_player_table_mat TO anon, authenticated, service_role;
