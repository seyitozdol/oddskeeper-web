-- Oyuncu ÜLKE (country_code, ISO alpha2) view'lara taşınır → bio/squad/ranking bayrağı.
--   BSL  : basketball.players.country_code (SofaScore player detayindan cekildi)
--   EL/EC: euroleague.players.country_code (EuroLeague API'de zaten vardi)
-- Additive: kolon SONA eklenir.

-- ============================================================
-- 1) BSL season stats: country_code ekle (position/role gibi subquery)
-- ============================================================
create or replace view analytics.bb_player_season_stats_v1 as
with agg as (
  select
    e.season_label, e.competition, e.player_slug,
    max(e.player_name)                          as player_name,
    (array_agg(e.team_name order by e.match_date desc))[1] as team_name,
    (array_agg(e.team_slug order by e.match_date desc))[1] as team_slug,
    (array_agg(e.jersey_no order by e.match_date desc))[1] as jersey_no,
    count(*)                                    as games,
    sum(coalesce(e.minutes,0))                  as tot_minutes,
    sum(coalesce(e.points,0))                   as tot_points,
    sum(coalesce(e.fgm,0))                       as tot_fgm,
    sum(coalesce(e.fga,0))                       as tot_fga,
    sum(coalesce(e.fg2m,0))                      as tot_fg2m,
    sum(coalesce(e.fg2a,0))                      as tot_fg2a,
    sum(coalesce(e.fg3m,0))                      as tot_fg3m,
    sum(coalesce(e.fg3a,0))                      as tot_fg3a,
    sum(coalesce(e.ftm,0))                       as tot_ftm,
    sum(coalesce(e.fta,0))                       as tot_fta,
    sum(coalesce(e.oreb,0))                      as tot_oreb,
    sum(coalesce(e.dreb,0))                      as tot_dreb,
    sum(coalesce(e.treb,0))                      as tot_treb,
    sum(coalesce(e.assists,0))                   as tot_assists,
    sum(coalesce(e.turnovers,0))                 as tot_turnovers,
    sum(coalesce(e.steals,0))                    as tot_steals,
    sum(coalesce(e.blocks,0))                    as tot_blocks,
    sum(coalesce(e.blocks_against,0))            as tot_blocks_against,
    sum(coalesce(e.fouls_drawn,0))               as tot_fouls_drawn,
    sum(coalesce(e.fouls_committed,0))           as tot_fouls_committed,
    sum(coalesce(e.team_fga,0))                  as tm_fga,
    sum(coalesce(e.team_fta,0))                  as tm_fta,
    sum(coalesce(e.team_tov,0))                  as tm_tov,
    sum(coalesce(e.team_minutes,0))              as tm_minutes
  from analytics.bb_player_game_enriched_v1 e
  group by e.season_label, e.competition, e.player_slug
)
select
  season_label, competition, player_slug, player_name, team_slug, team_name, jersey_no,
  games,
  round(tot_minutes::numeric,1)                                   as minutes_total,
  round((tot_minutes)::numeric/nullif(games,0),1)                as mpg,
  tot_points as points_total, tot_treb as reb_total, tot_assists as assists_total,
  tot_steals as steals_total, tot_blocks as blocks_total, tot_turnovers as turnovers_total,
  tot_oreb as oreb_total, tot_dreb as dreb_total, tot_fg3m as fg3m_total,
  round((tot_points)::numeric/nullif(games,0),1)                 as ppg,
  round((tot_treb)::numeric/nullif(games,0),1)                   as rpg,
  round((tot_assists)::numeric/nullif(games,0),1)                as apg,
  round((tot_steals)::numeric/nullif(games,0),1)                 as spg,
  round((tot_blocks)::numeric/nullif(games,0),1)                 as bpg,
  round((tot_turnovers)::numeric/nullif(games,0),1)              as topg,
  round((tot_oreb)::numeric/nullif(games,0),1)                   as orpg,
  round((tot_dreb)::numeric/nullif(games,0),1)                   as drpg,
  round((tot_fg3m)::numeric/nullif(games,0),2)                   as fg3m_pg,
  round((tot_fgm::numeric/nullif(tot_fga,0))*100,1)              as fg_pct,
  round((tot_fg2m::numeric/nullif(tot_fg2a,0))*100,1)            as fg2_pct,
  round((tot_fg3m::numeric/nullif(tot_fg3a,0))*100,1)            as fg3_pct,
  round((tot_ftm::numeric/nullif(tot_fta,0))*100,1)             as ft_pct,
  round(((tot_fgm + 0.5*tot_fg3m)::numeric/nullif(tot_fga,0))*100,1)                     as efg_pct,
  round((tot_points::numeric/nullif(2*(tot_fga + 0.44*tot_fta),0))*100,1)                as ts_pct,
  round((tot_fg3a::numeric/nullif(tot_fga,0))*100,1)            as three_rate,
  round((tot_points/nullif(tot_minutes,0))::numeric,2)          as ppm,
  round((tot_points/nullif(tot_minutes,0)*36)::numeric,1)       as pts_per36,
  round((tot_treb/nullif(tot_minutes,0)*36)::numeric,1)         as reb_per36,
  round((tot_assists/nullif(tot_minutes,0)*36)::numeric,1)      as ast_per36,
  round( (100 * ((tot_fga + 0.44*tot_fta + tot_turnovers) * (tm_minutes/5.0))
         / nullif(tot_minutes * (tm_fga + 0.44*tm_fta + tm_tov),0))::numeric, 1)         as usage_pct,
  round(((tot_points+tot_treb+tot_assists))::numeric/nullif(games,0),1) as pra_pg,
  round(((tot_points+tot_assists))::numeric/nullif(games,0),1)         as pa_pg,
  round(((tot_points+tot_treb))::numeric/nullif(games,0),1)            as pr_pg,
  (select pl.position  from basketball.players pl where pl.player_slug = agg.player_slug) as position,
  (select pl.height_cm from basketball.players pl where pl.player_slug = agg.player_slug) as height_cm,
  (select pl.sofascore_player_id from basketball.players pl where pl.player_slug = agg.player_slug) as sofascore_player_id,
  (select r.role from analytics.bb_player_role_v1 r
     where r.season_label = agg.season_label and r.player_slug = agg.player_slug
       and r.team_slug = agg.team_slug limit 1) as role,
  (select pl.country_code from basketball.players pl where pl.player_slug = agg.player_slug) as country_code
from agg;

grant select on analytics.bb_player_season_stats_v1 to anon, authenticated;

-- ============================================================
-- 2) BSL leaderboard: DROP+CREATE → country_code otomatik gelir
-- ============================================================
drop view if exists analytics.bb_player_leaderboard_v1;
create view analytics.bb_player_leaderboard_v1 as
with cfg as (
  select coalesce(max(value) filter (where key='min_minutes'),10) as min_minutes
  from basketball.model_config
),
mx as (
  select season_label, competition, max(games) as max_games
  from analytics.bb_player_season_stats_v1 group by 1,2
),
q as (
  select s.*,
    (s.mpg >= (select min_minutes from cfg)
       and s.games >= greatest(5, 0.30*mx.max_games)) as is_qualified
  from analytics.bb_player_season_stats_v1 s
  join mx on mx.season_label=s.season_label and mx.competition=s.competition
)
select q.*,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by ppg desc)  end as ppg_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by rpg desc)  end as rpg_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by apg desc)  end as apg_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by spg desc)  end as spg_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by bpg desc)  end as bpg_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by fg3m_pg desc) end as fg3m_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by ts_pct desc nulls last) end as ts_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by usage_pct desc nulls last) end as usage_rank
from q;

grant select on analytics.bb_player_leaderboard_v1 to anon, authenticated;

-- ============================================================
-- 3) EL/EC season: country_code ekle (euroleague.players'tan)
-- ============================================================
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
  max(pl.image_url)                                     as image_url,
  max(pl.position_name)                                 as position,
  max(pl.height)                                        as height_cm,
  max(pl.country_code)                                  as country_code
from euroleague.player_match_stats p
left join euroleague.players pl
  on pl.competition=p.competition and pl.season_code=p.season_code and pl.person_code=p.person_code
group by p.competition, p.season_code, p.season_label, p.person_code;

-- bsl_player_euro_seasons_v1 s.* → yeniden yaratınca country_code gelir
create or replace view analytics.bsl_player_euro_seasons_v1 as
select l.bsl_player_slug, s.*
from analytics.el_player_season_v1 s
join euroleague.player_bsl_link l on l.person_code = s.person_code;

-- ============================================================
-- 4) EL/EC leaderboard: country_code ekle (role + crest_url korunur)
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
  ((a.tot_sec/60.0)/nullif(a.games,0) >= 10 and a.games >= greatest(5, 0.30*mx.mg)) as is_qualified,
  bt.team_name as bsl_team_name,
  pl.image_url,
  pl.position_name as position,
  pl.height        as height_cm,
  (select r.role from analytics.el_player_role_v1 r
     where r.competition = a.competition and r.season_label = a.season_label
       and r.team_slug = a.team_code and r.player_slug = a.person_code limit 1) as role,
  tm.crest_url,
  pl.country_code
from agg a
join mx on mx.competition=a.competition and mx.season_code=a.season_code
left join lnk l on l.person_code=a.person_code
left join euroleague.team_bsl_link tl on tl.team_code=a.team_code
left join basketball.teams bt on bt.team_slug=tl.bsl_team_slug
left join euroleague.players pl
  on pl.competition=a.competition and pl.season_code=a.season_code and pl.person_code=a.person_code
left join euroleague.teams tm
  on tm.competition=a.competition and tm.season_code=a.season_code and tm.team_code=a.team_code;

grant select on
  analytics.el_player_season_v1,
  analytics.bsl_player_euro_seasons_v1,
  analytics.el_player_leaderboard_v1
to anon, authenticated;
