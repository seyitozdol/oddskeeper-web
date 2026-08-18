-- 2026-08-18 Faz 4: Avrupa kupasi asama (round) verisi. football.matches'e
-- round_number/round_name eklendi (roundInfo backfill); bu view uc kupayi kapsar,
-- frontend asama seciciyi (on eleme/play-off/lig fazi/braket) ve lig-fazi puan
-- tablosunu besler. Not: football.matches ALTER (round_number int, round_name text)
-- + match_row loader guncellemesi ayrica yapildi.

create or replace view analytics.eurocup_stage_matches_v1 as
select
  m.source_match_id           as match_id,
  m.competition,
  m.season_label,
  m.match_datetime,
  m.home_team_source_id       as home_team_id,
  m.home_team_name,
  m.away_team_source_id       as away_team_id,
  m.away_team_name,
  m.home_score,
  m.away_score,
  m.round_number,
  m.round_name,
  m.winner_team_source_id
from football.matches m
where m.source='sofascore'
  and m.competition in ('UEFA Şampiyonlar Ligi','UEFA Avrupa Ligi','UEFA Konferans Ligi');
grant select on analytics.eurocup_stage_matches_v1 to anon, authenticated;
