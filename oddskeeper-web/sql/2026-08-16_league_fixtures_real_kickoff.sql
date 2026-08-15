-- league_fixtures_v1: gercek SofaScore kickoff tarih+saatini bagla.
--
-- Sorun: TSL fixture view'i apifootball satirlarini kullanir (frontend kadro
-- lookup'i apifootball team id uzayi bekler), ama apifootball fixture_datetime
-- PLACEHOLDER (tum sezon 17:00/18:00) VE tarih de nominal/yanlis (round Cuma-Pzt'ye
-- yayilirken hepsi tek gune yaziliyor). Gercek tarih+saat SofaScore satirlarinda.
--
-- Cozum: apifootball fixture'i sofascore fixture'ina (ayni competition+season+round
-- + KANONIK takim slug'i; sofascore slug'i ref.team_mapping ile kanoniklestirilir)
-- LEFT JOIN edip fixture_datetime/fixture_date'i sofascore'dan COALESCE et. Takim
-- id/isim/slug apifootball'da kalir (kadro lookup bozulmaz). Eslesme yoksa
-- (sofascore fikstürü olmayan lig/mac) apifootball degeri korunur.
-- Join TSL 26/27'de 18/18 dogrulandi.

create or replace view analytics.league_fixtures_v1 as
with sofa_time as (
  select distinct on (f.competition, f.season_label, f.round_number, tmh.team_slug, tma.team_slug)
         f.competition, f.season_label, f.round_number,
         tmh.team_slug as home_slug, tma.team_slug as away_slug,
         f.fixture_datetime
  from football.fixtures f
  join ref.team_mapping tmh on tmh.source_team_id = f.home_team_source_id
  join ref.team_mapping tma on tma.source_team_id = f.away_team_source_id
  where f.source = 'sofascore' and f.fixture_datetime is not null
  order by f.competition, f.season_label, f.round_number, tmh.team_slug, tma.team_slug, f.fixture_datetime
),
open_fixtures as (
  select f.fixture_id,
         f.competition,
         f.season_label,
         f.round_number,
         coalesce(s.fixture_datetime::date, f.fixture_date) as fixture_date,
         coalesce(s.fixture_datetime, f.fixture_datetime)   as fixture_datetime,
         (f.kickoff_time_known or s.fixture_datetime is not null) as kickoff_time_known,
         f.kickoff_time_text,
         f.fixture_status,
         f.venue,
         f.home_team_slug,
         f.home_team_source_id,
         f.home_team_name,
         f.away_team_slug,
         f.away_team_source_id,
         f.away_team_name
  from football.fixtures f
  left join sofa_time s
    on s.competition  = f.competition
   and s.season_label = f.season_label
   and s.round_number = f.round_number
   and s.home_slug    = f.home_team_slug
   and s.away_slug    = f.away_team_slug
  where coalesce(lower(f.fixture_status), 'scheduled') = any (array['scheduled','postponed','cancelled'])
    and f.source is distinct from 'sofascore'
    and not (exists (
      select 1 from football.matches m
      where m.home_team_source_id = f.home_team_source_id
        and m.away_team_source_id = f.away_team_source_id
        and m.match_datetime is not null
        and m.match_datetime::date = f.fixture_date))
)
select fixture_id, competition, season_label, round_number, fixture_date, fixture_datetime,
       kickoff_time_known, kickoff_time_text, fixture_status, venue,
       home_team_slug, home_team_source_id, home_team_name,
       away_team_slug, away_team_source_id, away_team_name
from open_fixtures f;
