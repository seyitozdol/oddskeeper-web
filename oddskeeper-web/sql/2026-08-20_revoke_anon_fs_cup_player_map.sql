-- K-1 (mimari inceleme 2, 2026-08-20): anon lockdown kacagi kapatildi.
-- ref.flashscore_sofa_cup_player_map, build_flashscore_sofa_cup_player_map.py
-- DDL'indeki "grant ... to anon" satiri yuzunden her kosuda anon'a yeniden
-- aciliyordu (CI anon-guard yalniz .sql diff'ini taradigi icin gormedi).
-- Ayni commit'te: (a) py DDL'inden anon cikarildi, (b) mapping_health'e
-- anon_grants_project_schemas HIGH sayaci eklendi (runtime bekci),
-- (c) anon-guard taramasi *.py dosyalarini da kapsar hale getirildi.
-- UYGULANDI: 2026-08-20 (autocommit, canli dogrulandi: proje semalarinda
-- anon grant sayisi 0).

revoke all on ref.flashscore_sofa_cup_player_map from anon;
