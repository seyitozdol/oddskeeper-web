import { createClient } from "../../../lib/supabase/server";

export type TeamComparisonSide = {
  team_slug: string;
  team_name: string;
  split_key: string;
  split_label: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  points_per_game: number;
  win_rate_pct: number;
  goals_for_per_game: number;
  goals_against_per_game: number;
};

export type LeagueAvg = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  points_per_game: number;
  win_rate_pct: number;
  goals_for_per_game: number;
  goals_against_per_game: number;
};

export type TeamComparisonResult = {
  competition: string;
  season_label: string;
  split_key: string;
  team_a: TeamComparisonSide;
  team_b: TeamComparisonSide;
  league_avg: LeagueAvg;
};

export async function getTeamComparison(
  teamSlugA: string,
  teamSlugB: string,
  splitKey: "overall" | "home" | "away" = "overall"
): Promise<TeamComparisonResult | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_team_comparison_v1", {
    p_team_slug_a: teamSlugA,
    p_team_slug_b: teamSlugB,
    p_split_key: splitKey,
  });

  if (error || !data) {
    console.error("getTeamComparison error:", error);
    return null;
  }

  if (data.error) {
    console.error("getTeamComparison RPC error:", data.error);
    return null;
  }

  return data as TeamComparisonResult;
}