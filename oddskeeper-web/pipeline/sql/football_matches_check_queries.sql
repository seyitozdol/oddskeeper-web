-- football.matches kontrol SQL seti
-- Amaç: loader sonrası tabloyu hızlı ve sistematik şekilde doğrulamak

-- ============================================================
-- 1) Toplam satır / unique maç sayısı
-- Beklenti:
-- total_rows = unique_match_ids
-- ============================================================
select
  count(*) as total_rows,
  count(distinct source_match_id) as unique_match_ids
from football.matches
where source = 'opta';


-- ============================================================
-- 2) Duplicate kontrolü
-- Beklenti:
-- 0 satır dönmeli
-- ============================================================
select
  source,
  source_match_id,
  count(*) as row_count
from football.matches
where source = 'opta'
group by source, source_match_id
having count(*) > 1;


-- ============================================================
-- 3) Zorunlu alan null kontrolü
-- Beklenti:
-- null_count = 0
-- ============================================================
select 'source' as field_name, count(*) as null_count
from football.matches
where source = 'opta' and source is null

union all
select 'source_match_id', count(*)
from football.matches
where source = 'opta' and source_match_id is null

union all
select 'home_team_source_id', count(*)
from football.matches
where source = 'opta' and home_team_source_id is null

union all
select 'away_team_source_id', count(*)
from football.matches
where source = 'opta' and away_team_source_id is null

union all
select 'home_team_name', count(*)
from football.matches
where source = 'opta' and home_team_name is null

union all
select 'away_team_name', count(*)
from football.matches
where source = 'opta' and away_team_name is null;


-- ============================================================
-- 4) Staging ile row coverage karşılaştırması
-- Beklenti:
-- staging_unique = matches_unique
-- ============================================================
select
  (select count(distinct source_match_id)
   from raw.match_json_staging
   where source = 'opta') as staging_unique,
  (select count(distinct source_match_id)
   from football.matches
   where source = 'opta') as matches_unique;


-- ============================================================
-- 5) Staging'de olup football.matches'de olmayan kayıt var mı?
-- Beklenti:
-- 0 satır dönmeli
-- ============================================================
select
  s.source_match_id
from raw.match_json_staging s
left join football.matches m
  on m.source = s.source
 and m.source_match_id = s.source_match_id
where s.source = 'opta'
  and m.source_match_id is null
order by s.source_match_id;


-- ============================================================
-- 6) football.matches'de olup staging'de olmayan kayıt var mı?
-- Beklenti:
-- 0 satır dönmeli
-- ============================================================
select
  m.source_match_id
from football.matches m
left join raw.match_json_staging s
  on s.source = m.source
 and s.source_match_id = m.source_match_id
where m.source = 'opta'
  and s.source_match_id is null
order by m.source_match_id;


-- ============================================================
-- 7) Şüpheli skor kayıtları
-- Not:
-- Çok yüksek skor illa hata değildir ama hızlı göz kontrolü için yararlı
-- ============================================================
select
  source_match_id,
  match_date_text,
  home_team_name,
  away_team_name,
  home_score,
  away_score
from football.matches
where source = 'opta'
  and (
    home_score is null
    or away_score is null
    or home_score < 0
    or away_score < 0
    or home_score > 15
    or away_score > 15
  )
order by match_datetime nulls last, source_match_id;


-- ============================================================
-- 8) Kazanan taraf tutarlılık kontrolü
-- Beklenti:
-- Şüpheli kayıt çıkmamalı
-- ============================================================
select
  source_match_id,
  home_team_name,
  away_team_name,
  home_score,
  away_score,
  winner_side,
  winner_team_source_id
from football.matches
where source = 'opta'
  and (
    (home_score > away_score and winner_side <> 'home')
    or (away_score > home_score and winner_side <> 'away')
    or (home_score = away_score and winner_side is not null)
  )
order by match_datetime nulls last, source_match_id;


-- ============================================================
-- 9) Son 20 kayıt quick view
-- ============================================================
select
  source_match_id,
  match_datetime,
  competition,
  home_team_name,
  away_team_name,
  home_score,
  away_score,
  winner_side,
  venue,
  attendance,
  referee,
  updated_at
from football.matches
where source = 'opta'
order by match_datetime desc nulls last, updated_at desc
limit 20;
