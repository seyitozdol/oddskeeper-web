-- 2026-07-30: Option A / Asama 4c-1 — TSL SofaScore METRIK LEADERBOARD (qualification'li).
-- player_metric_leaderboard_current'in SofaScore esdegeri. Kaynak: global mat +
-- QUALIFICATION: oyuncu dakikasi sezonun max dakikasinin %30'undan buyukse qualified;
-- league_rank/percentile SADECE qualified oyuncular arasinda (micro-sample per90 sismesini eler).
-- Frontend getPlayerMetricLeaderboard bunu okuyacak. ranking_value=coalesce(per90,per_match,total).

create or replace view analytics.tsl_ss_player_metric_leaderboard_current as
with pmin as (
  select season_label, competition, player_source_id,
         max(total_value) filter (where metric_key = 'total_minutes') as minutes,
         max(total_value) filter (where metric_key = 'appearances')   as apps
  from analytics.tsl_ss_player_detailed_metrics_global_mat
  group by season_label, competition, player_source_id
),
thr as (
  select season_label, competition,
         round(0.30 * max(minutes)) as min_thr,
         greatest(5, round(0.30 * max(apps))) as apps_thr
  from pmin group by season_label, competition
),
enr as (
  select m.*,
    coalesce(m.per90_value, m.per_match_value, m.total_value) as ranking_value,
    pm.minutes, pm.apps, t.min_thr, t.apps_thr,
    (pm.minutes >= t.min_thr) as is_qualified
  from analytics.tsl_ss_player_detailed_metrics_global_mat m
  join pmin pm using (season_label, competition, player_source_id)
  join thr  t  using (season_label, competition)
)
select
  season_label, competition, player_source_id, player_name, position_code, role_group,
  source_team_id, team_slug, team_name,
  metric_key, metric_label, category_key, category_label,
  total_value, per_match_value, per90_value, home_value, away_value, last5_value,
  league_avg, league_median,
  case when is_qualified then rank() over (
    partition by season_label, competition, metric_key, is_qualified
    order by case when rank_direction = 'asc' then ranking_value end asc nulls last,
             case when rank_direction <> 'asc' then ranking_value end desc nulls last
  ) end as league_rank,
  case when is_qualified then round((1 - percent_rank() over (
    partition by season_label, competition, metric_key, is_qualified
    order by case when rank_direction = 'asc' then ranking_value end asc nulls last,
             case when rank_direction <> 'asc' then ranking_value end desc nulls last
  ))::numeric, 4) end as league_percentile,
  vs_league_avg_abs, vs_league_avg_pct, rank_direction, is_higher_better, value_format,
  home_away_gap_abs, sample_matches, coverage_flag,
  'all'::text                            as player_pool,
  'all'::text                            as ranking_pool,
  ranking_value,
  is_qualified,
  min_thr                                as qualification_minutes_threshold,
  apps_thr                               as qualification_apps_threshold,
  case when is_qualified then null else 'Yetersiz dakika (sezon max %30 alti)' end as qualification_reason
from enr;

grant select on analytics.tsl_ss_player_metric_leaderboard_current to anon, authenticated, service_role;

drop materialized view if exists analytics.tsl_ss_player_metric_leaderboard_mat;
create materialized view analytics.tsl_ss_player_metric_leaderboard_mat as
  select * from analytics.tsl_ss_player_metric_leaderboard_current;
create unique index uq_tsl_ss_metric_lb_mat
  on analytics.tsl_ss_player_metric_leaderboard_mat (season_label, competition, metric_key, player_source_id);
grant select on analytics.tsl_ss_player_metric_leaderboard_mat to anon, authenticated, service_role;
