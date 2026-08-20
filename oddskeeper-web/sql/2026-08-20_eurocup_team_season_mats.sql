-- Avrupa kupasi TAKIM-sezon view'lari mat'a aliniyor (H3'un eksik kalan esi).
-- ucl/uel/uecl_team_season_stats_v1 canli aggregate: player_agg CTE'si
-- football.mpsd_with_raw (raw_stats jsonb) uzerinden takim toplamlari cikariyor;
-- dogrudan baglantida 1.5-3.2s, PostgREST authenticator'da (work_mem 8MB +
-- statement_timeout) zaman asimina kadar gidiyor. Birlesik kupa takim profili
-- ucunu birden cektigi icin sayfa 8-10s aciliyordu, uc sorgu birden timeout
-- olunca sayfa 404'e dusuyordu (contexts bos -> notFound).
--
-- Recete 2026-08-19_eurocup_player_season_mats.sql (H3) ile birebir ayni:
-- mevcut view tanimi matview'e alinir, view ince "select * from mat" olur;
-- frontend/PostgREST tuketicileri icin sozlesme degismez.
--
-- Grain (season_label, team_id) uc kupada da benzersiz (dogrulandi: 0 dup)
-- -> unique index, REFRESH ... CONCURRENTLY icin onkosul.
--
-- Refresh: refresh_orchestrator.py tablosuna + CUP_CHAIN_MATS'a eklendi (cup
-- kaynagi); OYUNCU mat'larindan SONRA tazelenir cunku team_xg CTE'si
-- {p}_player_season_stats_v1 (ince view -> oyuncu mat'i) okur.
--
-- Grant: yalniz authenticated + service_role (anon SELECT lockdown 2026-08-19;
-- yeni SQL'de anon grant yasak).
--
-- Geri alma: her prefix icin
--   DROP VIEW analytics.<p>_team_season_stats_v1;
--   ... orijinal view tanimini yeniden yarat (kaynak: sql/2026-08-18_*_views.sql) ...
--   DROP MATERIALIZED VIEW analytics.<p>_team_season_stats_mat;

DO $mig$
DECLARE
  p text;
  d text;
BEGIN
  FOREACH p IN ARRAY ARRAY['ucl','uel','uecl'] LOOP
    -- Mevcut view tanimini (baz-tablo SELECT'i) ince-view'a cevirmeden ONCE yakala.
    SELECT pg_get_viewdef(format('analytics.%s_team_season_stats_v1', p), true) INTO d;
    d := rtrim(btrim(d), ';');

    -- 1) Matview (baz tablolardan; WITH DATA varsayilan -> hemen dolar).
    EXECUTE format(
      'CREATE MATERIALIZED VIEW analytics.%s_team_season_stats_mat AS %s', p, d);

    -- 2) CONCURRENTLY refresh icin unique index.
    EXECUTE format(
      'CREATE UNIQUE INDEX %s_tss_mat_uq ON analytics.%s_team_season_stats_mat '
      '(season_label, team_id)', p, p);

    -- 3) View'i ince passthrough'a cevir (kolonlar birebir ayni -> or replace calisir).
    EXECUTE format(
      'CREATE OR REPLACE VIEW analytics.%s_team_season_stats_v1 AS '
      'SELECT * FROM analytics.%s_team_season_stats_mat', p, p);

    -- 4) Grant (anon YOK: anon SELECT lockdown).
    EXECUTE format(
      'GRANT SELECT ON analytics.%s_team_season_stats_mat '
      'TO authenticated, service_role', p);
    EXECUTE format(
      'GRANT SELECT ON analytics.%s_team_season_stats_v1 '
      'TO authenticated, service_role', p);
  END LOOP;
END $mig$;
