-- H3 GERI ALMA: 2026-08-19_eurocup_player_season_mats.sql'i tersine cevirir.
-- ucl/uel/uecl_player_season_stats_v1'i tekrar canli aggregate view'a dondurur
-- (mat'in tanimindaki baz-tablo SELECT'ini geri yazar) ve matview'i dusurur.
-- Frontend degismez (view adi/kolonlari ayni). refresh_cup_mats.py cagrisi
-- (run_match_scrape 3d + fetcher CUP_M) ayrica kaldirilmali/etkisiz kalir
-- (mat yoksa refresh_cup_mats HATA loglar ama tur devam eder).
DO $rb$
DECLARE
  p text;
  d text;
BEGIN
  FOREACH p IN ARRAY ARRAY['ucl','uel','uecl'] LOOP
    -- Orijinal SELECT su an mat'in tanimi (view artik "select * from mat").
    SELECT pg_get_viewdef(format('analytics.%s_player_season_stats_mat', p)::regclass, true) INTO d;
    d := rtrim(btrim(d), ';');
    -- View'i baz-tablo aggregate'ine geri cevir (kolonlar birebir ayni).
    EXECUTE format(
      'CREATE OR REPLACE VIEW analytics.%s_player_season_stats_v1 AS %s', p, d);
    -- Artik view mat'a bagimli degil -> matview dusurulebilir.
    EXECUTE format(
      'DROP MATERIALIZED VIEW analytics.%s_player_season_stats_mat', p);
  END LOOP;
END $rb$;
