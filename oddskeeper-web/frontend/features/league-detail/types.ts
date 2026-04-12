export type LeagueDetailTab = "overview" | "standings" | "results" | "fixtures";

export const LEAGUE_DETAIL_TABS: LeagueDetailTab[] = [
  "overview",
  "standings",
  "results",
  "fixtures",
];

export type LeagueOverviewRow = {
  competition: string | null;
  season_label: string | null;
  teams_count: number;
  completed_matches: number;
  upcoming_fixtures: number;
  total_goals: number;
  goals_per_match: number | null;
  home_win_pct: number | null;
  draw_pct: number | null;
  away_win_pct: number | null;
  latest_match_datetime: string | null;
  next_fixture_date: string | null;
  next_fixture_datetime: string | null;
};

export type LeagueStandingRow = {
  rank: number;
  competition: string | null;
  season_label: string | null;
  team_source_id: string;
  team_slug: string | null;
  team_name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  points_per_game: number | null;
  home_points: number;
  away_points: number;
  last5_points: number;
  form_last5: string;
};

export type LeagueResultRow = {
  source_match_id: string;
  competition: string | null;
  season_label: string | null;
  match_datetime: string | null;
  match_date: string | null;
  home_team_source_id: string | null;
  home_team_slug: string | null;
  home_team_name: string | null;
  away_team_source_id: string | null;
  away_team_slug: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
  match_status: string | null;
  result_code: "H" | "A" | "D" | null;
  round_number?: number | null;
};

export type LeagueFixtureRow = {
  fixture_id: number;
  competition: string | null;
  season_label: string | null;
  round_number: number | null;
  fixture_date: string | null;
  fixture_datetime: string | null;
  kickoff_time_known: boolean;
  kickoff_time_text: string | null;
  fixture_status: string | null;
  venue: string | null;
  home_team_slug: string | null;
  home_team_source_id: string | null;
  home_team_name: string | null;
  away_team_slug: string | null;
  away_team_source_id: string | null;
  away_team_name: string | null;
};
