-- 2026-08-07: GSheet sekmesi + MSM handoff view.
-- football.match_team_stats (source='sofascore') 2 satirini (ev/dep) mac basina TEK
-- satira cevirir; GSheet 18 kolonu. league=competition'dan turetilir; season_label
-- match_datetime'dan (Tem-Ara -> YYYY/YYYY+1). Mavi grup (RC/VAR/PEN/WoodWork/OwnGoal)
-- mac-toplami tek deger. Frontend fixture'a join eder (tff1: source_match_id=event id;
-- tsl: takim adi+tarih, ileride).
create or replace view analytics.msm_gsheet_v1 as
with mt as (
  select * from football.match_team_stats where source = 'sofascore'
)
select
  h.source_match_id,
  case h.competition when 'Süper Lig' then 'tsl'
                     when 'Trendyol 1. Lig' then 'tff1'
                     else h.competition end                              as league,
  h.competition,
  h.match_datetime,
  case when extract(month from h.match_datetime) >= 7
       then extract(year from h.match_datetime)::int || '/' || (extract(year from h.match_datetime)::int + 1)
       else (extract(year from h.match_datetime)::int - 1) || '/' || extract(year from h.match_datetime)::int
  end                                                                    as season_label,
  h.source_team_id as home_team_id, h.team_name as home_team_name,
  a.source_team_id as away_team_id, a.team_name as away_team_name,
  -- FT
  h.score_for as ft_home, a.score_for as ft_away,
  -- Added time (mac seviyesi; ev satirindan)
  (h.sofascore_extras->>'added_time_1h')::int as added_time_1h,
  (h.sofascore_extras->>'added_time_2h')::int as added_time_2h,
  -- Card = sari + 2*kirmizi
  (h.sofascore_extras->>'card_total')::int as card_home, (a.sofascore_extras->>'card_total')::int as card_away,
  h.summary_corners_won as corner_home, a.summary_corners_won as corner_away,
  h.summary_shots as shot_home, a.summary_shots as shot_away,
  h.summary_shots_on_target as sot_home, a.summary_shots_on_target as sot_away,
  h.summary_fouls_conceded as foul_home, a.summary_fouls_conceded as foul_away,
  h.summary_offsides as offside_home, a.summary_offsides as offside_away,
  h.summary_saves as saves_home, a.summary_saves as saves_away,
  h.details_total_throws as throwin_home, a.details_total_throws as throwin_away,
  h.summary_tackles as tackle_home, a.summary_tackles as tackle_away,
  h.details_goal_kicks as goalkick_home, a.details_goal_kicks as goalkick_away,
  (h.sofascore_extras->>'possession_pct')::numeric as possession_home,
  (a.sofascore_extras->>'possession_pct')::numeric as possession_away,
  -- mavi grup: mac toplami
  (coalesce(h.summary_red_cards,0) + coalesce(a.summary_red_cards,0))                             as rc_total,
  (coalesce((h.sofascore_extras->>'var_count')::int,0) + coalesce((a.sofascore_extras->>'var_count')::int,0)) as var_total,
  (coalesce((h.sofascore_extras->>'penalties')::int,0) + coalesce((a.sofascore_extras->>'penalties')::int,0)) as pen_total,
  (coalesce(h.details_hit_woodwork,0) + coalesce(a.details_hit_woodwork,0))                       as woodwork_total,
  (coalesce((h.sofascore_extras->>'own_goals')::int,0) + coalesce((a.sofascore_extras->>'own_goals')::int,0)) as owngoal_total
from mt h
join mt a
  on a.source_match_id = h.source_match_id
 and h.team_side = 'home' and a.team_side = 'away';

grant select on analytics.msm_gsheet_v1 to anon, authenticated, service_role;
