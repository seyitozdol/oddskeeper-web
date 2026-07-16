import { createClient } from "../../../lib/supabase/server";
import type { TeamStatisticsSummaryRow } from "../types";

type TeamSeasonHistoryDbRow = {
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

export async function getTeamSeasonHistory(
  teamSlug: string
): Promise<TeamStatisticsSummaryRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("team_statistics_summary_v1")
    .select(
      `
        team_slug,
        team_source_id,
        team_name,
        competition,
        season_label,
        played,
        wins,
        draws,
        losses,
        goals_for,
        goals_against,
        goal_difference,
        points,
        win_rate_pct,
        points_per_game,
        goals_for_per_game,
        goals_against_per_game,
        latest_match_datetime
      `
    )
    .eq("team_slug", teamSlug)
    .order("season_label", { ascending: false })
    .returns<TeamSeasonHistoryDbRow[]>();

  if (error) {
    console.error("team season history fetch error:", {
      teamSlug,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return [];
  }

  return data ?? [];
}
