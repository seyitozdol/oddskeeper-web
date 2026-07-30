-- 2026-07-30: Option A / Asama 4a — TSL SofaScore oyuncu metrik BENCHMARK view'i.
-- player_metric_benchmarks_v1'in SofaScore esdegeri. Kaynak: benim global mat'im
-- (tsl_ss_player_detailed_metrics_global_mat; league_rank/percentile/avg zaten var) +
-- katalog(benchmark_allowed). Eklenen: TAKIM-ICI rank/percentile. Frontend
-- getPlayerMetricBenchmarks bunu (mat uzerinden) okuyacak.
-- metric_value = coalesce(per90, per_match, total) (value_basis'e denk).
-- PERCENTILE KONVANSIYONU: Opta benchmark view'i "yuksek=iyi" (best~1.0) veriyor
-- (global view best=0'dan FARKLI). Buna uyulur: 1 - best-first percent_rank.

create or replace view analytics.tsl_ss_player_metric_benchmarks_v1 as
with base as (
  select
    m.season_label, m.competition, m.source_team_id, m.team_slug, m.team_name,
    m.player_source_id, m.player_name, m.position_code, m.role_group,
    m.metric_key, m.metric_label, m.category_key, m.display_priority,
    m.rank_direction, m.league_rank, m.league_avg, m.league_median,
    m.vs_league_avg_abs, m.vs_league_avg_pct,
    c.value_basis,
    coalesce(m.per90_value, m.per_match_value, m.total_value) as metric_value
  from analytics.tsl_ss_player_detailed_metrics_global_mat m
  join analytics.tsl_ss_metric_catalog_v1 c using (metric_key)
  where c.benchmark_allowed
)
select
  season_label, competition, source_team_id, team_slug, team_name,
  player_source_id, player_name, position_code, role_group,
  metric_key, metric_label as display_label, category_key as category, display_priority,
  value_basis, rank_direction,
  round(metric_value, 4) as metric_value,
  rank() over (
    partition by season_label, competition, source_team_id, metric_key
    order by case when rank_direction = 'asc' then metric_value end asc nulls last,
             case when rank_direction <> 'asc' then metric_value end desc nulls last
  ) as team_rank,
  league_rank,
  round((1 - percent_rank() over (
    partition by season_label, competition, source_team_id, metric_key
    order by case when rank_direction = 'asc' then metric_value end asc nulls last,
             case when rank_direction <> 'asc' then metric_value end desc nulls last
  ))::numeric, 4) as team_percentile,
  round((1 - percent_rank() over (
    partition by season_label, competition, metric_key
    order by case when rank_direction = 'asc' then metric_value end asc nulls last,
             case when rank_direction <> 'asc' then metric_value end desc nulls last
  ))::numeric, 4) as league_percentile,
  round(league_avg, 4) as league_avg,
  round(league_median::numeric, 4) as league_median,
  round(vs_league_avg_abs, 4) as vs_league_avg_abs,
  round(vs_league_avg_pct, 4) as vs_league_avg_pct,
  case
    when rank_direction = 'desc' then metric_value >= league_avg
    when rank_direction = 'asc' then metric_value <= league_avg
  end as above_league_avg_flag
from base;

grant select on analytics.tsl_ss_player_metric_benchmarks_v1 to anon, authenticated, service_role;

-- Frontend mat okur (window'lar tum partition'i tarar). Loader REFRESH edecek (asama 7).
drop materialized view if exists analytics.tsl_ss_player_metric_benchmarks_mat;
create materialized view analytics.tsl_ss_player_metric_benchmarks_mat as
  select * from analytics.tsl_ss_player_metric_benchmarks_v1;
create unique index uq_tsl_ss_benchmarks_mat
  on analytics.tsl_ss_player_metric_benchmarks_mat (season_label, competition, player_source_id, metric_key);
grant select on analytics.tsl_ss_player_metric_benchmarks_mat to anon, authenticated, service_role;
