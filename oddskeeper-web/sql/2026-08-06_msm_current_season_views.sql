-- MSM Faz 2: guncel sezon feed (Excel Tab/Data karsiligi).
-- Kaynak: football.match_team_stats (home+away 2 satir/mac) -> self-join for/against.
-- Kimlik team_slug (ref.team_mapping, source_team_id uzerinden). Sezon dash-normalize.
-- 10 market unpivot. source_rank: opta=1 (10 market), apifootball=2 (7 market), sofascore=3.
-- NOT: 26/27 henuz bos; feed dolunca view otomatik yansitir. Throw-in/Goal Kick/Tackle
--      apifootball'da YOK (opta emekli -> Faz 2b ingestion karari).

create or replace view msm.team_match_log_v1 as
with pair as (
  select
    case when t.competition ilike '%per Lig%' then 'tsl'
         when t.competition ilike '%1. Lig%' or t.competition ilike '%1.Lig%'
              or t.competition ilike '%irinci Lig%' then 'tff1'
         else t.competition end                                as league,
    replace(coalesce(m.season_label, ''), '/', '-')            as season,
    t.source,
    case t.source when 'opta' then 1 when 'apifootball' then 2
                  when 'sofascore' then 3 else 9 end           as source_rank,
    t.source_match_id,
    t.match_datetime,
    tm.team_slug                                               as team_slug,
    t.team_name,
    (t.team_side = 'home')                                     as is_home,
    otm.team_slug                                              as opp_slug,
    t.opponent_team_name,
    -- for (t) / against (o) stat pairs
    t.summary_shots               as f_shot,    o.summary_shots               as a_shot,
    t.summary_shots_on_target     as f_sot,     o.summary_shots_on_target     as a_sot,
    t.summary_fouls_conceded      as f_foul,    o.summary_fouls_conceded      as a_foul,
    t.summary_corners_won         as f_corner,  o.summary_corners_won         as a_corner,
    t.summary_offsides            as f_offside, o.summary_offsides            as a_offside,
    t.summary_saves               as f_saves,   o.summary_saves               as a_saves,
    t.summary_tackles             as f_tackle,  o.summary_tackles             as a_tackle,
    (coalesce(t.summary_yellow_cards,0)+coalesce(t.summary_red_cards,0)) as f_card,
    (coalesce(o.summary_yellow_cards,0)+coalesce(o.summary_red_cards,0)) as a_card,
    t.details_total_throws        as f_throw,   o.details_total_throws        as a_throw,
    t.details_goal_kicks          as f_gkick,   o.details_goal_kicks          as a_gkick,
    (coalesce(t.summary_red_cards,0)+coalesce(o.summary_red_cards,0)) as match_red_cards
  from football.match_team_stats t
  join football.matches m
    on m.source = t.source and m.source_match_id = t.source_match_id
  join football.match_team_stats o
    on o.source = t.source and o.source_match_id = t.source_match_id
   and o.team_side <> t.team_side
  left join ref.team_mapping tm  on tm.source_team_id  = t.source_team_id
  left join ref.team_mapping otm on otm.source_team_id = t.opponent_team_source_id
),
indexed as (
  select p.*,
    dense_rank() over (partition by league, season, team_slug
                       order by match_datetime, source_match_id) as team_match_index
  from pair p
),
unp as (
  select i.league, i.season, i.source, i.source_rank, i.source_match_id, i.match_datetime,
         i.team_slug, i.team_name, i.is_home, i.opp_slug, i.opponent_team_name,
         i.team_match_index, i.match_red_cards, v.market, v.for_value, v.against_value
  from indexed i
  cross join lateral (values
    ('Shot',      i.f_shot,    i.a_shot),
    ('SOT',       i.f_sot,     i.a_sot),
    ('Foul',      i.f_foul,    i.a_foul),
    ('Corner',    i.f_corner,  i.a_corner),
    ('Offside',   i.f_offside, i.a_offside),
    ('Saves',     i.f_saves,   i.a_saves),
    ('Tackle',    i.f_tackle,  i.a_tackle),
    ('Card',      i.f_card,    i.a_card),
    ('Throw-in',  i.f_throw,   i.a_throw),
    ('Goal Kick', i.f_gkick,   i.a_gkick)
  ) as v(market, for_value, against_value)
)
select * from unp
where team_slug is not null and for_value is not null;

-- Sezon agregasyonu: HF/HA/AF/AA per (league, season, team_slug, market, source).
-- HF=evde for ort, HA=evde against ort, AF=depde for ort, AA=depde against ort.
create or replace view msm.team_season_stats_v1 as
select
  league, season, team_slug, market, source, min(source_rank) as source_rank,
  count(*) filter (where is_home)                              as home_games,
  count(*) filter (where not is_home)                          as away_games,
  avg(for_value)     filter (where is_home)                    as hf,
  avg(against_value) filter (where is_home)                    as ha,
  avg(for_value)     filter (where not is_home)                as af,
  avg(against_value) filter (where not is_home)                as aa
from msm.team_match_log_v1
group by league, season, team_slug, market, source;

grant select on msm.team_match_log_v1  to anon, authenticated;
grant select on msm.team_season_stats_v1 to anon, authenticated;
