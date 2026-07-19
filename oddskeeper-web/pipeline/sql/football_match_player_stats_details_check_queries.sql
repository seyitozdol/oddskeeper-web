-- 1) Total row count vs unique composite key
select
    count(*) as total_rows,
    count(distinct (source, source_match_id, source_player_id)) as unique_rows
from football.match_player_stats_details
where source = 'opta';

-- 2) Duplicate composite key kontrolü
select
    source,
    source_match_id,
    source_player_id,
    count(*) as row_count
from football.match_player_stats_details
where source = 'opta'
group by source, source_match_id, source_player_id
having count(*) > 1
order by row_count desc, source_match_id, source_player_id;

-- 3) Required alan null kontrolü
select 'source' as field_name, count(*) as null_count
from football.match_player_stats_details
where source = 'opta' and source is null

union all
select 'source_match_id', count(*)
from football.match_player_stats_details
where source = 'opta' and source_match_id is null

union all
select 'source_team_id', count(*)
from football.match_player_stats_details
where source = 'opta' and source_team_id is null

union all
select 'team_name', count(*)
from football.match_player_stats_details
where source = 'opta' and team_name is null

union all
select 'source_player_id', count(*)
from football.match_player_stats_details
where source = 'opta' and source_player_id is null

union all
select 'player_name', count(*)
from football.match_player_stats_details
where source = 'opta' and player_name is null;

-- 4) Staging extraction count vs target unique count
with staging_rows as (
    select
        s.source,
        s.source_match_id,
        section ->> 'team_source_id' as source_team_id,
        row_item ->> 'source_player_id' as source_player_id
    from raw.match_json_staging s
    cross join lateral jsonb_array_elements(s.payload -> 'match_details' -> 'details_sections') as section
    cross join lateral jsonb_array_elements(section -> 'table' -> 'rows') as row_item
    where s.source = 'opta'
      and coalesce(section ->> 'team_source_id', '') <> ''
      and coalesce(row_item ->> 'source_player_id', '') <> ''
)
select
    count(distinct (source, source_match_id, source_player_id)) as staging_unique,
    (
        select count(distinct (source, source_match_id, source_player_id))
        from football.match_player_stats_details
        where source = 'opta'
    ) as target_unique
from staging_rows;

-- 5) Staging'de olup target'ta olmayan kayıtlar
with staging_rows as (
    select distinct
        s.source,
        s.source_match_id,
        row_item ->> 'source_player_id' as source_player_id
    from raw.match_json_staging s
    cross join lateral jsonb_array_elements(s.payload -> 'match_details' -> 'details_sections') as section
    cross join lateral jsonb_array_elements(section -> 'table' -> 'rows') as row_item
    where s.source = 'opta'
      and coalesce(section ->> 'team_source_id', '') <> ''
      and coalesce(row_item ->> 'source_player_id', '') <> ''
)
select
    sr.source,
    sr.source_match_id,
    sr.source_player_id
from staging_rows sr
left join football.match_player_stats_details t
    on t.source = sr.source
   and t.source_match_id = sr.source_match_id
   and t.source_player_id = sr.source_player_id
where t.source_player_id is null
order by sr.source_match_id, sr.source_player_id;

-- 6) Target'ta olup staging'de olmayan kayıtlar
with staging_rows as (
    select distinct
        s.source,
        s.source_match_id,
        row_item ->> 'source_player_id' as source_player_id
    from raw.match_json_staging s
    cross join lateral jsonb_array_elements(s.payload -> 'match_details' -> 'details_sections') as section
    cross join lateral jsonb_array_elements(section -> 'table' -> 'rows') as row_item
    where s.source = 'opta'
      and coalesce(section ->> 'team_source_id', '') <> ''
      and coalesce(row_item ->> 'source_player_id', '') <> ''
)
select
    t.source,
    t.source_match_id,
    t.source_player_id
from football.match_player_stats_details t
left join staging_rows sr
    on sr.source = t.source
   and sr.source_match_id = t.source_match_id
   and sr.source_player_id = t.source_player_id
where t.source = 'opta'
  and sr.source_player_id is null
order by t.source_match_id, t.source_player_id;

-- 7) Temel mantık dışı değer kontrolü
select
    source_match_id,
    source_player_id,
    player_name,
    position_code,
    expected_goals,
    accurate_pass,
    attempts_ibox,
    attempts_obox,
    goal_kicks,
    total_throws
from football.match_player_stats_details
where source = 'opta'
  and (
      coalesce(expected_goals, 0) < 0 or coalesce(expected_goals, 0) > 10
      or coalesce(accurate_pass, 0) < 0 or coalesce(accurate_pass, 0) > 250
      or coalesce(attempts_ibox, 0) < 0 or coalesce(attempts_ibox, 0) > 30
      or coalesce(attempts_obox, 0) < 0 or coalesce(attempts_obox, 0) > 30
      or coalesce(goal_kicks, 0) < 0 or coalesce(goal_kicks, 0) > 40
      or coalesce(total_throws, 0) < 0 or coalesce(total_throws, 0) > 60
  )
order by source_match_id, source_player_id;

-- 8) Gol tipi alanlarında mantık dışı değer kontrolü
select
    source_match_id,
    source_player_id,
    player_name,
    out_of_box_goals,
    right_foot_goals,
    left_foot_goals,
    headed_goals,
    penalty_goals,
    freekick_goals,
    fantasy_assist
from football.match_player_stats_details
where source = 'opta'
  and (
      coalesce(out_of_box_goals, 0) < 0 or coalesce(out_of_box_goals, 0) > 10
      or coalesce(right_foot_goals, 0) < 0 or coalesce(right_foot_goals, 0) > 10
      or coalesce(left_foot_goals, 0) < 0 or coalesce(left_foot_goals, 0) > 10
      or coalesce(headed_goals, 0) < 0 or coalesce(headed_goals, 0) > 10
      or coalesce(penalty_goals, 0) < 0 or coalesce(penalty_goals, 0) > 10
      or coalesce(freekick_goals, 0) < 0 or coalesce(freekick_goals, 0) > 10
      or coalesce(fantasy_assist, 0) < 0 or coalesce(fantasy_assist, 0) > 10
  )
order by source_match_id, source_player_id;

-- 9) Son 20 kayıt hızlı göz kontrolü
select
    source_match_id,
    source_team_id,
    team_name,
    source_player_id,
    player_name,
    player_side,
    lineup_status,
    position_code,
    accurate_pass,
    expected_goals,
    attempts_ibox,
    attempts_obox,
    headed_goals,
    penalty_goals,
    fantasy_assist,
    updated_at
from football.match_player_stats_details
where source = 'opta'
order by updated_at desc, source_match_id desc
limit 20;
