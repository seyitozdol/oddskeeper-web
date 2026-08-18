-- 2026-08-18: Avrupa kupasi takim-mac market logu (match_team_stats+matches, round_name dahil).
-- Cup Teams ana marketleri MSM yerine bundan; lig-fazi filtresi round_name IS NULL.

create view analytics.eurocup_team_match_log_v1 as
with base as (
  select ts.competition, m.season_label, m.round_name, ts.source_team_id as team_id, ts.match_datetime,
         ts.summary_shots, ts.summary_shots_on_target, ts.summary_corners_won, ts.summary_saves,
         ts.summary_tackles, ts.details_total_throws, ts.details_goal_kicks, ts.summary_fouls_conceded,
         (coalesce(ts.summary_yellow_cards,0)+2*coalesce(ts.summary_red_cards,0)) as card_val,
         ts.summary_offsides
  from football.match_team_stats ts
  join football.matches m on m.source=ts.source and m.source_match_id=ts.source_match_id
  where ts.source='sofascore'
    and ts.competition in ('UEFA Şampiyonlar Ligi','UEFA Avrupa Ligi','UEFA Konferans Ligi')
),
unpiv as (
  select b.competition, b.season_label, b.round_name, b.team_id, b.match_datetime, v.market, v.for_value
  from base b
  cross join lateral (values
    ('Shot', b.summary_shots), ('SOT', b.summary_shots_on_target),
    ('Corner', b.summary_corners_won), ('Saves', b.summary_saves),
    ('Tackle', b.summary_tackles), ('Throw-in', b.details_total_throws),
    ('Goal Kick', b.details_goal_kicks), ('Foul', b.summary_fouls_conceded),
    ('Card', b.card_val), ('Offside', b.summary_offsides)
  ) v(market, for_value)
  where v.for_value is not null
)
select competition, season_label, round_name, team_id, match_datetime, market, for_value,
       row_number() over (partition by competition, season_label, team_id, market order by match_datetime) as team_match_index
from unpiv;
grant select on analytics.eurocup_team_match_log_v1 to anon, authenticated;
