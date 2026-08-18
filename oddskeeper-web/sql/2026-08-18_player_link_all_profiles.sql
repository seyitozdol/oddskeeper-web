-- 2026-08-18: Tek-profil Faz 3 — sofascore oyuncu id -> football profil slug
-- cozucusu ARTIK TUM oyunculari kapsar. Faz 2b sonrasi kupa-only oyuncular da
-- profil aldigi icin eski "synthetic haric" dislamasi (yalniz dual) gereksizdi;
-- kupa yuzeylerindeki her oyuncu linki bu view ile TEK football profiline gider.
create or replace view analytics.sofascore_football_player_link_v1 as
select distinct
  m.sofascore_player_id,
  b.player_slug,
  b.player_name
from ref.sofascore_opta_player_map m
join analytics.player_profile_bridged_v1 b
  on b.player_source_id = m.opta_player_id
where b.player_slug is not null;
-- grant zaten var (anon, authenticated); create or replace korur.
