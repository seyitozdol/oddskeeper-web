-- 2026-08-19_drop_unused_indexes.sql geri alma: birebir orijinal tanimlar
-- (pg_indexes'ten drop oncesi alindi).

CREATE INDEX idx_player_leaderboard_rows_metric_rank ON analytics.player_leaderboard_rows_v1 USING btree (competition, season_label, metric_key, league_rank);
CREATE INDEX idx_player_leaderboard_rows_metric_team ON analytics.player_leaderboard_rows_v1 USING btree (competition, season_label, metric_key, team_slug);
CREATE INDEX idx_player_qualification_v1_pool ON analytics.player_qualification_v1 USING btree (season_label, competition, player_pool);
CREATE INDEX idx_player_qualification_v1_qualified ON analytics.player_qualification_v1 USING btree (season_label, competition, is_qualified);
CREATE INDEX idx_player_qualification_v1_scope ON analytics.player_qualification_v1 USING btree (season_label, competition);
CREATE INDEX idx_player_qualification_v1_team ON analytics.player_qualification_v1 USING btree (season_label, competition, source_team_id);
CREATE INDEX idx_prediction_match_shots_v1_is_active ON analytics.prediction_match_shots_v1 USING btree (is_active);
CREATE INDEX idx_team_leaderboard_catalog_comp_season ON analytics.team_leaderboard_metric_catalog_v1 USING btree (competition, season_label, category_sort, metric_sort, metric_label);
CREATE INDEX idx_team_leaderboard_rows_metric_rank ON analytics.team_leaderboard_rows_v1 USING btree (competition, season_label, metric_key, league_rank);
CREATE INDEX sofascore_squad_current_player_idx ON football.sofascore_squad_current USING btree (sofascore_player_id);
CREATE INDEX sofascore_squad_current_team_slug_idx ON football.sofascore_squad_current USING btree (team_slug);
