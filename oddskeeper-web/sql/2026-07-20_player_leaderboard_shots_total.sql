-- 2026-07-20: Oyuncu lider tablosuna turetilmis "shots_total" metrigi
--
-- Sorun: "Shots" oyuncu tarafinda turetilmis bir metrik (attempts_ibox +
-- attempts_obox); player_metric_leaderboard_v1 tablosunda hic yok, bu
-- yuzden siralama sayfasinda Sut bos geliyordu.
-- Cozum: player_metric_leaderboard_current view'i, v1 tablosunun uzerine
-- pencere fonksiyonlariyla siralanmis shots_total satirlarini ekler.
-- v1 tazelendiginde turetilmis satirlar da otomatik guncellenir.
--
-- Not: v1 tablosunda ayni (sezon, lig, havuz, metrik, oyuncu, takim)
-- anahtari icin farkli rank degerleriyle mukerrer satirlar var (tazeleme
-- isi iki gecis yazmis). View her iki kolda DISTINCT ON ile anahtar basina
-- tek satir secer (daha iyi rank tercih edilir). Kok neden v1 refresh
-- isinde; kalici temizlik ayrica yapilmali.
--
-- UYGULANDI: 2026-07-20

CREATE OR REPLACE VIEW analytics.player_metric_leaderboard_current AS
SELECT
  season_label, competition, player_source_id, player_name, position_code,
  role_group, source_team_id, team_slug, team_name, metric_key, metric_label,
  category_key, category_label, total_value, per_match_value, per90_value,
  home_value, away_value, last5_value, league_avg, league_median, league_rank,
  league_percentile, vs_league_avg_abs, vs_league_avg_pct, rank_direction,
  is_higher_better, value_format, home_away_gap_abs, sample_matches,
  coverage_flag, player_pool, ranking_pool, ranking_value, is_qualified,
  recent_activity_flag, qualification_minutes_threshold,
  qualification_apps_threshold, qualification_reason, refreshed_at,
  refresh_batch_label
FROM (
  SELECT DISTINCT ON (season_label, competition, ranking_pool, metric_key, player_source_id, source_team_id) *
  FROM analytics.player_metric_leaderboard_v1
  ORDER BY season_label, competition, ranking_pool, metric_key, player_source_id, source_team_id, league_rank ASC NULLS LAST
) v1

UNION ALL

SELECT
  s.season_label, s.competition, s.player_source_id, s.player_name,
  s.position_code, s.role_group, s.source_team_id, s.team_slug, s.team_name,
  s.metric_key, s.metric_label, s.category_key, s.category_label,
  s.total_value, s.per_match_value, s.per90_value, s.home_value, s.away_value,
  s.last5_value,
  (avg(s.per90_value) FILTER (WHERE s.is_qualified)
    OVER w)::numeric AS league_avg,
  NULL::numeric AS league_median,
  (CASE WHEN s.is_qualified THEN
    rank() OVER (
      PARTITION BY s.season_label, s.competition, s.ranking_pool
      ORDER BY CASE WHEN s.is_qualified THEN s.per90_value END DESC NULLS LAST
    )
  END)::integer AS league_rank,
  NULL::numeric AS league_percentile,
  (s.per90_value - avg(s.per90_value) FILTER (WHERE s.is_qualified) OVER w
    )::numeric AS vs_league_avg_abs,
  (CASE
    WHEN avg(s.per90_value) FILTER (WHERE s.is_qualified) OVER w > 0 THEN
      (s.per90_value - avg(s.per90_value) FILTER (WHERE s.is_qualified) OVER w)
      / avg(s.per90_value) FILTER (WHERE s.is_qualified) OVER w * 100
  END)::numeric AS vs_league_avg_pct,
  'desc'::text AS rank_direction,
  true AS is_higher_better,
  'integer'::text AS value_format,
  abs(s.home_value - s.away_value)::numeric AS home_away_gap_abs,
  s.sample_matches, s.coverage_flag, s.player_pool, s.ranking_pool,
  s.per90_value AS ranking_value, s.is_qualified, s.recent_activity_flag,
  s.qualification_minutes_threshold, s.qualification_apps_threshold,
  s.qualification_reason, s.refreshed_at, s.refresh_batch_label
FROM (
  SELECT
    a.season_label, a.competition, a.player_source_id, a.player_name,
    a.position_code, a.role_group, a.source_team_id, a.team_slug, a.team_name,
    'shots_total'::text AS metric_key,
    'Shots'::text AS metric_label,
    'shooting'::text AS category_key,
    'Shooting'::text AS category_label,
    a.total_value + b.total_value AS total_value,
    a.per_match_value + b.per_match_value AS per_match_value,
    a.per90_value + b.per90_value AS per90_value,
    a.home_value + b.home_value AS home_value,
    a.away_value + b.away_value AS away_value,
    a.last5_value + b.last5_value AS last5_value,
    a.sample_matches, a.coverage_flag, a.player_pool, a.ranking_pool,
    a.is_qualified, a.recent_activity_flag,
    a.qualification_minutes_threshold, a.qualification_apps_threshold,
    a.qualification_reason, a.refreshed_at, a.refresh_batch_label
  FROM (
    SELECT DISTINCT ON (season_label, competition, ranking_pool, metric_key, player_source_id, source_team_id) *
    FROM analytics.player_metric_leaderboard_v1
    WHERE metric_key = 'attempts_ibox_total'
    ORDER BY season_label, competition, ranking_pool, metric_key, player_source_id, source_team_id, league_rank ASC NULLS LAST
  ) a
  JOIN (
    SELECT DISTINCT ON (season_label, competition, ranking_pool, metric_key, player_source_id, source_team_id) *
    FROM analytics.player_metric_leaderboard_v1
    WHERE metric_key = 'attempts_obox_total'
    ORDER BY season_label, competition, ranking_pool, metric_key, player_source_id, source_team_id, league_rank ASC NULLS LAST
  ) b
    ON b.player_source_id = a.player_source_id
   AND b.season_label = a.season_label
   AND b.competition = a.competition
   AND b.source_team_id IS NOT DISTINCT FROM a.source_team_id
   AND b.ranking_pool = a.ranking_pool
   AND b.player_pool = a.player_pool
) s
WINDOW w AS (PARTITION BY s.season_label, s.competition, s.ranking_pool);
