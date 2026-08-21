-- Kupa PSM veri katmani (sahip istegi 2026-08-21): CL/EL/Konf Player Stats Model.
-- Desen = TFF1 PSM'in sofascore-keyed seti; tek fark competition kolonlu TEK set
-- (frontend eq(competition) ile suzer; uc kupa icin ayri view seti YOK).
-- Kaynak zinciri: eurocup_player_match_log_v1 (mpsd raw parse) -> log MAT ->
-- sezon agregati -> kadro (roster; kupa icin TM piyasa-degeri kaynagi yok,
-- market_value_eur NULL). Dekorasyon football.sofascore_player_info'dan.
-- Shot-zone sezon toplami: player_shot_zones_season_v1 kupalari bilincli
-- DISLIYOR (TSL leak-guard); kupa-ozel sezon view'i burada.
-- Refresh: refresh_orchestrator.py CUP kaynagina eklendi (log -> season -> squad).
-- UYGULANDI: 2026-08-21 canli.

-- 1) Oyuncu-mac logu MAT (raw_stats parse'i tur basina bir kez)
drop materialized view if exists analytics.eurocup_pm_player_match_log_mat;
create materialized view analytics.eurocup_pm_player_match_log_mat as
  select * from analytics.eurocup_player_match_log_v1;
create unique index uq_eurocup_pm_log_mat
  on analytics.eurocup_pm_player_match_log_mat (competition, season_label, match_id, player_id);
create index ix_eurocup_pm_log_player
  on analytics.eurocup_pm_player_match_log_mat (competition, player_id, match_datetime desc);

-- 2) Sezon x oyuncu agregati (tff1_pm_player_season_v1 kolon sozlesmesi + competition)
create or replace view analytics.eurocup_pm_player_season_v1 as
select
  competition,
  season_label,
  player_id,
  max(player_name)                                              as player_name,
  (array_agg(team_id order by match_datetime desc))[1]          as team_id,
  (array_agg(team_name order by match_datetime desc))[1]        as team_name,
  mode() within group (order by position_code)                  as position_code,
  count(*) filter (where minutes > 0)                           as appearances,
  count(*) filter (where lineup_status = 'starter')             as starts,
  sum(minutes)                                                  as minutes,
  max(match_datetime) filter (where minutes > 0)                as last_match_datetime,
  sum(goals) as goals, sum(assists) as assists,
  sum(shots) as shots, sum(shots_on_target) as shots_on_target,
  sum(total_passes) as total_passes, sum(accurate_passes) as accurate_passes,
  sum(key_passes) as key_passes, sum(crosses) as crosses,
  sum(tackles) as tackles, sum(interceptions) as interceptions,
  sum(clearances) as clearances, sum(blocks) as blocks,
  sum(ball_recoveries) as ball_recoveries,
  sum(duels_won) as duels_won, sum(aerials_won) as aerials_won,
  sum(fouls) as fouls, sum(was_fouled) as was_fouled,
  sum(offsides) as offsides, sum(dribbles_won) as dribbles_won,
  sum(touches) as touches, sum(saves) as saves
from analytics.eurocup_pm_player_match_log_mat
group by competition, season_label, player_id;

drop materialized view if exists analytics.eurocup_pm_player_season_mat;
create materialized view analytics.eurocup_pm_player_season_mat as
  select * from analytics.eurocup_pm_player_season_v1;
create unique index uq_eurocup_pm_season_mat
  on analytics.eurocup_pm_player_season_mat (competition, season_label, player_id);

-- 3) Kadro (tff1_squad_mat kolon sozlesmesi + competition). Uyelik = roster:
--    takimin verisi olan EN GUNCEL sezonun oyunculari (26/27 satiri olan takim
--    26/27 kadrosu, yoksa 25/26'ya duser; elemelerden yeni gelen takimlar da
--    boylece kadrolu olur).
drop materialized view if exists analytics.eurocup_pm_squad_mat;
create materialized view analytics.eurocup_pm_squad_mat as
with ss as (
  select * from analytics.eurocup_pm_player_season_v1
), pick as (
  select competition, team_id, max(season_label) as use_season
  from ss group by competition, team_id
)
select
  s.competition,
  s.team_id,
  s.team_name,
  s.player_id,
  coalesce(i.player_name, s.player_name)      as player_name,
  coalesce(i."position", s.position_code)     as "position",
  i.photo_url,
  i.birth_date,
  i.country,
  null::numeric                               as market_value_eur,
  'roster'::text                              as membership_source,
  s.appearances,
  s.starts,
  s.minutes,
  round(100.0 * s.starts / nullif(s.appearances, 0)) as starter_rate_pct,
  s.last_match_datetime
from ss s
join pick p on p.competition = s.competition and p.team_id = s.team_id
           and s.season_label = p.use_season
left join football.sofascore_player_info i on i.sofascore_player_id = s.player_id;
create unique index uq_eurocup_pm_squad_mat
  on analytics.eurocup_pm_squad_mat (competition, team_id, player_id);

-- 4) Kupa shot-zone sezon toplami (player_shot_zones_season_v1'in kupa esi;
--    leak-guard'li TSL view'ina DOKUNULMADI)
create or replace view analytics.eurocup_shot_zones_season_v1 as
select competition, sofascore_player_id, season_label,
  count(*) as matches,
  sum(shots_total) as shots_total, sum(shots_ibox) as shots_ibox,
  sum(shots_obox) as shots_obox, sum(sot_total) as sot_total,
  sum(sot_ibox) as sot_ibox, sum(sot_obox) as sot_obox,
  sum(goals_ibox) as goals_ibox, sum(goals_obox) as goals_obox
from analytics.player_shot_zones_match_v1
where competition in ('UEFA Şampiyonlar Ligi','UEFA Avrupa Ligi','UEFA Konferans Ligi')
group by competition, sofascore_player_id, season_label;

grant select on analytics.eurocup_pm_player_match_log_mat,
  analytics.eurocup_pm_player_season_v1, analytics.eurocup_pm_player_season_mat,
  analytics.eurocup_pm_squad_mat, analytics.eurocup_shot_zones_season_v1
  to authenticated, service_role;

notify pgrst, 'reload schema';
