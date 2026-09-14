-- 2026-09-14: mapping health FAIL (HIGH=5; 7 Eyl + 14 Eyl kosulari) kapama.

-- 1) anon sizintisi: sql/2026-09-01_cev_eurovolley.sql "to anon, authenticated"
--    ile uygulanmisti. anon-guard o push'ta KIRMIZIYDI (run 51, 2026-09-01) ama
--    migration yine de uygulanmis, kirmizi duzeltilmemis. Lockdown (2026-08-19)
--    geregi geri alinir; kaynak dosya da ayni commit'te "to authenticated"
--    olarak duzeltildi.
revoke select on analytics.vb_competitions_v1 from anon;

-- 2) player_mapping_ss_promoted_drift: Metehan Baltaci GS'den Genclerbirligi'ne
--    gecti; gercek Opta kimligi pm id 559'da (unique-name) acildi. Bayat GS
--    satiri (af tm618869 -> ss997155) ayni gercek kimlige hizalanir: iki af
--    kimligi tek profile (m-baltaci--d3dz...) gider, parcalanma biter.
update ref.player_mapping
   set opta_player_id   = 'd3dzc7rv10txevv09tpa7l016',
       opta_player_slug = 'm-baltaci--d3dzc7rv10txevv09tpa7l016',
       team_slug        = 'genclerbirligi'
 where id = 461 and opta_player_id = 'ss997155';

-- 3) squad_profile_broken_link 3 vaka (+ duplicate_slug'in 3'u): yaz penceresi
--    transferleri kadroda af-id'li, profil ss kimliginde. Ucu de profil
--    tarafinda takim/lig teyitli (Super Lig 26/27; Ege Bilim + Franculino mac
--    da oynadi). Da Mata + Ege Bilim'de pm'de FARKLI af id'ye kopru zaten var
--    (583994 / tm1321749, af cift-id klasigi); kadronun kullandigi id'ye ikinci
--    kopru acilir. Franculino'nun koprusu hic yoktu.
insert into ref.player_mapping
  (apifootball_player_id, opta_player_id, opta_player_slug, player_name, team_slug, match_method, sofascore_player_id)
values
  ('414354', 'ss1482346', 'da-mata--ss1482346',        'Da Mata',        'konyaspor',   'manual', '1482346'),
  ('491803', 'ss1942371', 'ege-bilim--ss1942371',      'Ege Bilim',      'kocaelispor', 'manual', '1942371'),
  ('340625', 'ss1146009', 'franculino-dju--ss1146009', 'Franculino Djú', 'trabzonspor', 'manual', '1146009');

-- 4) LOW odds_orphan_availability temizligi (166 -> 355 birikmisti; yetim =
--    taban event stale-sweep ile silinmis, satir view'da zaten gorunmuyor).
delete from tracker.event_odds_availability a
 where not exists (select 1 from tracker.upcoming_events e where e.event_id = a.event_id);

-- Sayilarin dusmesi icin sart (2026-08-19 tuzagi). Duplicate_slug'in dusmesi
-- icin info mat'i da gerekir (player_current_info_bridged_v1 dogrudan mat okur):
refresh materialized view analytics.team_current_squad_profile_mat;
refresh materialized view analytics.player_current_info_bridged_mat;
