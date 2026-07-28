-- TFF 1. Lig sayfa donusumu icin medya katmani (2026-07-28)
-- Kaynak: FlashScore statik gorselleri (extract_flashscore_images_tff1.py doldurur):
--   ref.sofascore_team_logos (23/27 takim; 4 eski takimda logo yok, UI harf rozeti)
--   football.sofascore_player_info.photo_url (663 oyuncu)

alter table football.sofascore_player_info add column if not exists photo_url text;

create or replace view analytics.tff1_player_info_v1 as
select
  sofascore_player_id                     as player_id,
  player_name,
  player_slug,
  birth_date,
  height_cm,
  country,
  position,
  photo_url
from football.sofascore_player_info;

create or replace view analytics.tff1_team_logos_v1 as
select
  sofascore_team_id                       as team_id,
  team_name,
  logo_url
from ref.sofascore_team_logos;

grant select on analytics.tff1_player_info_v1 to anon, authenticated, service_role;
grant select on analytics.tff1_team_logos_v1 to anon, authenticated, service_role;
