-- 1) Total row count vs unique composite key
select
    count(*) as total_rows,
    count(distinct (source, source_match_id, source_team_id)) as unique_rows
from football.match_team_stats
where source = 'opta';

-- 2) Duplicate composite key kontrolü
select
    source,
    source_match_id,
    source_team_id,
    count(*) as row_count
from football.match_team_stats
where source = 'opta'
group by source, source_match_id, source_team_id
having count(*) > 1
order by row_count desc, source_match_id, source_team_id;

-- 3) Required alan null kontrolü
select 'source' as field_name, count(*) as null_count
from football.match_team_stats
where source = 'opta' and source is null

union all
select 'source_match_id', count(*)
from football.match_team_stats
where source = 'opta' and source_match_id is null

union all
select 'source_team_id', count(*)
from football.match_team_stats
where source = 'opta' and source_team_id is null

union all
select 'team_name', count(*)
from football.match_team_stats
where source = 'opta' and team_name is null

union all
select 'team_side', count(*)
from football.match_team_stats
where source = 'opta' and team_side is null;

-- 4) Staging extraction count vs target unique count
with staging_rows as (
    select s.source,
           s.source_match_id,
           (s.payload -> 'match_summary' -> 'match_info' -> 'home_team' ->> 'source_team_id') as source_team_id
    from raw.match_json_staging s
    where s.source = 'opta'

    union all

    select s.source,
           s.source_match_id,
           (s.payload -> 'match_summary' -> 'match_info' -> 'away_team' ->> 'source_team_id') as source_team_id
    from raw.match_json_staging s
    where s.source = 'opta'
)
select
    count(distinct (source, source_match_id, source_team_id)) as staging_unique,
    (
        select count(distinct (source, source_match_id, source_team_id))
        from football.match_team_stats
        where source = 'opta'
    ) as target_unique
from staging_rows;

-- 5) Staging'de olup target'ta olmayan kayıtlar
with staging_rows as (
    select distinct s.source,
           s.source_match_id,
           (s.payload -> 'match_summary' -> 'match_info' -> 'home_team' ->> 'source_team_id') as source_team_id
    from raw.match_json_staging s
    where s.source = 'opta'

    union

    select distinct s.source,
           s.source_match_id,
           (s.payload -> 'match_summary' -> 'match_info' -> 'away_team' ->> 'source_team_id') as source_team_id
    from raw.match_json_staging s
    where s.source = 'opta'
)
select
    sr.source,
    sr.source_match_id,
    sr.source_team_id
from staging_rows sr
left join football.match_team_stats t
    on t.source = sr.source
   and t.source_match_id = sr.source_match_id
   and t.source_team_id = sr.source_team_id
where t.source_team_id is null
order by sr.source_match_id, sr.source_team_id;

-- 6) Target'ta olup staging'de olmayan kayıtlar
with staging_rows as (
    select distinct s.source,
           s.source_match_id,
           (s.payload -> 'match_summary' -> 'match_info' -> 'home_team' ->> 'source_team_id') as source_team_id
    from raw.match_json_staging s
    where s.source = 'opta'

    union

    select distinct s.source,
           s.source_match_id,
           (s.payload -> 'match_summary' -> 'match_info' -> 'away_team' ->> 'source_team_id') as source_team_id
    from raw.match_json_staging s
    where s.source = 'opta'
)
select
    t.source,
    t.source_match_id,
    t.source_team_id
from football.match_team_stats t
left join staging_rows sr
    on sr.source = t.source
   and sr.source_match_id = t.source_match_id
   and sr.source_team_id = t.source_team_id
where t.source = 'opta'
  and sr.source_team_id is null
order by t.source_match_id, t.source_team_id;

-- 7) Maç başına satır sayısı tam 2 mi?
select
    source_match_id,
    count(*) as row_count
from football.match_team_stats
where source = 'opta'
group by source_match_id
having count(*) <> 2
order by source_match_id;

-- 8) Skor / result_code tutarlılığı
select
    source_match_id,
    source_team_id,
    team_name,
    team_side,
    score_for,
    score_against,
    result_code
from football.match_team_stats
where source = 'opta'
  and (
    (score_for > score_against and result_code <> 'W')
    or (score_for < score_against and result_code <> 'L')
    or (score_for = score_against and result_code <> 'D')
    or score_for < 0
    or score_against < 0
    or score_for > 20
    or score_against > 20
  )
order by source_match_id, source_team_id;

-- 9) Negatif / mantık dışı takım metrikleri
select
    source_match_id,
    source_team_id,
    team_name,
    summary_goals,
    summary_shots,
    summary_shots_on_target,
    details_expected_goals,
    opta_player_count,
    opta_minutes_total,
    opta_points_total
from football.match_team_stats
where source = 'opta'
  and (
    coalesce(summary_goals, 0) < 0
    or coalesce(summary_shots, 0) < 0
    or coalesce(summary_shots_on_target, 0) < 0
    or coalesce(details_expected_goals, 0) < 0
    or coalesce(opta_player_count, 0) < 0
    or coalesce(opta_minutes_total, 0) < 0
    or coalesce(opta_points_total, 0) < 0
  )
order by source_match_id, source_team_id;

-- 10) Örnek veri görünümü
select
    source_match_id,
    source_team_id,
    team_name,
    team_side,
    opponent_team_name,
    score_for,
    score_against,
    result_code,
    summary_goals,
    summary_shots,
    summary_shots_on_target,
    details_expected_goals,
    opta_player_count,
    opta_points_total,
    updated_at
from football.match_team_stats
where source = 'opta'
order by source_match_id desc, team_side
limit 50;
