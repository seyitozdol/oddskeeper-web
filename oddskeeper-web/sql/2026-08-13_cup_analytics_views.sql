-- Kupa (Turkiye Kupasi) analytics view'lari. Mackolik verisi (football.mackolik_*)
-- uzerine kurulu; TSL "Resmi" deneyimindeki tsl_ss_* / msm_* view sekillerini
-- YANSITIR ki ayni bilesenler kupa icin de calissin. Takim tarafi (Faz 1-2).
-- Kimlik: Mackolik uuid = Opta uuid; team_slug ref.mackolik_team_map'ten.

-- 0) Takim kimlik yardimcisi: mackolik team id -> slug/isim/logo
create or replace view analytics.cup_team_meta_v1 as
select
    tm.mackolik_team_id                             as team_id,
    tm.mackolik_team_uuid                           as team_uuid,
    tm.team_slug,
    coalesce(tm.canonical_team_name, tm.team_name)  as team_name,
    tm.team_name                                    as mackolik_name,
    (tm.team_slug is not null)                      as is_in_system
from ref.mackolik_team_map tm;

-- 1) Maclar (results) — tsl_ss_matches_v1 sekli + kupa ekleri (round, status, sezon id)
create or replace view analytics.cup_matches_v1 as
select
    m.season_name                          as season_label,
    m.match_uuid                           as match_id,
    m.competition_name                     as competition,
    m.match_datetime,
    m.season_id,
    m.round_id,
    m.round_name,
    m.status,
    m.team_a_id                            as home_team_id,
    coalesce(ta.team_name, m.team_a_name)  as home_team_name,
    ta.team_slug                           as home_team_slug,
    m.team_b_id                            as away_team_id,
    coalesce(tb.team_name, m.team_b_name)  as away_team_name,
    tb.team_slug                           as away_team_slug,
    m.score_a                              as home_score,
    m.score_b                              as away_score,
    m.round_winner_id
from football.mackolik_matches m
left join analytics.cup_team_meta_v1 ta on ta.team_id = m.team_a_id
left join analytics.cup_team_meta_v1 tb on tb.team_id = m.team_b_id;

-- 2) Takim-mac-stat uzun form: her mac icin A ve B tarafi ayri satir
create or replace view analytics.cup_team_match_stats_v1 as
with sided as (
    select m.match_uuid, m.season_name, m.season_id, m.match_datetime,
           m.round_name,
           'A'::text as side, m.team_a_id as team_id, m.team_b_id as opp_id,
           m.score_a as gf, m.score_b as ga
    from football.mackolik_matches m
    union all
    select m.match_uuid, m.season_name, m.season_id, m.match_datetime,
           m.round_name,
           'B'::text, m.team_b_id, m.team_a_id, m.score_b, m.score_a
    from football.mackolik_matches m
)
select
    sd.match_uuid, sd.season_name, sd.season_id, sd.match_datetime, sd.round_name,
    sd.side, (sd.side = 'A') as is_home,
    sd.team_id, tm.team_slug, tm.team_name,
    sd.opp_id, sd.gf, sd.ga,
    case when sd.gf > sd.ga then 'W' when sd.gf < sd.ga then 'L' else 'D' end as result_code,
    s.stat_type,
    case when sd.side = 'A' then s.value_a else s.value_b end as value
from sided sd
join football.mackolik_team_stats s on s.match_uuid = sd.match_uuid
left join analytics.cup_team_meta_v1 tm on tm.team_id = sd.team_id;

-- 3) Takim sezon-ozet metrikleri (tum kupa maclari toplam + mac-basi + ev/dep)
create or replace view analytics.cup_team_metrics_v1 as
select
    season_name                                   as season_label,
    team_id, team_slug, team_name, stat_type,
    count(distinct match_uuid)                    as apps,
    sum(value)                                    as total_value,
    round(avg(value)::numeric, 2)                 as per_match_value,
    round(avg(value) filter (where is_home)::numeric, 2)      as home_value,
    round(avg(value) filter (where not is_home)::numeric, 2)  as away_value
from analytics.cup_team_match_stats_v1
where value is not null
group by season_name, team_id, team_slug, team_name, stat_type;

-- 4) Takim siralamasi (team rankings) — tsl_ss_team_leaderboard_rows_v1 sekli
--    (metrik basina lig ort/medyan/rank; higher-better varsayimi, faul/kart haric).
create or replace view analytics.cup_team_leaderboard_rows_v1 as
with base as (
    select * from analytics.cup_team_metrics_v1 where team_id is not null
),
flags as (
    select *,
        (stat_type not in ('fouls','yellow_card','red_card','second_yellow_card',
                           'direct_red_card','shots_off_target','big_chances_missed')) as higher_better
    from base
),
medians as (
    select season_label, stat_type,
           percentile_cont(0.5) within group (order by total_value) as league_median
    from base group by season_label, stat_type
),
ranked as (
    select f.*,
        avg(total_value) over (partition by f.season_label, f.stat_type) as league_avg,
        md.league_median,
        rank() over (
            partition by f.season_label, f.stat_type
            order by f.total_value * (case when f.higher_better then 1 else -1 end) desc
        ) as league_rank
    from flags f
    join medians md on md.season_label = f.season_label and md.stat_type = f.stat_type
)
select
    (season_label || ':' || stat_type || ':' || team_id::text) as row_id,
    'Türkiye Kupası'::text as competition,
    season_label,
    'team'::text as category_key,
    'Takım'::text as category_label,
    stat_type as metric_key,
    stat_type as metric_label,
    team_slug, team_name,
    total_value, per_match_value, home_value, away_value,
    round(league_avg::numeric, 2) as league_avg,
    round(league_median::numeric, 2) as league_median,
    league_rank,
    case when league_avg > 0
         then round(((total_value - league_avg) / league_avg * 100)::numeric, 1)
         else null end as vs_league_avg_pct,
    'number'::text as value_format,
    case when higher_better then 'desc' else 'asc' end as rank_direction,
    higher_better as is_higher_better,
    team_id, apps
from ranked;

-- 5) Hakemler — msm_referee_season_stats_v1 sekli (kupa raw'indan turetilir).
--    Ana hakemin faul/sari/kirmizi toplamlari maclardaki team stat'lardan;
--    hakem-mac esleri raw.match.referee'den.
create or replace view analytics.cup_referee_matches_v1 as
select
    m.season_name                                  as season,
    (m.raw #>> '{match,referee,name}')             as referee,
    m.match_uuid,
    (m.raw #> '{match,referee}')                    as referee_obj
from football.mackolik_matches m
where (m.raw #>> '{match,referee,name}') is not null;

create or replace view analytics.cup_referee_season_stats_v1 as
with rm as (
    select rm.season, rm.referee, rm.match_uuid
    from analytics.cup_referee_matches_v1 rm
),
mstat as (  -- mac basina toplam faul / sari / kirmizi (iki takim)
    select match_uuid,
        sum(value) filter (where stat_type='fouls')            as fouls,
        sum(value) filter (where stat_type in ('yellow_card','second_yellow_card')) as yellow,
        sum(value) filter (where stat_type in ('red_card','direct_red_card'))       as red
    from analytics.cup_team_match_stats_v1
    group by match_uuid
)
select
    'cup'::text as league,
    rm.season,
    rm.referee,
    count(distinct rm.match_uuid)                          as apps,
    coalesce(sum(ms.fouls), 0)::numeric                    as fouls_total,
    null::numeric                                          as tackles_total,
    0::bigint                                              as tackles_rows,
    coalesce(sum(ms.yellow), 0)::numeric                   as yellow_total,
    coalesce(sum(ms.red), 0)::numeric                      as red_total,
    0::numeric                                             as pen_total,
    round((coalesce(sum(ms.fouls),0) / nullif(count(distinct rm.match_uuid),0))::numeric, 2) as fouls_pg,
    null::numeric                                          as fouls_per_tackle,
    0::numeric                                             as pen_pg,
    round((coalesce(sum(ms.yellow),0) / nullif(count(distinct rm.match_uuid),0))::numeric, 2) as yel_pg,
    round((coalesce(sum(ms.red),0) / nullif(count(distinct rm.match_uuid),0))::numeric, 2)    as red_pg,
    round(((coalesce(sum(ms.yellow),0)+coalesce(sum(ms.red),0)) / nullif(count(distinct rm.match_uuid),0))::numeric, 2) as cards_pg
from rm
left join mstat ms on ms.match_uuid = rm.match_uuid
group by rm.season, rm.referee;

-- 6) Cup Stages — turlar (gameset) yapisi: sezon + tur + mac sayisi + tarih araligi
create or replace view analytics.cup_stages_v1 as
select
    season_name                     as season_label,
    season_id,
    round_id,
    round_name,
    count(*)                        as match_count,
    count(*) filter (where status = 'Played') as played_count,
    min(match_datetime)             as first_match,
    max(match_datetime)             as last_match
from football.mackolik_matches
group by season_name, season_id, round_id, round_name;

grant select on
    analytics.cup_team_meta_v1, analytics.cup_matches_v1,
    analytics.cup_team_match_stats_v1, analytics.cup_team_metrics_v1,
    analytics.cup_team_leaderboard_rows_v1, analytics.cup_referee_matches_v1,
    analytics.cup_referee_season_stats_v1, analytics.cup_stages_v1
to anon, authenticated;
