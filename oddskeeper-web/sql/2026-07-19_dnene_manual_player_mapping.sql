-- 2026-07-19: D. Nene (Fenerbahce) manuel oyuncu eslemesi
--
-- Sorun: Opta profili "D. Nene", API-Football kadrosu ise ayni oyuncuyu
-- "N. Dorgeles" (first_name=Nene, last_name=Dorgeles) olarak tutuyor.
-- Isim sirasi ters oldugu icin otomatik eslemenin 3 gecisi de tutmadi;
-- oyuncu sitede yanlislikla "Not in current league squads" / "Left club"
-- gorunuyordu. Ters-isim taramasi yapildi, ligde bu durumda olan tek
-- oyuncu bu (dogum tarihi 2002-12-23 ve Mali uyrugu ile teyitli).
--
-- UYGULANDI (id=274). Kadro tazeleme sonrasi mapping yeniden kurulursa
-- (truncate + 3 gecis) bu satirin da yeniden eklenmesi gerekir.

insert into ref.player_mapping
  (apifootball_player_id, opta_player_id, opta_player_slug, player_name, team_slug, match_method)
values
  ('302869', '96xomdtz505yoaz35i5bb8f84', 'd-nene--96xomdtz505yoaz35i5bb8f84', 'D. Nene', 'fenerbahce', 'manual');
