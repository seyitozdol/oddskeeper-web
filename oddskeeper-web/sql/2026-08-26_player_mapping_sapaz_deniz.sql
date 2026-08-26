-- 2026-08-26: squad_profile_broken_link (mapping health HIGH) kapama.
-- Kadro slug'i af/sentetik kimlikte, profil ss (SofaScore) kimliginde kalan 2 oyuncu
-- icin manuel kopru (Ali Turap Bulbul emsali, 2026-08-19).
-- NOT: Ucuncu vaka (ibrahim-diabate--aftm620696, Erzurumspor) YANLIS POZITIF:
-- ss1500169 KF Egnatia'nin (UEFA rakibi) AYRI oyuncusu; mapping ACILMADI,
-- check tarafinda eurocup-only profiller aday olmaktan cikarildi
-- (pipeline/src/common/mapping_health_check.py).

insert into ref.player_mapping
  (apifootball_player_id, opta_player_id, opta_player_slug, player_name, team_slug, match_method, sofascore_player_id)
values
  ('673366',    'ss2690252', 'kuzey-sapaz--ss2690252',  'Kuzey Sapaz',  'fenerbahce', 'manual', '2690252'),
  ('tm1223585', 'ss2649962', 'sercan-deniz--ss2649962', 'Sercan Deniz', 'kasimpasa',  'manual', '2649962');

-- Sayinin dusmesi icin sart (2026-08-19 tuzagi):
refresh materialized view analytics.team_current_squad_profile_mat;
