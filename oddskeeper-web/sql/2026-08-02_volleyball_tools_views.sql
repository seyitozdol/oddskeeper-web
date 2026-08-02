-- Voleybol Match-Player Tools veri katmani (Turkiye-merkezli; sadece TUR oyuncu-mac
-- verisi var). Iki per-mac view frontend'e ham satir verir; frontend home/away/total
-- avg + last5/last10 hesaplar (BSL kalibi ama pre-aggregate yerine ham).

-- Oyuncu per-mac metrikleri (kategorileri tek satira pivotla). side: TUR ev mi (H/A).
create or replace view analytics.vb_pm_player_match_v1 as
select
  pms.competition_id,
  pms.fivb_id,
  pms.match_date,
  pms.home_team,
  pms.away_team,
  case when pms.home_team ilike '%TUR%' then 'H' else 'A' end as side,
  max(case when pms.category='scoring'   then (pms.data->>'points')::numeric end)        as points,
  max(case when pms.category='scoring'   then (pms.data->>'attack_points')::numeric end) as attack,
  max(case when pms.category='scoring'   then (pms.data->>'block_points')::numeric end)  as block,
  max(case when pms.category='scoring'   then (pms.data->>'serve_points')::numeric end)  as ace,
  max(case when pms.category='dig'       then (pms.data->>'digs')::numeric end)          as digs,
  max(case when pms.category='reception' then (pms.data->>'successful')::numeric end)    as rec_succ,
  max(case when pms.category='reception' then (pms.data->>'total')::numeric end)         as rec_att
from volleyball.player_match_stats pms
where pms.fivb_id in (select fivb_id from volleyball.roster where team_code='TUR')
group by 1,2,3,4,5;

-- Takim (Turkiye) per-mac metrikleri = TUR oyuncularini topla + mac sonucu (W/L).
create or replace view analytics.vb_pm_team_match_v1 as
with pm as (
  select * from analytics.vb_pm_player_match_v1
),
agg as (
  select competition_id, match_date, home_team, away_team, side,
    sum(points) as points, sum(attack) as attack, sum(block) as block,
    sum(ace) as ace, sum(digs) as digs,
    case when sum(rec_att) > 0 then round(sum(rec_succ) / sum(rec_att) * 100, 2) end as rec_pct
  from pm group by 1,2,3,4,5
)
select
  a.competition_id, c.name as competition_name, a.match_date, a.side,
  -- rakip = TUR olmayan taraf (ad+kod string'i)
  case when a.side='H' then a.away_team else a.home_team end as opponent,
  m.home_sets, m.away_sets,
  case when a.side='H'
       then (case when m.home_sets > m.away_sets then 'W' else 'L' end)
       else (case when m.away_sets > m.home_sets then 'W' else 'L' end) end as result,
  a.points, a.attack, a.block, a.ace, a.digs, a.rec_pct
from agg a
join volleyball.competitions c on c.id = a.competition_id
left join volleyball.matches m
  on m.competition_id = a.competition_id
 and m.match_date = a.match_date
 and m.home_code = right(trim(a.home_team), 3)
 and m.away_code = right(trim(a.away_team), 3);

-- Turkiye oyuncu listesi (Player List sekmesi + Player Dist kimligi).
create or replace view analytics.vb_pm_player_list_v1 as
select
  p.fivb_id,
  p.full_name,
  p.short_name,
  p.position,
  p.sofascore_player_id,
  count(distinct pm.match_date) as games
from volleyball.players p
join volleyball.roster r on r.fivb_id = p.fivb_id and r.team_code = 'TUR'
left join analytics.vb_pm_player_match_v1 pm on pm.fivb_id = p.fivb_id
group by 1,2,3,4,5;

grant select on analytics.vb_pm_player_match_v1,
                analytics.vb_pm_team_match_v1,
                analytics.vb_pm_player_list_v1
  to anon, authenticated;
