-- 2026-07-29: tff1_matches_v1 competition filtresi.
-- Sorun: view source='sofascore' TUM maclari iceriyordu; TSL SofaScore maclari
-- (Super Lig 24/25 + 25/26) yuklendiginde TFF1 mac listesine sizdi.
-- Cozum: Trendyol 1. Lig + Play-off filtresi.

create or replace view analytics.tff1_matches_v1 as
select
    season_label,
    source_match_id as match_id,
    competition,
    match_datetime,
    home_team_source_id as home_team_id,
    home_team_name,
    away_team_source_id as away_team_id,
    away_team_name,
    home_score,
    away_score
from football.matches
where source = 'sofascore'
  and competition in ('Trendyol 1. Lig', 'Trendyol 1. Lig Play-off');
