-- Kupa profil sayfalari (Faz 3-4) icin ek view'lar.
-- Gorseller: Mackolik CDN (api.mackolikfeeds.com/soccer/images/{teams|players}/150x150/{uuid}.png)
-- uuid ile, alt lig/amator dahil hepsini kapsar (frontend'de URL kurulur).

-- cup_matches_v1'e takim uuid'leri eklendi (logo icin). DROP + CREATE (kolon sirasi).
drop view if exists analytics.cup_matches_v1;
create view analytics.cup_matches_v1 as
select
    m.season_name as season_label, m.match_uuid as match_id, m.competition_name as competition,
    m.match_datetime, m.season_id, m.round_id, m.round_name, m.status,
    m.team_a_id as home_team_id, coalesce(ta.team_name, m.team_a_name) as home_team_name,
    ta.team_slug as home_team_slug, ta.team_uuid as home_team_uuid,
    m.team_b_id as away_team_id, coalesce(tb.team_name, m.team_b_name) as away_team_name,
    tb.team_slug as away_team_slug, tb.team_uuid as away_team_uuid,
    m.score_a as home_score, m.score_b as away_score, m.round_winner_id
from football.mackolik_matches m
left join analytics.cup_team_meta_v1 ta on ta.team_id = m.team_a_id
left join analytics.cup_team_meta_v1 tb on tb.team_id = m.team_b_id;

-- Mac basina takim istatistigi (frontend football semasini okuyamaz -> analytics view).
create or replace view analytics.cup_match_stats_v1 as
select match_uuid, stat_type, value_a, value_b from football.mackolik_team_stats;

-- Oyuncu dizilis satirlari (raw lineup'tan): oyuncu-mac + reyting + bio.
create or replace view analytics.cup_player_lineup_v1 as
select
  m.season_name as season_label, m.match_uuid, m.round_name, m.match_datetime,
  s.team_id,
  (p->'player'->>'id')::bigint as player_id,
  p->'player'->>'uuid' as player_uuid,
  p->'player'->>'name' as player_name,
  nullif(p->'player'->>'height','')::int as height,
  p->'player'->>'birth_date' as birth_date,
  nullif(p->'player'->>'nationality_id','')::int as nationality_id,
  nullif(p->>'rating','')::numeric as rating,
  p->'position'->>0 as position
from football.mackolik_matches m
cross join lateral (values
   (m.team_a_id, m.raw#>'{lineup,team_A,players}'),
   (m.team_b_id, m.raw#>'{lineup,team_B,players}')
) as s(team_id, players)
cross join lateral jsonb_array_elements(coalesce(s.players, '[]'::jsonb)) as p
where m.raw is not null and (p->'player'->>'id') is not null;

-- Oyuncu sezon-ozeti: mac sayisi + ort reyting + bio + ana takim/pozisyon.
create or replace view analytics.cup_player_stats_v1 as
select
  player_id,
  max(player_uuid) as player_uuid,
  max(player_name) as player_name,
  max(height) as height,
  max(birth_date) as birth_date,
  max(nationality_id) as nationality_id,
  season_label,
  count(distinct match_uuid) as apps,
  round(avg(rating),2) as avg_rating,
  mode() within group (order by team_id) as main_team_id,
  mode() within group (order by position) as main_position
from analytics.cup_player_lineup_v1
group by player_id, season_label;

grant select on
    analytics.cup_matches_v1, analytics.cup_match_stats_v1,
    analytics.cup_player_lineup_v1, analytics.cup_player_stats_v1
to anon, authenticated;
