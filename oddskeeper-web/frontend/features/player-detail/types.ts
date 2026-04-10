import { VALID_PLAYER_TABS } from "./constants";

export type ValidPlayerTab = (typeof VALID_PLAYER_TABS)[number];

export type PlayerProfileRow = {
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
};

export type PlayerMatchLogRow = {
  player_slug: string;
  player_source_id: string;
  player_name: string;

  team_slug: string | null;
  team_source_id: string | null;
  team_name: string | null;

  source_match_id: string;
  competition: string | null;
  season_label: string | null;
  match_datetime: string | null;

  is_home: boolean;
  is_away: boolean;

  opponent_name: string | null;
  opponent_team_slug: string | null;

  score_display: string | null;
  result_code: "W" | "D" | "L" | null;

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
  accurate_pass: number | null;
};

export type PlayerAdvancedOverviewRow = {
  player_bk: string
  team_bk: string
  season_label: string
  role_group: string | null
  usage_label: string | null
  recent_form_label: string | null
  primary_strength_metric_key: string | null
  primary_strength_metric_value: number | null
  primary_strength_league_rank: number | null
  primary_strength_vs_league_pct: number | null
  secondary_strength_metric_key: string | null
  secondary_strength_metric_value: number | null
};

export type PlayerMetricBenchmarkRow = {
  season_label: string
  competition: string | null
  team_bk: string
  player_bk: string
  metric_key: string
  metric_value: number | null
  team_rank: number | null
  league_rank: number | null
  team_percentile: number | null
  league_percentile: number | null
  league_avg: number | null
  league_median: number | null
  vs_league_avg_abs: number | null
  vs_league_avg_pct: number | null
  above_league_avg_flag: boolean | null
};
