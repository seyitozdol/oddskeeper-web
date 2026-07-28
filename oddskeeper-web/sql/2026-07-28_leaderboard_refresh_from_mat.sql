-- Leaderboard tablolarini sezon SONU verisiyle tazeleme (2026-07-28).
--
-- SORUN 1 (bayatlik): analytics.player_metric_leaderboard_v1 ve
-- player_leaderboard_rows_v1 TABLOLARI en son 2026-04-28'de (33. hafta)
-- yazilmisti; sezonun son 5 haftasi eksikti (or. O. Kokcu 7 gol/7 asist
-- gorunuyordu, gercek 8/8). Yazici is bu repoda yok.
-- SORUN 2 (mukerrer kok nedeni COZULDU): player_detailed_metrics_v2_2_mat
-- zinciri oyuncu ADIYLA grupluyor; Opta ayni oyuncuyu bazi maclarda kisaltmali
-- ('M. Ibrahimoglu') bazilarinda tam adla yazinca sezon IKIYE BOLUNUYOR
-- (29 oyuncu). Eski leaderboard mukerrerlerinin kaynagi da bu.
-- COZUM: mat once oyuncu-id bazinda BIRLESTIRILIR (mat_merged temp view;
-- toplanabilir metrikler toplanir, ortalama/yuzde metrikler mac agirlikli
-- ortalanir), tablolar bu birlesik veriden tazelenir; mukerrer satirlar
-- silinir, rank/persentil yeniden hesaplanir.
--
-- Cikarilan semantik: ranking_value = per90_value; league_rank yalniz
-- is_qualified icinde; percentile = 1-(rank-1)/(nq-1); kalifikasyon:
-- minutes>=esik VE apps>=esik (OUTFIELD 620dk/7, GK 930dk/9).
--
-- UYGULANDI: 2026-07-28

set statement_timeout = 0;

create temp table mat_merged as
with base as (
  select *,
    metric_key not in ('avg_minutes','pass_accuracy_pct','shot_accuracy_pct',
                       'starter_rate_pct','xg_per90') as summable
  from analytics.player_detailed_metrics_v2_2_mat
)
select
  season_label, competition, metric_key, player_source_id, source_team_id,
  max(metric_label) as metric_label,
  max(category_key) as category_key,
  max(category_label) as category_label,
  (array_agg(player_name order by sample_matches desc))[1] as player_name,
  (array_agg(position_code order by sample_matches desc))[1] as position_code,
  (array_agg(role_group order by sample_matches desc))[1] as role_group,
  max(team_slug) as team_slug,
  max(team_name) as team_name,
  max(rank_direction) as rank_direction,
  bool_or(is_higher_better) as is_higher_better,
  max(value_format) as value_format,
  bool_or(coverage_flag) as coverage_flag,
  sum(sample_matches) as sample_matches,
  case when bool_and(summable) then sum(total_value)
       else sum(total_value * sample_matches) / nullif(sum(sample_matches), 0) end as total_value,
  case when bool_and(summable) then sum(total_value) / nullif(sum(sample_matches), 0)
       else sum(per_match_value * sample_matches) / nullif(sum(sample_matches), 0) end as per_match_value,
  sum(per90_value * sample_matches) / nullif(sum(sample_matches), 0) as per90_value,
  case when bool_and(summable) then sum(home_value)
       else sum(home_value * sample_matches) / nullif(sum(sample_matches), 0) end as home_value,
  case when bool_and(summable) then sum(away_value)
       else sum(away_value * sample_matches) / nullif(sum(sample_matches), 0) end as away_value,
  (array_agg(last5_value order by sample_matches desc))[1] as last5_value
from base
group by season_label, competition, metric_key, player_source_id, source_team_id;

create index on mat_merged (season_label, competition, metric_key, player_source_id);

begin;

-- 1) Mukerrer satir temizligi (eski cift gecisler + isim-varyanti kaynaklilar)
delete from analytics.player_metric_leaderboard_v1 a
using analytics.player_metric_leaderboard_v1 b
where a.ctid < b.ctid
  and a.season_label = b.season_label
  and a.competition = b.competition
  and a.ranking_pool = b.ranking_pool
  and a.metric_key = b.metric_key
  and a.player_source_id = b.player_source_id
  and a.source_team_id is not distinct from b.source_team_id;

-- 2) Hafta 33 sonrasi debut edenler icin eksik satirlar
insert into analytics.player_metric_leaderboard_v1 (
  season_label, competition, player_source_id, player_name, position_code,
  role_group, source_team_id, team_slug, team_name, metric_key, metric_label,
  category_key, category_label, total_value, per_match_value, per90_value,
  home_value, away_value, last5_value, rank_direction, is_higher_better,
  value_format, sample_matches, coverage_flag, player_pool, ranking_pool,
  ranking_value, is_qualified, qualification_minutes_threshold,
  qualification_apps_threshold, qualification_reason,
  refreshed_at, refresh_batch_label)
select
  m.season_label, m.competition, m.player_source_id, m.player_name,
  m.position_code, m.role_group, m.source_team_id, m.team_slug, m.team_name,
  m.metric_key, m.metric_label, m.category_key, m.category_label,
  m.total_value, m.per_match_value, m.per90_value, m.home_value, m.away_value,
  m.last5_value, m.rank_direction, m.is_higher_better, m.value_format,
  m.sample_matches, m.coverage_flag,
  pool.player_pool, pool.ranking_pool, m.per90_value,
  false,
  case when pool.player_pool = 'GOALKEEPER' then 930 else 620 end,
  case when pool.player_pool = 'GOALKEEPER' then 9 else 7 end,
  'low_minutes_low_appearances',
  now(), '2026-07-28_final_fullseason'
from mat_merged m
cross join lateral (
  select case when m.position_code = 'GK' then 'GOALKEEPER' else 'OUTFIELD' end as player_pool,
         unnest(case when m.position_code = 'GK'
                     then array['GOALKEEPERS', 'ALL_PLAYERS']
                     else array['OUTFIELD_PLAYERS', 'ALL_PLAYERS'] end) as ranking_pool
) pool
where m.metric_key in (select distinct metric_key from analytics.player_metric_leaderboard_v1)
  and not exists (
    select 1 from analytics.player_metric_leaderboard_v1 v
    where v.season_label = m.season_label and v.competition = m.competition
      and v.metric_key = m.metric_key and v.player_source_id = m.player_source_id
      and v.source_team_id is not distinct from m.source_team_id
      and v.ranking_pool = pool.ranking_pool);

-- 3) Deger kolonlarini birlesik mat'tan guncelle
update analytics.player_metric_leaderboard_v1 v
set total_value = m.total_value,
    per_match_value = m.per_match_value,
    per90_value = m.per90_value,
    home_value = m.home_value,
    away_value = m.away_value,
    last5_value = m.last5_value,
    sample_matches = m.sample_matches,
    ranking_value = m.per90_value,
    player_name = m.player_name,
    home_away_gap_abs = abs(coalesce(m.home_value, 0) - coalesce(m.away_value, 0)),
    refreshed_at = now(),
    refresh_batch_label = '2026-07-28_final_fullseason'
from mat_merged m
where m.season_label = v.season_label and m.competition = v.competition
  and m.metric_key = v.metric_key and m.player_source_id = v.player_source_id
  and m.source_team_id is not distinct from v.source_team_id;

-- 4) Kalifikasyon (sezon sonu dakika/mac)
update analytics.player_metric_leaderboard_v1 v
set is_qualified = (p.total_minutes >= v.qualification_minutes_threshold
                    and p.appearances >= v.qualification_apps_threshold),
    qualification_reason = case
      when p.total_minutes >= v.qualification_minutes_threshold
           and p.appearances >= v.qualification_apps_threshold
      then 'qualified' else v.qualification_reason end
from analytics.player_profile_v1 p
where p.player_source_id = v.player_source_id
  and p.team_source_id is not distinct from v.source_team_id
  and p.season_label = v.season_label and p.competition = v.competition;

-- 5) Rank / ortalama / medyan / persentil yeniden hesabi
with stats as (
  select season_label, competition, metric_key, ranking_pool,
         avg(per90_value) filter (where is_qualified) as avg_v,
         percentile_cont(0.5) within group (order by per90_value)
           filter (where is_qualified) as med_v,
         count(*) filter (where is_qualified and ranking_value is not null) as nq
  from analytics.player_metric_leaderboard_v1
  group by 1, 2, 3, 4
),
ranked as (
  select ctid as rid,
         case when is_qualified then
           rank() over (
             partition by season_label, competition, metric_key, ranking_pool
             order by case when is_qualified then
               (case when rank_direction = 'desc' then -ranking_value else ranking_value end)
             end asc nulls last)
         end as rnk
  from analytics.player_metric_leaderboard_v1
)
update analytics.player_metric_leaderboard_v1 v
set league_rank = r.rnk,
    league_avg = s.avg_v,
    league_median = s.med_v,
    league_percentile = case when r.rnk is not null and s.nq > 1
                             then 1 - (r.rnk - 1)::numeric / (s.nq - 1) end,
    vs_league_avg_abs = case when s.avg_v is not null then v.per90_value - s.avg_v end,
    vs_league_avg_pct = case when s.avg_v > 0
                             then (v.per90_value - s.avg_v) / s.avg_v * 100 end
from ranked r, stats s
where r.rid = v.ctid
  and s.season_label = v.season_label and s.competition = v.competition
  and s.metric_key = v.metric_key and s.ranking_pool = v.ranking_pool;

-- 6) player_leaderboard_rows_v1: mukerrer temizlik + deger guncelleme + eksikler + rank
delete from analytics.player_leaderboard_rows_v1 a
using analytics.player_leaderboard_rows_v1 b
where a.ctid < b.ctid
  and a.season_label = b.season_label and a.competition = b.competition
  and a.metric_key = b.metric_key and a.player_source_id = b.player_source_id
  and a.source_team_id is not distinct from b.source_team_id;

update analytics.player_leaderboard_rows_v1 v
set total_value = m.total_value,
    per_match_value = m.per_match_value,
    per90_value = m.per90_value,
    sample_matches = m.sample_matches,
    player_name = m.player_name,
    updated_at = now()
from mat_merged m
where m.season_label = v.season_label and m.competition = v.competition
  and m.metric_key = v.metric_key and m.player_source_id = v.player_source_id
  and m.source_team_id is not distinct from v.source_team_id;

insert into analytics.player_leaderboard_rows_v1 (
  competition, season_label, category_key, category_label, metric_key,
  metric_label, player_source_id, player_name, player_slug, position_code,
  role_group, source_team_id, team_slug, team_name, sample_matches,
  total_value, per_match_value, per90_value, value_format, is_higher_better,
  updated_at)
select
  m.competition, m.season_label, m.category_key, m.category_label, m.metric_key,
  m.metric_label, m.player_source_id, m.player_name,
  coalesce(pm.opta_player_slug,
           trim(both '-' from regexp_replace(lower(m.player_name), '[^a-z0-9]+', '-', 'g'))
             || '--' || m.player_source_id),
  m.position_code, m.role_group, m.source_team_id,
  m.team_slug, m.team_name, m.sample_matches,
  m.total_value, m.per_match_value, m.per90_value, m.value_format,
  m.is_higher_better, now()
from mat_merged m
left join ref.player_mapping pm on pm.opta_player_id = m.player_source_id
where m.metric_key in (select distinct metric_key from analytics.player_leaderboard_rows_v1)
  and not exists (
    select 1 from analytics.player_leaderboard_rows_v1 v
    where v.season_label = m.season_label and v.competition = m.competition
      and v.metric_key = m.metric_key and v.player_source_id = m.player_source_id
      and v.source_team_id is not distinct from m.source_team_id);

with stats as (
  select season_label, competition, metric_key,
         avg(per90_value) as avg_v
  from analytics.player_leaderboard_rows_v1
  group by 1, 2, 3
),
ranked as (
  select ctid as rid,
         rank() over (
           partition by season_label, competition, metric_key
           order by case when is_higher_better then -per90_value else per90_value end asc nulls last
         ) as rnk
  from analytics.player_leaderboard_rows_v1
)
update analytics.player_leaderboard_rows_v1 v
set league_rank = r.rnk,
    league_avg = s.avg_v,
    vs_league_avg_pct = case when s.avg_v > 0 then (v.per90_value - s.avg_v) / s.avg_v * 100 end
from ranked r, stats s
where r.rid = v.ctid
  and s.season_label = v.season_label and s.competition = v.competition
  and s.metric_key = v.metric_key;

commit;
