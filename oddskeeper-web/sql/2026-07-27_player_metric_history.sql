-- 2026-07-27: Gecmis sezon (2023/24, 2024/25) apifootball mac-oyuncu verisini
-- (football.match_player_stats_details, source='apifootball') analytics metrik
-- uzayina yansitir; boylece oyuncu profil drawer'i gecmis sezonlari da gosterir.
-- Oyuncu kimligi apifootball_player_id -> opta_player_id (ref.player_mapping)
-- ile analytics player_source_id (opta) uzayina cevrilir; transferli oyuncu
-- opta id bazinda toplanir (WhoScored gibi oyuncu-global). apifootball'da
-- OLMAYAN metrikler (bloklanan sut, xG, ceza sahasi ici/disi sut) haric.

-- Dedup: apifootball_player_id basina tek opta_player_id.
create or replace view analytics._af_player_map_v1 as
select distinct on (apifootball_player_id)
  apifootball_player_id, opta_player_id
from ref.player_mapping
where apifootball_player_id is not null and opta_player_id is not null
order by apifootball_player_id, created_at;

-- Mac-oyuncu bazinda cikarilan metrikler (opta id'ye eslenmis).
create or replace view analytics._af_match_player_v1 as
select
  pm.opta_player_id as player_source_id,
  m.season_label,
  d.source_match_id,
  coalesce((d.raw_stats->'games'->>'minutes')::int, 0) as minutes,
  coalesce((d.raw_stats->'goals'->>'total')::numeric, 0)    as goals,
  coalesce((d.raw_stats->'goals'->>'assists')::numeric, 0)  as assists,
  coalesce((d.raw_stats->'goals'->>'saves')::numeric, 0)    as saves,
  coalesce((d.raw_stats->'shots'->>'total')::numeric, 0)    as shots_total,
  coalesce((d.raw_stats->'shots'->>'on')::numeric, 0)       as shots_on,
  coalesce((d.raw_stats->'passes'->>'total')::numeric, 0)   as passes,
  coalesce(d.accurate_pass, 0)                              as accurate_pass,
  coalesce((d.raw_stats->'fouls'->>'committed')::numeric, 0) as fouls_committed,
  coalesce((d.raw_stats->'fouls'->>'drawn')::numeric, 0)     as fouls_drawn,
  coalesce((d.raw_stats->'cards'->>'yellow')::numeric, 0)    as yellow,
  coalesce((d.raw_stats->'cards'->>'red')::numeric, 0)       as red,
  coalesce((d.raw_stats->'tackles'->>'total')::numeric, 0)   as tackles,
  coalesce((d.raw_stats->>'offsides')::numeric, 0)           as offsides
from football.match_player_stats_details d
join football.matches m
  on m.source = d.source and m.source_match_id = d.source_match_id
join analytics._af_player_map_v1 pm
  on pm.apifootball_player_id = d.source_player_id
where d.source = 'apifootball'
  and m.season_label in ('2023/2024', '2024/2025');

-- Sezon-oyuncu toplami (mac = dakika>0 oynadigi maclar).
create or replace view analytics._af_player_season_agg_v1 as
select
  player_source_id,
  season_label,
  count(distinct source_match_id) filter (where minutes > 0) as matches,
  sum(goals) as goals, sum(assists) as assists, sum(saves) as saves,
  sum(shots_total) as shots_total, sum(shots_on) as shots_on,
  sum(passes) as passes, sum(accurate_pass) as accurate_pass,
  sum(fouls_committed) as fouls_committed, sum(fouls_drawn) as fouls_drawn,
  sum(yellow) as yellow, sum(red) as red,
  sum(tackles) as tackles, sum(offsides) as offsides
from analytics._af_match_player_v1
group by player_source_id, season_label;

-- Uzun format: metrik basina bir satir (leaderboard ile ayni metric_key uzayi).
create or replace view analytics.player_metric_history_v1 as
select
  a.player_source_id,
  a.season_label,
  x.metric_key,
  x.total_value,
  a.matches as sample_matches,
  case when a.matches > 0 then x.total_value / a.matches end as per_match_value
from analytics._af_player_season_agg_v1 a
cross join lateral (values
  ('goals_total',            a.goals),
  ('assists_total',          a.assists),
  ('saves_total_total',      a.saves),
  ('shots_total',            a.shots_total),
  ('shots_on_target_total',  a.shots_on),
  ('passes_total',           a.passes),
  ('accurate_pass_total',    a.accurate_pass),
  ('fouls_conceded_total',   a.fouls_committed),
  ('fouls_won_total',        a.fouls_drawn),
  ('cards_yellow_total',     a.yellow),
  ('cards_red_total',        a.red),
  ('tackles_total',          a.tackles),
  ('offsides_total',         a.offsides)
) as x(metric_key, total_value)
where a.matches > 0;

-- shots_off_target log metrigi (drawer 'log:shots_off_target' ile okur).
create or replace view analytics.player_log_history_v1 as
select
  player_source_id,
  season_label,
  matches,
  case when matches > 0 then (shots_total - shots_on) / matches end as shots_off_target
from analytics._af_player_season_agg_v1
where matches > 0;

-- ── Birlesik view'lar (guncel 2025/26 + gecmis): drawer bunlari okur ──
-- league_rank/last5 gecmis sezonda yok (drawer sadece guncel sezon icin gosterir).

create or replace view analytics.player_metric_by_season_v1 as
select season_label, player_source_id, metric_key,
  per_match_value, last5_value, total_value, league_rank, sample_matches
from analytics.player_metric_leaderboard_current
union all
select season_label, player_source_id, metric_key,
  per_match_value, null::numeric, total_value, null::integer, sample_matches
from analytics.player_metric_history_v1;

create or replace view analytics.player_log_by_season_v1 as
select player_source_id, season_label, matches, shots_off_target, shots_blocked
from analytics.player_log_season_avg_v1
union all
select player_source_id, season_label, matches, shots_off_target, null::numeric
from analytics.player_log_history_v1;

grant select on analytics.player_metric_history_v1, analytics.player_log_history_v1,
  analytics.player_metric_by_season_v1, analytics.player_log_by_season_v1
  to anon, authenticated;
