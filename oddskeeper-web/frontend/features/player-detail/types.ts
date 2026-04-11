import { VALID_PLAYER_TABS } from "./constants";

export type ValidPlayerTab = (typeof VALID_PLAYER_TABS)[number];

export type PlayerProfileRow = {
  team_slug: string;
  team_source_id: string;
  source_team_id?: string | number | null;
  team_name: string;

  competition: string | null;
  season_label: string | null;

  player_source_id: string;
  player_name: string;
  player_slug: string;

  primary_position_code: string;
  position_group: string;

  appearances: number;
  starts: number;
  sub_appearances: number;
  starter_rate_pct: number | string | null;

  total_minutes: number;
  avg_minutes: number | string | null;

  goals: number;
  assists: number;

  first_match_datetime: string | null;
  last_match_datetime: string | null;
};

export type PlayerMatchLogRow = {
  player_slug: string;
  player_source_id: string | number;
  player_name: string;

  team_slug: string | null;
  team_source_id: string | null;
  source_team_id?: string | number | null;
  team_name: string | null;

  source_match_id: string;
  competition: string | null;
  season_label: string | null;
  match_datetime: string | null;

  is_home: boolean;
  is_away: boolean;

  opponent_name: string | null;
  opponent_team_name?: string | null;
  opponent_team_slug: string | null;

  score_display: string | null;
  result_code: "W" | "D" | "L" | null;
  result_label?: string | null;

  lineup_status: string | null;
  position_code: string | null;

  points: number | string | null;
  minutes_played: number | null;
  goals: number | null;
  assists: number | null;

  shots_on_target: number | null;
  shots_off_target: number | null;
  shots_blocked: number | null;

  passes: number | string | null;
  accurate_pass: number | null;
  crosses: number | string | null;

  tackles: number | null;
  interceptions: number | null;
  fouls_won: number | null;
  fouls_conceded: number | null;
  offsides: number | null;
  cards_yellow: number | null;
  cards_red: number | null;
  penalties_won: number | null;
  saves_total: number | null;

  expected_goals: number | string | null;
};

export type PlayerAdvancedMetricValue = string | number | boolean | null;

export type PlayerAdvancedOverviewRow = {
  season_label: string | null;
  competition: string | null;

  source_team_id: string | number | null;
  team_source_id?: string | number | null;
  team_slug: string | null;
  team_name: string | null;

  player_source_id: string | number | null;
  player_name: string | null;
  position_code: string | null;
  role_group: string | null;

  appearances: number | null;
  starts: number | null;
  sub_appearances: number | null;
  total_minutes: number | null;
  avg_minutes: number | null;

  usage_label: string | null;
  recent_form_label: string | null;

  primary_strength_metric_key: string | null;
  primary_strength_metric_label: string | null;
  primary_strength_category: string | null;
  primary_strength_metric_value: PlayerAdvancedMetricValue;
  primary_strength_league_rank: number | null;
  primary_strength_league_percentile: number | null;
  primary_strength_vs_league_avg_pct: number | null;
  primary_strength_vs_league_pct?: number | null;

  secondary_strength_metric_key: string | null;
  secondary_strength_metric_label: string | null;
  secondary_strength_category: string | null;
  secondary_strength_metric_value: PlayerAdvancedMetricValue;
  secondary_strength_league_rank: number | null;
  secondary_strength_league_percentile: number | null;
  secondary_strength_vs_league_avg_pct: number | null;
  secondary_strength_vs_league_pct?: number | null;
};

export type PlayerMetricBenchmarkRow = {
  season_label: string | null;
  competition: string | null;

  source_team_id: string | number | null;
  team_source_id?: string | number | null;
  team_slug: string | null;
  team_name: string | null;

  player_source_id: string | number | null;
  player_name: string | null;
  position_code: string | null;
  role_group: string | null;

  metric_key: string;
  display_label?: string | null;
  metric_label?: string | null;
  category: string | null;
  display_priority: number | null;
  value_basis: string | null;
  rank_direction: string | null;

  metric_value: PlayerAdvancedMetricValue;
  team_rank: number | null;
  league_rank: number | null;
  team_percentile: number | null;
  league_percentile: number | null;
  league_avg: number | null;
  league_median: number | null;
  vs_league_avg_abs: number | null;
  vs_league_avg_pct: number | null;
  above_league_avg_flag: boolean | null;
};

export type PlayerDetailedCategoryKey =
  | "output"
  | "attacking"
  | "shooting"
  | "passing"
  | "defence"
  | "discipline"
  | "usage"
  | "goalkeeper";

export type PlayerDetailedValueFormat =
  | "integer"
  | "decimal_1"
  | "decimal_2"
  | "decimal_3"
  | "pct_1";

export type PlayerDetailedMetricRow = {
  season_label: string | null;
  competition: string | null;

  source_team_id: string | number | null;
  team_source_id?: string | number | null;
  team_slug: string | null;
  team_name: string | null;

  player_source_id: string | number | null;
  player_name: string | null;
  position_code: string | null;
  role_group: string | null;

  metric_key: string;
  metric_label: string;
  category_key: PlayerDetailedCategoryKey;
  category_label: string;
  display_priority: number | null;

  total_value: number | null;
  per_match_value: number | null;
  per90_value: number | null;
  home_value: number | null;
  away_value: number | null;
  last5_value: number | null;

  league_avg: number | null;
  league_median: number | null;
  league_rank: number | null;
  league_percentile: number | null;

  vs_league_avg_abs: number | null;
  vs_league_avg_pct: number | null;

  rank_direction: "asc" | "desc" | string | null;
  is_higher_better: boolean | null;
  value_format: PlayerDetailedValueFormat | string | null;

  home_away_gap_abs: number | null;
  sample_matches: number | null;
  coverage_flag: boolean | null;
};

export type PlayerDetailedSummaryCardKey =
  | "best_category"
  | "weakest_category"
  | "best_metric"
  | "worst_metric"
  | "biggest_gap"
  | "coverage_status";

export type PlayerDetailedSummaryCardRow = {
  key: PlayerDetailedSummaryCardKey;
  label: string;
  value: string | number | boolean | null;
  subvalue?: string | number | boolean | null;
};
export type PlayerMetricLeaderboardRow = {
  season_label: string | null;
  competition: string | null;

  player_source_id: string | number | null;
  player_name: string | null;
  position_code: string | null;
  role_group: string | null;

  source_team_id: string | number | null;
  team_slug: string | null;
  team_name: string | null;

  metric_key: string;
  metric_label: string;
  category_key: PlayerDetailedCategoryKey;
  category_label: string;

  total_value: number | null;
  per_match_value: number | null;
  per90_value: number | null;
  home_value: number | null;
  away_value: number | null;
  last5_value: number | null;

  league_avg: number | null;
  league_median: number | null;
  league_rank: number | null;
  league_percentile: number | null;

  vs_league_avg_abs: number | null;
  vs_league_avg_pct: number | null;

  rank_direction: "asc" | "desc" | string | null;
  is_higher_better: boolean | null;
  value_format: string | null;

  home_away_gap_abs: number | null;
  sample_matches: number | null;
  coverage_flag: boolean | null;

  player_pool: string | null;
  ranking_pool: string | null;
  ranking_value: number | null;
  is_qualified: boolean | null;
  recent_activity_flag: boolean | null;
  qualification_minutes_threshold: number | null;
  qualification_apps_threshold: number | null;
  qualification_reason: string | null;

};