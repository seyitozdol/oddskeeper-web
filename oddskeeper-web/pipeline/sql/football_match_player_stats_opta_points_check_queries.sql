-- 1) toplam satır ve unique composite key kontrolü
select
  count(*) as total_rows,
  count(distinct concat_ws('||', source, source_match_id, source_player_id)) as unique_rows
from football.match_player_stats_opta_points
where source = 'opta';

-- 2) duplicate composite key kontrolü
select
  source,
  source_match_id,
  source_player_id,
  count(*) as row_count
from football.match_player_stats_opta_points
where source = 'opta'
group by source, source_match_id, source_player_id
having count(*) > 1
order by row_count desc, source_match_id, source_player_id;

-- 3) zorunlu alan null kontrolü
select 'source' as field_name, count(*) as null_count
from football.match_player_stats_opta_points
where source = 'opta' and source is null

union all
select 'source_match_id', count(*)
from football.match_player_stats_opta_points
where source = 'opta' and source_match_id is null

union all
select 'source_team_id', count(*)
from football.match_player_stats_opta_points
where source = 'opta' and source_team_id is null

union all
select 'team_name', count(*)
from football.match_player_stats_opta_points
where source = 'opta' and team_name is null

union all
select 'source_player_id', count(*)
from football.match_player_stats_opta_points
where source = 'opta' and source_player_id is null

union all
select 'player_name', count(*)
from football.match_player_stats_opta_points
where source = 'opta' and player_name is null;

-- 4) staging extraction count vs target unique count
with staging_rows as (
    select distinct
        s.source,
        s.source_match_id,
        row_item ->> 'source_player_id' as source_player_id
    from raw.match_json_staging s
    cross join lateral jsonb_array_elements(s.payload -> 'opta_points_stats' -> 'stats_sections') as sec(section_item)
    cross join lateral jsonb_array_elements(coalesce(sec.section_item -> 'table' -> 'rows', '[]'::jsonb)) as row_item
    where s.source = 'opta'
      and coalesce(sec.section_item ->> 'team_source_id', '') <> ''
      and coalesce(row_item ->> 'source_player_id', '') <> ''
),
target_rows as (
    select distinct source, source_match_id, source_player_id
    from football.match_player_stats_opta_points
    where source = 'opta'
)
select
  (select count(*) from staging_rows) as staging_unique_rows,
  (select count(*) from target_rows) as target_unique_rows;

-- 5) staging'de olup target'ta olmayan kayıt var mı
with staging_rows as (
    select distinct
        s.source,
        s.source_match_id,
        row_item ->> 'source_player_id' as source_player_id
    from raw.match_json_staging s
    cross join lateral jsonb_array_elements(s.payload -> 'opta_points_stats' -> 'stats_sections') as sec(section_item)
    cross join lateral jsonb_array_elements(coalesce(sec.section_item -> 'table' -> 'rows', '[]'::jsonb)) as row_item
    where s.source = 'opta'
      and coalesce(sec.section_item ->> 'team_source_id', '') <> ''
      and coalesce(row_item ->> 'source_player_id', '') <> ''
)
select
    sr.source,
    sr.source_match_id,
    sr.source_player_id
from staging_rows sr
left join football.match_player_stats_opta_points t
  on t.source = sr.source
 and t.source_match_id = sr.source_match_id
 and t.source_player_id = sr.source_player_id
where t.source_player_id is null
order by sr.source_match_id, sr.source_player_id;

-- 6) target'ta olup staging'de olmayan kayıt var mı
with staging_rows as (
    select distinct
        s.source,
        s.source_match_id,
        row_item ->> 'source_player_id' as source_player_id
    from raw.match_json_staging s
    cross join lateral jsonb_array_elements(s.payload -> 'opta_points_stats' -> 'stats_sections') as sec(section_item)
    cross join lateral jsonb_array_elements(coalesce(sec.section_item -> 'table' -> 'rows', '[]'::jsonb)) as row_item
    where s.source = 'opta'
      and coalesce(sec.section_item ->> 'team_source_id', '') <> ''
      and coalesce(row_item ->> 'source_player_id', '') <> ''
)
select
    t.source,
    t.source_match_id,
    t.source_player_id
from football.match_player_stats_opta_points t
left join staging_rows sr
  on sr.source = t.source
 and sr.source_match_id = t.source_match_id
 and sr.source_player_id = t.source_player_id
where t.source = 'opta'
  and sr.source_player_id is null
order by t.source_match_id, t.source_player_id;

-- 7) anormal minutes kontrolü
select
  source_match_id,
  source_player_id,
  player_name,
  minutes_played,
  lineup_status,
  position_code
from football.match_player_stats_opta_points
where source = 'opta'
  and (
    minutes_played is null
    or minutes_played < 0
    or minutes_played > 130
  )
order by source_match_id, source_player_id;

-- 8) anormal cards / goals gibi basit range kontrolleri
select
  source_match_id,
  source_player_id,
  player_name,
  goals,
  assists,
  cards_yellow,
  cards_red,
  points
from football.match_player_stats_opta_points
where source = 'opta'
  and (
    coalesce(goals, 0) < 0 or coalesce(goals, 0) > 10
    or coalesce(assists, 0) < 0 or coalesce(assists, 0) > 10
    or coalesce(cards_yellow, 0) < 0 or coalesce(cards_yellow, 0) > 2
    or coalesce(cards_red, 0) < 0 or coalesce(cards_red, 0) > 1
  )
order by source_match_id, source_player_id;

-- 9) örnek veri görüntüleme
select
  source_match_id,
  source_team_id,
  team_name,
  source_player_id,
  player_name,
  player_side,
  lineup_status,
  position_code,
  team_rank,
  points,
  minutes_played,
  goals,
  assists,
  shots_on_target,
  passes,
  tackles,
  updated_at
from football.match_player_stats_opta_points
where source = 'opta'
order by source_match_id desc, team_name, team_rank nulls last, player_name
limit 50;
