-- MSM: tamamlanan maclarin hakemini per-mac feed'e ekle.
-- football.matches.referee zaten dolu (opta + apifootball); MSM view'i simdiye kadar
-- select etmiyordu. referee kolonu view sonuna EKLENIR (create or replace uyumlu).
-- Bagimli view team_season_stats_v1 kolonlari isimle sectigi icin etkilenmez.

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
    (coalesce(t.summary_red_cards,0)+coalesce(o.summary_red_cards,0)) as match_red_cards,
    m.referee                                                  as referee
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
         i.team_match_index, i.match_red_cards, v.market, v.for_value, v.against_value,
         i.referee
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

-- Analytics wrapper (frontend anon 'analytics' semasini okur): referee'yi yansitmak icin
-- select * yeniden genisletilir.
create or replace view analytics.msm_team_match_log_v1 as
  select * from msm.team_match_log_v1;

grant select on msm.team_match_log_v1 to anon, authenticated;
grant select on analytics.msm_team_match_log_v1 to anon, authenticated;
