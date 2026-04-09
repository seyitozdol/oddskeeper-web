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
  opponent_source_team_id: string | null;
  team_score: number | null;
  opponent_score: number | null;
  score_display: string | null;
  result_code: "W" | "D" | "L" | null;
  result_points: number | null;
  venue: string | null;
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
};