-- GERI ALMA: H4 pivot mat'ini dusurur (2026-08-19_tsl_player_table_mat.sql tersi).
-- Once loader'i eski uzun-format cekimine geri al (git revert), sonra bu calisir.
DROP MATERIALIZED VIEW IF EXISTS analytics.tsl_ss_player_table_mat;
