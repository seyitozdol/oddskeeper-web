-- EuroLeague/EuroCup standings + oyuncu leaderboard (hub sayfalari icin).
-- euroleague.* uzerine; competition (E/U) + season_code bazli. BSL bb_* kaliplarina
-- paralel ama ayri (modele girmez). Possession = FGA - OREB + TOV + 0.44*FTA.

-- ============================================================
-- Takim sezon istatistikleri + standings (competition + season)
-- ============================================================
create or replace view analytics.el_team_season_v1 as
with agg as (
  select
    competition, season_code, season_label, team_code,
    max(team_name)                                        as team_name,
    count(*)                                              as games,
    sum((points > opp_points)::int)                       as wins,
    sum((points < opp_points)::int)                       as losses,
    sum(coalesce(points,0))                               as tot_points,
    sum(coalesce(opp_points,0))                           as tot_opp,
    sum(coalesce(fg2m,0)+coalesce(fg3m,0))                as tot_fgm,
    sum(coalesce(fg2a,0)+coalesce(fg3a,0))                as tot_fga,
    sum(coalesce(fg3m,0))                                 as tot_fg3m,
    sum(coalesce(fg3a,0))                                 as tot_fg3a,
    sum(coalesce(treb,0))                                 as tot_treb,
    sum(coalesce(assists,0))                              as tot_ast,
    sum((coalesce(fg2a,0)+coalesce(fg3a,0)) - coalesce(oreb,0)
        + coalesce(turnovers,0) + 0.44*coalesce(fta,0))   as tot_poss
  from euroleague.team_match_stats
  group by competition, season_code, season_label, team_code
)
select
  agg.competition, agg.season_code, agg.season_label, agg.team_code, agg.team_name,
  games, wins, losses,
  round((wins::numeric/nullif(games,0))*100,1)                       as win_pct,
  round(tot_points::numeric/nullif(games,0),1)                      as ppg,
  round(tot_opp::numeric/nullif(games,0),1)                         as oppg,
  round((tot_points-tot_opp)::numeric/nullif(games,0),1)           as point_diff,
  round(tot_treb::numeric/nullif(games,0),1)                       as rpg,
  round(tot_ast::numeric/nullif(games,0),1)                        as apg,
  round((tot_fgm::numeric/nullif(tot_fga,0))*100,1)                as fg_pct,
  round((tot_fg3m::numeric/nullif(tot_fg3a,0))*100,1)              as fg3_pct,
  round(((tot_fgm+0.5*tot_fg3m)::numeric/nullif(tot_fga,0))*100,1) as efg_pct,
  round(tot_poss::numeric/nullif(games,0),1)                       as pace,
  round((100*tot_points/nullif(tot_poss,0))::numeric,1)            as off_rtg,
  round((100*tot_opp/nullif(tot_poss,0))::numeric,1)               as def_rtg,
  round((100*(tot_points-tot_opp)/nullif(tot_poss,0))::numeric,1)  as net_rtg,
  rank() over (partition by agg.competition, agg.season_code
               order by wins desc, (tot_points-tot_opp) desc)      as standings_rank,
  tm.crest_url,
  lnk.bsl_team_slug
from agg
left join euroleague.teams tm
  on tm.competition=agg.competition and tm.season_code=agg.season_code and tm.team_code=agg.team_code
left join euroleague.team_bsl_link lnk on lnk.team_code=agg.team_code;

-- Takim mac logu (takim detay sayfasi icin)
create or replace view analytics.el_team_game_log_v1 as
select
  competition,
  case competition when 'E' then 'EuroLeague' when 'U' then 'EuroCup' else competition end as competition_name,
  season_code, season_label, game_code, round, phase_code, game_date,
  team_code, team_name, home_away, opponent_code, opponent_name,
  points, opp_points,
  case when points>opp_points then 'W' when points<opp_points then 'L' else 'T' end as result
from euroleague.team_match_stats;

-- ============================================================
-- Oyuncu leaderboard (competition + season)
-- ============================================================
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
  ((a.tot_sec/60.0)/nullif(a.games,0) >= 10 and a.games >= greatest(5, 0.30*mx.mg)) as is_qualified
from agg a
join mx on mx.competition=a.competition and mx.season_code=a.season_code
left join lnk l on l.person_code=a.person_code;

grant select on analytics.el_team_season_v1, analytics.el_player_leaderboard_v1,
  analytics.el_team_game_log_v1 to anon, authenticated;
