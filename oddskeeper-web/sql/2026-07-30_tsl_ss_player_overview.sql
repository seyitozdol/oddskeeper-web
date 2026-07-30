-- 2026-07-30: Option A / Asama 4b — TSL SofaScore oyuncu ADVANCED OVERVIEW view'i.
-- player_overview_advanced_v1'in SofaScore esdegeri. Kaynak: benim mat'larim
-- (global_mat: base alanlar + last5/sezon form; benchmarks_mat: en guclu 2 metrik).
-- Frontend getPlayerAdvancedOverview bunu (mat uzerinden) okuyacak.
-- usage_label: avg_minutes/starts esiklerine gore (Opta ile ayni).
-- recent_form_label: son5 vs sezon per_match (goals+assists+xg+shots_on_target) farki.
-- primary/secondary_strength: overview_allowed + role_scope uyan metriklerden,
--   league_percentile (best=1.0) en yuksek 2'si.

create or replace view analytics.tsl_ss_player_overview_advanced_v1 as
with base as (
  select
    season_label, competition, player_source_id,
    max(player_name)                                             as player_name,
    (array_agg(source_team_id order by sample_matches desc nulls last))[1] as source_team_id,
    (array_agg(team_slug      order by sample_matches desc nulls last))[1] as team_slug,
    (array_agg(team_name      order by sample_matches desc nulls last))[1] as team_name,
    (array_agg(position_code  order by sample_matches desc nulls last))[1] as position_code,
    (array_agg(role_group     order by sample_matches desc nulls last))[1] as role_group,
    max(total_value) filter (where metric_key = 'appearances')  as appearances,
    max(total_value) filter (where metric_key = 'starts')       as starts,
    max(total_value) filter (where metric_key = 'total_minutes') as total_minutes,
    max(total_value) filter (where metric_key = 'avg_minutes')  as avg_minutes,
    coalesce(sum(last5_value) filter (where metric_key in
      ('goals_total','assists_total','expected_goals_total','shots_on_target_total')), 0)     as last5_form_sum,
    coalesce(sum(per_match_value) filter (where metric_key in
      ('goals_total','assists_total','expected_goals_total','shots_on_target_total')), 0)     as season_form_sum
  from analytics.tsl_ss_player_detailed_metrics_global_mat
  group by season_label, competition, player_source_id
),
base2 as (
  select *,
    (coalesce(appearances,0) - coalesce(starts,0)) as sub_appearances,
    case role_group
      when 'goalkeeper' then 'gk' when 'defender' then 'def'
      when 'midfielder' then 'mid' when 'forward' then 'fwd' else 'all' end as role_scope_key,
    case
      when avg_minutes >= 75 and starts >= greatest(5, ceil(coalesce(appearances,0) * 0.6)) then 'Core starter'
      when avg_minutes >= 50 then 'Regular starter'
      when avg_minutes >= 25 then 'Rotation piece'
      else 'Limited role'
    end as usage_label,
    case
      when coalesce(appearances,0) < 5 then 'Low sample'
      when (last5_form_sum - season_form_sum) >= 0.25 then 'Uptrend'
      when (last5_form_sum - season_form_sum) <= -0.25 then 'Downtrend'
      else 'Stable'
    end as recent_form_label
  from base
),
strengths as (
  select
    b.season_label, b.competition, b.player_source_id,
    bm.metric_key, bm.display_label, bm.category, bm.metric_value,
    bm.league_rank, bm.league_percentile, bm.vs_league_avg_pct,
    row_number() over (
      partition by b.season_label, b.competition, b.player_source_id
      order by bm.league_percentile desc nulls last, bm.vs_league_avg_pct desc nulls last,
               bm.display_priority, bm.metric_key
    ) as rn
  from base2 b
  join analytics.tsl_ss_player_metric_benchmarks_mat bm
    on bm.season_label = b.season_label and bm.competition = b.competition
   and bm.player_source_id = b.player_source_id
  join analytics.tsl_ss_metric_catalog_v1 c on c.metric_key = bm.metric_key
  where c.overview_allowed and (c.role_scope = 'all' or c.role_scope = b.role_scope_key)
)
select
  b.season_label, b.competition, b.source_team_id, b.team_slug, b.team_name,
  b.player_source_id, b.player_name, b.position_code, b.role_group,
  b.appearances, b.starts, b.sub_appearances, b.total_minutes, b.avg_minutes,
  b.usage_label, b.recent_form_label,
  s1.metric_key        as primary_strength_metric_key,
  s1.display_label     as primary_strength_metric_label,
  s1.category          as primary_strength_category,
  s1.metric_value      as primary_strength_metric_value,
  s1.league_rank       as primary_strength_league_rank,
  s1.league_percentile as primary_strength_league_percentile,
  s1.vs_league_avg_pct as primary_strength_vs_league_avg_pct,
  s2.metric_key        as secondary_strength_metric_key,
  s2.display_label     as secondary_strength_metric_label,
  s2.category          as secondary_strength_category,
  s2.metric_value      as secondary_strength_metric_value,
  s2.league_rank       as secondary_strength_league_rank,
  s2.league_percentile as secondary_strength_league_percentile,
  s2.vs_league_avg_pct as secondary_strength_vs_league_avg_pct
from base2 b
left join strengths s1
  on s1.season_label = b.season_label and s1.competition = b.competition
 and s1.player_source_id = b.player_source_id and s1.rn = 1
left join strengths s2
  on s2.season_label = b.season_label and s2.competition = b.competition
 and s2.player_source_id = b.player_source_id and s2.rn = 2;

grant select on analytics.tsl_ss_player_overview_advanced_v1 to anon, authenticated, service_role;

drop materialized view if exists analytics.tsl_ss_player_overview_advanced_mat;
create materialized view analytics.tsl_ss_player_overview_advanced_mat as
  select * from analytics.tsl_ss_player_overview_advanced_v1;
create unique index uq_tsl_ss_overview_mat
  on analytics.tsl_ss_player_overview_advanced_mat (season_label, competition, player_source_id);
grant select on analytics.tsl_ss_player_overview_advanced_mat to anon, authenticated, service_role;
