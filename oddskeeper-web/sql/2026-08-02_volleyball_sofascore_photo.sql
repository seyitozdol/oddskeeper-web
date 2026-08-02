-- Voleybol oyuncu profil fotografi: SofaScore player id -> img.sofascore.com/api/v1/player/{id}/image.
-- Eslesme tarayici same-origin search API'siyle (team.sport.slug='volleyball' filtresi + isim skoru).
-- SofaScore voleybol indeksi sinirli: guncel Turkiye milli takim cekirdegi (15 oyuncu) var, kalani yok.

alter table volleyball.players add column if not exists sofascore_player_id int;

update volleyball.players p set sofascore_player_id = v.sid
from (values
  (137087, 2261617),  -- Asli Kalac
  (143590, 2261621),  -- Cansu Özbay
  (163094, 2261609),  -- Derya Cebecioglu
  (163982, 2261616),  -- Ebrar Karakurt
  (138782, 2261612),  -- Eda Erdem Dündar
  (163975, 2261620),  -- Elif Şahin
  (163116, 2261614),  -- Eylül Akarçeşme
  (138773, 2261619),  -- Gizem Örge
  (143585, 2261610),  -- Hande Baladin
  (163089, 2261622),  -- İlkin Aydin
  (143339, 2261615),  -- Melissa Teresa Vargas
  (122646, 2261613),  -- Sinead Jack
  (152254, 2150278),  -- Tutku Burcu Yüzgenç
  (163091, 2261618),  -- Yaprak Erkek
  (152263, 2261611)   -- Zehra Güneş
) as v(fivb_id, sid)
where p.fivb_id = v.fivb_id;

-- Bio view'ina sofascore_player_id ekle (sonuna).
create or replace view analytics.vb_player_v1 as
select fivb_id, full_name, short_name, position, birth_date, height_cm, nationality,
       sofascore_player_id
from volleyball.players;

-- Leaderboard view: sofascore_player_id ekle (kolon sirasi degistigi icin DROP+CREATE).
drop view if exists analytics.vb_player_leaderboard_v1;
create view analytics.vb_player_leaderboard_v1 as
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
  p.sofascore_player_id,
  s.points, s.attack_points, s.block_points, s.serve_points, s.scorer_rank,
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

grant select on analytics.vb_player_leaderboard_v1, analytics.vb_player_v1 to anon, authenticated;
