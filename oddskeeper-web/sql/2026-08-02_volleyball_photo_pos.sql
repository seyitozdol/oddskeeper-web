-- Kolon + fonksiyon (inline uygulanmisti; kayit icin burada da):
alter table volleyball.players add column if not exists vbw_photo text;
create or replace function volleyball.norm_pos(p text) returns text language sql immutable as $$
  select case lower(coalesce(trim(p), ''))
    when 'libero' then 'L' when 'l' then 'L'
    when 'outside hitter' then 'OH' when 'outside spiker' then 'OH' when 'oh' then 'OH'
    when 'middle blocker' then 'MB' when 'mb' then 'MB'
    when 'setter' then 'S' when 's' then 'S'
    when 'opposite spiker' then 'OP' when 'opposite' then 'OP' when 'op' then 'OP' when 'o' then 'OP'
    when '' then null
    else upper(p) end
$$;

-- volleyballworld oyuncu fotografi (vbw_photo cloudinary id) + pozisyon tekillestirme.
-- Foto URL: https://images.volleyballworld.com/image/upload/t_editorial_squared_6_desktop/f_auto/fivb-prd/{vbw_photo}.webp
-- (yalniz t_editorial_squared_6_desktop named transform calisiyor). Pozisyon: volleyball.norm_pos
-- her varyanti (L/Libero, O/Opposite spiker ...) kanonik kisa koda ceviriр (L/OH/MB/S/OP).

-- Leaderboard: position normalize + vbw_photo ekle (sonuna).
create or replace view analytics.vb_player_leaderboard_v1 as
select
  s.competition_id,
  s.fivb_id,
  p.short_name,
  p.full_name,
  s.team_code,
  volleyball.norm_pos(coalesce(r.position, p.position)) as position,
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
  s.rec_successful, s.rec_success, s.rec_rank,
  p.vbw_photo
from volleyball.player_competition_stats s
join volleyball.players p on p.fivb_id = s.fivb_id
left join volleyball.roster r
  on r.competition_id = s.competition_id and r.fivb_id = s.fivb_id;

-- Profil bio: vbw_photo ekle (sonuna). position tam etiket kalir (profil sayfasi).
create or replace view analytics.vb_player_v1 as
select fivb_id, full_name, short_name, position, birth_date, height_cm, nationality,
       sofascore_player_id, vbw_photo
from volleyball.players;

-- Tools oyuncu listesi: pozisyonu normalize et + vbw_photo (kolon sirasi degisti -> drop).
drop view if exists analytics.vb_pm_player_list_v1;
create view analytics.vb_pm_player_list_v1 as
select
  p.fivb_id,
  p.full_name,
  p.short_name,
  volleyball.norm_pos(p.position) as position,
  p.sofascore_player_id,
  p.vbw_photo,
  count(distinct pm.match_date) as games
from volleyball.players p
join volleyball.roster r on r.fivb_id = p.fivb_id and r.team_code = 'TUR'
left join analytics.vb_pm_player_match_v1 pm on pm.fivb_id = p.fivb_id
group by 1,2,3,4,5,6;

grant select on analytics.vb_player_leaderboard_v1, analytics.vb_player_v1,
                analytics.vb_pm_player_list_v1 to anon, authenticated;
