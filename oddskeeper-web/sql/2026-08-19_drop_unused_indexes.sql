-- H10 (ARCHITECTURE_REVIEW): idx_scan=0 olan non-unique indeks temizligi (~2.1 MB).
-- Kaynak: pg_stat_user_indexes (stats hic reset edilmemis); her tablonun sorgulari
-- PK ya da baska bir indeksle karsilaniyor (or. player_leaderboard_rows_v1 sorgulari
-- idx_..._player 14k scan, sofascore_squad_current pkey 9.4k scan). Supabase sistem
-- semalarindaki (auth/storage/realtime) taranmamis indekslere BILEREK dokunulmadi.
-- Pipeline bu indeksleri yeniden YARATMAZ (grep dogrulandi); geri almak icin
-- 2026-08-19_drop_unused_indexes_ROLLBACK.sql.
-- Not: sofascore_squad_current 2026-08-15'te kuruldu (4 gunluk gozlem) ama tablo
-- 1.2k satir; indeks gerekirse yeniden kurmak saniyelik.

drop index if exists analytics.idx_player_leaderboard_rows_metric_rank;   -- 1328 KB
drop index if exists analytics.idx_player_leaderboard_rows_metric_team;   --  464 KB
drop index if exists analytics.idx_player_qualification_v1_pool;
drop index if exists analytics.idx_player_qualification_v1_qualified;
drop index if exists analytics.idx_player_qualification_v1_scope;
drop index if exists analytics.idx_player_qualification_v1_team;
drop index if exists analytics.idx_prediction_match_shots_v1_is_active;
drop index if exists analytics.idx_team_leaderboard_catalog_comp_season;
drop index if exists analytics.idx_team_leaderboard_rows_metric_rank;
-- idx_team_leaderboard_rows_metric_team DUSURULMEDI: idx_scan=2, kullanimda.
drop index if exists football.sofascore_squad_current_player_idx;         --   88 KB
drop index if exists football.sofascore_squad_current_team_slug_idx;      --   40 KB
