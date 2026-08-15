-- PSM (Player Market) 2026/27 sezon-Avg koprusu.
--
-- Sorun: PSM Avg kolonu guncel sezonu (takvim: 2026/2027) sorgular ama kaynaklari
-- (player_metric_leaderboard_current / player_log_season_avg_v1 / player_profile_v1)
-- OPTA tabanli; 26/27'de Opta verisi yok (Opta job'i 2026-07-19'da durdu). 26/27
-- verisi SofaScore/FlashScore zincirinde (tsl_ss_*). Bu kopru o veriyi PSM'in
-- oyuncu-id uzayina (opta ya da af-<apifootball_id>) ve PSM metric_key'lerine cevirir.
--
-- Kimlik zinciri:
--   - opta oyuncusu: PSM player_key = opta id = tsl_ss player_source_id (dogrudan).
--   - yeni transfer: PSM player_key = 'af-'||apifootball_id
--       -> ref.apifootball_sofascore_player_map (af -> sofascore_id)
--       -> ref.sofascore_opta_player_map (sofascore_id -> opta ya da sentetik ss-)
--       = tsl_ss player_source_id.
--
-- Bagimliliklar: ref.apifootball_sofascore_player_map (build_apifootball_sofascore_player_map.py),
-- ref.sofascore_opta_player_map, analytics.tsl_ss_player_detailed_metrics_global_mat,
-- analytics.player_shot_zones_season_v1. Hepsi refresh_tsl_mats zincirinde tazelenir.

-- ── Kimlik koprusu: PSM player_key -> tsl_ss player_source_id ──────────────────
create or replace view analytics.psm_id_bridge_v1 as
  -- opta (ve her tsl_ss id) kendi kimligiyle
  select distinct player_source_id as player_key, player_source_id as tslss_id
  from analytics.tsl_ss_player_detailed_metrics_global_mat
  where season_label = '2026/2027'
  union
  -- yeni transfer: af-<id> -> sofascore -> opta/ss
  select distinct 'af-' || m.apifootball_player_id as player_key, so.opta_player_id as tslss_id
  from ref.apifootball_sofascore_player_map m
  join ref.sofascore_opta_player_map so on so.sofascore_player_id = m.sofascore_player_id;

-- ── Sut sonuclari (off_target / blocked) shotmap'ten, appearance-tabanli ──────
-- off_target = miss + post (isabetsiz, blokaj DEGIL); blocked = block. Ham sayim
-- (yaklasik degil). Payda player_shot_zones_season_v1.matches (oynanan mac). Boylece
-- shots_off_target/shots_blocked marketleri 26/27'de manuel kalmaz.
create or replace view analytics.player_shot_outcomes_season_v1 as
with cnt as (
  select s.source_player_id, m.season_label,
         count(*) filter (where s.shot_type in ('miss','post')) as off_target_total,
         count(*) filter (where s.shot_type = 'block')          as blocked_total
  from football.match_player_shots s
  join football.matches m on m.source = s.source and m.source_match_id = s.source_match_id
  group by 1, 2
)
select z.opta_player_id, z.season_label, z.matches,
       coalesce(c.off_target_total, 0)::numeric / nullif(z.matches, 0) as shots_off_target,
       coalesce(c.blocked_total,    0)::numeric / nullif(z.matches, 0) as shots_blocked
from analytics.player_shot_zones_season_v1 z
left join cnt c on c.source_player_id = z.sofascore_player_id and c.season_label = z.season_label;

-- ── Sezon-Avg koprusu (per_match_value, PSM metricKey'iyle) ───────────────────
create or replace view analytics.psm_player_season_avg_bridge_v1 as
with im as (select player_key, tslss_id from analytics.psm_id_bridge_v1),
-- tsl_ss duz metrikler: PSM metricKey == tsl_ss metric_key (per_match hazir)
plain as (
  select im.player_key, g.metric_key, g.per_match_value
  from analytics.tsl_ss_player_detailed_metrics_global_mat g
  join im on im.tslss_id = g.player_source_id
  where g.season_label = '2026/2027'
    and g.metric_key in (
      'goals_total','assists_total','expected_goals_total','passes_total',
      'accurate_pass_total','tackles_total','fouls_conceded_total','fouls_won_total',
      'cards_yellow_total','cards_red_total','offsides_total','saves_total_total',
      'shots_total','shots_on_target_total'
    )
),
-- shotmap bolgeleri (per-match): attempts (duz key) + SOT (shots: onek)
zones as (
  select im.player_key, k.metric_key, k.val as per_match_value
  from analytics.player_shot_zones_season_v1 z
  join im on im.tslss_id = z.opta_player_id
  cross join lateral (values
    ('attempts_ibox_total', z.shots_ibox),
    ('attempts_obox_total', z.shots_obox),
    ('shots:sot_ibox',      z.sot_ibox),
    ('shots:sot_obox',      z.sot_obox)
  ) k(metric_key, val)
  where z.season_label = '2026/2027'
),
-- sut sonuclari (PSM 'log:' onekiyle): off_target + blocked, shotmap'ten ham sayim
outcomes as (
  select im.player_key, k.metric_key, k.val as per_match_value
  from analytics.player_shot_outcomes_season_v1 o
  join im on im.tslss_id = o.opta_player_id
  cross join lateral (values
    ('log:shots_off_target', o.shots_off_target),
    ('log:shots_blocked',    o.shots_blocked)
  ) k(metric_key, val)
  where o.season_label = '2026/2027'
)
select player_key as player_source_id, '2026/2027'::text as season_label,
       metric_key, per_match_value::numeric as per_match_value
from plain where per_match_value is not null
union all select player_key, '2026/2027', metric_key, per_match_value from zones where per_match_value is not null
union all select player_key, '2026/2027', metric_key, per_match_value from outcomes where per_match_value is not null;

-- ── Sezon mac; PSM 'Mac sayisi' kolonu ───────────────────────────────────────
create or replace view analytics.psm_player_appearances_bridge_v1 as
select im.player_key as player_source_id, '2026/2027'::text as season_label,
       g.total_value::int as appearances
from analytics.tsl_ss_player_detailed_metrics_global_mat g
join analytics.psm_id_bridge_v1 im on im.tslss_id = g.player_source_id
where g.season_label = '2026/2027' and g.metric_key = 'appearances' and g.total_value is not null;

grant select on analytics.player_shot_outcomes_season_v1 to anon, authenticated;
grant select on analytics.psm_id_bridge_v1 to anon, authenticated;
grant select on analytics.psm_player_season_avg_bridge_v1 to anon, authenticated;
grant select on analytics.psm_player_appearances_bridge_v1 to anon, authenticated;
