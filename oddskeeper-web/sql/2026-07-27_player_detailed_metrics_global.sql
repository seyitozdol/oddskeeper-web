-- 2026-07-27: Oyuncu detay istatistiklerinde MUKERRER metrik duzeltmesi.
-- player_detailed_metrics_v2_2_mat gren'i (sezon, competition, player, TAKIM,
-- metrik) oldugundan sezon icinde 2 takimda oynayan oyuncu her metrikte iki
-- satir uretir; oyuncu sayfasi metrikleri iki kez gosterir. Bu view, mevcut
-- mat'i (pipeline'in refresh ettigi zinciri BOZMADAN) oyuncu-global tek satira
-- toplar ve siralamayi bu global havuzda yeniden hesaplar (WhoScored gibi:
-- her oyuncunun global tek satiri). Frontend getPlayerDetailedMetrics bunu okur.
--
-- Toplama: total/home/away/mac toplanir, mac_basi = sum(total)/sum(mac),
-- per90 = maca gore agirlikli ortalama, last5 en cok macli stint'ten alinir.
-- ranking_value = COALESCE(per90, per_match, total) (kaynak zincirle ayni),
-- yon rank_direction'a gore (asc = dusuk iyi).

create or replace view analytics.player_detailed_metrics_global_v1 as
with agg as (
  select
    season_label,
    competition,
    player_source_id,
    metric_key,
    (array_agg(player_name order by sample_matches desc nulls last))[1] as player_name,
    (array_agg(position_code order by sample_matches desc nulls last))[1] as position_code,
    (array_agg(role_group order by sample_matches desc nulls last))[1] as role_group,
    (array_agg(source_team_id order by sample_matches desc nulls last))[1] as source_team_id,
    (array_agg(team_slug order by sample_matches desc nulls last))[1] as team_slug,
    (array_agg(team_name order by sample_matches desc nulls last))[1] as team_name,
    max(metric_label) as metric_label,
    max(category_key) as category_key,
    max(category_label) as category_label,
    max(display_priority) as display_priority,
    sum(total_value) as total_value,
    sum(sample_matches) as sample_matches,
    -- per_match: sayim metriklerinde maca-agirlikli ort = sum(total)/sum(mac);
    -- oran metriklerinde de agirlikli ort dogru. "appearances/starts" gibi
    -- kaynakta per_match = total olan (maç sayısı) metriklerde ise global total.
    case
      when bool_and(per_match_value = total_value) then sum(total_value)
      else sum(per_match_value * sample_matches) filter (where per_match_value is not null)
           / nullif(sum(sample_matches) filter (where per_match_value is not null), 0)
    end as per_match_value,
    sum(per90_value * sample_matches) filter (where per90_value is not null)
      / nullif(sum(sample_matches) filter (where per90_value is not null), 0)
      as per90_value,
    sum(home_value) as home_value,
    sum(away_value) as away_value,
    (array_agg(last5_value order by sample_matches desc nulls last))[1] as last5_value,
    bool_or(is_higher_better) as is_higher_better,
    (array_agg(rank_direction order by sample_matches desc nulls last))[1] as rank_direction,
    max(value_format) as value_format,
    bool_or(coverage_flag) as coverage_flag
  from analytics.player_detailed_metrics_v2_2_mat
  group by season_label, competition, player_source_id, metric_key
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
  r.season_label,
  r.competition,
  r.player_source_id,
  r.player_name,
  r.position_code,
  r.role_group,
  r.source_team_id,
  r.team_slug,
  r.team_name,
  r.metric_key,
  r.metric_label,
  r.category_key,
  r.category_label,
  r.display_priority,
  r.total_value,
  r.per_match_value,
  r.per90_value,
  r.home_value,
  r.away_value,
  r.last5_value,
  st.league_avg,
  st.league_median,
  rank() over (
    partition by r.season_label, r.competition, r.metric_key
    order by
      case when r.rank_direction = 'asc' then r.ranking_value end asc nulls last,
      case when r.rank_direction <> 'asc' then r.ranking_value end desc nulls last
  )::integer as league_rank,
  percent_rank() over (
    partition by r.season_label, r.competition, r.metric_key
    order by
      case when r.rank_direction = 'asc' then r.ranking_value end asc nulls last,
      case when r.rank_direction <> 'asc' then r.ranking_value end desc nulls last
  )::numeric as league_percentile,
  (r.ranking_value - st.league_avg) as vs_league_avg_abs,
  case
    when st.league_avg is null or abs(st.league_avg) < 0.5 or st.league_avg = 0 then null
    else (r.ranking_value - st.league_avg) / st.league_avg
  end as vs_league_avg_pct,
  r.rank_direction,
  r.is_higher_better,
  r.value_format,
  abs(coalesce(r.home_value, 0) - coalesce(r.away_value, 0)) as home_away_gap_abs,
  r.sample_matches,
  r.coverage_flag
from ranked r
join stats st using (season_label, competition, metric_key);

grant select on analytics.player_detailed_metrics_global_v1 to anon, authenticated;
