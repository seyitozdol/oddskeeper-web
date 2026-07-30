-- 2026-07-30: Option A / Asama 5a — TSL SofaScore TAKIM detay metrik + siralama.
-- team_detailed_metrics_v2_1'in SofaScore esdegeri. SofaScore takim istatistigi YOK;
-- oyuncu-mac verisi (match_player_stats_details, source='sofascore') takima toplanir.
-- Gren: sezon x takim x metrik. per90 YOK (per_match/home/away var). Ranking global view gibi.
-- Kaynak takim id'si = SofaScore numeric team id. team_slug NULL (eslemesi ayri is).
-- Kapsam: goals_for/against, xg, shots(+sot,+against), passes(+acc,+%), tackles,
--   interceptions, fouls(+won), offsides, saves, shot_accuracy, xg_per_shot.
--   (korner/goal_kick/throw/gol-kirilimlari SofaScore'da yok; kart FlashScore ertelendi.)

create or replace view analytics.tsl_ss_team_detailed_metrics_v1 as
with tm as (  -- takim-mac toplami
  select
    m.season_label,
    d.source_team_id,
    m.source_match_id,
    m.match_datetime,
    (m.home_team_source_id = d.source_team_id) as is_home,
    case when m.home_team_source_id = d.source_team_id then m.home_score else m.away_score end as goals_for,
    case when m.home_team_source_id = d.source_team_id then m.away_score else m.home_score end as goals_against,
    (array_agg(d.team_name order by d.source_player_id))[1]        as team_name,
    coalesce(sum((d.raw_stats->>'expectedGoals')::numeric),0)      as xg,
    coalesce(sum((d.raw_stats->>'totalShots')::numeric),0)         as shots,
    coalesce(sum((d.raw_stats->>'onTargetScoringAttempt')::numeric),0) as sot,
    coalesce(sum((d.raw_stats->>'totalPass')::numeric),0)          as passes,
    coalesce(sum((d.raw_stats->>'accuratePass')::numeric),0)       as acc_pass,
    coalesce(sum((d.raw_stats->>'totalTackle')::numeric),0)        as tackles,
    coalesce(sum((d.raw_stats->>'interceptionWon')::numeric),0)    as interceptions,
    coalesce(sum((d.raw_stats->>'fouls')::numeric),0)              as fouls,
    coalesce(sum((d.raw_stats->>'wasFouled')::numeric),0)          as fouls_won,
    coalesce(sum((d.raw_stats->>'totalOffside')::numeric),0)       as offsides,
    coalesce(sum((d.raw_stats->>'saves')::numeric),0)              as saves
  from football.match_player_stats_details d
  join football.matches m
    on m.source = d.source and m.source_match_id = d.source_match_id
  where d.source = 'sofascore' and m.competition = 'Süper Lig'
  group by m.season_label, d.source_team_id, m.source_match_id, m.match_datetime,
           is_home, goals_for, goals_against
),
tmo as (  -- rakip (karsi) toplamlarini ekle
  select a.*, coalesce(b.shots,0) as shots_against, coalesce(b.sot,0) as sot_against
  from tm a
  left join tm b on b.source_match_id = a.source_match_id and b.source_team_id <> a.source_team_id
),
season as (  -- sezon toplami + ev/deplasman
  select
    season_label, source_team_id,
    (array_agg(team_name order by match_datetime desc))[1] as team_name,
    count(*) as matches,
    sum(goals_for) gf, sum(goals_for) filter (where is_home) gf_h, sum(goals_for) filter (where not is_home) gf_a,
    sum(goals_against) ga, sum(goals_against) filter (where is_home) ga_h, sum(goals_against) filter (where not is_home) ga_a,
    sum(xg) xg, sum(xg) filter (where is_home) xg_h, sum(xg) filter (where not is_home) xg_a,
    sum(shots) sh, sum(shots) filter (where is_home) sh_h, sum(shots) filter (where not is_home) sh_a,
    sum(sot) sot, sum(sot) filter (where is_home) sot_h, sum(sot) filter (where not is_home) sot_a,
    sum(shots_against) sha, sum(shots_against) filter (where is_home) sha_h, sum(shots_against) filter (where not is_home) sha_a,
    sum(sot_against) sota, sum(sot_against) filter (where is_home) sota_h, sum(sot_against) filter (where not is_home) sota_a,
    sum(passes) pa, sum(passes) filter (where is_home) pa_h, sum(passes) filter (where not is_home) pa_a,
    sum(acc_pass) ap, sum(acc_pass) filter (where is_home) ap_h, sum(acc_pass) filter (where not is_home) ap_a,
    sum(tackles) tk, sum(tackles) filter (where is_home) tk_h, sum(tackles) filter (where not is_home) tk_a,
    sum(interceptions) it, sum(interceptions) filter (where is_home) it_h, sum(interceptions) filter (where not is_home) it_a,
    sum(fouls) fl, sum(fouls) filter (where is_home) fl_h, sum(fouls) filter (where not is_home) fl_a,
    sum(fouls_won) fw, sum(fouls_won) filter (where is_home) fw_h, sum(fouls_won) filter (where not is_home) fw_a,
    sum(offsides) of, sum(offsides) filter (where is_home) of_h, sum(offsides) filter (where not is_home) of_a,
    sum(saves) sv, sum(saves) filter (where is_home) sv_h, sum(saves) filter (where not is_home) sv_a
  from tmo
  group by season_label, source_team_id
),
long as (
  select
    s.season_label, s.source_team_id, s.team_name, s.matches,
    x.metric_key, x.category_key, x.category_label, x.metric_label,
    x.rank_direction, x.value_format, x.is_derived, x.display_priority,
    x.total_value, x.home_value, x.away_value
  from season s
  cross join lateral (values
    ('team_goals_for','attacking','Hücum','Attığı Gol','desc','count',false,10, s.gf, s.gf_h, s.gf_a),
    ('team_goals_against','defending','Savunma','Yediği Gol','asc','count',false,11, s.ga, s.ga_h, s.ga_a),
    ('team_expected_goals','attacking','Hücum','xG','desc','decimal',false,12, round(s.xg,2), round(s.xg_h,2), round(s.xg_a,2)),
    ('team_shots','attacking','Hücum','Şut','desc','count',false,13, s.sh, s.sh_h, s.sh_a),
    ('team_shots_on_target','attacking','Hücum','İsabetli Şut','desc','count',false,14, s.sot, s.sot_h, s.sot_a),
    ('team_shot_accuracy_pct','attacking','Hücum','İsabet %','desc','pct',true,15,
       case when s.sh>0 then round(100.0*s.sot/s.sh,1) end, null, null),
    ('team_xg_per_shot','attacking','Hücum','Şut Başı xG','desc','decimal',true,16,
       case when s.sh>0 then round(s.xg/s.sh,3) end, null, null),
    ('team_shots_against','defending','Savunma','Rakip Şut','asc','count',false,20, s.sha, s.sha_h, s.sha_a),
    ('team_shots_on_target_against','defending','Savunma','Rakip İsabetli Şut','asc','count',false,21, s.sota, s.sota_h, s.sota_a),
    ('team_passes','build_up','Oyun Kurma','Pas','desc','count',false,30, s.pa, s.pa_h, s.pa_a),
    ('team_accurate_pass','build_up','Oyun Kurma','İsabetli Pas','desc','count',false,31, s.ap, s.ap_h, s.ap_a),
    ('team_pass_accuracy_pct','build_up','Oyun Kurma','Pas İsabet %','desc','pct',true,32,
       case when s.pa>0 then round(100.0*s.ap/s.pa,1) end, null, null),
    ('team_tackles','defending','Savunma','Müdahale','desc','count',false,40, s.tk, s.tk_h, s.tk_a),
    ('team_interceptions','defending','Savunma','Top Kapma','desc','count',false,41, s.it, s.it_h, s.it_a),
    ('team_saves','defending','Savunma','Kurtarış','desc','count',false,42, s.sv, s.sv_h, s.sv_a),
    ('team_fouls_conceded','discipline','Disiplin','Yapılan Faul','asc','count',false,50, s.fl, s.fl_h, s.fl_a),
    ('team_fouls_won','discipline','Disiplin','Kazanılan Faul','desc','count',false,51, s.fw, s.fw_h, s.fw_a),
    ('team_offsides','discipline','Disiplin','Ofsayt','asc','count',false,52, s.of, s.of_h, s.of_a)
  ) as x(metric_key, category_key, category_label, metric_label, rank_direction, value_format,
         is_derived, display_priority, total_value, home_value, away_value)
),
enr as (
  select *,
    case when value_format = 'pct' or is_derived then total_value
         when matches > 0 then round(total_value / matches, 2) end as per_match_value,
    (rank_direction <> 'asc') as is_higher_better
  from long
),
stats as (
  select season_label, metric_key,
    avg(coalesce(per_match_value, total_value)) as league_avg,
    percentile_cont(0.5) within group (order by coalesce(per_match_value, total_value)::double precision) as league_median
  from enr group by season_label, metric_key
)
select
  e.season_label,
  'Süper Lig'::text as competition,
  null::text        as team_slug,
  e.source_team_id,
  e.team_name,
  e.metric_key, e.metric_label, e.category_key, e.category_label, e.display_priority,
  e.total_value, e.per_match_value, e.home_value, e.away_value,
  round(st.league_avg, 3) as league_avg,
  round(st.league_median::numeric, 3) as league_median,
  rank() over (partition by e.season_label, e.metric_key
    order by case when e.rank_direction='asc' then coalesce(e.per_match_value,e.total_value) end asc nulls last,
             case when e.rank_direction<>'asc' then coalesce(e.per_match_value,e.total_value) end desc nulls last
  )::integer as league_rank,
  round((1 - percent_rank() over (partition by e.season_label, e.metric_key
    order by case when e.rank_direction='asc' then coalesce(e.per_match_value,e.total_value) end asc nulls last,
             case when e.rank_direction<>'asc' then coalesce(e.per_match_value,e.total_value) end desc nulls last
  ))::numeric, 4) as league_percentile,
  round(coalesce(e.per_match_value,e.total_value) - st.league_avg, 3) as vs_league_avg_abs,
  case when st.league_avg is null or abs(st.league_avg) < 0.01 then null
       else round(100.0 * (coalesce(e.per_match_value,e.total_value) - st.league_avg) / st.league_avg, 2) end as vs_league_avg_pct,
  e.rank_direction, e.is_higher_better, e.value_format,
  abs(coalesce(e.home_value,0) - coalesce(e.away_value,0)) as home_away_gap_abs,
  e.matches as sample_matches,
  true as coverage_flag
from enr e
join stats st using (season_label, metric_key);

grant select on analytics.tsl_ss_team_detailed_metrics_v1 to anon, authenticated, service_role;

drop materialized view if exists analytics.tsl_ss_team_detailed_metrics_mat;
create materialized view analytics.tsl_ss_team_detailed_metrics_mat as
  select * from analytics.tsl_ss_team_detailed_metrics_v1;
create unique index uq_tsl_ss_team_dm_mat
  on analytics.tsl_ss_team_detailed_metrics_mat (season_label, competition, source_team_id, metric_key);
grant select on analytics.tsl_ss_team_detailed_metrics_mat to anon, authenticated, service_role;
