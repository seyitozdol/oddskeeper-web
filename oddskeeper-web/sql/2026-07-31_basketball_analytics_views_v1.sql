-- Basketbol analytics okuma katmanı (Faz 3 adım 1) — ham basketball.* üzerine türev view'lar.
-- DB-only, additive, güvenli (frontend'i etkilemez). Monte-Carlo oran motoru AYRI faz.
-- Possession = FGA - OREB + TOV + 0.44*FTA  (Excel tblTeam.Poss ile aynı).

-- ============================================================
-- 1) Oyuncu-maç zenginleştirilmiş (takım-maç bağlamı + türev alanlar)
-- ============================================================
create or replace view analytics.bb_player_game_enriched_v1 as
with tg as (
  select season_label, match_key, match_date, team_name,
         home_away, opponent_name, opponent_slug,
         points as team_points, opp_points as team_opp_points,
         (coalesce(fg2a,0)+coalesce(fg3a,0))                                         as team_fga,
         coalesce(fta,0)                                                             as team_fta,
         coalesce(turnovers,0)                                                       as team_tov,
         ((coalesce(fg2a,0)+coalesce(fg3a,0)) - coalesce(oreb,0)
            + coalesce(turnovers,0) + 0.44*coalesce(fta,0))                          as team_poss
  from basketball.team_match_stats
),
tgm as (
  select season_label, match_key, match_date, team_name, sum(coalesce(minutes,0)) as team_minutes
  from basketball.player_match_stats
  group by 1,2,3,4
)
select
  p.id, p.source, p.season_label, p.competition, p.match_key, p.match_date, p.week,
  p.player_slug, p.player_name, p.team_slug, p.team_name, p.jersey_no,
  p.seconds_played, p.minutes, p.points,
  p.fg2m, p.fg2a, p.fg2_pct, p.fg3m, p.fg3a, p.fg3_pct, p.ftm, p.fta, p.ft_pct,
  p.oreb, p.dreb, p.treb, p.assists, p.turnovers, p.steals, p.blocks, p.blocks_against,
  p.fouls_drawn, p.fouls_committed,
  (coalesce(p.fg2m,0)+coalesce(p.fg3m,0)) as fgm,
  (coalesce(p.fg2a,0)+coalesce(p.fg3a,0)) as fga,
  tg.home_away, tg.opponent_name, tg.opponent_slug,
  tg.team_points, tg.team_opp_points, tg.team_fga, tg.team_fta, tg.team_tov, tg.team_poss,
  tgm.team_minutes
from basketball.player_match_stats p
left join tg  on tg.season_label=p.season_label and tg.match_key=p.match_key and tg.match_date=p.match_date and tg.team_name=p.team_name
left join tgm on tgm.season_label=p.season_label and tgm.match_key=p.match_key and tgm.match_date=p.match_date and tgm.team_name=p.team_name;

-- ============================================================
-- 2) Oyuncu maç logu (profil/son-5 form için, tek satır=oyuncu-maç)
-- ============================================================
create or replace view analytics.bb_player_match_log_v1 as
select
  e.season_label, e.competition, e.match_key, e.match_date, e.week,
  e.player_slug, e.player_name, e.team_slug, e.team_name, e.jersey_no,
  e.home_away, e.opponent_name, e.opponent_slug,
  round(coalesce(e.minutes,0)::numeric,1) as minutes,
  e.points, e.fgm, e.fga,
  e.fg2m, e.fg2a, e.fg3m, e.fg3a, e.ftm, e.fta,
  e.oreb, e.dreb, e.treb, e.assists, e.turnovers, e.steals, e.blocks, e.blocks_against,
  e.fouls_drawn, e.fouls_committed,
  (e.points + e.treb + e.assists)                       as pra,
  (e.points + e.assists)                                as pa,
  (e.points + e.treb)                                   as pr,
  round((case when e.fga>0 then (e.fgm + 0.5*e.fg3m)::numeric/e.fga end)*100,1)  as efg_pct,
  round((case when (e.fga + 0.44*e.fta)>0 then e.points::numeric/(2*(e.fga+0.44*e.fta)) end)*100,1) as ts_pct
from analytics.bb_player_game_enriched_v1 e;

-- ============================================================
-- 3) Oyuncu sezon istatistikleri (agg + ileri metrik)
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
    -- usage payda bileşenleri (oyuncunun oynadığı maçlardaki takım toplamları)
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
  -- shooting
  round((tot_fgm::numeric/nullif(tot_fga,0))*100,1)              as fg_pct,
  round((tot_fg2m::numeric/nullif(tot_fg2a,0))*100,1)            as fg2_pct,
  round((tot_fg3m::numeric/nullif(tot_fg3a,0))*100,1)            as fg3_pct,
  round((tot_ftm::numeric/nullif(tot_fta,0))*100,1)             as ft_pct,
  round(((tot_fgm + 0.5*tot_fg3m)::numeric/nullif(tot_fga,0))*100,1)                     as efg_pct,
  round((tot_points::numeric/nullif(2*(tot_fga + 0.44*tot_fta),0))*100,1)                as ts_pct,
  round((tot_fg3a::numeric/nullif(tot_fga,0))*100,1)            as three_rate,
  -- advanced
  round((tot_points/nullif(tot_minutes,0))::numeric,2)          as ppm,
  round((tot_points/nullif(tot_minutes,0)*36)::numeric,1)       as pts_per36,
  round((tot_treb/nullif(tot_minutes,0)*36)::numeric,1)         as reb_per36,
  round((tot_assists/nullif(tot_minutes,0)*36)::numeric,1)      as ast_per36,
  round( (100 * ((tot_fga + 0.44*tot_fta + tot_turnovers) * (tm_minutes/5.0))
         / nullif(tot_minutes * (tm_fga + 0.44*tm_fta + tm_tov),0))::numeric, 1)         as usage_pct,
  -- combo markets (per game)
  round(((tot_points+tot_treb+tot_assists))::numeric/nullif(games,0),1) as pra_pg,
  round(((tot_points+tot_assists))::numeric/nullif(games,0),1)         as pa_pg,
  round(((tot_points+tot_treb))::numeric/nullif(games,0),1)            as pr_pg
from agg;

-- ============================================================
-- 4) Takım maç logu (sonuç/form, tek satır=takım-maç)
-- ============================================================
create or replace view analytics.bb_team_match_log_v1 as
select
  t.season_label, t.competition, t.match_key, t.match_date, t.week,
  t.team_slug, t.team_name, t.home_away, t.opponent_slug, t.opponent_name,
  t.points, t.opp_points,
  (t.points - t.opp_points)                                    as margin,
  case when t.points > t.opp_points then 'W'
       when t.points < t.opp_points then 'L' else 'T' end      as result,
  (coalesce(t.fg2m,0)+coalesce(t.fg3m,0))                      as fgm,
  (coalesce(t.fg2a,0)+coalesce(t.fg3a,0))                      as fga,
  t.fg2m, t.fg2a, t.fg3m, t.fg3a, t.ftm, t.fta,
  t.oreb, t.dreb, t.treb, t.assists, t.turnovers, t.steals, t.blocks, t.blocks_against,
  t.fouls_drawn, t.fouls_committed,
  ((coalesce(t.fg2a,0)+coalesce(t.fg3a,0)) - coalesce(t.oreb,0)
     + coalesce(t.turnovers,0) + 0.44*coalesce(t.fta,0))       as possessions
from basketball.team_match_stats t;

-- ============================================================
-- 5) Takım sezon istatistikleri + sıralama (standings)
-- ============================================================
create or replace view analytics.bb_team_season_stats_v1 as
with agg as (
  select
    season_label, competition, team_slug,
    max(team_name)                                     as team_name,
    count(*)                                            as games,
    sum((points>opp_points)::int)                      as wins,
    sum((points<opp_points)::int)                      as losses,
    sum(coalesce(points,0))                            as tot_points,
    sum(coalesce(opp_points,0))                        as tot_opp_points,
    sum(fgm)                                           as tot_fgm,
    sum(fga)                                           as tot_fga,
    sum(coalesce(fg2m,0))                              as tot_fg2m,
    sum(coalesce(fg2a,0))                              as tot_fg2a,
    sum(coalesce(fg3m,0))                              as tot_fg3m,
    sum(coalesce(fg3a,0))                              as tot_fg3a,
    sum(coalesce(ftm,0))                               as tot_ftm,
    sum(coalesce(fta,0))                               as tot_fta,
    sum(coalesce(oreb,0))                              as tot_oreb,
    sum(coalesce(dreb,0))                              as tot_dreb,
    sum(coalesce(treb,0))                              as tot_treb,
    sum(coalesce(assists,0))                           as tot_assists,
    sum(coalesce(turnovers,0))                         as tot_turnovers,
    sum(coalesce(steals,0))                            as tot_steals,
    sum(coalesce(blocks,0))                            as tot_blocks,
    sum(coalesce(possessions,0))                       as tot_poss
  from analytics.bb_team_match_log_v1
  group by season_label, competition, team_slug
)
select
  season_label, competition, team_slug, team_name, games, wins, losses,
  round((wins::numeric/nullif(games,0))*100,1)                  as win_pct,
  round((tot_points)::numeric/nullif(games,0),1)               as ppg,
  round((tot_opp_points)::numeric/nullif(games,0),1)           as oppg,
  round(((tot_points-tot_opp_points))::numeric/nullif(games,0),1) as point_diff,
  round((tot_treb)::numeric/nullif(games,0),1)                 as rpg,
  round((tot_oreb)::numeric/nullif(games,0),1)                 as orpg,
  round((tot_dreb)::numeric/nullif(games,0),1)                 as drpg,
  round((tot_assists)::numeric/nullif(games,0),1)              as apg,
  round((tot_steals)::numeric/nullif(games,0),1)               as spg,
  round((tot_blocks)::numeric/nullif(games,0),1)               as bpg,
  round((tot_turnovers)::numeric/nullif(games,0),1)            as topg,
  round((tot_fgm::numeric/nullif(tot_fga,0))*100,1)            as fg_pct,
  round((tot_fg2m::numeric/nullif(tot_fg2a,0))*100,1)          as fg2_pct,
  round((tot_fg3m::numeric/nullif(tot_fg3a,0))*100,1)          as fg3_pct,
  round((tot_ftm::numeric/nullif(tot_fta,0))*100,1)           as ft_pct,
  round(((tot_fgm + 0.5*tot_fg3m)::numeric/nullif(tot_fga,0))*100,1) as efg_pct,
  round((tot_poss)::numeric/nullif(games,0),1)                 as pace,
  round((100*tot_points/nullif(tot_poss,0))::numeric,1)        as off_rtg,
  round((100*tot_opp_points/nullif(tot_poss,0))::numeric,1)    as def_rtg,
  round((100*(tot_points-tot_opp_points)/nullif(tot_poss,0))::numeric,1) as net_rtg,
  rank() over (partition by season_label, competition
               order by wins desc, (tot_points-tot_opp_points) desc)   as standings_rank
from agg;

-- ============================================================
-- 6) Oyuncu leaderboard (kalifikasyon + metrik sıraları)
--    Kalifikasyon: mpg >= model_config.min_minutes ve games >= %30 max
-- ============================================================
create or replace view analytics.bb_player_leaderboard_v1 as
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

-- ============================================================
-- Grants
-- ============================================================
grant select on
  analytics.bb_player_game_enriched_v1,
  analytics.bb_player_match_log_v1,
  analytics.bb_player_season_stats_v1,
  analytics.bb_team_match_log_v1,
  analytics.bb_team_season_stats_v1,
  analytics.bb_player_leaderboard_v1
to anon, authenticated;
