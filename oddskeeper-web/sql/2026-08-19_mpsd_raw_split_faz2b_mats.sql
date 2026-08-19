-- 2026-08-19: mpsd raw_stats yan tablo ayrimi FAZ 2 / ADIM B (matview gecisi)
--
-- 4 matview raw_stats'i yan tablodan okuyacak. Matview OR REPLACE desteklemez ve
-- her birinin ustunde bagimli view'lar var (PSM koprusu dahil) -> TEK transaction
-- icinde drop cascade + hepsini yeniden kur. DDL transactional: okuyucu ya eski
-- ya yeni hali gorur.
--
-- Tanimlar/indeksler/grant'lar canli katalogdan URETILDI. GRANT'lar relacl'dan
-- alindi (information_schema matview grant'larini GOSTERMEZ - bu tuzaga dikkat).
begin;
set local lock_timeout = '60s';
drop materialized view analytics.player_shot_zones_match_mat cascade;
drop materialized view analytics.ucl_player_season_stats_mat cascade;
drop materialized view analytics.uecl_player_season_stats_mat cascade;
drop materialized view analytics.uel_player_season_stats_mat cascade;

-- analytics.player_shot_zones_match_mat (3 indeks, 2 grant)
create materialized view analytics.player_shot_zones_match_mat as
 SELECT d.source_match_id,
    m.competition,
    m.season_label,
    m.match_datetime,
    d.source_player_id AS sofascore_player_id,
    om.opta_player_id,
    d.player_name,
    COALESCE(a.shots_total, 0::bigint) AS shots_total,
    COALESCE(a.shots_ibox, 0::bigint) AS shots_ibox,
    COALESCE(a.shots_obox, 0::bigint) AS shots_obox,
    COALESCE(a.sot_total, 0::bigint) AS sot_total,
    COALESCE(a.sot_ibox, 0::bigint) AS sot_ibox,
    COALESCE(a.sot_obox, 0::bigint) AS sot_obox,
    COALESCE(a.goals_ibox, 0::bigint) AS goals_ibox,
    COALESCE(a.goals_obox, 0::bigint) AS goals_obox
   FROM football.mpsd_with_raw d
     JOIN football.matches m ON m.source = 'sofascore'::text AND m.source_match_id = d.source_match_id
     LEFT JOIN ref.sofascore_opta_player_map om ON om.sofascore_player_id = d.source_player_id
     LEFT JOIN ( SELECT match_player_shots.source_match_id,
            match_player_shots.source_player_id,
            count(*) AS shots_total,
            count(*) FILTER (WHERE match_player_shots.is_in_box) AS shots_ibox,
            count(*) FILTER (WHERE NOT match_player_shots.is_in_box) AS shots_obox,
            count(*) FILTER (WHERE match_player_shots.is_on_target) AS sot_total,
            count(*) FILTER (WHERE match_player_shots.is_in_box AND match_player_shots.is_on_target) AS sot_ibox,
            count(*) FILTER (WHERE NOT match_player_shots.is_in_box AND match_player_shots.is_on_target) AS sot_obox,
            count(*) FILTER (WHERE match_player_shots.is_in_box AND match_player_shots.shot_type = 'goal'::text) AS goals_ibox,
            count(*) FILTER (WHERE NOT match_player_shots.is_in_box AND match_player_shots.shot_type = 'goal'::text) AS goals_obox
           FROM football.match_player_shots
          GROUP BY match_player_shots.source_match_id, match_player_shots.source_player_id) a ON a.source_match_id = d.source_match_id AND a.source_player_id = d.source_player_id
  WHERE d.source = 'sofascore'::text AND COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::numeric, 0::numeric) > 0::numeric;
CREATE UNIQUE INDEX idx_pszm_match_player ON analytics.player_shot_zones_match_mat USING btree (source_match_id, sofascore_player_id);
CREATE INDEX idx_pszm_season_sofa ON analytics.player_shot_zones_match_mat USING btree (season_label, sofascore_player_id);
CREATE INDEX idx_pszm_season_opta ON analytics.player_shot_zones_match_mat USING btree (season_label, opta_player_id);
grant select on analytics.player_shot_zones_match_mat to authenticated;
grant select, insert, update, delete on analytics.player_shot_zones_match_mat to service_role;

-- analytics.ucl_player_season_stats_mat (1 indeks, 2 grant)
create materialized view analytics.ucl_player_season_stats_mat as
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
           FROM football.mpsd_with_raw d
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
           FROM football.mpsd_with_raw d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Şampiyonlar Ligi'::text
        ), fs_agg AS (
         SELECT m.season_label,
            d.source_player_id AS player_id,
            round(sum((d.raw_stats ->> 'expectedGoals'::text)::numeric), 2) AS xg,
            round(sum((d.raw_stats ->> 'expectedGoalsOnTarget'::text)::numeric), 2) AS xgot,
            round(sum((d.raw_stats ->> 'expectedAssists'::text)::numeric), 2) AS xa,
            mode() WITHIN GROUP (ORDER BY (d.raw_stats ->> 'position'::text)) AS fs_position
           FROM football.mpsd_with_raw d
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
            ELSE COALESCE(fa.appearances, agg.appearances)
        END AS appearances,
        CASE
            WHEN agg.minutes > 0 THEN agg.starts
            ELSE COALESCE(fa.starts, agg.starts)
        END AS starts,
        CASE
            WHEN agg.minutes > 0 THEN agg.minutes
            ELSE COALESCE(fa.minutes, agg.minutes)
        END AS minutes,
        CASE
            WHEN agg.minutes > 0 THEN agg.goals
            ELSE COALESCE(fa.goals, agg.goals)
        END AS goals,
        CASE
            WHEN agg.minutes > 0 THEN agg.assists
            ELSE COALESCE(fa.assists, agg.assists)
        END AS assists,
        CASE
            WHEN agg.minutes > 0 THEN agg.own_goals
            ELSE COALESCE(fa.own_goals, agg.own_goals)
        END AS own_goals,
        CASE
            WHEN agg.minutes > 0 THEN agg.shots
            ELSE COALESCE(fa.shots, agg.shots)
        END AS shots,
        CASE
            WHEN agg.minutes > 0 THEN agg.shots_on_target
            ELSE COALESCE(fa.shots_on_target, agg.shots_on_target)
        END AS shots_on_target,
        CASE
            WHEN agg.minutes > 0 THEN agg.big_chances_missed
            ELSE COALESCE(fa.big_chances_missed, agg.big_chances_missed)
        END AS big_chances_missed,
        CASE
            WHEN agg.minutes > 0 THEN agg.hit_woodwork
            ELSE COALESCE(fa.hit_woodwork, agg.hit_woodwork)
        END AS hit_woodwork,
        CASE
            WHEN agg.minutes > 0 THEN agg.total_passes
            ELSE COALESCE(fa.total_passes, agg.total_passes)
        END AS total_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_passes
            ELSE COALESCE(fa.accurate_passes, agg.accurate_passes)
        END AS accurate_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.pass_accuracy
            ELSE COALESCE(fa.pass_accuracy, agg.pass_accuracy)
        END AS pass_accuracy,
        CASE
            WHEN agg.minutes > 0 THEN agg.key_passes
            ELSE COALESCE(fa.key_passes, agg.key_passes)
        END AS key_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.big_chances_created
            ELSE COALESCE(fa.big_chances_created, agg.big_chances_created)
        END AS big_chances_created,
        CASE
            WHEN agg.minutes > 0 THEN agg.crosses
            ELSE COALESCE(fa.crosses, agg.crosses)
        END AS crosses,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_crosses
            ELSE COALESCE(fa.accurate_crosses, agg.accurate_crosses)
        END AS accurate_crosses,
        CASE
            WHEN agg.minutes > 0 THEN agg.long_balls
            ELSE COALESCE(fa.long_balls, agg.long_balls)
        END AS long_balls,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_long_balls
            ELSE COALESCE(fa.accurate_long_balls, agg.accurate_long_balls)
        END AS accurate_long_balls,
        CASE
            WHEN agg.minutes > 0 THEN agg.tackles
            ELSE COALESCE(fa.tackles, agg.tackles)
        END AS tackles,
        CASE
            WHEN agg.minutes > 0 THEN agg.tackles_won
            ELSE COALESCE(fa.tackles_won, agg.tackles_won)
        END AS tackles_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.interceptions
            ELSE COALESCE(fa.interceptions, agg.interceptions)
        END AS interceptions,
        CASE
            WHEN agg.minutes > 0 THEN agg.clearances
            ELSE COALESCE(fa.clearances, agg.clearances)
        END AS clearances,
        CASE
            WHEN agg.minutes > 0 THEN agg.blocks
            ELSE COALESCE(fa.blocks, agg.blocks)
        END AS blocks,
        CASE
            WHEN agg.minutes > 0 THEN agg.ball_recoveries
            ELSE COALESCE(fa.ball_recoveries, agg.ball_recoveries)
        END AS ball_recoveries,
        CASE
            WHEN agg.minutes > 0 THEN agg.duels_won
            ELSE COALESCE(fa.duels_won, agg.duels_won)
        END AS duels_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.duels_lost
            ELSE COALESCE(fa.duels_lost, agg.duels_lost)
        END AS duels_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.aerials_won
            ELSE COALESCE(fa.aerials_won, agg.aerials_won)
        END AS aerials_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.aerials_lost
            ELSE COALESCE(fa.aerials_lost, agg.aerials_lost)
        END AS aerials_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.fouls
            ELSE COALESCE(fa.fouls, agg.fouls)
        END AS fouls,
        CASE
            WHEN agg.minutes > 0 THEN agg.was_fouled
            ELSE COALESCE(fa.was_fouled, agg.was_fouled)
        END AS was_fouled,
        CASE
            WHEN agg.minutes > 0 THEN agg.offsides
            ELSE COALESCE(fa.offsides, agg.offsides)
        END AS offsides,
        CASE
            WHEN agg.minutes > 0 THEN agg.dispossessed
            ELSE COALESCE(fa.dispossessed, agg.dispossessed)
        END AS dispossessed,
        CASE
            WHEN agg.minutes > 0 THEN agg.possession_lost
            ELSE COALESCE(fa.possession_lost, agg.possession_lost)
        END AS possession_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.dribbles_won
            ELSE COALESCE(fa.dribbles_won, agg.dribbles_won)
        END AS dribbles_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.dribbles_attempted
            ELSE COALESCE(fa.dribbles_attempted, agg.dribbles_attempted)
        END AS dribbles_attempted,
        CASE
            WHEN agg.minutes > 0 THEN agg.touches
            ELSE COALESCE(fa.touches, agg.touches)
        END AS touches,
        CASE
            WHEN agg.minutes > 0 THEN agg.saves
            ELSE COALESCE(fa.saves, agg.saves)
        END AS saves,
        CASE
            WHEN agg.minutes > 0 THEN agg.penalties_saved
            ELSE COALESCE(fa.penalties_saved, agg.penalties_saved)
        END AS penalties_saved,
        CASE
            WHEN agg.minutes > 0 THEN agg.errors_leading_to_shot
            ELSE COALESCE(fa.errors_leading_to_shot, agg.errors_leading_to_shot)
        END AS errors_leading_to_shot,
        CASE
            WHEN agg.minutes > 0 THEN agg.errors_leading_to_goal
            ELSE COALESCE(fa.errors_leading_to_goal, agg.errors_leading_to_goal)
        END AS errors_leading_to_goal,
        CASE
            WHEN agg.minutes > 0 THEN agg.rating_avg
            ELSE COALESCE(fa.rating_avg, agg.rating_avg)
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
     LEFT JOIN card_agg cc ON cc.season_label = agg.season_label AND cc.player_id = agg.player_id;
CREATE UNIQUE INDEX ucl_pss_mat_uq ON analytics.ucl_player_season_stats_mat USING btree (season_label, player_id, team_id);
grant select on analytics.ucl_player_season_stats_mat to authenticated;
grant select, insert, update, delete on analytics.ucl_player_season_stats_mat to service_role;

-- analytics.uecl_player_season_stats_mat (1 indeks, 2 grant)
create materialized view analytics.uecl_player_season_stats_mat as
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
           FROM football.mpsd_with_raw d
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
           FROM football.mpsd_with_raw d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Konferans Ligi'::text
        ), fs_agg AS (
         SELECT m.season_label,
            d.source_player_id AS player_id,
            round(sum((d.raw_stats ->> 'expectedGoals'::text)::numeric), 2) AS xg,
            round(sum((d.raw_stats ->> 'expectedGoalsOnTarget'::text)::numeric), 2) AS xgot,
            round(sum((d.raw_stats ->> 'expectedAssists'::text)::numeric), 2) AS xa,
            mode() WITHIN GROUP (ORDER BY (d.raw_stats ->> 'position'::text)) AS fs_position
           FROM football.mpsd_with_raw d
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
            ELSE COALESCE(fa.appearances, agg.appearances)
        END AS appearances,
        CASE
            WHEN agg.minutes > 0 THEN agg.starts
            ELSE COALESCE(fa.starts, agg.starts)
        END AS starts,
        CASE
            WHEN agg.minutes > 0 THEN agg.minutes
            ELSE COALESCE(fa.minutes, agg.minutes)
        END AS minutes,
        CASE
            WHEN agg.minutes > 0 THEN agg.goals
            ELSE COALESCE(fa.goals, agg.goals)
        END AS goals,
        CASE
            WHEN agg.minutes > 0 THEN agg.assists
            ELSE COALESCE(fa.assists, agg.assists)
        END AS assists,
        CASE
            WHEN agg.minutes > 0 THEN agg.own_goals
            ELSE COALESCE(fa.own_goals, agg.own_goals)
        END AS own_goals,
        CASE
            WHEN agg.minutes > 0 THEN agg.shots
            ELSE COALESCE(fa.shots, agg.shots)
        END AS shots,
        CASE
            WHEN agg.minutes > 0 THEN agg.shots_on_target
            ELSE COALESCE(fa.shots_on_target, agg.shots_on_target)
        END AS shots_on_target,
        CASE
            WHEN agg.minutes > 0 THEN agg.big_chances_missed
            ELSE COALESCE(fa.big_chances_missed, agg.big_chances_missed)
        END AS big_chances_missed,
        CASE
            WHEN agg.minutes > 0 THEN agg.hit_woodwork
            ELSE COALESCE(fa.hit_woodwork, agg.hit_woodwork)
        END AS hit_woodwork,
        CASE
            WHEN agg.minutes > 0 THEN agg.total_passes
            ELSE COALESCE(fa.total_passes, agg.total_passes)
        END AS total_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_passes
            ELSE COALESCE(fa.accurate_passes, agg.accurate_passes)
        END AS accurate_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.pass_accuracy
            ELSE COALESCE(fa.pass_accuracy, agg.pass_accuracy)
        END AS pass_accuracy,
        CASE
            WHEN agg.minutes > 0 THEN agg.key_passes
            ELSE COALESCE(fa.key_passes, agg.key_passes)
        END AS key_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.big_chances_created
            ELSE COALESCE(fa.big_chances_created, agg.big_chances_created)
        END AS big_chances_created,
        CASE
            WHEN agg.minutes > 0 THEN agg.crosses
            ELSE COALESCE(fa.crosses, agg.crosses)
        END AS crosses,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_crosses
            ELSE COALESCE(fa.accurate_crosses, agg.accurate_crosses)
        END AS accurate_crosses,
        CASE
            WHEN agg.minutes > 0 THEN agg.long_balls
            ELSE COALESCE(fa.long_balls, agg.long_balls)
        END AS long_balls,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_long_balls
            ELSE COALESCE(fa.accurate_long_balls, agg.accurate_long_balls)
        END AS accurate_long_balls,
        CASE
            WHEN agg.minutes > 0 THEN agg.tackles
            ELSE COALESCE(fa.tackles, agg.tackles)
        END AS tackles,
        CASE
            WHEN agg.minutes > 0 THEN agg.tackles_won
            ELSE COALESCE(fa.tackles_won, agg.tackles_won)
        END AS tackles_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.interceptions
            ELSE COALESCE(fa.interceptions, agg.interceptions)
        END AS interceptions,
        CASE
            WHEN agg.minutes > 0 THEN agg.clearances
            ELSE COALESCE(fa.clearances, agg.clearances)
        END AS clearances,
        CASE
            WHEN agg.minutes > 0 THEN agg.blocks
            ELSE COALESCE(fa.blocks, agg.blocks)
        END AS blocks,
        CASE
            WHEN agg.minutes > 0 THEN agg.ball_recoveries
            ELSE COALESCE(fa.ball_recoveries, agg.ball_recoveries)
        END AS ball_recoveries,
        CASE
            WHEN agg.minutes > 0 THEN agg.duels_won
            ELSE COALESCE(fa.duels_won, agg.duels_won)
        END AS duels_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.duels_lost
            ELSE COALESCE(fa.duels_lost, agg.duels_lost)
        END AS duels_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.aerials_won
            ELSE COALESCE(fa.aerials_won, agg.aerials_won)
        END AS aerials_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.aerials_lost
            ELSE COALESCE(fa.aerials_lost, agg.aerials_lost)
        END AS aerials_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.fouls
            ELSE COALESCE(fa.fouls, agg.fouls)
        END AS fouls,
        CASE
            WHEN agg.minutes > 0 THEN agg.was_fouled
            ELSE COALESCE(fa.was_fouled, agg.was_fouled)
        END AS was_fouled,
        CASE
            WHEN agg.minutes > 0 THEN agg.offsides
            ELSE COALESCE(fa.offsides, agg.offsides)
        END AS offsides,
        CASE
            WHEN agg.minutes > 0 THEN agg.dispossessed
            ELSE COALESCE(fa.dispossessed, agg.dispossessed)
        END AS dispossessed,
        CASE
            WHEN agg.minutes > 0 THEN agg.possession_lost
            ELSE COALESCE(fa.possession_lost, agg.possession_lost)
        END AS possession_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.dribbles_won
            ELSE COALESCE(fa.dribbles_won, agg.dribbles_won)
        END AS dribbles_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.dribbles_attempted
            ELSE COALESCE(fa.dribbles_attempted, agg.dribbles_attempted)
        END AS dribbles_attempted,
        CASE
            WHEN agg.minutes > 0 THEN agg.touches
            ELSE COALESCE(fa.touches, agg.touches)
        END AS touches,
        CASE
            WHEN agg.minutes > 0 THEN agg.saves
            ELSE COALESCE(fa.saves, agg.saves)
        END AS saves,
        CASE
            WHEN agg.minutes > 0 THEN agg.penalties_saved
            ELSE COALESCE(fa.penalties_saved, agg.penalties_saved)
        END AS penalties_saved,
        CASE
            WHEN agg.minutes > 0 THEN agg.errors_leading_to_shot
            ELSE COALESCE(fa.errors_leading_to_shot, agg.errors_leading_to_shot)
        END AS errors_leading_to_shot,
        CASE
            WHEN agg.minutes > 0 THEN agg.errors_leading_to_goal
            ELSE COALESCE(fa.errors_leading_to_goal, agg.errors_leading_to_goal)
        END AS errors_leading_to_goal,
        CASE
            WHEN agg.minutes > 0 THEN agg.rating_avg
            ELSE COALESCE(fa.rating_avg, agg.rating_avg)
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
     LEFT JOIN card_agg cc ON cc.season_label = agg.season_label AND cc.player_id = agg.player_id;
CREATE UNIQUE INDEX uecl_pss_mat_uq ON analytics.uecl_player_season_stats_mat USING btree (season_label, player_id, team_id);
grant select on analytics.uecl_player_season_stats_mat to authenticated;
grant select, insert, update, delete on analytics.uecl_player_season_stats_mat to service_role;

-- analytics.uel_player_season_stats_mat (1 indeks, 2 grant)
create materialized view analytics.uel_player_season_stats_mat as
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
           FROM football.mpsd_with_raw d
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
           FROM football.mpsd_with_raw d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Avrupa Ligi'::text
        ), fs_agg AS (
         SELECT m.season_label,
            d.source_player_id AS player_id,
            round(sum((d.raw_stats ->> 'expectedGoals'::text)::numeric), 2) AS xg,
            round(sum((d.raw_stats ->> 'expectedGoalsOnTarget'::text)::numeric), 2) AS xgot,
            round(sum((d.raw_stats ->> 'expectedAssists'::text)::numeric), 2) AS xa,
            mode() WITHIN GROUP (ORDER BY (d.raw_stats ->> 'position'::text)) AS fs_position
           FROM football.mpsd_with_raw d
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
            ELSE COALESCE(fa.appearances, agg.appearances)
        END AS appearances,
        CASE
            WHEN agg.minutes > 0 THEN agg.starts
            ELSE COALESCE(fa.starts, agg.starts)
        END AS starts,
        CASE
            WHEN agg.minutes > 0 THEN agg.minutes
            ELSE COALESCE(fa.minutes, agg.minutes)
        END AS minutes,
        CASE
            WHEN agg.minutes > 0 THEN agg.goals
            ELSE COALESCE(fa.goals, agg.goals)
        END AS goals,
        CASE
            WHEN agg.minutes > 0 THEN agg.assists
            ELSE COALESCE(fa.assists, agg.assists)
        END AS assists,
        CASE
            WHEN agg.minutes > 0 THEN agg.own_goals
            ELSE COALESCE(fa.own_goals, agg.own_goals)
        END AS own_goals,
        CASE
            WHEN agg.minutes > 0 THEN agg.shots
            ELSE COALESCE(fa.shots, agg.shots)
        END AS shots,
        CASE
            WHEN agg.minutes > 0 THEN agg.shots_on_target
            ELSE COALESCE(fa.shots_on_target, agg.shots_on_target)
        END AS shots_on_target,
        CASE
            WHEN agg.minutes > 0 THEN agg.big_chances_missed
            ELSE COALESCE(fa.big_chances_missed, agg.big_chances_missed)
        END AS big_chances_missed,
        CASE
            WHEN agg.minutes > 0 THEN agg.hit_woodwork
            ELSE COALESCE(fa.hit_woodwork, agg.hit_woodwork)
        END AS hit_woodwork,
        CASE
            WHEN agg.minutes > 0 THEN agg.total_passes
            ELSE COALESCE(fa.total_passes, agg.total_passes)
        END AS total_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_passes
            ELSE COALESCE(fa.accurate_passes, agg.accurate_passes)
        END AS accurate_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.pass_accuracy
            ELSE COALESCE(fa.pass_accuracy, agg.pass_accuracy)
        END AS pass_accuracy,
        CASE
            WHEN agg.minutes > 0 THEN agg.key_passes
            ELSE COALESCE(fa.key_passes, agg.key_passes)
        END AS key_passes,
        CASE
            WHEN agg.minutes > 0 THEN agg.big_chances_created
            ELSE COALESCE(fa.big_chances_created, agg.big_chances_created)
        END AS big_chances_created,
        CASE
            WHEN agg.minutes > 0 THEN agg.crosses
            ELSE COALESCE(fa.crosses, agg.crosses)
        END AS crosses,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_crosses
            ELSE COALESCE(fa.accurate_crosses, agg.accurate_crosses)
        END AS accurate_crosses,
        CASE
            WHEN agg.minutes > 0 THEN agg.long_balls
            ELSE COALESCE(fa.long_balls, agg.long_balls)
        END AS long_balls,
        CASE
            WHEN agg.minutes > 0 THEN agg.accurate_long_balls
            ELSE COALESCE(fa.accurate_long_balls, agg.accurate_long_balls)
        END AS accurate_long_balls,
        CASE
            WHEN agg.minutes > 0 THEN agg.tackles
            ELSE COALESCE(fa.tackles, agg.tackles)
        END AS tackles,
        CASE
            WHEN agg.minutes > 0 THEN agg.tackles_won
            ELSE COALESCE(fa.tackles_won, agg.tackles_won)
        END AS tackles_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.interceptions
            ELSE COALESCE(fa.interceptions, agg.interceptions)
        END AS interceptions,
        CASE
            WHEN agg.minutes > 0 THEN agg.clearances
            ELSE COALESCE(fa.clearances, agg.clearances)
        END AS clearances,
        CASE
            WHEN agg.minutes > 0 THEN agg.blocks
            ELSE COALESCE(fa.blocks, agg.blocks)
        END AS blocks,
        CASE
            WHEN agg.minutes > 0 THEN agg.ball_recoveries
            ELSE COALESCE(fa.ball_recoveries, agg.ball_recoveries)
        END AS ball_recoveries,
        CASE
            WHEN agg.minutes > 0 THEN agg.duels_won
            ELSE COALESCE(fa.duels_won, agg.duels_won)
        END AS duels_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.duels_lost
            ELSE COALESCE(fa.duels_lost, agg.duels_lost)
        END AS duels_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.aerials_won
            ELSE COALESCE(fa.aerials_won, agg.aerials_won)
        END AS aerials_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.aerials_lost
            ELSE COALESCE(fa.aerials_lost, agg.aerials_lost)
        END AS aerials_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.fouls
            ELSE COALESCE(fa.fouls, agg.fouls)
        END AS fouls,
        CASE
            WHEN agg.minutes > 0 THEN agg.was_fouled
            ELSE COALESCE(fa.was_fouled, agg.was_fouled)
        END AS was_fouled,
        CASE
            WHEN agg.minutes > 0 THEN agg.offsides
            ELSE COALESCE(fa.offsides, agg.offsides)
        END AS offsides,
        CASE
            WHEN agg.minutes > 0 THEN agg.dispossessed
            ELSE COALESCE(fa.dispossessed, agg.dispossessed)
        END AS dispossessed,
        CASE
            WHEN agg.minutes > 0 THEN agg.possession_lost
            ELSE COALESCE(fa.possession_lost, agg.possession_lost)
        END AS possession_lost,
        CASE
            WHEN agg.minutes > 0 THEN agg.dribbles_won
            ELSE COALESCE(fa.dribbles_won, agg.dribbles_won)
        END AS dribbles_won,
        CASE
            WHEN agg.minutes > 0 THEN agg.dribbles_attempted
            ELSE COALESCE(fa.dribbles_attempted, agg.dribbles_attempted)
        END AS dribbles_attempted,
        CASE
            WHEN agg.minutes > 0 THEN agg.touches
            ELSE COALESCE(fa.touches, agg.touches)
        END AS touches,
        CASE
            WHEN agg.minutes > 0 THEN agg.saves
            ELSE COALESCE(fa.saves, agg.saves)
        END AS saves,
        CASE
            WHEN agg.minutes > 0 THEN agg.penalties_saved
            ELSE COALESCE(fa.penalties_saved, agg.penalties_saved)
        END AS penalties_saved,
        CASE
            WHEN agg.minutes > 0 THEN agg.errors_leading_to_shot
            ELSE COALESCE(fa.errors_leading_to_shot, agg.errors_leading_to_shot)
        END AS errors_leading_to_shot,
        CASE
            WHEN agg.minutes > 0 THEN agg.errors_leading_to_goal
            ELSE COALESCE(fa.errors_leading_to_goal, agg.errors_leading_to_goal)
        END AS errors_leading_to_goal,
        CASE
            WHEN agg.minutes > 0 THEN agg.rating_avg
            ELSE COALESCE(fa.rating_avg, agg.rating_avg)
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
     LEFT JOIN card_agg cc ON cc.season_label = agg.season_label AND cc.player_id = agg.player_id;
CREATE UNIQUE INDEX uel_pss_mat_uq ON analytics.uel_player_season_stats_mat USING btree (season_label, player_id, team_id);
grant select on analytics.uel_player_season_stats_mat to authenticated;
grant select, insert, update, delete on analytics.uel_player_season_stats_mat to service_role;

-- bagimli view'lar (topolojik sira: lvl kucukten buyuge)

-- analytics.player_shot_zones_match_v1 (lvl1)
create view analytics.player_shot_zones_match_v1 as
 SELECT source_match_id,
    competition,
    season_label,
    match_datetime,
    sofascore_player_id,
    opta_player_id,
    player_name,
    shots_total,
    shots_ibox,
    shots_obox,
    sot_total,
    sot_ibox,
    sot_obox,
    goals_ibox,
    goals_obox
   FROM analytics.player_shot_zones_match_mat;
grant select on analytics.player_shot_zones_match_v1 to authenticated;
grant select, insert, update, delete on analytics.player_shot_zones_match_v1 to service_role;

-- analytics.player_shot_zones_season_v1 (lvl1)
create view analytics.player_shot_zones_season_v1 as
 SELECT sofascore_player_id,
    max(opta_player_id) AS opta_player_id,
    season_label,
    count(*) AS matches,
    avg(shots_total) AS shots_total,
    avg(shots_ibox) AS shots_ibox,
    avg(shots_obox) AS shots_obox,
    avg(sot_total) AS sot_total,
    avg(sot_ibox) AS sot_ibox,
    avg(sot_obox) AS sot_obox,
    avg(goals_ibox) AS goals_ibox,
    avg(goals_obox) AS goals_obox
   FROM analytics.player_shot_zones_match_mat
  WHERE competition IS NULL OR (competition <> ALL (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text]))
  GROUP BY sofascore_player_id, season_label;
grant select on analytics.player_shot_zones_season_v1 to authenticated;
grant select, insert, update, delete on analytics.player_shot_zones_season_v1 to service_role;

-- analytics.ucl_player_season_stats_v1 (lvl1)
create view analytics.ucl_player_season_stats_v1 as
 SELECT season_label,
    player_id,
    player_name,
    team_name,
    team_id,
    teams,
    position_code,
    appearances,
    starts,
    minutes,
    goals,
    assists,
    own_goals,
    shots,
    shots_on_target,
    big_chances_missed,
    hit_woodwork,
    total_passes,
    accurate_passes,
    pass_accuracy,
    key_passes,
    big_chances_created,
    crosses,
    accurate_crosses,
    long_balls,
    accurate_long_balls,
    tackles,
    tackles_won,
    interceptions,
    clearances,
    blocks,
    ball_recoveries,
    duels_won,
    duels_lost,
    aerials_won,
    aerials_lost,
    fouls,
    was_fouled,
    offsides,
    dispossessed,
    possession_lost,
    dribbles_won,
    dribbles_attempted,
    touches,
    saves,
    penalties_saved,
    errors_leading_to_shot,
    errors_leading_to_goal,
    rating_avg,
    km_covered,
    sprints,
    top_speed,
    xg,
    xgot,
    xa,
    yellow_cards,
    red_cards,
    fs_position
   FROM analytics.ucl_player_season_stats_mat;
grant select on analytics.ucl_player_season_stats_v1 to authenticated;
grant select, insert, update, delete on analytics.ucl_player_season_stats_v1 to service_role;

-- analytics.uecl_player_season_stats_v1 (lvl1)
create view analytics.uecl_player_season_stats_v1 as
 SELECT season_label,
    player_id,
    player_name,
    team_name,
    team_id,
    teams,
    position_code,
    appearances,
    starts,
    minutes,
    goals,
    assists,
    own_goals,
    shots,
    shots_on_target,
    big_chances_missed,
    hit_woodwork,
    total_passes,
    accurate_passes,
    pass_accuracy,
    key_passes,
    big_chances_created,
    crosses,
    accurate_crosses,
    long_balls,
    accurate_long_balls,
    tackles,
    tackles_won,
    interceptions,
    clearances,
    blocks,
    ball_recoveries,
    duels_won,
    duels_lost,
    aerials_won,
    aerials_lost,
    fouls,
    was_fouled,
    offsides,
    dispossessed,
    possession_lost,
    dribbles_won,
    dribbles_attempted,
    touches,
    saves,
    penalties_saved,
    errors_leading_to_shot,
    errors_leading_to_goal,
    rating_avg,
    km_covered,
    sprints,
    top_speed,
    xg,
    xgot,
    xa,
    yellow_cards,
    red_cards,
    fs_position
   FROM analytics.uecl_player_season_stats_mat;
grant select on analytics.uecl_player_season_stats_v1 to authenticated;
grant select, insert, update, delete on analytics.uecl_player_season_stats_v1 to service_role;

-- analytics.uel_player_season_stats_v1 (lvl1)
create view analytics.uel_player_season_stats_v1 as
 SELECT season_label,
    player_id,
    player_name,
    team_name,
    team_id,
    teams,
    position_code,
    appearances,
    starts,
    minutes,
    goals,
    assists,
    own_goals,
    shots,
    shots_on_target,
    big_chances_missed,
    hit_woodwork,
    total_passes,
    accurate_passes,
    pass_accuracy,
    key_passes,
    big_chances_created,
    crosses,
    accurate_crosses,
    long_balls,
    accurate_long_balls,
    tackles,
    tackles_won,
    interceptions,
    clearances,
    blocks,
    ball_recoveries,
    duels_won,
    duels_lost,
    aerials_won,
    aerials_lost,
    fouls,
    was_fouled,
    offsides,
    dispossessed,
    possession_lost,
    dribbles_won,
    dribbles_attempted,
    touches,
    saves,
    penalties_saved,
    errors_leading_to_shot,
    errors_leading_to_goal,
    rating_avg,
    km_covered,
    sprints,
    top_speed,
    xg,
    xgot,
    xa,
    yellow_cards,
    red_cards,
    fs_position
   FROM analytics.uel_player_season_stats_mat;
grant select on analytics.uel_player_season_stats_v1 to authenticated;
grant select, insert, update, delete on analytics.uel_player_season_stats_v1 to service_role;

-- analytics.player_shot_outcomes_season_v1 (lvl2)
create view analytics.player_shot_outcomes_season_v1 as
 WITH cnt AS (
         SELECT s.source_player_id,
            m.season_label,
            count(*) FILTER (WHERE s.shot_type = ANY (ARRAY['miss'::text, 'post'::text])) AS off_target_total,
            count(*) FILTER (WHERE s.shot_type = 'block'::text) AS blocked_total
           FROM football.match_player_shots s
             JOIN football.matches m ON m.source = s.source AND m.source_match_id = s.source_match_id
          WHERE m.competition IS NULL OR (m.competition <> ALL (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text]))
          GROUP BY s.source_player_id, m.season_label
        )
 SELECT z.opta_player_id,
    z.season_label,
    z.matches,
    COALESCE(c.off_target_total, 0::bigint)::numeric / NULLIF(z.matches, 0)::numeric AS shots_off_target,
    COALESCE(c.blocked_total, 0::bigint)::numeric / NULLIF(z.matches, 0)::numeric AS shots_blocked
   FROM analytics.player_shot_zones_season_v1 z
     LEFT JOIN cnt c ON c.source_player_id = z.sofascore_player_id AND c.season_label = z.season_label;
grant select on analytics.player_shot_outcomes_season_v1 to authenticated;
grant select, insert, update, delete on analytics.player_shot_outcomes_season_v1 to service_role;

-- analytics.ucl_team_season_stats_v1 (lvl2)
create view analytics.ucl_team_season_stats_v1 as
 WITH team_matches AS (
         SELECT matches.season_label,
            matches.home_team_source_id AS team_id,
            matches.home_team_name AS team_name,
            matches.home_score AS gf,
            matches.away_score AS ga
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'UEFA Şampiyonlar Ligi'::text
        UNION ALL
         SELECT matches.season_label,
            matches.away_team_source_id,
            matches.away_team_name,
            matches.away_score,
            matches.home_score
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'UEFA Şampiyonlar Ligi'::text
        ), standings AS (
         SELECT team_matches.season_label,
            team_matches.team_id,
            max(team_matches.team_name) AS team_name,
            count(*) AS played,
            count(*) FILTER (WHERE team_matches.gf > team_matches.ga) AS wins,
            count(*) FILTER (WHERE team_matches.gf = team_matches.ga) AS draws,
            count(*) FILTER (WHERE team_matches.gf < team_matches.ga) AS losses,
            sum(team_matches.gf) AS goals_for,
            sum(team_matches.ga) AS goals_against,
            sum(team_matches.gf) - sum(team_matches.ga) AS goal_diff,
            3 * count(*) FILTER (WHERE team_matches.gf > team_matches.ga) + count(*) FILTER (WHERE team_matches.gf = team_matches.ga) AS points,
            count(*) FILTER (WHERE team_matches.ga = 0) AS clean_sheets
           FROM team_matches
          GROUP BY team_matches.season_label, team_matches.team_id
        ), player_agg AS (
         SELECT m.season_label,
            d.source_team_id AS team_id,
            sum(COALESCE((d.raw_stats ->> 'totalShots'::text)::integer, 0)) AS shots,
            sum(COALESCE((d.raw_stats ->> 'onTargetScoringAttempt'::text)::integer, 0)) AS shots_on_target,
            sum(COALESCE((d.raw_stats ->> 'totalPass'::text)::integer, 0)) AS total_passes,
            sum(COALESCE((d.raw_stats ->> 'accuratePass'::text)::integer, 0)) AS accurate_passes,
            sum(COALESCE((d.raw_stats ->> 'keyPass'::text)::integer, 0)) AS key_passes,
            sum(COALESCE((d.raw_stats ->> 'bigChanceCreated'::text)::integer, 0)) AS big_chances_created,
            sum(COALESCE((d.raw_stats ->> 'totalTackle'::text)::integer, 0)) AS tackles,
            sum(COALESCE((d.raw_stats ->> 'interceptionWon'::text)::integer, 0)) AS interceptions,
            sum(COALESCE((d.raw_stats ->> 'fouls'::text)::integer, 0)) AS fouls,
            round(avg((d.raw_stats ->> 'rating'::text)::numeric) FILTER (WHERE COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0) > 0), 2) AS rating_avg,
            round(sum((d.raw_stats ->> 'kilometersCovered'::text)::numeric) / NULLIF(count(DISTINCT d.source_match_id) FILTER (WHERE d.raw_stats ? 'kilometersCovered'::text), 0)::numeric, 1) AS km_per_match
           FROM football.mpsd_with_raw d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Şampiyonlar Ligi'::text
          GROUP BY m.season_label, d.source_team_id
        ), team_xg AS (
         SELECT ucl_player_season_stats_v1.season_label,
            ucl_player_season_stats_v1.team_id,
            round(sum(ucl_player_season_stats_v1.xg), 2) AS xg
           FROM analytics.ucl_player_season_stats_v1
          WHERE ucl_player_season_stats_v1.xg IS NOT NULL
          GROUP BY ucl_player_season_stats_v1.season_label, ucl_player_season_stats_v1.team_id
        )
 SELECT s.season_label,
    s.team_id,
    s.team_name,
    s.played,
    s.wins,
    s.draws,
    s.losses,
    s.goals_for,
    s.goals_against,
    s.goal_diff,
    s.points,
    s.clean_sheets,
        CASE
            WHEN s.played > 0 THEN round(100.0 * s.wins::numeric / s.played::numeric, 1)
            ELSE NULL::numeric
        END AS win_pct,
    p.shots,
    p.shots_on_target,
    p.total_passes,
    p.accurate_passes,
        CASE
            WHEN p.total_passes > 0 THEN round(100.0 * p.accurate_passes::numeric / p.total_passes::numeric, 1)
            ELSE NULL::numeric
        END AS pass_accuracy,
    p.key_passes,
    p.big_chances_created,
    p.tackles,
    p.interceptions,
    p.fouls,
    p.rating_avg,
    p.km_per_match,
    tx.xg
   FROM standings s
     LEFT JOIN player_agg p ON p.season_label = s.season_label AND p.team_id = s.team_id
     LEFT JOIN team_xg tx ON tx.season_label = s.season_label AND tx.team_id = s.team_id;
grant select on analytics.ucl_team_season_stats_v1 to authenticated;
grant select, insert, update, delete on analytics.ucl_team_season_stats_v1 to service_role;

-- analytics.uecl_team_season_stats_v1 (lvl2)
create view analytics.uecl_team_season_stats_v1 as
 WITH team_matches AS (
         SELECT matches.season_label,
            matches.home_team_source_id AS team_id,
            matches.home_team_name AS team_name,
            matches.home_score AS gf,
            matches.away_score AS ga
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'UEFA Konferans Ligi'::text
        UNION ALL
         SELECT matches.season_label,
            matches.away_team_source_id,
            matches.away_team_name,
            matches.away_score,
            matches.home_score
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'UEFA Konferans Ligi'::text
        ), standings AS (
         SELECT team_matches.season_label,
            team_matches.team_id,
            max(team_matches.team_name) AS team_name,
            count(*) AS played,
            count(*) FILTER (WHERE team_matches.gf > team_matches.ga) AS wins,
            count(*) FILTER (WHERE team_matches.gf = team_matches.ga) AS draws,
            count(*) FILTER (WHERE team_matches.gf < team_matches.ga) AS losses,
            sum(team_matches.gf) AS goals_for,
            sum(team_matches.ga) AS goals_against,
            sum(team_matches.gf) - sum(team_matches.ga) AS goal_diff,
            3 * count(*) FILTER (WHERE team_matches.gf > team_matches.ga) + count(*) FILTER (WHERE team_matches.gf = team_matches.ga) AS points,
            count(*) FILTER (WHERE team_matches.ga = 0) AS clean_sheets
           FROM team_matches
          GROUP BY team_matches.season_label, team_matches.team_id
        ), player_agg AS (
         SELECT m.season_label,
            d.source_team_id AS team_id,
            sum(COALESCE((d.raw_stats ->> 'totalShots'::text)::integer, 0)) AS shots,
            sum(COALESCE((d.raw_stats ->> 'onTargetScoringAttempt'::text)::integer, 0)) AS shots_on_target,
            sum(COALESCE((d.raw_stats ->> 'totalPass'::text)::integer, 0)) AS total_passes,
            sum(COALESCE((d.raw_stats ->> 'accuratePass'::text)::integer, 0)) AS accurate_passes,
            sum(COALESCE((d.raw_stats ->> 'keyPass'::text)::integer, 0)) AS key_passes,
            sum(COALESCE((d.raw_stats ->> 'bigChanceCreated'::text)::integer, 0)) AS big_chances_created,
            sum(COALESCE((d.raw_stats ->> 'totalTackle'::text)::integer, 0)) AS tackles,
            sum(COALESCE((d.raw_stats ->> 'interceptionWon'::text)::integer, 0)) AS interceptions,
            sum(COALESCE((d.raw_stats ->> 'fouls'::text)::integer, 0)) AS fouls,
            round(avg((d.raw_stats ->> 'rating'::text)::numeric) FILTER (WHERE COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0) > 0), 2) AS rating_avg,
            round(sum((d.raw_stats ->> 'kilometersCovered'::text)::numeric) / NULLIF(count(DISTINCT d.source_match_id) FILTER (WHERE d.raw_stats ? 'kilometersCovered'::text), 0)::numeric, 1) AS km_per_match
           FROM football.mpsd_with_raw d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Konferans Ligi'::text
          GROUP BY m.season_label, d.source_team_id
        ), team_xg AS (
         SELECT uecl_player_season_stats_v1.season_label,
            uecl_player_season_stats_v1.team_id,
            round(sum(uecl_player_season_stats_v1.xg), 2) AS xg
           FROM analytics.uecl_player_season_stats_v1
          WHERE uecl_player_season_stats_v1.xg IS NOT NULL
          GROUP BY uecl_player_season_stats_v1.season_label, uecl_player_season_stats_v1.team_id
        )
 SELECT s.season_label,
    s.team_id,
    s.team_name,
    s.played,
    s.wins,
    s.draws,
    s.losses,
    s.goals_for,
    s.goals_against,
    s.goal_diff,
    s.points,
    s.clean_sheets,
        CASE
            WHEN s.played > 0 THEN round(100.0 * s.wins::numeric / s.played::numeric, 1)
            ELSE NULL::numeric
        END AS win_pct,
    p.shots,
    p.shots_on_target,
    p.total_passes,
    p.accurate_passes,
        CASE
            WHEN p.total_passes > 0 THEN round(100.0 * p.accurate_passes::numeric / p.total_passes::numeric, 1)
            ELSE NULL::numeric
        END AS pass_accuracy,
    p.key_passes,
    p.big_chances_created,
    p.tackles,
    p.interceptions,
    p.fouls,
    p.rating_avg,
    p.km_per_match,
    tx.xg
   FROM standings s
     LEFT JOIN player_agg p ON p.season_label = s.season_label AND p.team_id = s.team_id
     LEFT JOIN team_xg tx ON tx.season_label = s.season_label AND tx.team_id = s.team_id;
grant select on analytics.uecl_team_season_stats_v1 to authenticated;
grant select, insert, update, delete on analytics.uecl_team_season_stats_v1 to service_role;

-- analytics.uel_team_season_stats_v1 (lvl2)
create view analytics.uel_team_season_stats_v1 as
 WITH team_matches AS (
         SELECT matches.season_label,
            matches.home_team_source_id AS team_id,
            matches.home_team_name AS team_name,
            matches.home_score AS gf,
            matches.away_score AS ga
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'UEFA Avrupa Ligi'::text
        UNION ALL
         SELECT matches.season_label,
            matches.away_team_source_id,
            matches.away_team_name,
            matches.away_score,
            matches.home_score
           FROM football.matches
          WHERE matches.source = 'sofascore'::text AND matches.competition = 'UEFA Avrupa Ligi'::text
        ), standings AS (
         SELECT team_matches.season_label,
            team_matches.team_id,
            max(team_matches.team_name) AS team_name,
            count(*) AS played,
            count(*) FILTER (WHERE team_matches.gf > team_matches.ga) AS wins,
            count(*) FILTER (WHERE team_matches.gf = team_matches.ga) AS draws,
            count(*) FILTER (WHERE team_matches.gf < team_matches.ga) AS losses,
            sum(team_matches.gf) AS goals_for,
            sum(team_matches.ga) AS goals_against,
            sum(team_matches.gf) - sum(team_matches.ga) AS goal_diff,
            3 * count(*) FILTER (WHERE team_matches.gf > team_matches.ga) + count(*) FILTER (WHERE team_matches.gf = team_matches.ga) AS points,
            count(*) FILTER (WHERE team_matches.ga = 0) AS clean_sheets
           FROM team_matches
          GROUP BY team_matches.season_label, team_matches.team_id
        ), player_agg AS (
         SELECT m.season_label,
            d.source_team_id AS team_id,
            sum(COALESCE((d.raw_stats ->> 'totalShots'::text)::integer, 0)) AS shots,
            sum(COALESCE((d.raw_stats ->> 'onTargetScoringAttempt'::text)::integer, 0)) AS shots_on_target,
            sum(COALESCE((d.raw_stats ->> 'totalPass'::text)::integer, 0)) AS total_passes,
            sum(COALESCE((d.raw_stats ->> 'accuratePass'::text)::integer, 0)) AS accurate_passes,
            sum(COALESCE((d.raw_stats ->> 'keyPass'::text)::integer, 0)) AS key_passes,
            sum(COALESCE((d.raw_stats ->> 'bigChanceCreated'::text)::integer, 0)) AS big_chances_created,
            sum(COALESCE((d.raw_stats ->> 'totalTackle'::text)::integer, 0)) AS tackles,
            sum(COALESCE((d.raw_stats ->> 'interceptionWon'::text)::integer, 0)) AS interceptions,
            sum(COALESCE((d.raw_stats ->> 'fouls'::text)::integer, 0)) AS fouls,
            round(avg((d.raw_stats ->> 'rating'::text)::numeric) FILTER (WHERE COALESCE((d.raw_stats ->> 'minutesPlayed'::text)::integer, 0) > 0), 2) AS rating_avg,
            round(sum((d.raw_stats ->> 'kilometersCovered'::text)::numeric) / NULLIF(count(DISTINCT d.source_match_id) FILTER (WHERE d.raw_stats ? 'kilometersCovered'::text), 0)::numeric, 1) AS km_per_match
           FROM football.mpsd_with_raw d
             JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
          WHERE d.source = 'sofascore'::text AND m.competition = 'UEFA Avrupa Ligi'::text
          GROUP BY m.season_label, d.source_team_id
        ), team_xg AS (
         SELECT uel_player_season_stats_v1.season_label,
            uel_player_season_stats_v1.team_id,
            round(sum(uel_player_season_stats_v1.xg), 2) AS xg
           FROM analytics.uel_player_season_stats_v1
          WHERE uel_player_season_stats_v1.xg IS NOT NULL
          GROUP BY uel_player_season_stats_v1.season_label, uel_player_season_stats_v1.team_id
        )
 SELECT s.season_label,
    s.team_id,
    s.team_name,
    s.played,
    s.wins,
    s.draws,
    s.losses,
    s.goals_for,
    s.goals_against,
    s.goal_diff,
    s.points,
    s.clean_sheets,
        CASE
            WHEN s.played > 0 THEN round(100.0 * s.wins::numeric / s.played::numeric, 1)
            ELSE NULL::numeric
        END AS win_pct,
    p.shots,
    p.shots_on_target,
    p.total_passes,
    p.accurate_passes,
        CASE
            WHEN p.total_passes > 0 THEN round(100.0 * p.accurate_passes::numeric / p.total_passes::numeric, 1)
            ELSE NULL::numeric
        END AS pass_accuracy,
    p.key_passes,
    p.big_chances_created,
    p.tackles,
    p.interceptions,
    p.fouls,
    p.rating_avg,
    p.km_per_match,
    tx.xg
   FROM standings s
     LEFT JOIN player_agg p ON p.season_label = s.season_label AND p.team_id = s.team_id
     LEFT JOIN team_xg tx ON tx.season_label = s.season_label AND tx.team_id = s.team_id;
grant select on analytics.uel_team_season_stats_v1 to authenticated;
grant select, insert, update, delete on analytics.uel_team_season_stats_v1 to service_role;

-- analytics.psm_player_season_avg_bridge_v1 (lvl3)
create view analytics.psm_player_season_avg_bridge_v1 as
 WITH im AS (
         SELECT b.player_key,
            b.tslss_id
           FROM analytics.psm_id_bridge_v1 b
        ), plain AS (
         SELECT im.player_key,
            g.season_label,
            g.metric_key,
            g.per_match_value
           FROM analytics.tsl_ss_player_detailed_metrics_global_mat g
             JOIN im ON im.tslss_id = g.player_source_id
          WHERE g.season_label >= '2026/2027'::text AND (g.metric_key = ANY (ARRAY['goals_total'::text, 'assists_total'::text, 'expected_goals_total'::text, 'passes_total'::text, 'accurate_pass_total'::text, 'tackles_total'::text, 'fouls_conceded_total'::text, 'fouls_won_total'::text, 'cards_yellow_total'::text, 'cards_red_total'::text, 'offsides_total'::text, 'saves_total_total'::text, 'shots_total'::text, 'shots_on_target_total'::text]))
        ), zones AS (
         SELECT im.player_key,
            z.season_label,
            k.metric_key,
            k.val AS per_match_value
           FROM analytics.player_shot_zones_season_v1 z
             JOIN im ON im.tslss_id = z.opta_player_id
             CROSS JOIN LATERAL ( VALUES ('attempts_ibox_total'::text,z.shots_ibox), ('attempts_obox_total'::text,z.shots_obox), ('shots:sot_ibox'::text,z.sot_ibox), ('shots:sot_obox'::text,z.sot_obox)) k(metric_key, val)
          WHERE z.season_label >= '2026/2027'::text
        ), outcomes AS (
         SELECT im.player_key,
            o.season_label,
            k.metric_key,
            k.val AS per_match_value
           FROM analytics.player_shot_outcomes_season_v1 o
             JOIN im ON im.tslss_id = o.opta_player_id
             CROSS JOIN LATERAL ( VALUES ('log:shots_off_target'::text,o.shots_off_target), ('log:shots_blocked'::text,o.shots_blocked)) k(metric_key, val)
          WHERE o.season_label >= '2026/2027'::text
        )
 SELECT plain.player_key AS player_source_id,
    plain.season_label,
    plain.metric_key,
    plain.per_match_value
   FROM plain
  WHERE plain.per_match_value IS NOT NULL
UNION ALL
 SELECT zones.player_key AS player_source_id,
    zones.season_label,
    zones.metric_key,
    zones.per_match_value
   FROM zones
  WHERE zones.per_match_value IS NOT NULL
UNION ALL
 SELECT outcomes.player_key AS player_source_id,
    outcomes.season_label,
    outcomes.metric_key,
    outcomes.per_match_value
   FROM outcomes
  WHERE outcomes.per_match_value IS NOT NULL;
grant select on analytics.psm_player_season_avg_bridge_v1 to authenticated;
grant select, insert, update, delete on analytics.psm_player_season_avg_bridge_v1 to service_role;

commit;
