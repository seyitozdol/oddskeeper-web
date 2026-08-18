-- 2026-08-18: Avrupa kupasi sezon Players -> TAM FlashScore overlay.
-- SofaScore 26/27 bazi kupa maclarinda oyuncu-stat vermiyor (bos). Oyuncunun
-- gercek sofascore dakikasi yoksa (agg.minutes=0) TUM metrikler flash_all CTE
-- (FS, ref.flashscore_sofa_cup_player_map ile sofascore player id) uzerinden;
-- xG ailesi her zaman coalesce(sofa,FS). km/sprint/topspeed FS te yok.
-- Uretici: scratchpad/apply_cup_full_overlay.py (pg_get_viewdef + transform).

create table if not exists ref.flashscore_sofa_cup_player_map (
  flashscore_player_id text primary key, sofascore_player_id text not null,
  player_name text, match_method text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
grant select on ref.flashscore_sofa_cup_player_map to anon, authenticated, service_role;

create or replace view analytics.ucl_player_season_stats_v1 as
 WITH flash_all AS (
         SELECT m.season_label,
            map.sofascore_player_id AS player_id,
            count(*) FILTER (WHERE NULLIF(d.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text, ''::text)::numeric::integer > 0) AS appearances,
            count(*) FILTER (WHERE d.lineup_status = 'starter'::text) AS starts,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text, ''::text)::numeric::integer, 0)) AS minutes,
            round(avg(NULLIF(d.raw_stats ->> '_rating'::text, ''::text)::numeric) FILTER (WHERE NULLIF(d.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text, ''::text)::numeric::integer > 0), 2) AS rating_avg,
            round(sum(NULLIF(d.raw_stats ->> 'EXPECTED_GOALS'::text, ''::text)::numeric), 2) AS xg,
            round(sum(NULLIF(d.raw_stats ->> 'EXPECTED_GOALS_ON_TARGET'::text, ''::text)::numeric), 2) AS xgot,
            round(sum(NULLIF(d.raw_stats ->> 'EXPECTED_ASSISTS'::text, ''::text)::numeric), 2) AS xa,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CARDS_YELLOW'::text, ''::text)::numeric::integer, 0)) AS yellow_cards,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CARDS_RED'::text, ''::text)::numeric::integer, 0) + COALESCE(NULLIF(d.raw_stats ->> 'CARDS_YELLOW_SECOND'::text, ''::text)::numeric::integer, 0)) AS red_cards,
            mode() WITHIN GROUP (ORDER BY (d.raw_stats ->> '_position'::text)) AS fs_position,
                CASE
                    WHEN sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_TOTAL'::text, ''::text)::numeric::integer, 0)) > 0 THEN round(100.0 * sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_ACCURATE'::text, ''::text)::numeric::integer, 0))::numeric / sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_TOTAL'::text, ''::text)::numeric::integer, 0))::numeric, 1)
                    ELSE NULL::numeric
                END AS pass_accuracy,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'GOALS'::text, ''::text)::numeric::integer, 0)) AS goals,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'ASSISTS_GOAL'::text, ''::text)::numeric::integer, 0)) AS assists,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'GOALS_OWN'::text, ''::text)::numeric::integer, 0)) AS own_goals,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'SHOTS_TOTAL'::text, ''::text)::numeric::integer, 0)) AS shots,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'SHOTS_ON_TARGET'::text, ''::text)::numeric::integer, 0)) AS shots_on_target,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'BIG_CHANCES_MISSED'::text, ''::text)::numeric::integer, 0)) AS big_chances_missed,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'HIT_WOODWORK'::text, ''::text)::numeric::integer, 0)) AS hit_woodwork,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS total_passes,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_ACCURATE'::text, ''::text)::numeric::integer, 0)) AS accurate_passes,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'KEY_PASSES'::text, ''::text)::numeric::integer, 0)) AS key_passes,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'BIG_CHANCES_CREATED'::text, ''::text)::numeric::integer, 0)) AS big_chances_created,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CROSSES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS crosses,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CROSSES_ACCURATE'::text, ''::text)::numeric::integer, 0)) AS accurate_crosses,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'LONG_BALLS_TOTAL'::text, ''::text)::numeric::integer, 0)) AS long_balls,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'LONG_BALLS_ACCURATE'::text, ''::text)::numeric::integer, 0)) AS accurate_long_balls,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TACKLES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS tackles,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TACKLES_WON'::text, ''::text)::numeric::integer, 0)) AS tackles_won,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'INTERCEPTIONS'::text, ''::text)::numeric::integer, 0)) AS interceptions,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CLEARANCES'::text, ''::text)::numeric::integer, 0)) AS clearances,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'OUTFIELDER_BLOCKS'::text, ''::text)::numeric::integer, 0)) AS blocks,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'BALL_RECOVERIES'::text, ''::text)::numeric::integer, 0)) AS ball_recoveries,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'DUELS_WON'::text, ''::text)::numeric::integer, 0)) AS duels_won,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'DUELS_AERIAL_WON'::text, ''::text)::numeric::integer, 0)) AS aerials_won,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'FOULS_COMMITTED'::text, ''::text)::numeric::integer, 0)) AS fouls,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'FOULS_SUFFERED'::text, ''::text)::numeric::integer, 0)) AS was_fouled,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'OFFSIDES'::text, ''::text)::numeric::integer, 0)) AS offsides,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'DRIBBLES_WON'::text, ''::text)::numeric::integer, 0)) AS dribbles_won,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'DRIBBLES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS dribbles_attempted,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TOUCHES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS touches,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'SAVES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS saves,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'PENALTIES_SAVED'::text, ''::text)::numeric::integer, 0)) AS penalties_saved,
            GREATEST(sum(COALESCE(NULLIF(d.raw_stats ->> 'DUELS_TOTAL'::text, ''::text)::numeric::integer, 0) - COALESCE(NULLIF(d.raw_stats ->> 'DUELS_WON'::text, ''::text)::numeric::integer, 0)), 0::bigint) AS duels_lost,
            GREATEST(sum(COALESCE(NULLIF(d.raw_stats ->> 'DUELS_AERIAL_TOTAL'::text, ''::text)::numeric::integer, 0) - COALESCE(NULLIF(d.raw_stats ->> 'DUELS_AERIAL_WON'::text, ''::text)::numeric::integer, 0)), 0::bigint) AS aerials_lost,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TURNOVERS'::text, ''::text)::numeric::integer, 0)) AS dispossessed,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TURNOVERS'::text, ''::text)::numeric::integer, 0)) AS possession_lost,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'ERRORS_LEAD_TO_SHOT'::text, ''::text)::numeric::integer, 0)) AS errors_leading_to_shot,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'ERRORS_LEAD_TO_GOAL'::text, ''::text)::numeric::integer, 0)) AS errors_leading_to_goal
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
             JOIN ref.flashscore_sofa_cup_player_map map ON map.flashscore_player_id = d.source_player_id
          WHERE d.source = 'flashscore'::text AND m.competition = 'UEFA Şampiyonlar Ligi'::text
          GROUP BY m.season_label, map.sofascore_player_id
        ), base AS (
         SELECT m.season_label,
            d.source_player_id,
            d.player_name,
            d.team_name,
            d.source_team_id,
            d.position_code,
            d.lineup_status,
            m.match_datetime,
            COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0) AS minutes,
            (d.raw_stats ->> 'rating'::text)::numeric AS rating,
            COALESCE((d.raw_stats ->> 'goals'::text)::integer, 0) AS goals,
            COALESCE((d.raw_stats ->> 'goalAssist'::text)::integer, 0) AS assists,
            COALESCE((d.raw_stats ->> 'ownGoals'::text)::integer, 0) AS own_goals,
            COALESCE((d.raw_stats ->> 'totalShots'::text)::integer, 0) AS shots,
            COALESCE((d.raw_stats ->> 'onTargetScoringAttempt'::text)::integer, 0) AS shots_on_target,
            COALESCE((d.raw_stats ->> 'bigChanceMissed'::text)::integer, 0) AS big_chances_missed,
            COALESCE((d.raw_stats ->> 'hitWoodwork'::text)::integer, 0) AS hit_woodwork,
            COALESCE((d.raw_stats ->> 'totalPass'::text)::integer, 0) AS total_passes,
            COALESCE((d.raw_stats ->> 'accuratePass'::text)::integer, 0) AS accurate_passes,
            COALESCE((d.raw_stats ->> 'keyPass'::text)::integer, 0) AS key_passes,
            COALESCE((d.raw_stats ->> 'bigChanceCreated'::text)::integer, 0) AS big_chances_created,
            COALESCE((d.raw_stats ->> 'totalCross'::text)::integer, 0) AS crosses,
            COALESCE((d.raw_stats ->> 'accurateCross'::text)::integer, 0) AS accurate_crosses,
            COALESCE((d.raw_stats ->> 'totalLongBalls'::text)::integer, 0) AS long_balls,
            COALESCE((d.raw_stats ->> 'accurateLongBalls'::text)::integer, 0) AS accurate_long_balls,
            COALESCE((d.raw_stats ->> 'totalTackle'::text)::integer, 0) AS tackles,
            COALESCE((d.raw_stats ->> 'wonTackle'::text)::integer, 0) AS tackles_won,
            COALESCE((d.raw_stats ->> 'interceptionWon'::text)::integer, 0) AS interceptions,
            COALESCE((d.raw_stats ->> 'totalClearance'::text)::integer, 0) AS clearances,
            COALESCE((d.raw_stats ->> 'outfielderBlock'::text)::integer, 0) AS blocks,
            COALESCE((d.raw_stats ->> 'ballRecovery'::text)::integer, 0) AS ball_recoveries,
            COALESCE((d.raw_stats ->> 'duelWon'::text)::integer, 0) AS duels_won,
            COALESCE((d.raw_stats ->> 'duelLost'::text)::integer, 0) AS duels_lost,
            COALESCE((d.raw_stats ->> 'aerialWon'::text)::integer, 0) AS aerials_won,
            COALESCE((d.raw_stats ->> 'aerialLost'::text)::integer, 0) AS aerials_lost,
            COALESCE((d.raw_stats ->> 'fouls'::text)::integer, 0) AS fouls,
            COALESCE((d.raw_stats ->> 'wasFouled'::text)::integer, 0) AS was_fouled,
            COALESCE((d.raw_stats ->> 'totalOffside'::text)::integer, 0) AS offsides,
            COALESCE((d.raw_stats ->> 'dispossessed'::text)::integer, 0) AS dispossessed,
            COALESCE((d.raw_stats ->> 'possessionLostCtrl'::text)::integer, 0) AS possession_lost,
            COALESCE((d.raw_stats ->> 'wonContest'::text)::integer, 0) AS dribbles_won,
            COALESCE((d.raw_stats ->> 'totalContest'::text)::integer, 0) AS dribbles_attempted,
            COALESCE((d.raw_stats ->> 'touches'::text)::integer, 0) AS touches,
            COALESCE((d.raw_stats ->> 'saves'::text)::integer, 0) AS saves,
            COALESCE((d.raw_stats ->> 'penaltySave'::text)::integer, 0) AS penalties_saved,
            COALESCE((d.raw_stats ->> 'errorLeadToAShot'::text)::integer, 0) AS errors_leading_to_shot,
            COALESCE((d.raw_stats ->> 'errorLeadToAGoal'::text)::integer, 0) AS errors_leading_to_goal,
            (d.raw_stats ->> 'kilometersCovered'::text)::numeric AS km_covered,
            (d.raw_stats ->> 'numberOfSprints'::text)::integer AS sprints,
            (d.raw_stats ->> 'topSpeed'::text)::numeric AS top_speed
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Şampiyonlar Ligi'::text
        ), fs_agg AS (
         SELECT m.season_label,
            d.source_player_id AS player_id,
            round(sum((d.raw_stats ->> 'expectedGoals'::text)::numeric), 2) AS xg,
            round(sum((d.raw_stats ->> 'expectedGoalsOnTarget'::text)::numeric), 2) AS xgot,
            round(sum((d.raw_stats ->> 'expectedAssists'::text)::numeric), 2) AS xa,
            mode() WITHIN GROUP (ORDER BY (d.raw_stats ->> 'position'::text)) AS fs_position
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Şampiyonlar Ligi'::text
          GROUP BY m.season_label, d.source_player_id
        ), card_agg AS (
         SELECT m.season_label,
            pc.source_player_id AS player_id,
            count(*) FILTER (WHERE pc.card_class = 'yellow'::text) AS yellow_cards,
            count(*) FILTER (WHERE pc.card_class = ANY (ARRAY['red'::text, 'yellowRed'::text])) AS red_cards
           FROM football.match_player_cards pc
             JOIN football.matches m ON m.source = pc.source AND m.source_match_id = pc.source_match_id
          WHERE pc.source = 'sofascore'::text AND pc.on_pitch AND NOT pc.rescinded AND m.competition = 'UEFA Şampiyonlar Ligi'::text
          GROUP BY m.season_label, pc.source_player_id
        ), agg AS (
         SELECT base.season_label,
            base.source_player_id AS player_id,
            max(base.player_name) AS player_name,
            (array_agg(base.team_name ORDER BY base.match_datetime DESC))[1] AS team_name,
            (array_agg(base.source_team_id ORDER BY base.match_datetime DESC))[1] AS team_id,
            string_agg(DISTINCT base.team_name, ', '::text) AS teams,
            mode() WITHIN GROUP (ORDER BY base.position_code) AS position_code,
            count(*) FILTER (WHERE base.minutes > 0) AS appearances,
            count(*) FILTER (WHERE base.lineup_status = 'starter'::text) AS starts,
            sum(base.minutes) AS minutes,
            sum(base.goals) AS goals,
            sum(base.assists) AS assists,
            sum(base.own_goals) AS own_goals,
            sum(base.shots) AS shots,
            sum(base.shots_on_target) AS shots_on_target,
            sum(base.big_chances_missed) AS big_chances_missed,
            sum(base.hit_woodwork) AS hit_woodwork,
            sum(base.total_passes) AS total_passes,
            sum(base.accurate_passes) AS accurate_passes,
                CASE
                    WHEN sum(base.total_passes) > 0 THEN round(100.0 * sum(base.accurate_passes)::numeric / sum(base.total_passes)::numeric, 1)
                    ELSE NULL::numeric
                END AS pass_accuracy,
            sum(base.key_passes) AS key_passes,
            sum(base.big_chances_created) AS big_chances_created,
            sum(base.crosses) AS crosses,
            sum(base.accurate_crosses) AS accurate_crosses,
            sum(base.long_balls) AS long_balls,
            sum(base.accurate_long_balls) AS accurate_long_balls,
            sum(base.tackles) AS tackles,
            sum(base.tackles_won) AS tackles_won,
            sum(base.interceptions) AS interceptions,
            sum(base.clearances) AS clearances,
            sum(base.blocks) AS blocks,
            sum(base.ball_recoveries) AS ball_recoveries,
            sum(base.duels_won) AS duels_won,
            sum(base.duels_lost) AS duels_lost,
            sum(base.aerials_won) AS aerials_won,
            sum(base.aerials_lost) AS aerials_lost,
            sum(base.fouls) AS fouls,
            sum(base.was_fouled) AS was_fouled,
            sum(base.offsides) AS offsides,
            sum(base.dispossessed) AS dispossessed,
            sum(base.possession_lost) AS possession_lost,
            sum(base.dribbles_won) AS dribbles_won,
            sum(base.dribbles_attempted) AS dribbles_attempted,
            sum(base.touches) AS touches,
            sum(base.saves) AS saves,
            sum(base.penalties_saved) AS penalties_saved,
            sum(base.errors_leading_to_shot) AS errors_leading_to_shot,
            sum(base.errors_leading_to_goal) AS errors_leading_to_goal,
            round(avg(base.rating) FILTER (WHERE base.minutes > 0), 2) AS rating_avg,
            round(sum(base.km_covered), 1) AS km_covered,
            sum(base.sprints) AS sprints,
            max(base.top_speed) AS top_speed
           FROM base
          GROUP BY base.season_label, base.source_player_id
        )
 SELECT agg.season_label,
    agg.player_id,
    agg.player_name,
    agg.team_name,
    agg.team_id,
    agg.teams,
    agg.position_code,
        CASE
            WHEN agg.minutes > 0 THEN agg.appearances
            ELSE fa.appearances
        END AS appearances,
        CASE
            WHEN agg.minutes > 0 THEN agg.starts
            ELSE fa.starts
        END AS starts,
        CASE
            WHEN agg.minutes > 0 THEN agg.minutes
            ELSE fa.minutes
        END AS minutes,
        CASE
            WHEN agg.minutes > 0 THEN agg.goals
            ELSE fa.goals
        END AS goals,
        CASE
            WHEN agg.minutes > 0 THEN agg.assists
            ELSE fa.assists
        END AS assists,
        CASE
            WHEN agg.minutes > 0 THEN agg.own_goals
            ELSE fa.own_goals
        END AS own_goals,
        CASE
            WHEN agg.minutes > 0 THEN agg.shots
            ELSE fa.shots
        END AS shots,
        CASE
            WHEN agg.minutes > 0 THEN agg.shots_on_target
            ELSE fa.shots_on_target
        END AS shots_on_target,
        CASE
            WHEN agg.minutes > 0 THEN agg.big_chances_missed
            ELSE fa.big_chances_missed
        END AS big_chances_missed,
        CASE
            WHEN agg.minutes > 0 THEN agg.hit_woodwork
            ELSE fa.hit_woodwork
        END AS hit_woodwork,
        CASE
            WHEN agg.minutes > 0 THEN agg.total_passes
            ELSE fa.total_passes
        END AS total_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_passes
            ELSE fa.accurate_passes
        END AS accurate_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.pass_accuracy
            ELSE fa.pass_accuracy
        END AS pass_accuracy,
        CASE
            WHEN agg.minutes > 0 THEN agg.key_passes
            ELSE fa.key_passes
        END AS key_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.big_chances_created
            ELSE fa.big_chances_created
        END AS big_chances_created,
        CASE
            WHEN agg.minutes > 0 THEN agg.crosses
            ELSE fa.crosses
        END AS crosses,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_crosses
            ELSE fa.accurate_crosses
        END AS accurate_crosses,
        CASE
            WHEN agg.minutes > 0 THEN agg.long_balls
            ELSE fa.long_balls
        END AS long_balls,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_long_balls
            ELSE fa.accurate_long_balls
        END AS accurate_long_balls,
        CASE
            WHEN agg.minutes > 0 THEN agg.tackles
            ELSE fa.tackles
        END AS tackles,
        CASE
            WHEN agg.minutes > 0 THEN agg.tackles_won
            ELSE fa.tackles_won
        END AS tackles_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.interceptions
            ELSE fa.interceptions
        END AS interceptions,
        CASE
            WHEN agg.minutes > 0 THEN agg.clearances
            ELSE fa.clearances
        END AS clearances,
        CASE
            WHEN agg.minutes > 0 THEN agg.blocks
            ELSE fa.blocks
        END AS blocks,
        CASE
            WHEN agg.minutes > 0 THEN agg.ball_recoveries
            ELSE fa.ball_recoveries
        END AS ball_recoveries,
        CASE
            WHEN agg.minutes > 0 THEN agg.duels_won
            ELSE fa.duels_won
        END AS duels_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.duels_lost
            ELSE fa.duels_lost
        END AS duels_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.aerials_won
            ELSE fa.aerials_won
        END AS aerials_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.aerials_lost
            ELSE fa.aerials_lost
        END AS aerials_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.fouls
            ELSE fa.fouls
        END AS fouls,
        CASE
            WHEN agg.minutes > 0 THEN agg.was_fouled
            ELSE fa.was_fouled
        END AS was_fouled,
        CASE
            WHEN agg.minutes > 0 THEN agg.offsides
            ELSE fa.offsides
        END AS offsides,
        CASE
            WHEN agg.minutes > 0 THEN agg.dispossessed
            ELSE fa.dispossessed
        END AS dispossessed,
        CASE
            WHEN agg.minutes > 0 THEN agg.possession_lost
            ELSE fa.possession_lost
        END AS possession_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.dribbles_won
            ELSE fa.dribbles_won
        END AS dribbles_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.dribbles_attempted
            ELSE fa.dribbles_attempted
        END AS dribbles_attempted,
        CASE
            WHEN agg.minutes > 0 THEN agg.touches
            ELSE fa.touches
        END AS touches,
        CASE
            WHEN agg.minutes > 0 THEN agg.saves
            ELSE fa.saves
        END AS saves,
        CASE
            WHEN agg.minutes > 0 THEN agg.penalties_saved
            ELSE fa.penalties_saved
        END AS penalties_saved,
        CASE
            WHEN agg.minutes > 0 THEN agg.errors_leading_to_shot
            ELSE fa.errors_leading_to_shot
        END AS errors_leading_to_shot,
        CASE
            WHEN agg.minutes > 0 THEN agg.errors_leading_to_goal
            ELSE fa.errors_leading_to_goal
        END AS errors_leading_to_goal,
        CASE
            WHEN agg.minutes > 0 THEN agg.rating_avg
            ELSE fa.rating_avg
        END AS rating_avg,
    agg.km_covered,
    agg.sprints,
    agg.top_speed,
    COALESCE(fs.xg, fa.xg) AS xg,
    COALESCE(fs.xgot, fa.xgot) AS xgot,
    COALESCE(fs.xa, fa.xa) AS xa,
        CASE
            WHEN agg.minutes > 0 THEN COALESCE(cc.yellow_cards, 0::bigint)
            ELSE COALESCE(fa.yellow_cards, 0::bigint)
        END AS yellow_cards,
        CASE
            WHEN agg.minutes > 0 THEN COALESCE(cc.red_cards, 0::bigint)
            ELSE COALESCE(fa.red_cards, 0::bigint)
        END AS red_cards,
    COALESCE(fs.fs_position, fa.fs_position) AS fs_position
   FROM agg
     LEFT JOIN fs_agg fs ON fs.season_label = agg.season_label AND fs.player_id = agg.player_id
     LEFT JOIN flash_all fa ON fa.season_label = agg.season_label AND fa.player_id = agg.player_id
     LEFT JOIN card_agg cc ON cc.season_label = agg.season_label AND cc.player_id = agg.player_id;;
grant select on analytics.ucl_player_season_stats_v1 to anon, authenticated;

create or replace view analytics.uel_player_season_stats_v1 as
 WITH flash_all AS (
         SELECT m.season_label,
            map.sofascore_player_id AS player_id,
            count(*) FILTER (WHERE NULLIF(d.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text, ''::text)::numeric::integer > 0) AS appearances,
            count(*) FILTER (WHERE d.lineup_status = 'starter'::text) AS starts,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text, ''::text)::numeric::integer, 0)) AS minutes,
            round(avg(NULLIF(d.raw_stats ->> '_rating'::text, ''::text)::numeric) FILTER (WHERE NULLIF(d.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text, ''::text)::numeric::integer > 0), 2) AS rating_avg,
            round(sum(NULLIF(d.raw_stats ->> 'EXPECTED_GOALS'::text, ''::text)::numeric), 2) AS xg,
            round(sum(NULLIF(d.raw_stats ->> 'EXPECTED_GOALS_ON_TARGET'::text, ''::text)::numeric), 2) AS xgot,
            round(sum(NULLIF(d.raw_stats ->> 'EXPECTED_ASSISTS'::text, ''::text)::numeric), 2) AS xa,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CARDS_YELLOW'::text, ''::text)::numeric::integer, 0)) AS yellow_cards,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CARDS_RED'::text, ''::text)::numeric::integer, 0) + COALESCE(NULLIF(d.raw_stats ->> 'CARDS_YELLOW_SECOND'::text, ''::text)::numeric::integer, 0)) AS red_cards,
            mode() WITHIN GROUP (ORDER BY (d.raw_stats ->> '_position'::text)) AS fs_position,
                CASE
                    WHEN sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_TOTAL'::text, ''::text)::numeric::integer, 0)) > 0 THEN round(100.0 * sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_ACCURATE'::text, ''::text)::numeric::integer, 0))::numeric / sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_TOTAL'::text, ''::text)::numeric::integer, 0))::numeric, 1)
                    ELSE NULL::numeric
                END AS pass_accuracy,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'GOALS'::text, ''::text)::numeric::integer, 0)) AS goals,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'ASSISTS_GOAL'::text, ''::text)::numeric::integer, 0)) AS assists,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'GOALS_OWN'::text, ''::text)::numeric::integer, 0)) AS own_goals,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'SHOTS_TOTAL'::text, ''::text)::numeric::integer, 0)) AS shots,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'SHOTS_ON_TARGET'::text, ''::text)::numeric::integer, 0)) AS shots_on_target,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'BIG_CHANCES_MISSED'::text, ''::text)::numeric::integer, 0)) AS big_chances_missed,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'HIT_WOODWORK'::text, ''::text)::numeric::integer, 0)) AS hit_woodwork,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS total_passes,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_ACCURATE'::text, ''::text)::numeric::integer, 0)) AS accurate_passes,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'KEY_PASSES'::text, ''::text)::numeric::integer, 0)) AS key_passes,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'BIG_CHANCES_CREATED'::text, ''::text)::numeric::integer, 0)) AS big_chances_created,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CROSSES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS crosses,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CROSSES_ACCURATE'::text, ''::text)::numeric::integer, 0)) AS accurate_crosses,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'LONG_BALLS_TOTAL'::text, ''::text)::numeric::integer, 0)) AS long_balls,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'LONG_BALLS_ACCURATE'::text, ''::text)::numeric::integer, 0)) AS accurate_long_balls,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TACKLES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS tackles,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TACKLES_WON'::text, ''::text)::numeric::integer, 0)) AS tackles_won,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'INTERCEPTIONS'::text, ''::text)::numeric::integer, 0)) AS interceptions,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CLEARANCES'::text, ''::text)::numeric::integer, 0)) AS clearances,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'OUTFIELDER_BLOCKS'::text, ''::text)::numeric::integer, 0)) AS blocks,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'BALL_RECOVERIES'::text, ''::text)::numeric::integer, 0)) AS ball_recoveries,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'DUELS_WON'::text, ''::text)::numeric::integer, 0)) AS duels_won,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'DUELS_AERIAL_WON'::text, ''::text)::numeric::integer, 0)) AS aerials_won,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'FOULS_COMMITTED'::text, ''::text)::numeric::integer, 0)) AS fouls,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'FOULS_SUFFERED'::text, ''::text)::numeric::integer, 0)) AS was_fouled,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'OFFSIDES'::text, ''::text)::numeric::integer, 0)) AS offsides,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'DRIBBLES_WON'::text, ''::text)::numeric::integer, 0)) AS dribbles_won,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'DRIBBLES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS dribbles_attempted,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TOUCHES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS touches,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'SAVES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS saves,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'PENALTIES_SAVED'::text, ''::text)::numeric::integer, 0)) AS penalties_saved,
            GREATEST(sum(COALESCE(NULLIF(d.raw_stats ->> 'DUELS_TOTAL'::text, ''::text)::numeric::integer, 0) - COALESCE(NULLIF(d.raw_stats ->> 'DUELS_WON'::text, ''::text)::numeric::integer, 0)), 0::bigint) AS duels_lost,
            GREATEST(sum(COALESCE(NULLIF(d.raw_stats ->> 'DUELS_AERIAL_TOTAL'::text, ''::text)::numeric::integer, 0) - COALESCE(NULLIF(d.raw_stats ->> 'DUELS_AERIAL_WON'::text, ''::text)::numeric::integer, 0)), 0::bigint) AS aerials_lost,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TURNOVERS'::text, ''::text)::numeric::integer, 0)) AS dispossessed,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TURNOVERS'::text, ''::text)::numeric::integer, 0)) AS possession_lost,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'ERRORS_LEAD_TO_SHOT'::text, ''::text)::numeric::integer, 0)) AS errors_leading_to_shot,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'ERRORS_LEAD_TO_GOAL'::text, ''::text)::numeric::integer, 0)) AS errors_leading_to_goal
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
             JOIN ref.flashscore_sofa_cup_player_map map ON map.flashscore_player_id = d.source_player_id
          WHERE d.source = 'flashscore'::text AND m.competition = 'UEFA Avrupa Ligi'::text
          GROUP BY m.season_label, map.sofascore_player_id
        ), base AS (
         SELECT m.season_label,
            d.source_player_id,
            d.player_name,
            d.team_name,
            d.source_team_id,
            d.position_code,
            d.lineup_status,
            m.match_datetime,
            COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0) AS minutes,
            (d.raw_stats ->> 'rating'::text)::numeric AS rating,
            COALESCE((d.raw_stats ->> 'goals'::text)::integer, 0) AS goals,
            COALESCE((d.raw_stats ->> 'goalAssist'::text)::integer, 0) AS assists,
            COALESCE((d.raw_stats ->> 'ownGoals'::text)::integer, 0) AS own_goals,
            COALESCE((d.raw_stats ->> 'totalShots'::text)::integer, 0) AS shots,
            COALESCE((d.raw_stats ->> 'onTargetScoringAttempt'::text)::integer, 0) AS shots_on_target,
            COALESCE((d.raw_stats ->> 'bigChanceMissed'::text)::integer, 0) AS big_chances_missed,
            COALESCE((d.raw_stats ->> 'hitWoodwork'::text)::integer, 0) AS hit_woodwork,
            COALESCE((d.raw_stats ->> 'totalPass'::text)::integer, 0) AS total_passes,
            COALESCE((d.raw_stats ->> 'accuratePass'::text)::integer, 0) AS accurate_passes,
            COALESCE((d.raw_stats ->> 'keyPass'::text)::integer, 0) AS key_passes,
            COALESCE((d.raw_stats ->> 'bigChanceCreated'::text)::integer, 0) AS big_chances_created,
            COALESCE((d.raw_stats ->> 'totalCross'::text)::integer, 0) AS crosses,
            COALESCE((d.raw_stats ->> 'accurateCross'::text)::integer, 0) AS accurate_crosses,
            COALESCE((d.raw_stats ->> 'totalLongBalls'::text)::integer, 0) AS long_balls,
            COALESCE((d.raw_stats ->> 'accurateLongBalls'::text)::integer, 0) AS accurate_long_balls,
            COALESCE((d.raw_stats ->> 'totalTackle'::text)::integer, 0) AS tackles,
            COALESCE((d.raw_stats ->> 'wonTackle'::text)::integer, 0) AS tackles_won,
            COALESCE((d.raw_stats ->> 'interceptionWon'::text)::integer, 0) AS interceptions,
            COALESCE((d.raw_stats ->> 'totalClearance'::text)::integer, 0) AS clearances,
            COALESCE((d.raw_stats ->> 'outfielderBlock'::text)::integer, 0) AS blocks,
            COALESCE((d.raw_stats ->> 'ballRecovery'::text)::integer, 0) AS ball_recoveries,
            COALESCE((d.raw_stats ->> 'duelWon'::text)::integer, 0) AS duels_won,
            COALESCE((d.raw_stats ->> 'duelLost'::text)::integer, 0) AS duels_lost,
            COALESCE((d.raw_stats ->> 'aerialWon'::text)::integer, 0) AS aerials_won,
            COALESCE((d.raw_stats ->> 'aerialLost'::text)::integer, 0) AS aerials_lost,
            COALESCE((d.raw_stats ->> 'fouls'::text)::integer, 0) AS fouls,
            COALESCE((d.raw_stats ->> 'wasFouled'::text)::integer, 0) AS was_fouled,
            COALESCE((d.raw_stats ->> 'totalOffside'::text)::integer, 0) AS offsides,
            COALESCE((d.raw_stats ->> 'dispossessed'::text)::integer, 0) AS dispossessed,
            COALESCE((d.raw_stats ->> 'possessionLostCtrl'::text)::integer, 0) AS possession_lost,
            COALESCE((d.raw_stats ->> 'wonContest'::text)::integer, 0) AS dribbles_won,
            COALESCE((d.raw_stats ->> 'totalContest'::text)::integer, 0) AS dribbles_attempted,
            COALESCE((d.raw_stats ->> 'touches'::text)::integer, 0) AS touches,
            COALESCE((d.raw_stats ->> 'saves'::text)::integer, 0) AS saves,
            COALESCE((d.raw_stats ->> 'penaltySave'::text)::integer, 0) AS penalties_saved,
            COALESCE((d.raw_stats ->> 'errorLeadToAShot'::text)::integer, 0) AS errors_leading_to_shot,
            COALESCE((d.raw_stats ->> 'errorLeadToAGoal'::text)::integer, 0) AS errors_leading_to_goal,
            (d.raw_stats ->> 'kilometersCovered'::text)::numeric AS km_covered,
            (d.raw_stats ->> 'numberOfSprints'::text)::integer AS sprints,
            (d.raw_stats ->> 'topSpeed'::text)::numeric AS top_speed
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Avrupa Ligi'::text
        ), fs_agg AS (
         SELECT m.season_label,
            d.source_player_id AS player_id,
            round(sum((d.raw_stats ->> 'expectedGoals'::text)::numeric), 2) AS xg,
            round(sum((d.raw_stats ->> 'expectedGoalsOnTarget'::text)::numeric), 2) AS xgot,
            round(sum((d.raw_stats ->> 'expectedAssists'::text)::numeric), 2) AS xa,
            mode() WITHIN GROUP (ORDER BY (d.raw_stats ->> 'position'::text)) AS fs_position
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Avrupa Ligi'::text
          GROUP BY m.season_label, d.source_player_id
        ), card_agg AS (
         SELECT m.season_label,
            pc.source_player_id AS player_id,
            count(*) FILTER (WHERE pc.card_class = 'yellow'::text) AS yellow_cards,
            count(*) FILTER (WHERE pc.card_class = ANY (ARRAY['red'::text, 'yellowRed'::text])) AS red_cards
           FROM football.match_player_cards pc
             JOIN football.matches m ON m.source = pc.source AND m.source_match_id = pc.source_match_id
          WHERE pc.source = 'sofascore'::text AND pc.on_pitch AND NOT pc.rescinded AND m.competition = 'UEFA Avrupa Ligi'::text
          GROUP BY m.season_label, pc.source_player_id
        ), agg AS (
         SELECT base.season_label,
            base.source_player_id AS player_id,
            max(base.player_name) AS player_name,
            (array_agg(base.team_name ORDER BY base.match_datetime DESC))[1] AS team_name,
            (array_agg(base.source_team_id ORDER BY base.match_datetime DESC))[1] AS team_id,
            string_agg(DISTINCT base.team_name, ', '::text) AS teams,
            mode() WITHIN GROUP (ORDER BY base.position_code) AS position_code,
            count(*) FILTER (WHERE base.minutes > 0) AS appearances,
            count(*) FILTER (WHERE base.lineup_status = 'starter'::text) AS starts,
            sum(base.minutes) AS minutes,
            sum(base.goals) AS goals,
            sum(base.assists) AS assists,
            sum(base.own_goals) AS own_goals,
            sum(base.shots) AS shots,
            sum(base.shots_on_target) AS shots_on_target,
            sum(base.big_chances_missed) AS big_chances_missed,
            sum(base.hit_woodwork) AS hit_woodwork,
            sum(base.total_passes) AS total_passes,
            sum(base.accurate_passes) AS accurate_passes,
                CASE
                    WHEN sum(base.total_passes) > 0 THEN round(100.0 * sum(base.accurate_passes)::numeric / sum(base.total_passes)::numeric, 1)
                    ELSE NULL::numeric
                END AS pass_accuracy,
            sum(base.key_passes) AS key_passes,
            sum(base.big_chances_created) AS big_chances_created,
            sum(base.crosses) AS crosses,
            sum(base.accurate_crosses) AS accurate_crosses,
            sum(base.long_balls) AS long_balls,
            sum(base.accurate_long_balls) AS accurate_long_balls,
            sum(base.tackles) AS tackles,
            sum(base.tackles_won) AS tackles_won,
            sum(base.interceptions) AS interceptions,
            sum(base.clearances) AS clearances,
            sum(base.blocks) AS blocks,
            sum(base.ball_recoveries) AS ball_recoveries,
            sum(base.duels_won) AS duels_won,
            sum(base.duels_lost) AS duels_lost,
            sum(base.aerials_won) AS aerials_won,
            sum(base.aerials_lost) AS aerials_lost,
            sum(base.fouls) AS fouls,
            sum(base.was_fouled) AS was_fouled,
            sum(base.offsides) AS offsides,
            sum(base.dispossessed) AS dispossessed,
            sum(base.possession_lost) AS possession_lost,
            sum(base.dribbles_won) AS dribbles_won,
            sum(base.dribbles_attempted) AS dribbles_attempted,
            sum(base.touches) AS touches,
            sum(base.saves) AS saves,
            sum(base.penalties_saved) AS penalties_saved,
            sum(base.errors_leading_to_shot) AS errors_leading_to_shot,
            sum(base.errors_leading_to_goal) AS errors_leading_to_goal,
            round(avg(base.rating) FILTER (WHERE base.minutes > 0), 2) AS rating_avg,
            round(sum(base.km_covered), 1) AS km_covered,
            sum(base.sprints) AS sprints,
            max(base.top_speed) AS top_speed
           FROM base
          GROUP BY base.season_label, base.source_player_id
        )
 SELECT agg.season_label,
    agg.player_id,
    agg.player_name,
    agg.team_name,
    agg.team_id,
    agg.teams,
    agg.position_code,
        CASE
            WHEN agg.minutes > 0 THEN agg.appearances
            ELSE fa.appearances
        END AS appearances,
        CASE
            WHEN agg.minutes > 0 THEN agg.starts
            ELSE fa.starts
        END AS starts,
        CASE
            WHEN agg.minutes > 0 THEN agg.minutes
            ELSE fa.minutes
        END AS minutes,
        CASE
            WHEN agg.minutes > 0 THEN agg.goals
            ELSE fa.goals
        END AS goals,
        CASE
            WHEN agg.minutes > 0 THEN agg.assists
            ELSE fa.assists
        END AS assists,
        CASE
            WHEN agg.minutes > 0 THEN agg.own_goals
            ELSE fa.own_goals
        END AS own_goals,
        CASE
            WHEN agg.minutes > 0 THEN agg.shots
            ELSE fa.shots
        END AS shots,
        CASE
            WHEN agg.minutes > 0 THEN agg.shots_on_target
            ELSE fa.shots_on_target
        END AS shots_on_target,
        CASE
            WHEN agg.minutes > 0 THEN agg.big_chances_missed
            ELSE fa.big_chances_missed
        END AS big_chances_missed,
        CASE
            WHEN agg.minutes > 0 THEN agg.hit_woodwork
            ELSE fa.hit_woodwork
        END AS hit_woodwork,
        CASE
            WHEN agg.minutes > 0 THEN agg.total_passes
            ELSE fa.total_passes
        END AS total_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_passes
            ELSE fa.accurate_passes
        END AS accurate_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.pass_accuracy
            ELSE fa.pass_accuracy
        END AS pass_accuracy,
        CASE
            WHEN agg.minutes > 0 THEN agg.key_passes
            ELSE fa.key_passes
        END AS key_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.big_chances_created
            ELSE fa.big_chances_created
        END AS big_chances_created,
        CASE
            WHEN agg.minutes > 0 THEN agg.crosses
            ELSE fa.crosses
        END AS crosses,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_crosses
            ELSE fa.accurate_crosses
        END AS accurate_crosses,
        CASE
            WHEN agg.minutes > 0 THEN agg.long_balls
            ELSE fa.long_balls
        END AS long_balls,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_long_balls
            ELSE fa.accurate_long_balls
        END AS accurate_long_balls,
        CASE
            WHEN agg.minutes > 0 THEN agg.tackles
            ELSE fa.tackles
        END AS tackles,
        CASE
            WHEN agg.minutes > 0 THEN agg.tackles_won
            ELSE fa.tackles_won
        END AS tackles_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.interceptions
            ELSE fa.interceptions
        END AS interceptions,
        CASE
            WHEN agg.minutes > 0 THEN agg.clearances
            ELSE fa.clearances
        END AS clearances,
        CASE
            WHEN agg.minutes > 0 THEN agg.blocks
            ELSE fa.blocks
        END AS blocks,
        CASE
            WHEN agg.minutes > 0 THEN agg.ball_recoveries
            ELSE fa.ball_recoveries
        END AS ball_recoveries,
        CASE
            WHEN agg.minutes > 0 THEN agg.duels_won
            ELSE fa.duels_won
        END AS duels_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.duels_lost
            ELSE fa.duels_lost
        END AS duels_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.aerials_won
            ELSE fa.aerials_won
        END AS aerials_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.aerials_lost
            ELSE fa.aerials_lost
        END AS aerials_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.fouls
            ELSE fa.fouls
        END AS fouls,
        CASE
            WHEN agg.minutes > 0 THEN agg.was_fouled
            ELSE fa.was_fouled
        END AS was_fouled,
        CASE
            WHEN agg.minutes > 0 THEN agg.offsides
            ELSE fa.offsides
        END AS offsides,
        CASE
            WHEN agg.minutes > 0 THEN agg.dispossessed
            ELSE fa.dispossessed
        END AS dispossessed,
        CASE
            WHEN agg.minutes > 0 THEN agg.possession_lost
            ELSE fa.possession_lost
        END AS possession_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.dribbles_won
            ELSE fa.dribbles_won
        END AS dribbles_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.dribbles_attempted
            ELSE fa.dribbles_attempted
        END AS dribbles_attempted,
        CASE
            WHEN agg.minutes > 0 THEN agg.touches
            ELSE fa.touches
        END AS touches,
        CASE
            WHEN agg.minutes > 0 THEN agg.saves
            ELSE fa.saves
        END AS saves,
        CASE
            WHEN agg.minutes > 0 THEN agg.penalties_saved
            ELSE fa.penalties_saved
        END AS penalties_saved,
        CASE
            WHEN agg.minutes > 0 THEN agg.errors_leading_to_shot
            ELSE fa.errors_leading_to_shot
        END AS errors_leading_to_shot,
        CASE
            WHEN agg.minutes > 0 THEN agg.errors_leading_to_goal
            ELSE fa.errors_leading_to_goal
        END AS errors_leading_to_goal,
        CASE
            WHEN agg.minutes > 0 THEN agg.rating_avg
            ELSE fa.rating_avg
        END AS rating_avg,
    agg.km_covered,
    agg.sprints,
    agg.top_speed,
    COALESCE(fs.xg, fa.xg) AS xg,
    COALESCE(fs.xgot, fa.xgot) AS xgot,
    COALESCE(fs.xa, fa.xa) AS xa,
        CASE
            WHEN agg.minutes > 0 THEN COALESCE(cc.yellow_cards, 0::bigint)
            ELSE COALESCE(fa.yellow_cards, 0::bigint)
        END AS yellow_cards,
        CASE
            WHEN agg.minutes > 0 THEN COALESCE(cc.red_cards, 0::bigint)
            ELSE COALESCE(fa.red_cards, 0::bigint)
        END AS red_cards,
    COALESCE(fs.fs_position, fa.fs_position) AS fs_position
   FROM agg
     LEFT JOIN fs_agg fs ON fs.season_label = agg.season_label AND fs.player_id = agg.player_id
     LEFT JOIN flash_all fa ON fa.season_label = agg.season_label AND fa.player_id = agg.player_id
     LEFT JOIN card_agg cc ON cc.season_label = agg.season_label AND cc.player_id = agg.player_id;;
grant select on analytics.uel_player_season_stats_v1 to anon, authenticated;

create or replace view analytics.uecl_player_season_stats_v1 as
 WITH flash_all AS (
         SELECT m.season_label,
            map.sofascore_player_id AS player_id,
            count(*) FILTER (WHERE NULLIF(d.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text, ''::text)::numeric::integer > 0) AS appearances,
            count(*) FILTER (WHERE d.lineup_status = 'starter'::text) AS starts,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text, ''::text)::numeric::integer, 0)) AS minutes,
            round(avg(NULLIF(d.raw_stats ->> '_rating'::text, ''::text)::numeric) FILTER (WHERE NULLIF(d.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text, ''::text)::numeric::integer > 0), 2) AS rating_avg,
            round(sum(NULLIF(d.raw_stats ->> 'EXPECTED_GOALS'::text, ''::text)::numeric), 2) AS xg,
            round(sum(NULLIF(d.raw_stats ->> 'EXPECTED_GOALS_ON_TARGET'::text, ''::text)::numeric), 2) AS xgot,
            round(sum(NULLIF(d.raw_stats ->> 'EXPECTED_ASSISTS'::text, ''::text)::numeric), 2) AS xa,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CARDS_YELLOW'::text, ''::text)::numeric::integer, 0)) AS yellow_cards,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CARDS_RED'::text, ''::text)::numeric::integer, 0) + COALESCE(NULLIF(d.raw_stats ->> 'CARDS_YELLOW_SECOND'::text, ''::text)::numeric::integer, 0)) AS red_cards,
            mode() WITHIN GROUP (ORDER BY (d.raw_stats ->> '_position'::text)) AS fs_position,
                CASE
                    WHEN sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_TOTAL'::text, ''::text)::numeric::integer, 0)) > 0 THEN round(100.0 * sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_ACCURATE'::text, ''::text)::numeric::integer, 0))::numeric / sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_TOTAL'::text, ''::text)::numeric::integer, 0))::numeric, 1)
                    ELSE NULL::numeric
                END AS pass_accuracy,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'GOALS'::text, ''::text)::numeric::integer, 0)) AS goals,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'ASSISTS_GOAL'::text, ''::text)::numeric::integer, 0)) AS assists,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'GOALS_OWN'::text, ''::text)::numeric::integer, 0)) AS own_goals,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'SHOTS_TOTAL'::text, ''::text)::numeric::integer, 0)) AS shots,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'SHOTS_ON_TARGET'::text, ''::text)::numeric::integer, 0)) AS shots_on_target,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'BIG_CHANCES_MISSED'::text, ''::text)::numeric::integer, 0)) AS big_chances_missed,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'HIT_WOODWORK'::text, ''::text)::numeric::integer, 0)) AS hit_woodwork,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS total_passes,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'PASSES_ACCURATE'::text, ''::text)::numeric::integer, 0)) AS accurate_passes,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'KEY_PASSES'::text, ''::text)::numeric::integer, 0)) AS key_passes,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'BIG_CHANCES_CREATED'::text, ''::text)::numeric::integer, 0)) AS big_chances_created,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CROSSES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS crosses,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CROSSES_ACCURATE'::text, ''::text)::numeric::integer, 0)) AS accurate_crosses,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'LONG_BALLS_TOTAL'::text, ''::text)::numeric::integer, 0)) AS long_balls,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'LONG_BALLS_ACCURATE'::text, ''::text)::numeric::integer, 0)) AS accurate_long_balls,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TACKLES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS tackles,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TACKLES_WON'::text, ''::text)::numeric::integer, 0)) AS tackles_won,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'INTERCEPTIONS'::text, ''::text)::numeric::integer, 0)) AS interceptions,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'CLEARANCES'::text, ''::text)::numeric::integer, 0)) AS clearances,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'OUTFIELDER_BLOCKS'::text, ''::text)::numeric::integer, 0)) AS blocks,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'BALL_RECOVERIES'::text, ''::text)::numeric::integer, 0)) AS ball_recoveries,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'DUELS_WON'::text, ''::text)::numeric::integer, 0)) AS duels_won,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'DUELS_AERIAL_WON'::text, ''::text)::numeric::integer, 0)) AS aerials_won,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'FOULS_COMMITTED'::text, ''::text)::numeric::integer, 0)) AS fouls,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'FOULS_SUFFERED'::text, ''::text)::numeric::integer, 0)) AS was_fouled,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'OFFSIDES'::text, ''::text)::numeric::integer, 0)) AS offsides,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'DRIBBLES_WON'::text, ''::text)::numeric::integer, 0)) AS dribbles_won,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'DRIBBLES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS dribbles_attempted,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TOUCHES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS touches,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'SAVES_TOTAL'::text, ''::text)::numeric::integer, 0)) AS saves,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'PENALTIES_SAVED'::text, ''::text)::numeric::integer, 0)) AS penalties_saved,
            GREATEST(sum(COALESCE(NULLIF(d.raw_stats ->> 'DUELS_TOTAL'::text, ''::text)::numeric::integer, 0) - COALESCE(NULLIF(d.raw_stats ->> 'DUELS_WON'::text, ''::text)::numeric::integer, 0)), 0::bigint) AS duels_lost,
            GREATEST(sum(COALESCE(NULLIF(d.raw_stats ->> 'DUELS_AERIAL_TOTAL'::text, ''::text)::numeric::integer, 0) - COALESCE(NULLIF(d.raw_stats ->> 'DUELS_AERIAL_WON'::text, ''::text)::numeric::integer, 0)), 0::bigint) AS aerials_lost,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TURNOVERS'::text, ''::text)::numeric::integer, 0)) AS dispossessed,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'TURNOVERS'::text, ''::text)::numeric::integer, 0)) AS possession_lost,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'ERRORS_LEAD_TO_SHOT'::text, ''::text)::numeric::integer, 0)) AS errors_leading_to_shot,
            sum(COALESCE(NULLIF(d.raw_stats ->> 'ERRORS_LEAD_TO_GOAL'::text, ''::text)::numeric::integer, 0)) AS errors_leading_to_goal
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
             JOIN ref.flashscore_sofa_cup_player_map map ON map.flashscore_player_id = d.source_player_id
          WHERE d.source = 'flashscore'::text AND m.competition = 'UEFA Konferans Ligi'::text
          GROUP BY m.season_label, map.sofascore_player_id
        ), base AS (
         SELECT m.season_label,
            d.source_player_id,
            d.player_name,
            d.team_name,
            d.source_team_id,
            d.position_code,
            d.lineup_status,
            m.match_datetime,
            COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0) AS minutes,
            (d.raw_stats ->> 'rating'::text)::numeric AS rating,
            COALESCE((d.raw_stats ->> 'goals'::text)::integer, 0) AS goals,
            COALESCE((d.raw_stats ->> 'goalAssist'::text)::integer, 0) AS assists,
            COALESCE((d.raw_stats ->> 'ownGoals'::text)::integer, 0) AS own_goals,
            COALESCE((d.raw_stats ->> 'totalShots'::text)::integer, 0) AS shots,
            COALESCE((d.raw_stats ->> 'onTargetScoringAttempt'::text)::integer, 0) AS shots_on_target,
            COALESCE((d.raw_stats ->> 'bigChanceMissed'::text)::integer, 0) AS big_chances_missed,
            COALESCE((d.raw_stats ->> 'hitWoodwork'::text)::integer, 0) AS hit_woodwork,
            COALESCE((d.raw_stats ->> 'totalPass'::text)::integer, 0) AS total_passes,
            COALESCE((d.raw_stats ->> 'accuratePass'::text)::integer, 0) AS accurate_passes,
            COALESCE((d.raw_stats ->> 'keyPass'::text)::integer, 0) AS key_passes,
            COALESCE((d.raw_stats ->> 'bigChanceCreated'::text)::integer, 0) AS big_chances_created,
            COALESCE((d.raw_stats ->> 'totalCross'::text)::integer, 0) AS crosses,
            COALESCE((d.raw_stats ->> 'accurateCross'::text)::integer, 0) AS accurate_crosses,
            COALESCE((d.raw_stats ->> 'totalLongBalls'::text)::integer, 0) AS long_balls,
            COALESCE((d.raw_stats ->> 'accurateLongBalls'::text)::integer, 0) AS accurate_long_balls,
            COALESCE((d.raw_stats ->> 'totalTackle'::text)::integer, 0) AS tackles,
            COALESCE((d.raw_stats ->> 'wonTackle'::text)::integer, 0) AS tackles_won,
            COALESCE((d.raw_stats ->> 'interceptionWon'::text)::integer, 0) AS interceptions,
            COALESCE((d.raw_stats ->> 'totalClearance'::text)::integer, 0) AS clearances,
            COALESCE((d.raw_stats ->> 'outfielderBlock'::text)::integer, 0) AS blocks,
            COALESCE((d.raw_stats ->> 'ballRecovery'::text)::integer, 0) AS ball_recoveries,
            COALESCE((d.raw_stats ->> 'duelWon'::text)::integer, 0) AS duels_won,
            COALESCE((d.raw_stats ->> 'duelLost'::text)::integer, 0) AS duels_lost,
            COALESCE((d.raw_stats ->> 'aerialWon'::text)::integer, 0) AS aerials_won,
            COALESCE((d.raw_stats ->> 'aerialLost'::text)::integer, 0) AS aerials_lost,
            COALESCE((d.raw_stats ->> 'fouls'::text)::integer, 0) AS fouls,
            COALESCE((d.raw_stats ->> 'wasFouled'::text)::integer, 0) AS was_fouled,
            COALESCE((d.raw_stats ->> 'totalOffside'::text)::integer, 0) AS offsides,
            COALESCE((d.raw_stats ->> 'dispossessed'::text)::integer, 0) AS dispossessed,
            COALESCE((d.raw_stats ->> 'possessionLostCtrl'::text)::integer, 0) AS possession_lost,
            COALESCE((d.raw_stats ->> 'wonContest'::text)::integer, 0) AS dribbles_won,
            COALESCE((d.raw_stats ->> 'totalContest'::text)::integer, 0) AS dribbles_attempted,
            COALESCE((d.raw_stats ->> 'touches'::text)::integer, 0) AS touches,
            COALESCE((d.raw_stats ->> 'saves'::text)::integer, 0) AS saves,
            COALESCE((d.raw_stats ->> 'penaltySave'::text)::integer, 0) AS penalties_saved,
            COALESCE((d.raw_stats ->> 'errorLeadToAShot'::text)::integer, 0) AS errors_leading_to_shot,
            COALESCE((d.raw_stats ->> 'errorLeadToAGoal'::text)::integer, 0) AS errors_leading_to_goal,
            (d.raw_stats ->> 'kilometersCovered'::text)::numeric AS km_covered,
            (d.raw_stats ->> 'numberOfSprints'::text)::integer AS sprints,
            (d.raw_stats ->> 'topSpeed'::text)::numeric AS top_speed
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Konferans Ligi'::text
        ), fs_agg AS (
         SELECT m.season_label,
            d.source_player_id AS player_id,
            round(sum((d.raw_stats ->> 'expectedGoals'::text)::numeric), 2) AS xg,
            round(sum((d.raw_stats ->> 'expectedGoalsOnTarget'::text)::numeric), 2) AS xgot,
            round(sum((d.raw_stats ->> 'expectedAssists'::text)::numeric), 2) AS xa,
            mode() WITHIN GROUP (ORDER BY (d.raw_stats ->> 'position'::text)) AS fs_position
           FROM football.match_player_stats_details d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Konferans Ligi'::text
          GROUP BY m.season_label, d.source_player_id
        ), card_agg AS (
         SELECT m.season_label,
            pc.source_player_id AS player_id,
            count(*) FILTER (WHERE pc.card_class = 'yellow'::text) AS yellow_cards,
            count(*) FILTER (WHERE pc.card_class = ANY (ARRAY['red'::text, 'yellowRed'::text])) AS red_cards
           FROM football.match_player_cards pc
             JOIN football.matches m ON m.source = pc.source AND m.source_match_id = pc.source_match_id
          WHERE pc.source = 'sofascore'::text AND pc.on_pitch AND NOT pc.rescinded AND m.competition = 'UEFA Konferans Ligi'::text
          GROUP BY m.season_label, pc.source_player_id
        ), agg AS (
         SELECT base.season_label,
            base.source_player_id AS player_id,
            max(base.player_name) AS player_name,
            (array_agg(base.team_name ORDER BY base.match_datetime DESC))[1] AS team_name,
            (array_agg(base.source_team_id ORDER BY base.match_datetime DESC))[1] AS team_id,
            string_agg(DISTINCT base.team_name, ', '::text) AS teams,
            mode() WITHIN GROUP (ORDER BY base.position_code) AS position_code,
            count(*) FILTER (WHERE base.minutes > 0) AS appearances,
            count(*) FILTER (WHERE base.lineup_status = 'starter'::text) AS starts,
            sum(base.minutes) AS minutes,
            sum(base.goals) AS goals,
            sum(base.assists) AS assists,
            sum(base.own_goals) AS own_goals,
            sum(base.shots) AS shots,
            sum(base.shots_on_target) AS shots_on_target,
            sum(base.big_chances_missed) AS big_chances_missed,
            sum(base.hit_woodwork) AS hit_woodwork,
            sum(base.total_passes) AS total_passes,
            sum(base.accurate_passes) AS accurate_passes,
                CASE
                    WHEN sum(base.total_passes) > 0 THEN round(100.0 * sum(base.accurate_passes)::numeric / sum(base.total_passes)::numeric, 1)
                    ELSE NULL::numeric
                END AS pass_accuracy,
            sum(base.key_passes) AS key_passes,
            sum(base.big_chances_created) AS big_chances_created,
            sum(base.crosses) AS crosses,
            sum(base.accurate_crosses) AS accurate_crosses,
            sum(base.long_balls) AS long_balls,
            sum(base.accurate_long_balls) AS accurate_long_balls,
            sum(base.tackles) AS tackles,
            sum(base.tackles_won) AS tackles_won,
            sum(base.interceptions) AS interceptions,
            sum(base.clearances) AS clearances,
            sum(base.blocks) AS blocks,
            sum(base.ball_recoveries) AS ball_recoveries,
            sum(base.duels_won) AS duels_won,
            sum(base.duels_lost) AS duels_lost,
            sum(base.aerials_won) AS aerials_won,
            sum(base.aerials_lost) AS aerials_lost,
            sum(base.fouls) AS fouls,
            sum(base.was_fouled) AS was_fouled,
            sum(base.offsides) AS offsides,
            sum(base.dispossessed) AS dispossessed,
            sum(base.possession_lost) AS possession_lost,
            sum(base.dribbles_won) AS dribbles_won,
            sum(base.dribbles_attempted) AS dribbles_attempted,
            sum(base.touches) AS touches,
            sum(base.saves) AS saves,
            sum(base.penalties_saved) AS penalties_saved,
            sum(base.errors_leading_to_shot) AS errors_leading_to_shot,
            sum(base.errors_leading_to_goal) AS errors_leading_to_goal,
            round(avg(base.rating) FILTER (WHERE base.minutes > 0), 2) AS rating_avg,
            round(sum(base.km_covered), 1) AS km_covered,
            sum(base.sprints) AS sprints,
            max(base.top_speed) AS top_speed
           FROM base
          GROUP BY base.season_label, base.source_player_id
        )
 SELECT agg.season_label,
    agg.player_id,
    agg.player_name,
    agg.team_name,
    agg.team_id,
    agg.teams,
    agg.position_code,
        CASE
            WHEN agg.minutes > 0 THEN agg.appearances
            ELSE fa.appearances
        END AS appearances,
        CASE
            WHEN agg.minutes > 0 THEN agg.starts
            ELSE fa.starts
        END AS starts,
        CASE
            WHEN agg.minutes > 0 THEN agg.minutes
            ELSE fa.minutes
        END AS minutes,
        CASE
            WHEN agg.minutes > 0 THEN agg.goals
            ELSE fa.goals
        END AS goals,
        CASE
            WHEN agg.minutes > 0 THEN agg.assists
            ELSE fa.assists
        END AS assists,
        CASE
            WHEN agg.minutes > 0 THEN agg.own_goals
            ELSE fa.own_goals
        END AS own_goals,
        CASE
            WHEN agg.minutes > 0 THEN agg.shots
            ELSE fa.shots
        END AS shots,
        CASE
            WHEN agg.minutes > 0 THEN agg.shots_on_target
            ELSE fa.shots_on_target
        END AS shots_on_target,
        CASE
            WHEN agg.minutes > 0 THEN agg.big_chances_missed
            ELSE fa.big_chances_missed
        END AS big_chances_missed,
        CASE
            WHEN agg.minutes > 0 THEN agg.hit_woodwork
            ELSE fa.hit_woodwork
        END AS hit_woodwork,
        CASE
            WHEN agg.minutes > 0 THEN agg.total_passes
            ELSE fa.total_passes
        END AS total_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_passes
            ELSE fa.accurate_passes
        END AS accurate_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.pass_accuracy
            ELSE fa.pass_accuracy
        END AS pass_accuracy,
        CASE
            WHEN agg.minutes > 0 THEN agg.key_passes
            ELSE fa.key_passes
        END AS key_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.big_chances_created
            ELSE fa.big_chances_created
        END AS big_chances_created,
        CASE
            WHEN agg.minutes > 0 THEN agg.crosses
            ELSE fa.crosses
        END AS crosses,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_crosses
            ELSE fa.accurate_crosses
        END AS accurate_crosses,
        CASE
            WHEN agg.minutes > 0 THEN agg.long_balls
            ELSE fa.long_balls
        END AS long_balls,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_long_balls
            ELSE fa.accurate_long_balls
        END AS accurate_long_balls,
        CASE
            WHEN agg.minutes > 0 THEN agg.tackles
            ELSE fa.tackles
        END AS tackles,
        CASE
            WHEN agg.minutes > 0 THEN agg.tackles_won
            ELSE fa.tackles_won
        END AS tackles_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.interceptions
            ELSE fa.interceptions
        END AS interceptions,
        CASE
            WHEN agg.minutes > 0 THEN agg.clearances
            ELSE fa.clearances
        END AS clearances,
        CASE
            WHEN agg.minutes > 0 THEN agg.blocks
            ELSE fa.blocks
        END AS blocks,
        CASE
            WHEN agg.minutes > 0 THEN agg.ball_recoveries
            ELSE fa.ball_recoveries
        END AS ball_recoveries,
        CASE
            WHEN agg.minutes > 0 THEN agg.duels_won
            ELSE fa.duels_won
        END AS duels_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.duels_lost
            ELSE fa.duels_lost
        END AS duels_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.aerials_won
            ELSE fa.aerials_won
        END AS aerials_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.aerials_lost
            ELSE fa.aerials_lost
        END AS aerials_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.fouls
            ELSE fa.fouls
        END AS fouls,
        CASE
            WHEN agg.minutes > 0 THEN agg.was_fouled
            ELSE fa.was_fouled
        END AS was_fouled,
        CASE
            WHEN agg.minutes > 0 THEN agg.offsides
            ELSE fa.offsides
        END AS offsides,
        CASE
            WHEN agg.minutes > 0 THEN agg.dispossessed
            ELSE fa.dispossessed
        END AS dispossessed,
        CASE
            WHEN agg.minutes > 0 THEN agg.possession_lost
            ELSE fa.possession_lost
        END AS possession_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.dribbles_won
            ELSE fa.dribbles_won
        END AS dribbles_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.dribbles_attempted
            ELSE fa.dribbles_attempted
        END AS dribbles_attempted,
        CASE
            WHEN agg.minutes > 0 THEN agg.touches
            ELSE fa.touches
        END AS touches,
        CASE
            WHEN agg.minutes > 0 THEN agg.saves
            ELSE fa.saves
        END AS saves,
        CASE
            WHEN agg.minutes > 0 THEN agg.penalties_saved
            ELSE fa.penalties_saved
        END AS penalties_saved,
        CASE
            WHEN agg.minutes > 0 THEN agg.errors_leading_to_shot
            ELSE fa.errors_leading_to_shot
        END AS errors_leading_to_shot,
        CASE
            WHEN agg.minutes > 0 THEN agg.errors_leading_to_goal
            ELSE fa.errors_leading_to_goal
        END AS errors_leading_to_goal,
        CASE
            WHEN agg.minutes > 0 THEN agg.rating_avg
            ELSE fa.rating_avg
        END AS rating_avg,
    agg.km_covered,
    agg.sprints,
    agg.top_speed,
    COALESCE(fs.xg, fa.xg) AS xg,
    COALESCE(fs.xgot, fa.xgot) AS xgot,
    COALESCE(fs.xa, fa.xa) AS xa,
        CASE
            WHEN agg.minutes > 0 THEN COALESCE(cc.yellow_cards, 0::bigint)
            ELSE COALESCE(fa.yellow_cards, 0::bigint)
        END AS yellow_cards,
        CASE
            WHEN agg.minutes > 0 THEN COALESCE(cc.red_cards, 0::bigint)
            ELSE COALESCE(fa.red_cards, 0::bigint)
        END AS red_cards,
    COALESCE(fs.fs_position, fa.fs_position) AS fs_position
   FROM agg
     LEFT JOIN fs_agg fs ON fs.season_label = agg.season_label AND fs.player_id = agg.player_id
     LEFT JOIN flash_all fa ON fa.season_label = agg.season_label AND fa.player_id = agg.player_id
     LEFT JOIN card_agg cc ON cc.season_label = agg.season_label AND cc.player_id = agg.player_id;;
grant select on analytics.uecl_player_season_stats_v1 to anon, authenticated;
