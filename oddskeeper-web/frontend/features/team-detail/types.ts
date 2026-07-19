import { VALID_TABS } from "./constants";

export type ValidTab = (typeof VALID_TABS)[number];

export type TeamProfileRow = {
  team_slug: string;
  display_name: string;
  founded_year: number | null;
  stadium_name: string | null;
  head_coach: string | null;
  website_url: string | null;
  capacity: number | null;
  market_value_display: string | null;
};

export type TeamResultRow = {
  team_slug: string;
  team_source_id: string;
  team_name: string;

  source_match_id: string;
  competition: string | null;
  match_datetime: string | null;

  is_home: boolean;
  is_away: boolean;

  opponent_name: string | null;
  opponent_team_name?: string | null;
  opponent_team_slug: string | null;
  opponent_source_team_id: string | null;

  team_score: number | null;
  opponent_score: number | null;
  score_display: string | null;

  result_code: "W" | "D" | "L" | null;
  result_label?: string | null;
  result_points: number | null;

  venue: string | null;
  venue_label?: string | null;
  match_date_label?: string | null;
};

export type TeamStatisticsSummaryRow = {
  team_slug: string;
  team_source_id: string;
  team_name: string;

  competition: string | null;
  season_label: string | null;

  played: number;
  wins: number;
  draws: number;
  losses: number;

  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;

  win_rate_pct: number | string | null;
  points_per_game: number | string | null;
  goals_for_per_game: number | string | null;
  goals_against_per_game: number | string | null;

  latest_match_datetime: string | null;
};

export type TeamStatisticsSplitRow = {
  team_slug: string;
  team_source_id: string;
  team_name: string;

  competition: string | null;
  season_label: string | null;

  split_key: "overall" | "home" | "away";
  split_label: "Overall" | "Home" | "Away";
  sort_order: number;

  played: number;
  wins: number;
  draws: number;
  losses: number;

  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;

  points_per_game: number | string | null;
  win_rate_pct: number | string | null;
};

export type TeamRecentFormRow = {
  team_slug: string;
  team_source_id: string;
  team_name: string;

  competition: string | null;
  season_label: string | null;

  recent_rank: number;
  source_match_id: string;
  match_datetime: string | null;

  is_home: boolean;
  opponent_name: string | null;

  team_score: number | null;
  opponent_score: number | null;
  score_display: string | null;

  result_code: "W" | "D" | "L" | null;
  result_points: number | null;
};

export type TeamSquadRow = {
  team_slug: string;
  team_source_id: string;
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

  current_team_slug: string | null;
  current_team_name: string | null;
};

export type TeamFixtureRow = {
  fixture_id: number;

  competition: string | null;
  season_label: string | null;
  round_number: number;

  fixture_date: string | null;
  fixture_datetime: string | null;
  kickoff_time_known: boolean;
  kickoff_time_text: string | null;

  fixture_status:
    | "scheduled"
    | "postponed"
    | "cancelled"
    | "completed"
    | string;

  venue: string | null;

  team_slug: string;
  team_source_id: string;
  team_name: string;

  is_home: boolean;
  is_away: boolean;

  opponent_team_slug: string;
  opponent_team_source_id: string;
  opponent_name: string | null;
};

export type TeamAdvancedMetricValue = string | number | boolean | null;

export type TeamAdvancedOverviewRow = {
  season_label: string | null;
  competition: string | null;

  source_team_id: string | number | null;
  team_source_id?: string | number | null;

  team_slug: string | null;
  team_name: string | null;

  attack_profile_label: string | null;
  defence_profile_label: string | null;
  recent_form_label: string | null;
  form_shift_last5_flag: boolean | null;

  strongest_metric_key: string | null;
  strongest_metric_label: string | null;
  strongest_metric_category: string | null;
  strongest_metric_value: TeamAdvancedMetricValue;
  strongest_metric_league_rank: number | null;
  strongest_metric_league_percentile: number | null;
  strongest_metric_vs_league_avg_pct: number | null;

  weakest_metric_key: string | null;
  weakest_metric_label: string | null;
  weakest_metric_category: string | null;
  weakest_metric_value: TeamAdvancedMetricValue;
  weakest_metric_league_rank: number | null;
  weakest_metric_league_percentile: number | null;
  weakest_metric_vs_league_avg_pct: number | null;

  home_away_gap_metric_key: string | null;
  home_away_gap_home_value: TeamAdvancedMetricValue;
  home_away_gap_away_value: TeamAdvancedMetricValue;
  home_away_gap_abs: number | null;

  strongest_metric_rank?: number | null;
  strongest_metric_vs_league_pct?: number | null;
  weakest_metric_rank?: number | null;
  weakest_metric_vs_league_pct?: number | null;
  home_away_gap_metric_label?: string | null;
};

export type TeamMetricBenchmarkRow = {
  season_label: string | null;
  competition: string | null;

  source_team_id: string | number | null;
  team_source_id?: string | number | null;

  team_slug: string | null;
  team_name: string | null;

  metric_key: string;
  display_label?: string | null;
  metric_label?: string | null;
  category: string | null;
  display_priority: number | null;
  value_basis: string | null;
  rank_direction: string | null;

  metric_value: TeamAdvancedMetricValue;
  league_rank: number | null;
  league_percentile: number | null;
  league_avg: number | null;
  league_median: number | null;
  vs_league_avg_abs: number | null;
  vs_league_avg_pct: number | null;
  above_league_avg_flag: boolean | null;
};

export type TeamDetailedCategoryKey =
  | "attack"
  | "defence"
  | "build_up"
  | "discipline"
  | "set_piece"
  | "goal_composition";

export type TeamDetailedValueFormat =
  | "integer"
  | "decimal_1"
  | "decimal_2"
  | "decimal_3"
  | "pct_1";

export type TeamDetailedMetricRow = {
  season_label: string | null;
  competition: string | null;

  source_team_id: string | number | null;
  team_source_id?: string | number | null;

  team_slug: string | null;
  team_name: string | null;

  metric_key: string;
  metric_label: string;
  category_key: TeamDetailedCategoryKey;
  category_label: string;
  display_priority: number | null;

  total_value: number | null;
  per_match_value: number | null;
  home_value: number | null;
  away_value: number | null;

  league_avg: number | null;
  league_median: number | null;
  league_rank: number | null;
  league_percentile: number | null;

  vs_league_avg_abs: number | null;
  vs_league_avg_pct: number | null;

  rank_direction: "asc" | "desc" | string | null;
  is_higher_better: boolean | null;
  value_format: TeamDetailedValueFormat | string | null;

  home_away_gap_abs: number | null;
  sample_matches: number | null;
  coverage_flag: boolean | null;
};

export type TeamDetailedSummaryCardKey =
  | "best_category"
  | "weakest_category"
  | "best_metric"
  | "worst_metric"
  | "biggest_gap"
  | "coverage_status";

export type TeamDetailedSummaryCardRow = {
  key: TeamDetailedSummaryCardKey;
  label: string;
  value: string | number | boolean | null;
  subvalue?: string | number | boolean | null;
};

export type TeamMetricLeaderboardRow = {
  season_label: string | null;
  competition: string | null;

  team_slug: string | null;
  source_team_id: string | number | null;
  team_name: string | null;

  metric_key: string;
  metric_label: string;
  category_key: TeamDetailedCategoryKey;
  category_label: string;

  total_value: number | null;
  per_match_value: number | null;
  home_value: number | null;
  away_value: number | null;

  league_avg: number | null;
  league_median: number | null;
  league_rank: number | null;
  league_percentile: number | null;

  vs_league_avg_abs: number | null;
  vs_league_avg_pct: number | null;

  rank_direction: "asc" | "desc" | string | null;
  is_higher_better: boolean | null;
  value_format: string | null;

  sample_matches: number | null;
  coverage_flag: boolean | null;
};

export type TeamAdvancedRuleCatalogRow = {
  metric_key: string;
  metric_label: string;
  display_group: string;
  identity_group: string;
  direction: "higher_better" | "lower_better";
  include_in_strength_risk: boolean;
  include_in_split: boolean;
  include_in_form: boolean;
  weight_attack: number;
  weight_defence: number;
  weight_build_up: number;
  priority_strength: number;
  priority_risk: number;
  is_active: boolean;
  notes: string | null;
};

export type TeamAdvancedFormSnapshot = {
  season_points_per_game: number | null;
  last5_points_per_game: number | null;
  season_goals_for_per_game: number | null;
  last5_goals_for_per_game: number | null;
  season_goals_against_per_game: number | null;
  last5_goals_against_per_game: number | null;
};

export type TeamAdvancedIdentityItem = {
  label: string;
  reason: string;
};

export type TeamAdvancedMetricCard = {
  label: string;
  reason: string;
  metric_key: string | null;
  metric_label: string | null;
  rank: number | null;
  vs_avg_pct: number | null;
  tone: "positive" | "negative" | "neutral" | "accent" | "warning";
};

export type TeamAdvancedTierItem = {
  label: string;
  score: number | null;
  tier: "Elite" | "Upper Tier" | "Mid Tier" | "Below Average" | "Weak";
  reason: string;
};

export type TeamAdvancedSummary = {
  identity: {
    attack: TeamAdvancedIdentityItem;
    defence: TeamAdvancedIdentityItem;
    build_up: TeamAdvancedIdentityItem;
    form: TeamAdvancedIdentityItem;
  };
  highlights: {
    strength: TeamAdvancedMetricCard;
    risk: TeamAdvancedMetricCard;
    trend: TeamAdvancedMetricCard;
    split: TeamAdvancedMetricCard;
  };
  positioning: {
    attack: TeamAdvancedTierItem;
    defence: TeamAdvancedTierItem;
    build_up: TeamAdvancedTierItem;
  };
  takeaways: {
    coaching: string;
    opponent_prep: string;
    recruitment: string;
  };
};
export type TeamCurrentSquadRow = {
  team_slug: string;
  team_source_id: string;
  team_name: string;

  player_source_id: string;
  player_name: string;

  age: number | null;
  shirt_number: number | null;
  position: string | null;
  position_group: string;
  position_sort: number;

  photo_url: string | null;
  fetched_at: string | null;

  player_slug: string | null;
};
