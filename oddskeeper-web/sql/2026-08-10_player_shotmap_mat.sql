-- 2026-08-10 (2. adim): shot-zone match katmani MATERIALIZED'a cevrildi.
-- Sebep: view her sorguda 43k+ appearance satirinda raw_stats jsonb parse +
-- shots agregasyonu yapiyordu (~9sn soguk) -> PostgREST statement timeout
-- (57014). Mat + indeksle sorgular ms'e iner. Tazeleme: refresh_mats()
-- (load_sofascore_1lig_player_stats; fetch_sofascore_matches her kosuda cagirir).

drop view if exists analytics.player_shot_zones_season_v1;
drop view if exists analytics.player_shot_zones_match_v1;

create materialized view analytics.player_shot_zones_match_mat as
select
  d.source_match_id,
  m.competition,
  m.season_label,
  m.match_datetime,
  d.source_player_id as sofascore_player_id,
  om.opta_player_id,
  d.player_name,
  coalesce(a.shots_total, 0)  as shots_total,
  coalesce(a.shots_ibox, 0)   as shots_ibox,
  coalesce(a.shots_obox, 0)   as shots_obox,
  coalesce(a.sot_total, 0)    as sot_total,
  coalesce(a.sot_ibox, 0)     as sot_ibox,
  coalesce(a.sot_obox, 0)     as sot_obox,
  coalesce(a.goals_ibox, 0)   as goals_ibox,
  coalesce(a.goals_obox, 0)   as goals_obox
from football.match_player_stats_details d
join football.matches m
  on m.source = 'sofascore' and m.source_match_id = d.source_match_id
left join ref.sofascore_opta_player_map om
  on om.sofascore_player_id = d.source_player_id
left join (
  select
    source_match_id,
    source_player_id,
    count(*)                                              as shots_total,
    count(*) filter (where is_in_box)                     as shots_ibox,
    count(*) filter (where not is_in_box)                 as shots_obox,
    count(*) filter (where is_on_target)                  as sot_total,
    count(*) filter (where is_in_box and is_on_target)    as sot_ibox,
    count(*) filter (where not is_in_box and is_on_target) as sot_obox,
    count(*) filter (where is_in_box and shot_type = 'goal')     as goals_ibox,
    count(*) filter (where not is_in_box and shot_type = 'goal') as goals_obox
  from football.match_player_shots
  group by 1, 2
) a
  on a.source_match_id = d.source_match_id
 and a.source_player_id = d.source_player_id
where d.source = 'sofascore'
  and coalesce((d.raw_stats->>'minutesPlayed')::numeric, 0) > 0;

-- refresh ... concurrently icin benzersiz indeks sart.
create unique index idx_pszm_match_player
  on analytics.player_shot_zones_match_mat (source_match_id, sofascore_player_id);
create index idx_pszm_season_sofa
  on analytics.player_shot_zones_match_mat (season_label, sofascore_player_id);
create index idx_pszm_season_opta
  on analytics.player_shot_zones_match_mat (season_label, opta_player_id);

grant select on analytics.player_shot_zones_match_mat to anon, authenticated, service_role;

-- API adlari sabit kalir: view'lar mat'tan okur.
create view analytics.player_shot_zones_match_v1 as
select * from analytics.player_shot_zones_match_mat;

create view analytics.player_shot_zones_season_v1 as
select
  sofascore_player_id,
  max(opta_player_id) as opta_player_id,
  season_label,
  count(*)          as matches,
  avg(shots_total)  as shots_total,
  avg(shots_ibox)   as shots_ibox,
  avg(shots_obox)   as shots_obox,
  avg(sot_total)    as sot_total,
  avg(sot_ibox)     as sot_ibox,
  avg(sot_obox)     as sot_obox,
  avg(goals_ibox)   as goals_ibox,
  avg(goals_obox)   as goals_obox
from analytics.player_shot_zones_match_mat
group by sofascore_player_id, season_label;

grant select on analytics.player_shot_zones_match_v1,
                analytics.player_shot_zones_season_v1
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
