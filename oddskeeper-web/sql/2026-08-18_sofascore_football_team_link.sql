-- 2026-08-18: SofaScore takim id -> Super Lig (football) takim profili koprusu.
-- Avrupa kupasi takim profili (sofascore-keyed) ile Super Lig takim profili (slug)
-- capraz-lig toggle'i icin. cup sofascore_team_id -> ref.team_mapping (source_team_id,
-- is_active) -> team_slug -> football team-stats detail. Frontend ref semasina
-- erismesin diye analytics view. (team_mapping Turk-ligi merkezli -> yalniz Super
-- Lig'de de oynayan (GS/FB gibi) kupa takimlari eslesir; yabanci takimlar dogal
-- olarak yok.)
create or replace view analytics.sofascore_football_team_link_v1 as
select distinct
  tm.source_team_id as sofascore_team_id,
  tm.team_slug,
  tm.display_name
from ref.team_mapping tm
where tm.team_slug is not null
  and tm.is_active
  and tm.source_team_id is not null;
grant select on analytics.sofascore_football_team_link_v1 to anon, authenticated;
