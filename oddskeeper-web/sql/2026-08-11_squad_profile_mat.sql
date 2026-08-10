-- 2026-08-11: team_current_squad_profile_v1 MATERIALIZED'a cevrildi.
--
-- Sebep: view'in prof CTE'si her sorguda TUM player_profile_v1'i (agir opta
-- agregat view'u) DISTINCT ON ile tariyordu; takim filtreli sorgu ~3sn.
-- PSM fetchTeamPlayers PostgREST statement timeout'una (57014) takilmaya
-- basladi (sentetik + bio satir artisiyla esik asildi). Cozum: tanim
-- team_current_squad_profile_def_v1 adiyla korunur, mat ondan beslenir,
-- API adi (team_current_squad_profile_v1) mat'i okuyan ince view olur.
-- Tazeleme: apply_synthetic_squad.py sonunda (gunluk 05:00 zinciri) +
-- refresh_mats() zinciri (sofascore kosulari).

alter view analytics.team_current_squad_profile_v1
  rename to team_current_squad_profile_def_v1;

create materialized view analytics.team_current_squad_profile_mat as
select * from analytics.team_current_squad_profile_def_v1;

-- concurrently icin benzersiz indeks. NOT: af_player_id TEK BASINA benzersiz
-- DEGIL (transfer penceresinde oyuncu iki kadroda birden listelenebiliyor,
-- or. 138833) -> takim+oyuncu cifti kullanilir.
create unique index idx_tcsp_team_player
  on analytics.team_current_squad_profile_mat (team_source_id, af_player_id);
create index idx_tcsp_team
  on analytics.team_current_squad_profile_mat (team_source_id);

grant select on analytics.team_current_squad_profile_mat to anon, authenticated, service_role;

create view analytics.team_current_squad_profile_v1 as
select * from analytics.team_current_squad_profile_mat;

grant select on analytics.team_current_squad_profile_v1 to anon, authenticated, service_role;

notify pgrst, 'reload schema';
