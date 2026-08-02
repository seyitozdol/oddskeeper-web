-- Voleybol frontend erisim katmani: analytics.vb_* view'lari (basketbol bb_* kalibi).
-- PostgREST sadece expose edilmis semalari (public/analytics) gorur; ham volleyball.*
-- semasi expose degil -> anon/authenticated bu view'lardan okur. View'lar owner (postgres)
-- yetkisiyle volleyball.* tablolarina erisir (security_invoker default off).

-- Turnuva listesi (sag-ust toggle). year desc + slug ile siralama; newest solda.
create or replace view analytics.vb_competitions_v1 as
select
  c.id as competition_id,
  c.comp_slug,
  c.year,
  c.gender,
  c.name,
  case c.comp_slug
    when 'volleyball-nations-league' then 'VNL ' || c.year
    when 'women-world-championship' then 'Dünya Ş. ' || c.year
    when 'volleyball-olympic-games-paris-2024' then 'Olimpiyat ' || c.year
    else c.name
  end as short_label,
  -- toggle sirasi: yeni yil once, ayni yilda VNL > Dunya S. > Olimpiyat
  (c.year * 10 + case c.comp_slug
     when 'volleyball-nations-league' then 3
     when 'women-world-championship' then 2
     else 1 end) as sort_key
from volleyball.competitions c;

-- Players sekmesi: turnuva-oyuncu leaderboard (bio + 7 kategori ozet + roster).
create or replace view analytics.vb_player_leaderboard_v1 as
select
  s.competition_id,
  s.fivb_id,
  p.short_name,
  p.full_name,
  s.team_code,
  coalesce(r.position, p.position) as position,
  r.shirt_number,
  p.nationality,
  p.height_cm,
  p.birth_date,
  -- scoring
  s.points, s.attack_points, s.block_points, s.serve_points, s.scorer_rank,
  -- kategori ozetleri (leaderboard kolonlari)
  s.atk_total, s.atk_success, s.atk_rank,
  s.blk_blocks, s.blk_eff, s.blk_rank,
  s.srv_points as srv_aces, s.srv_success, s.srv_rank,
  s.set_successful, s.set_rank,
  s.dig_digs, s.dig_rank,
  s.rec_successful, s.rec_success, s.rec_rank
from volleyball.player_competition_stats s
join volleyball.players p on p.fivb_id = s.fivb_id
left join volleyball.roster r
  on r.competition_id = s.competition_id and r.fivb_id = s.fivb_id;

-- Oyuncu profili: bio (tek satir, kalici).
create or replace view analytics.vb_player_v1 as
select fivb_id, full_name, short_name, position, birth_date, height_cm, nationality
from volleyball.players;

-- Oyuncu profili: mac-mac kirilim (kategori basina jsonb).
create or replace view analytics.vb_player_match_v1 as
select competition_id, fivb_id, match_date, home_team, away_team, category, data
from volleyball.player_match_stats;

-- Kadro (bir turnuvadaki takim + oyuncular).
create or replace view analytics.vb_roster_v1 as
select
  r.competition_id, r.team_code, t.team_name, r.fivb_id,
  p.short_name, p.full_name, r.shirt_number,
  coalesce(r.position, p.position) as position,
  p.height_cm, p.birth_date, p.nationality
from volleyball.roster r
join volleyball.players p on p.fivb_id = r.fivb_id
left join volleyball.teams t on t.competition_id = r.competition_id and t.team_code = r.team_code;

-- Turnuvada oynanan maclar (Results icin turetme; skor/set YOK, sadece tarih+takimlar).
-- NOT: skor/set scrape'i sonra (schedule sayfalari); simdilik oyuncu-mac verisinden distinct.
create or replace view analytics.vb_matches_v1 as
select distinct competition_id, match_date, home_team, away_team
from volleyball.player_match_stats
where match_date is not null;

grant select on analytics.vb_competitions_v1,
                analytics.vb_player_leaderboard_v1,
                analytics.vb_player_v1,
                analytics.vb_player_match_v1,
                analytics.vb_roster_v1,
                analytics.vb_matches_v1
  to anon, authenticated;
