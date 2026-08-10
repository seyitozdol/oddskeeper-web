-- 2026-08-10: SofaScore shotmap katmani - oyuncu bazinda kutu ici/disi sut kirilimlari.
--
-- Kaynak: api.sofascore.com/api/v1/event/{id}/shotmap (sut basina oyuncu,
-- shotType goal/save/miss/post/block, koordinat, xg/xgot). Uc kaynakla capraz
-- dogrulandi (FlashScore SHOTS_BOX_IN/OUT + WhoScored Opta olaylari, 9/9 birebir).
-- Siniflandirma: kutu ici = x*1.05m <= 16.5 VE 20.35 <= y <= 79.65;
-- isabetli = shotType in (goal, save) (blok ve direk ISABETLI DEGIL).
--
-- Katmanlar:
--   football.match_player_shots            ham sut satirlari (yeniden turetilebilir)
--   analytics.player_shot_zones_match_v1   oyuncu-mac agregati, APPEARANCE tabanli
--                                          (sut atmayan maclar 0 satiri olarak var;
--                                          Last5/ortalama dogru hesaplanir)
--   analytics.player_shot_zones_season_v1  oyuncu-sezon mac-basi ortalamalar
-- Opta koprusu: ref.sofascore_opta_player_map (TSL PSM opta id uzayi icin).

create table if not exists football.match_player_shots (
  id bigint generated always as identity primary key,
  source text not null default 'sofascore',
  source_match_id text not null,
  shot_id bigint not null,
  source_player_id text not null,
  player_name text,
  is_home boolean,
  time_min int,
  shot_type text not null,
  situation text,
  body_part text,
  x numeric,
  y numeric,
  xg numeric,
  xgot numeric,
  is_in_box boolean not null,
  is_on_target boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_match_id, shot_id)
);

create index if not exists idx_mps_match_player
  on football.match_player_shots (source_match_id, source_player_id);

grant select, insert, update, delete on football.match_player_shots to service_role;

-- Oyuncu-mac agregati: taban = SofaScore oyuncu-mac satirlari (oynayanlar),
-- sutlar LEFT JOIN -> sut atmayan maclarda 0. TSL + 1.Lig (source='sofascore'
-- maci olan her lig).
create or replace view analytics.player_shot_zones_match_v1 as
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

grant select on analytics.player_shot_zones_match_v1 to anon, authenticated, service_role;

-- Oyuncu-sezon: mac-basi ortalamalar (appearance tabanli oldugu icin dogru payda).
create or replace view analytics.player_shot_zones_season_v1 as
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
from analytics.player_shot_zones_match_v1
group by sofascore_player_id, season_label;

grant select on analytics.player_shot_zones_season_v1 to anon, authenticated, service_role;

notify pgrst, 'reload schema';
