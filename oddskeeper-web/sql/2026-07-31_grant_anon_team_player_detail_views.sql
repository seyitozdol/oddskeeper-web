-- Team/oyuncu/lig/maç detay analytics view'ları authenticated + service_role'e
-- grant'liydi ama anon'a DEĞİLDİ. DEV_AUTH_BYPASS anon rolünde çalıştığından
-- (bkz. tsl-experience-hub notu) football profil sayfaları dev'de boş dönüyordu
-- (Galatasaray dahil TÜM takımlar). Production kullanıcıları zaten authenticated
-- olduğundan prod etkilenmiyordu; bu grant dev'i prod'la eşitler ve TSL/1.Lig'den
-- köprülenen football profillerinin görünmesini sağlar.
-- pm_* / prediction / dc_predictions gibi model/market içi tablolar KASITEN hariç.

grant select on
  analytics.team_statistics_summary_v1,
  analytics.team_recent_form_v1,
  analytics.team_statistics_split_v1,
  analytics.team_detailed_metrics_v2_1,
  analytics.team_overview_advanced_v1,
  analytics.team_advanced_rule_catalog,
  analytics.team_metric_benchmarks_v1,
  analytics.team_current_squad_v1,
  analytics.team_current_squad_profile_v1,
  analytics.team_fixtures_v1,
  analytics.team_results_v1,
  analytics.team_squad_v1,
  analytics.team_leaderboard_rows_v1,
  analytics.player_detailed_metrics_global_v1,
  analytics.player_leaderboard_metric_catalog_v1,
  analytics.player_leaderboard_rows_v1,
  analytics.player_log_by_season_v1,
  analytics.player_log_season_avg_v1,
  analytics.player_match_log_v1,
  analytics.player_metric_benchmarks_v1,
  analytics.player_metric_by_season_v1,
  analytics.player_metric_leaderboard_current,
  analytics.player_overview_advanced_v1,
  analytics.league_fixtures_v1,
  analytics.league_overview_v1,
  analytics.league_results_v1,
  analytics.league_table_v1,
  analytics.match_incidents_v1,
  analytics.match_participants_v1,
  analytics.match_profile_v1,
  analytics.match_team_stats_v1
to anon;
