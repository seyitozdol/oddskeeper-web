-- Match-Player Tools iki-takim modeli: artik TUM takimlarin oyuncu-mac verisi var
-- (--all-profiles), Player Dist + Team Metrics fixture'in ev/deplasman takimlarina gore.
-- Bagimlilik sirasi: team_match & player_list -> player_match. Once dropla.

drop view if exists analytics.vb_pm_team_match_v1;
drop view if exists analytics.vb_pm_player_list_v1;
drop view if exists analytics.vb_pm_player_match_v1;

-- Oyuncu per-mac (TUM oyuncular + kendi takim kodu + kendi tarafi H/A).
create view analytics.vb_pm_player_match_v1 as
with base as (
  select pms.competition_id, pms.fivb_id, r.team_code, pms.match_date,
         pms.home_team, pms.away_team, pms.category, pms.data
  from volleyball.player_match_stats pms
  join volleyball.roster r
    on r.competition_id = pms.competition_id and r.fivb_id = pms.fivb_id
)
select
  competition_id, fivb_id, team_code, match_date,
  case when right(trim(home_team), 3) = team_code then 'H' else 'A' end as side,
  max(case when category='scoring'   then (data->>'points')::numeric end)        as points,
  max(case when category='scoring'   then (data->>'attack_points')::numeric end) as attack,
  max(case when category='scoring'   then (data->>'block_points')::numeric end)  as block,
  max(case when category='scoring'   then (data->>'serve_points')::numeric end)  as ace,
  max(case when category='dig'       then (data->>'digs')::numeric end)          as digs,
  max(case when category='reception' then (data->>'successful')::numeric end)    as rec_succ,
  max(case when category='reception' then (data->>'total')::numeric end)         as rec_att
from base
group by 1,2,3,4,5;

-- Takim per-mac (TUM takimlar) = takim oyuncularini topla + sonuc.
create view analytics.vb_pm_team_match_v1 as
with pm as (select * from analytics.vb_pm_player_match_v1),
base as (
  select pms.competition_id, pms.match_date, pms.home_team, pms.away_team
  from volleyball.player_match_stats pms group by 1,2,3,4
),
agg as (
  select p.competition_id, p.team_code, p.match_date, p.side,
    sum(p.points) points, sum(p.attack) attack, sum(p.block) block,
    sum(p.ace) ace, sum(p.digs) digs,
    case when sum(p.rec_att) > 0 then round(sum(p.rec_succ)/sum(p.rec_att)*100,2) end rec_pct
  from pm p group by 1,2,3,4
)
select
  a.competition_id, c.name as competition_name, a.team_code, a.match_date, a.side,
  case when a.side='H' then right(trim(b.away_team),3) else right(trim(b.home_team),3) end as opponent_code,
  case when a.side='H' then b.away_team else b.home_team end as opponent,
  m.home_sets, m.away_sets,
  case when a.side='H' then (case when m.home_sets > m.away_sets then 'W' else 'L' end)
       else (case when m.away_sets > m.home_sets then 'W' else 'L' end) end as result,
  a.points, a.attack, a.block, a.ace, a.digs, a.rec_pct
from agg a
join volleyball.competitions c on c.id = a.competition_id
join base b on b.competition_id = a.competition_id and b.match_date = a.match_date
   and (right(trim(b.home_team),3) = a.team_code or right(trim(b.away_team),3) = a.team_code)
left join volleyball.matches m
  on m.competition_id = a.competition_id and m.match_date = a.match_date
 and m.home_code = right(trim(b.home_team),3) and m.away_code = right(trim(b.away_team),3);

-- Oyuncu kimligi (TUM takim oyuncular; Player Dist icin). team_code mac view'inden gelir.
create view analytics.vb_pm_player_list_v1 as
select
  p.fivb_id, p.full_name, p.short_name,
  volleyball.norm_pos(p.position) as position,
  p.sofascore_player_id, p.vbw_photo,
  count(distinct pm.match_date) as games
from volleyball.players p
join (select distinct fivb_id from volleyball.roster) rr on rr.fivb_id = p.fivb_id
left join analytics.vb_pm_player_match_v1 pm on pm.fivb_id = p.fivb_id
group by 1,2,3,4,5,6;

-- Takim listesi (fixture dropdown + Team Metrics).
create or replace view analytics.vb_pm_teams_v1 as
select team_code, max(team_name) as team_name
from volleyball.teams
group by team_code;

grant select on analytics.vb_pm_player_match_v1, analytics.vb_pm_team_match_v1,
                analytics.vb_pm_player_list_v1, analytics.vb_pm_teams_v1
  to anon, authenticated;
