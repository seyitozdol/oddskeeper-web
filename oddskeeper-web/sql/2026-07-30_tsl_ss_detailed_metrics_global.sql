-- 2026-07-30: Option A / Asama 3 — TSL SofaScore detay metrik GLOBAL + SIRALAMA view'i.
-- analytics.player_detailed_metrics_global_v1 mantigi; kaynak SofaScore mat'i
-- (tsl_ss_player_detailed_metrics_v1). Oyuncu-global tek satira toplar (2 takimli
-- oyuncu birlesir), lig ort/medyan + rank/percentile. Frontend getPlayerDetailedMetrics
-- bunu (mat uzerinden) okuyacak. ranking_value = coalesce(per90, per_match, total);
-- yon rank_direction ('asc'=dusuk iyi). Sayim metrikleri per90 ile siralanir (Opta ile ayni).
--
-- 2-TAKIMLI OYUNCU TOPLAMASI (team_agg): sayim metrikleri TOPLANIR (gol/asist/mac);
-- oran/rating (pct, avg, avg_minutes, xg_per90) mac-agirlikli ORTALAMA; top_speed MAX.
-- (Opta global view hepsini topluyordu; rating gibi oran metrikleri icin yanlisti.)

create or replace view analytics.tsl_ss_player_detailed_metrics_global_v1 as
with src as (
  select s.*,
    case
      when c.agg_kind = 'max' then 'max'
      when c.value_format = 'pct' or c.agg_kind = 'avg'
           or s.metric_key in ('avg_minutes','xg_per90') then 'wavg'
      else 'sum'
    end as team_agg
  from analytics.tsl_ss_player_detailed_metrics_v1 s
  join analytics.tsl_ss_metric_catalog_v1 c using (metric_key)
),
agg0 as (
  select
    season_label, competition, player_source_id, metric_key,
    max(team_agg) as team_agg,
    (array_agg(player_name    order by sample_matches desc nulls last))[1] as player_name,
    (array_agg(position_code  order by sample_matches desc nulls last))[1] as position_code,
    (array_agg(role_group     order by sample_matches desc nulls last))[1] as role_group,
    (array_agg(source_team_id order by sample_matches desc nulls last))[1] as source_team_id,
    (array_agg(team_slug      order by sample_matches desc nulls last))[1] as team_slug,
    (array_agg(team_name      order by sample_matches desc nulls last))[1] as team_name,
    max(metric_label) as metric_label,
    max(category_key) as category_key,
    max(category_label) as category_label,
    max(display_priority) as display_priority,
    sum(total_value) as sum_total,
    max(total_value) as max_total,
    sum(total_value * sample_matches) filter (where total_value is not null) as wsum_total,
    sum(sample_matches) filter (where total_value is not null) as samp_tv,
    sum(sample_matches) as sample_matches,
    bool_and(per_match_value = total_value) as all_pm_eq_total,
    sum(per_match_value * sample_matches) filter (where per_match_value is not null) as wsum_pm,
    sum(sample_matches) filter (where per_match_value is not null) as samp_pm,
    sum(per90_value * sample_matches) filter (where per90_value is not null) as wsum_p90,
    sum(sample_matches) filter (where per90_value is not null) as samp_p90,
    sum(home_value) as home_value,
    sum(away_value) as away_value,
    (array_agg(last5_value order by sample_matches desc nulls last))[1] as last5_value,
    bool_or(is_higher_better) as is_higher_better,
    (array_agg(rank_direction order by sample_matches desc nulls last))[1] as rank_direction,
    max(value_format) as value_format,
    bool_or(coverage_flag) as coverage_flag
  from src
  group by season_label, competition, player_source_id, metric_key
),
agg as (
  select
    season_label, competition, player_source_id, metric_key,
    player_name, position_code, role_group, source_team_id, team_slug, team_name,
    metric_label, category_key, category_label, display_priority,
    sample_matches, home_value, away_value, last5_value,
    is_higher_better, rank_direction, value_format, coverage_flag,
    case team_agg
      when 'sum' then sum_total
      when 'max' then max_total
      else wsum_total / nullif(samp_tv, 0)
    end as total_value,
    case
      when team_agg = 'sum' then
        case when all_pm_eq_total then sum_total else wsum_pm / nullif(samp_pm, 0) end
      when team_agg = 'max' then max_total
      else wsum_total / nullif(samp_tv, 0)
    end as per_match_value,
    case when team_agg = 'sum' then wsum_p90 / nullif(samp_p90, 0) end as per90_value
  from agg0
),
ranked as (
  select *, coalesce(per90_value, per_match_value, total_value) as ranking_value
  from agg
),
stats as (
  select season_label, competition, metric_key,
    avg(ranking_value) as league_avg,
    percentile_cont(0.5) within group (order by ranking_value::double precision) as league_median
  from ranked
  group by season_label, competition, metric_key
)
select
  r.season_label, r.competition, r.player_source_id, r.player_name, r.position_code, r.role_group,
  r.source_team_id, r.team_slug, r.team_name, r.metric_key, r.metric_label, r.category_key,
  r.category_label, r.display_priority, r.total_value, r.per_match_value, r.per90_value,
  r.home_value, r.away_value, r.last5_value, st.league_avg, st.league_median,
  rank() over (
    partition by r.season_label, r.competition, r.metric_key
    order by case when r.rank_direction = 'asc' then r.ranking_value end asc nulls last,
             case when r.rank_direction <> 'asc' then r.ranking_value end desc nulls last
  )::integer as league_rank,
  percent_rank() over (
    partition by r.season_label, r.competition, r.metric_key
    order by case when r.rank_direction = 'asc' then r.ranking_value end asc nulls last,
             case when r.rank_direction <> 'asc' then r.ranking_value end desc nulls last
  )::numeric as league_percentile,
  (r.ranking_value - st.league_avg) as vs_league_avg_abs,
  case
    when st.league_avg is null or abs(st.league_avg) < 0.5 or st.league_avg = 0 then null
    else (r.ranking_value - st.league_avg) / st.league_avg
  end as vs_league_avg_pct,
  r.rank_direction, r.is_higher_better, r.value_format,
  abs(coalesce(r.home_value, 0) - coalesce(r.away_value, 0)) as home_away_gap_abs,
  r.sample_matches, r.coverage_flag
from ranked r
join stats st using (season_label, competition, metric_key);

grant select on analytics.tsl_ss_player_detailed_metrics_global_v1 to anon, authenticated, service_role;

drop materialized view if exists analytics.tsl_ss_player_detailed_metrics_global_mat;
create materialized view analytics.tsl_ss_player_detailed_metrics_global_mat as
  select * from analytics.tsl_ss_player_detailed_metrics_global_v1;
create unique index uq_tsl_ss_pdm_global_mat
  on analytics.tsl_ss_player_detailed_metrics_global_mat (season_label, competition, player_source_id, metric_key);
grant select on analytics.tsl_ss_player_detailed_metrics_global_mat to anon, authenticated, service_role;
