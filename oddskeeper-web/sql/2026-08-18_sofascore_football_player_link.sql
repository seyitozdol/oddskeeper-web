-- 2026-08-18: SofaScore oyuncu id -> Super Lig (football) oyuncu profili koprusu.
-- Avrupa kupasi oyuncu profili (sofascore-keyed) ile Super Lig profili (opta-keyed)
-- capraz-lig toggle'i icin. Zincir: cup sofascore_player_id -> ref.sofascore_opta_
-- player_map (opta) -> analytics.player_profile_bridged_v1 (player_source_id=opta)
-- -> player_slug -> football detail href. Frontend ref semasina erismesin diye
-- analytics view olarak sunulur. (Not: map Super Lig maclarindan uretilir -> yalniz
-- Super Lig de oynayan oyunculari kapsar; kupa-only yabancilar dogal olarak yok.)
create or replace view analytics.sofascore_football_player_link_v1 as
select distinct
  m.sofascore_player_id,
  b.player_slug,
  b.player_name
from ref.sofascore_opta_player_map m
join analytics.player_profile_bridged_v1 b
  on b.player_source_id = m.opta_player_id
where b.player_slug is not null
  and m.match_method <> 'synthetic';  -- sentetik = Super Lig profili YOK
grant select on analytics.sofascore_football_player_link_v1 to anon, authenticated;
