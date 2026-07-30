-- 2026-07-30: Option A / Asama 5b — TSL SofaScore TAKIM benchmarks + overview + leaderboard.
-- Kaynak: tsl_ss_team_detailed_metrics_mat (+ football.matches puan durumu icin).
-- team_metric_benchmarks_v1 / team_overview_advanced_v1 / team_leaderboard_rows_v1 esdegerleri.

-- ══ 1) TAKIM BENCHMARK (mat'in yeniden sekli + value_basis + above_avg) ══
create or replace view analytics.tsl_ss_team_metric_benchmarks_v1 as
select
  season_label, competition, source_team_id, team_slug, team_name,
  metric_key, metric_label as display_label, category_key as category, display_priority,
  case when value_format = 'pct' then 'pct' else 'per_match' end as value_basis,
  rank_direction,
  coalesce(per_match_value, total_value) as metric_value,
  league_rank, league_percentile,
  league_avg, league_median, vs_league_avg_abs, vs_league_avg_pct,
  case when rank_direction = 'desc' then coalesce(per_match_value,total_value) >= league_avg
       when rank_direction = 'asc'  then coalesce(per_match_value,total_value) <= league_avg end as above_league_avg_flag
from analytics.tsl_ss_team_detailed_metrics_mat;

grant select on analytics.tsl_ss_team_metric_benchmarks_v1 to anon, authenticated, service_role;

-- ══ 2) TAKIM LEADERBOARD satirlari (lig Takim Liderleri paneli) ══
create or replace view analytics.tsl_ss_team_leaderboard_rows_v1 as
select
  row_number() over (partition by season_label, competition order by display_priority, metric_key, league_rank) as row_id,
  competition, season_label, category_key, category_label, metric_key, metric_label,
  team_slug, team_name,
  total_value, per_match_value, home_value, away_value,
  league_avg, league_median, league_rank, vs_league_avg_pct,
  value_format, rank_direction, is_higher_better
from analytics.tsl_ss_team_detailed_metrics_mat;

grant select on analytics.tsl_ss_team_leaderboard_rows_v1 to anon, authenticated, service_role;

-- ══ 3) TAKIM ADVANCED OVERVIEW ══
create or replace view analytics.tsl_ss_team_overview_advanced_v1 as
with tmatch as (  -- takim-mac sonuclari (puan durumu + son5 icin)
  select season_label, home_team_source_id as team_id, match_datetime,
         home_score gf, away_score ga
  from football.matches where source='sofascore' and competition='Süper Lig'
  union all
  select season_label, away_team_source_id, match_datetime, away_score, home_score
  from football.matches where source='sofascore' and competition='Süper Lig'
),
standings as (
  select season_label, team_id,
    count(*) matches_played,
    count(*) filter (where gf>ga) wins,
    count(*) filter (where gf=ga) draws,
    count(*) filter (where gf<ga) losses,
    sum(gf) score_for_total, sum(ga) score_against_total,
    (3*count(*) filter (where gf>ga) + count(*) filter (where gf=ga))::numeric / nullif(count(*),0) as ppg
  from tmatch group by season_label, team_id
),
last5 as (
  select season_label, team_id,
    sum(case when gf>ga then 3 when gf=ga then 1 else 0 end) as pts5,
    count(*) n5
  from (select *, row_number() over (partition by season_label, team_id order by match_datetime desc) rn from tmatch) t
  where rn<=5 group by season_label, team_id
),
ranked as (  -- takim x metrik, en guclu/zayif icin percentile
  select season_label, source_team_id, metric_key, metric_label, category_key,
    coalesce(per_match_value,total_value) as metric_value, league_rank, league_percentile, vs_league_avg_pct,
    home_value, away_value, home_away_gap_abs,
    row_number() over (partition by season_label, source_team_id order by league_percentile desc nulls last, metric_key) rn_strong,
    row_number() over (partition by season_label, source_team_id order by league_percentile asc nulls last, metric_key) rn_weak,
    row_number() over (partition by season_label, source_team_id order by home_away_gap_abs desc nulls last, metric_key) rn_gap
  from analytics.tsl_ss_team_detailed_metrics_mat
),
att as (  -- hucum profili: team_goals_for percentile
  select season_label, source_team_id, league_percentile ap from analytics.tsl_ss_team_detailed_metrics_mat
  where metric_key='team_goals_for'
),
def as (  -- savunma profili: team_goals_against percentile (best=1.0 = az yiyen = iyi)
  select season_label, source_team_id, league_percentile dp from analytics.tsl_ss_team_detailed_metrics_mat
  where metric_key='team_goals_against'
),
base as (
  select distinct season_label, source_team_id, team_name from analytics.tsl_ss_team_detailed_metrics_mat
)
select
  b.season_label, 'Süper Lig'::text competition, null::text team_slug, b.source_team_id, b.team_name,
  s.matches_played, s.wins, s.draws, s.losses, s.score_for_total, s.score_against_total,
  case when a.ap>=0.8 then 'Elit hücum' when a.ap>=0.6 then 'Güçlü hücum'
       when a.ap>=0.4 then 'Ortalama hücum' else 'Zayıf hücum' end as attack_profile_label,
  case when d.dp>=0.8 then 'Elit savunma' when d.dp>=0.6 then 'Güçlü savunma'
       when d.dp>=0.4 then 'Ortalama savunma' else 'Zayıf savunma' end as defence_profile_label,
  case when l.pts5>=11 then 'Çok iyi form' when l.pts5>=7 then 'İyi form'
       when l.pts5>=4 then 'Orta form' else 'Kötü form' end as recent_form_label,
  ( (l.pts5::numeric / nullif(l.n5,0)) > s.ppg ) as form_shift_last5_flag,
  st.metric_key strongest_metric_key, st.metric_label strongest_metric_label, st.category_key strongest_metric_category,
  st.metric_value strongest_metric_value, st.league_rank strongest_metric_league_rank,
  st.league_percentile strongest_metric_league_percentile, st.vs_league_avg_pct strongest_metric_vs_league_avg_pct,
  wk.metric_key weakest_metric_key, wk.metric_label weakest_metric_label, wk.category_key weakest_metric_category,
  wk.metric_value weakest_metric_value, wk.league_rank weakest_metric_league_rank,
  wk.league_percentile weakest_metric_league_percentile, wk.vs_league_avg_pct weakest_metric_vs_league_avg_pct,
  gp.metric_key home_away_gap_metric_key, gp.home_value home_away_gap_home_value,
  gp.away_value home_away_gap_away_value, gp.home_away_gap_abs
from base b
left join standings s on s.season_label=b.season_label and s.team_id=b.source_team_id
left join last5 l on l.season_label=b.season_label and l.team_id=b.source_team_id
left join att a on a.season_label=b.season_label and a.source_team_id=b.source_team_id
left join def d on d.season_label=b.season_label and d.source_team_id=b.source_team_id
left join ranked st on st.season_label=b.season_label and st.source_team_id=b.source_team_id and st.rn_strong=1
left join ranked wk on wk.season_label=b.season_label and wk.source_team_id=b.source_team_id and wk.rn_weak=1
left join ranked gp on gp.season_label=b.season_label and gp.source_team_id=b.source_team_id and gp.rn_gap=1;

grant select on analytics.tsl_ss_team_overview_advanced_v1 to anon, authenticated, service_role;

-- mat'lar (frontend okur)
drop materialized view if exists analytics.tsl_ss_team_metric_benchmarks_mat;
create materialized view analytics.tsl_ss_team_metric_benchmarks_mat as select * from analytics.tsl_ss_team_metric_benchmarks_v1;
create unique index uq_tsl_ss_team_bm_mat on analytics.tsl_ss_team_metric_benchmarks_mat (season_label, competition, source_team_id, metric_key);
grant select on analytics.tsl_ss_team_metric_benchmarks_mat to anon, authenticated, service_role;

drop materialized view if exists analytics.tsl_ss_team_overview_advanced_mat;
create materialized view analytics.tsl_ss_team_overview_advanced_mat as select * from analytics.tsl_ss_team_overview_advanced_v1;
create unique index uq_tsl_ss_team_ov_mat on analytics.tsl_ss_team_overview_advanced_mat (season_label, competition, source_team_id);
grant select on analytics.tsl_ss_team_overview_advanced_mat to anon, authenticated, service_role;
