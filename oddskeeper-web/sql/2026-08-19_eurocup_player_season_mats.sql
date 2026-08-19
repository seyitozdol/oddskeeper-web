-- H3 (ARCHITECTURE_REVIEW): ucl/uel/uecl_player_season_stats_v1 canli aggregate
-- view'lari her render'da ~1.4-4.3s suruyordu (15807 detay satiri iki aggregate
-- dalinda taraniyor, external merge sort work_mem 8MB'i asip diske tasiyor).
-- Bunlari matview'e aliyoruz; view'i ince "select * from mat"a ceviriyoruz
-- (player_metric_leaderboard_current deseni). Frontend loader'lar view'i
-- {prefix}_player_season_stats_v1 template'iyle cagirdigi icin HICBIR frontend
-- degisikligi gerekmez; tum tuketiciler seffaf olarak <100ms mat okur.
--
-- Grain (season_label, player_id, team_id) tum kupa/sezonlarda benzersiz (dogrulandi:
-- ucl/uel/uecl'de 0 dup) -> unique index, REFRESH ... CONCURRENTLY icin onkosul.
--
-- Refresh: run_match_scrape.sh'ta kupa-maci-islenince gate'li adim refresh_cup_mats.py
-- (CONCURRENTLY) calistirir. Bu migration mat'lari WITH DATA ile doldurur (ilk hal).
--
-- Geri alma: her prefix icin
--   DROP VIEW analytics.<p>_player_season_stats_v1;  -- ince passthrough
--   ... orijinal view tanimini yeniden yarat (kaynak: sql/2026-08-18_*_views.sql) ...
--   DROP MATERIALIZED VIEW analytics.<p>_player_season_stats_mat;

DO $mig$
DECLARE
  p text;
  d text;
BEGIN
  FOREACH p IN ARRAY ARRAY['ucl','uel','uecl'] LOOP
    -- Mevcut view tanimini (baz-tablo SELECT'i) ince-view'a cevirmeden ONCE yakala.
    SELECT pg_get_viewdef(format('analytics.%s_player_season_stats_v1', p), true) INTO d;
    d := rtrim(btrim(d), ';');

    -- 1) Matview (baz tablolardan; WITH DATA varsayilan -> hemen dolar).
    EXECUTE format(
      'CREATE MATERIALIZED VIEW analytics.%s_player_season_stats_mat AS %s', p, d);

    -- 2) CONCURRENTLY refresh icin unique index.
    EXECUTE format(
      'CREATE UNIQUE INDEX %s_pss_mat_uq ON analytics.%s_player_season_stats_mat '
      '(season_label, player_id, team_id)', p, p);

    -- 3) View'i ince passthrough'a cevir (kolonlar birebir ayni -> or replace calisir).
    EXECUTE format(
      'CREATE OR REPLACE VIEW analytics.%s_player_season_stats_v1 AS '
      'SELECT * FROM analytics.%s_player_season_stats_mat', p, p);

    -- 4) Grant'lari koru (orijinal view: anon/authenticated/service_role SELECT).
    EXECUTE format(
      'GRANT SELECT ON analytics.%s_player_season_stats_mat '
      'TO anon, authenticated, service_role', p);
    EXECUTE format(
      'GRANT SELECT ON analytics.%s_player_season_stats_v1 '
      'TO anon, authenticated, service_role', p);
  END LOOP;
END $mig$;
