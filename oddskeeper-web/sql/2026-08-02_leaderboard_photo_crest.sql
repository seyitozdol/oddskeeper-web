-- Player Leaders (Explorer) için: BSL leaderboard'a sofascore_player_id (pp),
-- EL/EC leaderboard'a crest_url (takım logosu) taşı. Additive.

-- ============================================================
-- BSL leaderboard: DROP+CREATE → q.*/s.* yeniden genişler, season view'daki
-- yeni kolonlar (sofascore_player_id, role, image_url) otomatik gelir.
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
-- EL/EC leaderboard: crest_url ekle (euroleague.teams join). role zaten var.
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
  tm.crest_url
from agg a
join mx on mx.competition=a.competition and mx.season_code=a.season_code
left join lnk l on l.person_code=a.person_code
left join euroleague.team_bsl_link tl on tl.team_code=a.team_code
left join basketball.teams bt on bt.team_slug=tl.bsl_team_slug
left join euroleague.players pl
  on pl.competition=a.competition and pl.season_code=a.season_code and pl.person_code=a.person_code
left join euroleague.teams tm
  on tm.competition=a.competition and tm.season_code=a.season_code and tm.team_code=a.team_code;

grant select on analytics.el_player_leaderboard_v1 to anon, authenticated;
