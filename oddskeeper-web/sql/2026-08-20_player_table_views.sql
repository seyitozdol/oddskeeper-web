-- C-1 Faz 2-3 (2026-08-20): Players yuzeyleri sayfa-sekilli okusun.
--
-- SORUN: eurocup + tff1 Players/Rankings her SSR'da foto/ulke icin
-- tff1_player_info_v1'in TAMAMINI (10.979 satir, 11 istek) ve eurocup'ta ayrica
-- slug icin sofascore_football_player_link_v1'in tamamini (9.983 satir, 10 istek)
-- cekip JS'te map kuruyordu. COZUM: foto/ulke/slug istatistik view'ina DB'de
-- join'lenir (olculdu: sezon filtresiyle 31 ms, mat GEREKMEZ); loader tek
-- kaynaktan okur.
--
-- ucl/uel/uecl_player_season_stats_v1: CREATE OR REPLACE ile SONA 3 kolon
-- eklenir (photo_url, country, player_slug) -- kolon ekleme OR REPLACE'te
-- serbesttir, mevcut kolon sozlesmesi degismez, grant'lar korunur.
-- tff1 icin yeni ince view: tff1_player_table_v1 (mat + info; slug tff1'de
-- bugun de null'du, eklenmedi).

-- analytics.ucl_player_season_stats_v1: foto/ulke/slug SONA eklendi (join anahtar: player_id = sofascore id)
create or replace view analytics.ucl_player_season_stats_v1 as
select base.*, i.photo_url, i.country, l.player_slug
from ( SELECT season_label,
    player_id,
    player_name,
    team_name,
    team_id,
    teams,
    position_code,
    appearances,
    starts,
    minutes,
    goals,
    assists,
    own_goals,
    shots,
    shots_on_target,
    big_chances_missed,
    hit_woodwork,
    total_passes,
    accurate_passes,
    pass_accuracy,
    key_passes,
    big_chances_created,
    crosses,
    accurate_crosses,
    long_balls,
    accurate_long_balls,
    tackles,
    tackles_won,
    interceptions,
    clearances,
    blocks,
    ball_recoveries,
    duels_won,
    duels_lost,
    aerials_won,
    aerials_lost,
    fouls,
    was_fouled,
    offsides,
    dispossessed,
    possession_lost,
    dribbles_won,
    dribbles_attempted,
    touches,
    saves,
    penalties_saved,
    errors_leading_to_shot,
    errors_leading_to_goal,
    rating_avg,
    km_covered,
    sprints,
    top_speed,
    xg,
    xgot,
    xa,
    yellow_cards,
    red_cards,
    fs_position
   FROM analytics.ucl_player_season_stats_mat) base
left join football.sofascore_player_info i on i.sofascore_player_id = base.player_id
left join analytics.sofascore_football_player_link_v1 l on l.sofascore_player_id = base.player_id;

-- analytics.uel_player_season_stats_v1: foto/ulke/slug SONA eklendi (join anahtar: player_id = sofascore id)
create or replace view analytics.uel_player_season_stats_v1 as
select base.*, i.photo_url, i.country, l.player_slug
from ( SELECT season_label,
    player_id,
    player_name,
    team_name,
    team_id,
    teams,
    position_code,
    appearances,
    starts,
    minutes,
    goals,
    assists,
    own_goals,
    shots,
    shots_on_target,
    big_chances_missed,
    hit_woodwork,
    total_passes,
    accurate_passes,
    pass_accuracy,
    key_passes,
    big_chances_created,
    crosses,
    accurate_crosses,
    long_balls,
    accurate_long_balls,
    tackles,
    tackles_won,
    interceptions,
    clearances,
    blocks,
    ball_recoveries,
    duels_won,
    duels_lost,
    aerials_won,
    aerials_lost,
    fouls,
    was_fouled,
    offsides,
    dispossessed,
    possession_lost,
    dribbles_won,
    dribbles_attempted,
    touches,
    saves,
    penalties_saved,
    errors_leading_to_shot,
    errors_leading_to_goal,
    rating_avg,
    km_covered,
    sprints,
    top_speed,
    xg,
    xgot,
    xa,
    yellow_cards,
    red_cards,
    fs_position
   FROM analytics.uel_player_season_stats_mat) base
left join football.sofascore_player_info i on i.sofascore_player_id = base.player_id
left join analytics.sofascore_football_player_link_v1 l on l.sofascore_player_id = base.player_id;

-- analytics.uecl_player_season_stats_v1: foto/ulke/slug SONA eklendi (join anahtar: player_id = sofascore id)
create or replace view analytics.uecl_player_season_stats_v1 as
select base.*, i.photo_url, i.country, l.player_slug
from ( SELECT season_label,
    player_id,
    player_name,
    team_name,
    team_id,
    teams,
    position_code,
    appearances,
    starts,
    minutes,
    goals,
    assists,
    own_goals,
    shots,
    shots_on_target,
    big_chances_missed,
    hit_woodwork,
    total_passes,
    accurate_passes,
    pass_accuracy,
    key_passes,
    big_chances_created,
    crosses,
    accurate_crosses,
    long_balls,
    accurate_long_balls,
    tackles,
    tackles_won,
    interceptions,
    clearances,
    blocks,
    ball_recoveries,
    duels_won,
    duels_lost,
    aerials_won,
    aerials_lost,
    fouls,
    was_fouled,
    offsides,
    dispossessed,
    possession_lost,
    dribbles_won,
    dribbles_attempted,
    touches,
    saves,
    penalties_saved,
    errors_leading_to_shot,
    errors_leading_to_goal,
    rating_avg,
    km_covered,
    sprints,
    top_speed,
    xg,
    xgot,
    xa,
    yellow_cards,
    red_cards,
    fs_position
   FROM analytics.uecl_player_season_stats_mat) base
left join football.sofascore_player_info i on i.sofascore_player_id = base.player_id
left join analytics.sofascore_football_player_link_v1 l on l.sofascore_player_id = base.player_id;

-- tff1: mat'a foto/ulke join'leyen ince view (loader mat yerine bunu okur)
create or replace view analytics.tff1_player_table_v1 as
select s.*, i.photo_url, i.country
from analytics.tff1_player_season_stats_mat s
left join football.sofascore_player_info i on i.sofascore_player_id = s.player_id;

grant select on analytics.tff1_player_table_v1 to authenticated, service_role;

notify pgrst, 'reload schema';
