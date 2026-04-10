import { createClient } from "../../../lib/supabase/server";
import type { TeamStatisticsSummaryRow } from "../types";

type TeamStatisticsSummaryDbRow = {
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

function mapRow(row: TeamStatisticsSummaryDbRow): TeamStatisticsSummaryRow {
  return {
    team_slug: row.team_slug,
    team_source_id: row.team_source_id,
    team_name: row.team_name,

    competition: row.competition,
    season_label: row.season_label,

    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,

    goals_for: row.goals_for,
    goals_against: row.goals_against,
    goal_difference: row.goal_difference,
    points: row.points,

    win_rate_pct: row.win_rate_pct,
    points_per_game: row.points_per_game,
    goals_for_per_game: row.goals_for_per_game,
    goals_against_per_game: row.goals_against_per_game,

    latest_match_datetime: row.latest_match_datetime,
  };
}

export async function getTeamStatisticsSummary(
  teamSlug: string
): Promise<TeamStatisticsSummaryRow | null> {
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
    .order("latest_match_datetime", { ascending: false })
    .limit(1)
    .returns<TeamStatisticsSummaryDbRow[]>();

  if (error) {
    console.error("team statistics summary fetch error:", {
      teamSlug,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  const row = data?.[0] ?? null;
  return row ? mapRow(row) : null;
}