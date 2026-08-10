-- 2026-08-11: PSM performans - iki sicak view MATERIALIZED'a cevrildi.
--
-- Kullanici sikayeti: sayfa gecisleri cok yavas. Olcum: her PSM yuklemesinde
-- kosan sorgular altta agir VIEW hesapliyordu:
--   player_metric_leaderboard_current  ~2-3sn (28.8k satir, her metrik
--     fetch'inde + fetchLatestMetricSeason'da yeniden hesap)
--   player_profile_v1                  ~2.7sn (570 satir cikti ama agir hesap;
--     drawer + kadro profilleri her cagrida oder)
-- Desen: tanim *_def_v1 adiyla korunur, mat ondan beslenir, API adi mat'i
-- okuyan ince view olur (team_current_squad_profile_v1 ile ayni cozum).
-- Tazeleme: refresh_mats() zinciri (sofascore kosulari) + gunluk kadro zinciri.
-- NOT: anahtarlar tam tekil degil (profile'da 1, leaderboard'da ~1.4k cift) ->
-- unique index YOK, refresh PLAIN yapilir (kisa kilit, kabul edilebilir).

-- ── player_metric_leaderboard_current ──
alter view analytics.player_metric_leaderboard_current
  rename to player_metric_leaderboard_current_def_v1;

create materialized view analytics.player_metric_leaderboard_current_mat as
select * from analytics.player_metric_leaderboard_current_def_v1;

create index idx_pmlc_metric_season
  on analytics.player_metric_leaderboard_current_mat (metric_key, season_label);
create index idx_pmlc_player
  on analytics.player_metric_leaderboard_current_mat (player_source_id);
create index idx_pmlc_season
  on analytics.player_metric_leaderboard_current_mat (season_label);

grant select on analytics.player_metric_leaderboard_current_mat to anon, authenticated, service_role;

create view analytics.player_metric_leaderboard_current as
select * from analytics.player_metric_leaderboard_current_mat;

grant select on analytics.player_metric_leaderboard_current to anon, authenticated, service_role;

-- ── player_profile_v1 ──
alter view analytics.player_profile_v1 rename to player_profile_def_v1;

create materialized view analytics.player_profile_mat as
select * from analytics.player_profile_def_v1;

create index idx_ppm_slug on analytics.player_profile_mat (player_slug);
create index idx_ppm_source on analytics.player_profile_mat (player_source_id, season_label);

grant select on analytics.player_profile_mat to anon, authenticated, service_role;

create view analytics.player_profile_v1 as
select * from analytics.player_profile_mat;

grant select on analytics.player_profile_v1 to anon, authenticated, service_role;

notify pgrst, 'reload schema';
