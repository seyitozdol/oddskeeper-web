-- 2026-08-13: Season History mukerrer sezon duzeltmesi.
--
-- team_statistics_summary_v1 satirlari (team_slug, team_source_id) bazliydi;
-- fikstur duzeltmesi icin ref.team_mapping'e eklenen SOFASCORE takim id'leri
-- ayni sezonu ikinci kez toplatti (opta + sofascore ayni maclari tasiyor) ->
-- takim sayfasi Season History'de 2025/2026 iki kez gorunuyordu. Cozum:
-- (team_slug, competition, season_label) basina TEK satir; played cok olan,
-- esitlikte opta (numerik olmayan id) tercih edilir.

create or replace view analytics.team_statistics_summary_v1 as
select team_slug, team_source_id, team_name, competition, season_label,
       played, wins, draws, losses, goals_for, goals_against, goal_difference,
       points, win_rate_pct, points_per_game, goals_for_per_game,
       goals_against_per_game, latest_match_datetime
from (
  select q.*,
         row_number() over (
           partition by q.team_slug, q.competition, q.season_label
           order by q.played desc,
                    (q.team_source_id ~ '^[0-9]+$')::int,
                    q.team_source_id
         ) as rn
  from (
 WITH team_match_base AS (
         SELECT tm.team_slug,
            tm.source_team_id AS team_source_id,
            tm.display_name AS team_name,
            m.competition,
            m.season_label,
            m.match_datetime,
                CASE
                    WHEN m.home_team_source_id = tm.source_team_id THEN true
                    ELSE false
                END AS is_home,
                CASE
                    WHEN m.away_team_source_id = tm.source_team_id THEN true
                    ELSE false
                END AS is_away,
                CASE
                    WHEN m.home_team_source_id = tm.source_team_id THEN m.home_score
                    ELSE m.away_score
                END AS team_score,
                CASE
                    WHEN m.home_team_source_id = tm.source_team_id THEN m.away_score
                    ELSE m.home_score
                END AS opponent_score,
                CASE
                    WHEN m.winner_team_source_id = tm.source_team_id THEN 1
                    ELSE 0
                END AS win_flag,
                CASE
                    WHEN m.winner_team_source_id IS NULL THEN 1
                    ELSE 0
                END AS draw_flag,
                CASE
                    WHEN m.winner_team_source_id IS NOT NULL AND m.winner_team_source_id <> tm.source_team_id THEN 1
                    ELSE 0
                END AS loss_flag
           FROM ref.team_mapping tm
             JOIN football.matches m ON m.home_team_source_id = tm.source_team_id OR m.away_team_source_id = tm.source_team_id
          WHERE tm.is_active = true AND tm.source_team_id IS NOT NULL AND m.season_label IS NOT NULL AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
        )
 SELECT team_slug,
    team_source_id,
    team_name,
    competition,
    season_label,
    count(*)::integer AS played,
    sum(win_flag)::integer AS wins,
    sum(draw_flag)::integer AS draws,
    sum(loss_flag)::integer AS losses,
    sum(team_score)::integer AS goals_for,
    sum(opponent_score)::integer AS goals_against,
    (sum(team_score) - sum(opponent_score))::integer AS goal_difference,
    (sum(win_flag) * 3 + sum(draw_flag))::integer AS points,
    round(sum(win_flag)::numeric / NULLIF(count(*), 0)::numeric * 100::numeric, 2) AS win_rate_pct,
    round((sum(win_flag) * 3 + sum(draw_flag))::numeric / NULLIF(count(*), 0)::numeric, 2) AS points_per_game,
    round(sum(team_score)::numeric / NULLIF(count(*), 0)::numeric, 2) AS goals_for_per_game,
    round(sum(opponent_score)::numeric / NULLIF(count(*), 0)::numeric, 2) AS goals_against_per_game,
    max(match_datetime) AS latest_match_datetime
   FROM team_match_base
  GROUP BY team_slug, team_source_id, team_name, competition, season_label
  ) q
) r
where r.rn = 1;

grant select on analytics.team_statistics_summary_v1 to anon, authenticated, service_role;

notify pgrst, 'reload schema';
