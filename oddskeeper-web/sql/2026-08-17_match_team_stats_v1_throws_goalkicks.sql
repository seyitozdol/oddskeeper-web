-- 2026-08-17: match_team_stats_v1 view'ina Taç (details_total_throws) ve
-- Kale Vuruşu (details_goal_kicks) kolonlarini ekle. Mac-detay ekraninda 10
-- takim-market kiyasi icin gerekli (Shot/SOT/Corner/Saves/Tackle/Throw-in/
-- Goal Kick/Foul/Card/Offside). CREATE OR REPLACE ile kolonlar SONA eklenir;
-- mevcut kolon sirasi/tipi degismedigi icin guvenli. anon select korunur.
create or replace view analytics.match_team_stats_v1 as
 SELECT mts.source_match_id,
    mp.competition,
    mp.match_datetime,
    mts.team_side,
    tm.team_slug,
    mts.source_team_id,
    mts.team_name,
    opp.team_slug AS opponent_team_slug,
    mts.opponent_team_source_id,
    mts.opponent_team_name,
    mts.score_for,
    mts.score_against,
    mts.result_code,
    mts.summary_goals,
    mts.summary_assists,
    mts.summary_red_cards,
    mts.summary_yellow_cards,
    mts.summary_corners_won,
    mts.summary_shots,
    mts.summary_shots_on_target,
    mts.summary_blocked_shots,
    mts.summary_passes,
    mts.summary_crosses,
    mts.summary_tackles,
    mts.summary_offsides,
    mts.summary_fouls_conceded,
    mts.summary_fouls_won,
    mts.summary_saves,
    mts.details_accurate_pass,
    mts.details_attempts_ibox,
    mts.details_attempts_obox,
    mts.details_expected_goals,
    mts.details_total_throws,
    mts.details_goal_kicks
   FROM football.match_team_stats mts
     LEFT JOIN analytics.match_profile_v1 mp ON mp.source_match_id = mts.source_match_id
     LEFT JOIN ref.team_mapping tm ON tm.source_team_id = mts.source_team_id AND tm.is_active = true
     LEFT JOIN ref.team_mapping opp ON opp.source_team_id = mts.opponent_team_source_id AND opp.is_active = true;

grant select on analytics.match_team_stats_v1 to anon;
