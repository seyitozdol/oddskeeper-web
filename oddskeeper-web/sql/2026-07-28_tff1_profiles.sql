-- TFF 1. Lig profil katmani: mac listesi, oyuncu bio, piyasa degeri view'lari.
-- Tablolar: football.sofascore_player_info + football.tff1_player_market_values
--   (fetch_transfermarkt_values_tff1.py olusturur/doldurur; TM TR2+TR1 kadrolari,
--    dogum tarihi + isim eslesmesi).
-- Ayrica tff1_player_season_stats_v1'e fs_position kolonu eklendi
-- (sql/2026-07-27_tff1_sofascore_views.sql guncellendi, mat'lar yeniden kuruldu).
-- Uygulandi: 2026-07-28

create or replace view analytics.tff1_matches_v1 as
select
  season_label,
  source_match_id                         as match_id,
  competition,
  match_datetime,
  home_team_source_id                     as home_team_id,
  home_team_name,
  away_team_source_id                     as away_team_id,
  away_team_name,
  home_score,
  away_score
from football.matches
where source = 'sofascore';

create or replace view analytics.tff1_player_info_v1 as
select
  sofascore_player_id                     as player_id,
  player_name,
  player_slug,
  birth_date,
  height_cm,
  country,
  position
from football.sofascore_player_info;

create or replace view analytics.tff1_player_market_value_v1 as
select
  sofascore_player_id                     as player_id,
  tm_player_id,
  tm_player_name,
  market_value_eur,
  tm_club,
  fetched_at
from football.tff1_player_market_values;

grant select on analytics.tff1_matches_v1 to anon, authenticated, service_role;
grant select on analytics.tff1_player_info_v1 to anon, authenticated, service_role;
grant select on analytics.tff1_player_market_value_v1 to anon, authenticated, service_role;
