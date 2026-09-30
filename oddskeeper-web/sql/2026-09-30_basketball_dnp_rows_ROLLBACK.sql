-- ROLLBACK: 2026-09-30_basketball_dnp_rows.sql oncesi view tanimlari (DNP satirlari mac sayilir).
-- Yalniz geri donmek gerekirse uygulanir.

create or replace view analytics.bb_player_game_enriched_v1 as
 WITH tg AS (
         SELECT team_match_stats.season_label,
            team_match_stats.match_key,
            team_match_stats.match_date,
            team_match_stats.team_name,
            team_match_stats.home_away,
            team_match_stats.opponent_name,
            team_match_stats.opponent_slug,
            team_match_stats.points AS team_points,
            team_match_stats.opp_points AS team_opp_points,
            (COALESCE(team_match_stats.fg2a, 0) + COALESCE(team_match_stats.fg3a, 0)) AS team_fga,
            COALESCE(team_match_stats.fta, 0) AS team_fta,
            COALESCE(team_match_stats.turnovers, 0) AS team_tov,
            (((((COALESCE(team_match_stats.fg2a, 0) + COALESCE(team_match_stats.fg3a, 0)) - COALESCE(team_match_stats.oreb, 0)) + COALESCE(team_match_stats.turnovers, 0)))::numeric + (0.44 * (COALESCE(team_match_stats.fta, 0))::numeric)) AS team_poss
           FROM basketball.team_match_stats
        ), tgm AS (
         SELECT player_match_stats.season_label,
            player_match_stats.match_key,
            player_match_stats.match_date,
            player_match_stats.team_name,
            sum(COALESCE(player_match_stats.minutes, (0)::numeric)) AS team_minutes
           FROM basketball.player_match_stats
          GROUP BY player_match_stats.season_label, player_match_stats.match_key, player_match_stats.match_date, player_match_stats.team_name
        )
 SELECT p.id,
    p.source,
    p.season_label,
    p.competition,
    p.match_key,
    p.match_date,
    p.week,
    COALESCE(mrg.canonical_slug, p.player_slug) AS player_slug,
    COALESCE(mrg.canonical_name, p.player_name) AS player_name,
    p.team_slug,
    p.team_name,
    p.jersey_no,
    p.seconds_played,
    p.minutes,
    p.points,
    p.fg2m,
    p.fg2a,
    p.fg2_pct,
    p.fg3m,
    p.fg3a,
    p.fg3_pct,
    p.ftm,
    p.fta,
    p.ft_pct,
    p.oreb,
    p.dreb,
    p.treb,
    p.assists,
    p.turnovers,
    p.steals,
    p.blocks,
    p.blocks_against,
    p.fouls_drawn,
    p.fouls_committed,
    (COALESCE(p.fg2m, 0) + COALESCE(p.fg3m, 0)) AS fgm,
    (COALESCE(p.fg2a, 0) + COALESCE(p.fg3a, 0)) AS fga,
    tg.home_away,
    tg.opponent_name,
    tg.opponent_slug,
    tg.team_points,
    tg.team_opp_points,
    tg.team_fga,
    tg.team_fta,
    tg.team_tov,
    tg.team_poss,
    tgm.team_minutes
   FROM (((basketball.player_match_stats p
     LEFT JOIN analytics.bb_pm_player_merges mrg ON (((mrg.league = 'basketball'::text) AND (mrg.alias_slug = p.player_slug))))
     LEFT JOIN tg ON (((tg.season_label = p.season_label) AND (tg.match_key = p.match_key) AND (tg.match_date = p.match_date) AND (tg.team_name = p.team_name))))
     LEFT JOIN tgm ON (((tgm.season_label = p.season_label) AND (tgm.match_key = p.match_key) AND (tgm.match_date = p.match_date) AND (tgm.team_name = p.team_name))));

create or replace view analytics.bb_player_role_v1 as
 WITH cfg AS (
         SELECT COALESCE(max(model_config.value) FILTER (WHERE (model_config.key = 'role_starter_min'::text)), (22)::numeric) AS starter_min,
            COALESCE(max(model_config.value) FILTER (WHERE (model_config.key = 'role_rotation_min'::text)), (14)::numeric) AS rotation_min,
            COALESCE(max(model_config.value) FILTER (WHERE (model_config.key = 'role_bench_min'::text)), (8)::numeric) AS bench_min,
            COALESCE(max(model_config.value) FILTER (WHERE (model_config.key = 'role_avail_share'::text)), 0.5) AS avail_share,
            COALESCE(max(model_config.value) FILTER (WHERE (model_config.key = 'role_early_games_max'::text)), (6)::numeric) AS early_games_max,
            COALESCE(max(model_config.value) FILTER (WHERE (model_config.key = 'role_gap_weeks'::text)), (5)::numeric) AS gap_weeks,
            COALESCE(max(model_config.value) FILTER (WHERE (model_config.key = 'role_recent_join_weeks'::text)), (8)::numeric) AS recent_join_weeks
           FROM basketball.model_config
        ), tg AS (
         SELECT team_match_stats.season_label,
            team_match_stats.team_slug,
            count(*) AS team_games,
            max(team_match_stats.week) AS team_last_week
           FROM basketball.team_match_stats
          GROUP BY team_match_stats.season_label, team_match_stats.team_slug
        ), pp AS (
         SELECT p.season_label,
            p.team_slug,
            COALESCE(m.canonical_slug, p.player_slug) AS player_slug,
            max(COALESCE(m.canonical_name, p.player_name)) AS player_name,
            count(*) AS games,
            round(avg(COALESCE(p.minutes, (0)::numeric)), 1) AS avg_minutes,
            min(p.week) AS first_week,
            max(p.week) AS last_week
           FROM (basketball.player_match_stats p
             LEFT JOIN analytics.bb_pm_player_merges m ON (((m.league = 'basketball'::text) AND (m.alias_slug = p.player_slug))))
          GROUP BY p.season_label, p.team_slug, COALESCE(m.canonical_slug, p.player_slug)
        ), ea AS (
         SELECT DISTINCT l.bsl_player_slug,
            tl.bsl_team_slug,
            er.season_label
           FROM ((euroleague.player_bsl_link l
             JOIN analytics.el_player_role_v1 er ON ((er.player_slug = l.person_code)))
             JOIN euroleague.team_bsl_link tl ON ((tl.team_code = er.team_slug)))
          WHERE (er.role <> 'departed'::text)
        )
 SELECT pp.season_label,
    pp.team_slug,
    pp.player_slug,
    pp.player_name,
    pl."position",
    pp.games,
    pp.avg_minutes,
    pp.first_week,
    pp.last_week,
    tg.team_games,
    tg.team_last_week,
    (EXISTS ( SELECT 1
           FROM euroleague.team_bsl_link tl
          WHERE (tl.bsl_team_slug = pp.team_slug))) AS euro_team,
        CASE
            WHEN ((pp.last_week)::numeric <= ((tg.team_last_week)::numeric - cfg.gap_weeks)) THEN
            CASE
                WHEN (EXISTS ( SELECT 1
                   FROM ea
                  WHERE ((ea.bsl_player_slug = pp.player_slug) AND (ea.bsl_team_slug = pp.team_slug) AND (ea.season_label = pp.season_label)))) THEN 'euro_focus'::text
                ELSE 'departed'::text
            END
            WHEN (((pp.games)::numeric <= cfg.early_games_max) AND ((pp.first_week)::numeric >= ((tg.team_last_week)::numeric - cfg.recent_join_weeks))) THEN 'newcomer'::text
            WHEN ((pp.avg_minutes >= cfg.starter_min) AND ((pp.games)::numeric >= (cfg.avail_share * (tg.team_games)::numeric))) THEN 'starter'::text
            WHEN (pp.avg_minutes >= cfg.rotation_min) THEN 'rotation'::text
            WHEN (pp.avg_minutes >= cfg.bench_min) THEN 'limited'::text
            ELSE 'garbage'::text
        END AS role,
    pl.sofascore_player_id
   FROM (((pp
     JOIN tg ON (((tg.season_label = pp.season_label) AND (tg.team_slug = pp.team_slug))))
     CROSS JOIN cfg)
     LEFT JOIN basketball.players pl ON ((pl.player_slug = pp.player_slug)));

refresh materialized view analytics.bb_player_metric_window_v1;
refresh materialized view analytics.bb_player_metric_window_roster_v1;
