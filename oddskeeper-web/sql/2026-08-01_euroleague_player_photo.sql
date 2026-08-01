-- Oyuncu fotografi: euroleague.players.image_url'u okuma view'larina tasi.
-- EL/EC oyuncu profili + EL/EC oynayan BSL oyuncularinin profil header'inda foto.
-- Hafif <img> ile gosterilir (next/image degil) → remotePatterns gerekmez, sayfayi yavaslatmaz.

-- 1) el_player_season_v1: image_url eklendi (euroleague.players 1:1 join, fan-out yok).
create or replace view analytics.el_player_season_v1 as
select
  p.competition, p.season_code, p.season_label, p.person_code,
  case p.competition when 'E' then 'EuroLeague' when 'U' then 'EuroCup' else p.competition end as competition_name,
  max(p.player_name)                                    as player_name,
  (array_agg(p.team_code order by p.game_date desc))[1] as team_code,
  (array_agg(p.team_name order by p.game_date desc))[1] as team_name,
  count(*)                                              as games,
  round(avg(p.minutes), 1)                              as mpg,
  round(avg(p.points), 1)                               as ppg,
  round(avg(p.treb), 1)                                 as rpg,
  round(avg(p.oreb), 1)                                 as orpg,
  round(avg(p.dreb), 1)                                 as drpg,
  round(avg(p.assists), 1)                              as apg,
  round(avg(p.steals), 1)                               as spg,
  round(avg(p.blocks), 1)                               as bpg,
  round(avg(p.turnovers), 1)                            as topg,
  round(avg(p.fg3m), 1)                                 as fg3m_pg,
  round(avg(p.valuation), 1)                            as val_pg,
  sum(p.points)                                         as points_total,
  round((sum(p.fg2m + p.fg3m)::numeric / nullif(sum(p.fg2a + p.fg3a), 0)) * 100, 1) as fg_pct,
  round((sum(p.fg2m)::numeric / nullif(sum(p.fg2a), 0)) * 100, 1)                   as fg2_pct,
  round((sum(p.fg3m)::numeric / nullif(sum(p.fg3a), 0)) * 100, 1)                   as fg3_pct,
  round((sum(p.ftm)::numeric  / nullif(sum(p.fta), 0)) * 100, 1)                    as ft_pct,
  round((sum(p.points)::numeric / nullif(2*(sum(p.fg2a+p.fg3a) + 0.44*sum(p.fta)), 0)) * 100, 1) as ts_pct,
  max(pl.image_url)                                     as image_url
from euroleague.player_match_stats p
left join euroleague.players pl
  on pl.competition=p.competition and pl.season_code=p.season_code and pl.person_code=p.person_code
group by p.competition, p.season_code, p.season_label, p.person_code;

-- 2) bsl_player_euro_seasons_v1: s.* oldugu icin yeniden yaratinca image_url'u otomatik alir.
create or replace view analytics.bsl_player_euro_seasons_v1 as
select l.bsl_player_slug, s.*
from analytics.el_player_season_v1 s
join euroleague.player_bsl_link l on l.person_code = s.person_code;

-- 3) el_player_leaderboard_v1: image_url eklendi (euro-only oyuncu profili bunu okur).
create or replace view analytics.el_player_leaderboard_v1 as
with agg as (
  select
    competition, season_code, season_label, person_code,
    max(player_name)                                     as player_name,
    (array_agg(team_code order by game_date desc))[1]    as team_code,
    (array_agg(team_name order by game_date desc))[1]    as team_name,
    count(*)                                             as games,
    sum(coalesce(seconds_played,0))                      as tot_sec,
    sum(coalesce(points,0))                              as tot_pts,
    sum(coalesce(treb,0))                                as tot_reb,
    sum(coalesce(assists,0))                             as tot_ast,
    sum(coalesce(steals,0))                              as tot_stl,
    sum(coalesce(blocks,0))                              as tot_blk,
    sum(coalesce(turnovers,0))                           as tot_tov,
    sum(coalesce(fg3m,0))                                as tot_fg3m,
    sum(coalesce(fg2m,0)+coalesce(fg3m,0))              as tot_fgm,
    sum(coalesce(fg2a,0)+coalesce(fg3a,0))             as tot_fga,
    sum(coalesce(fg3a,0))                               as tot_fg3a,
    sum(coalesce(ftm,0))                                as tot_ftm,
    sum(coalesce(fta,0))                                as tot_fta,
    sum(coalesce(valuation,0))                          as tot_val
  from euroleague.player_match_stats
  group by competition, season_code, season_label, person_code
),
mx as (select competition, season_code, max(games) as mg from agg group by 1,2),
lnk as (select person_code, bsl_player_slug from euroleague.player_bsl_link)
select
  a.competition, a.season_code, a.season_label, a.person_code, a.player_name,
  a.team_code, a.team_name, l.bsl_player_slug,
  a.games,
  round((a.tot_sec/60.0)/nullif(a.games,0),1)              as mpg,
  round(a.tot_pts::numeric/nullif(a.games,0),1)            as ppg,
  round(a.tot_reb::numeric/nullif(a.games,0),1)            as rpg,
  round(a.tot_ast::numeric/nullif(a.games,0),1)            as apg,
  round(a.tot_stl::numeric/nullif(a.games,0),1)            as spg,
  round(a.tot_blk::numeric/nullif(a.games,0),1)            as bpg,
  round(a.tot_tov::numeric/nullif(a.games,0),1)            as topg,
  round(a.tot_fg3m::numeric/nullif(a.games,0),1)           as fg3m_pg,
  round(a.tot_val::numeric/nullif(a.games,0),1)            as val_pg,
  round((a.tot_fgm::numeric/nullif(a.tot_fga,0))*100,1)   as fg_pct,
  round((a.tot_fg3m::numeric/nullif(a.tot_fg3a,0))*100,1) as fg3_pct,
  round((a.tot_ftm::numeric/nullif(a.tot_fta,0))*100,1)   as ft_pct,
  round((a.tot_pts::numeric/nullif(2*(a.tot_fga+0.44*a.tot_fta),0))*100,1) as ts_pct,
  ((a.tot_sec/60.0)/nullif(a.games,0) >= 10 and a.games >= greatest(5, 0.30*mx.mg)) as is_qualified,
  bt.team_name as bsl_team_name,
  pl.image_url
from agg a
join mx on mx.competition=a.competition and mx.season_code=a.season_code
left join lnk l on l.person_code=a.person_code
left join euroleague.team_bsl_link tl on tl.team_code=a.team_code
left join basketball.teams bt on bt.team_slug=tl.bsl_team_slug
left join euroleague.players pl
  on pl.competition=a.competition and pl.season_code=a.season_code and pl.person_code=a.person_code;

grant select on
  analytics.el_player_season_v1,
  analytics.bsl_player_euro_seasons_v1,
  analytics.el_player_leaderboard_v1
to anon, authenticated;
