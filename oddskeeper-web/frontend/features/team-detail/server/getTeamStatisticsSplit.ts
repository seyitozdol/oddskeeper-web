import { createClient } from "../../../lib/supabase/server";
import type { TeamStatisticsSplitRow } from "../types";

type TeamStatisticsSplitDbRow = {
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

function mapRow(row: TeamStatisticsSplitDbRow): TeamStatisticsSplitRow {
  return {
    team_slug: row.team_slug,
    team_source_id: row.team_source_id,
    team_name: row.team_name,

    competition: row.competition,
    season_label: row.season_label,

    split_key: row.split_key,
    split_label: row.split_label,
    sort_order: row.sort_order,

    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,

    goals_for: row.goals_for,
    goals_against: row.goals_against,
    goal_difference: row.goal_difference,
    points: row.points,

    points_per_game: row.points_per_game,
    win_rate_pct: row.win_rate_pct,
  };
}

export async function getTeamStatisticsSplit(
  teamSlug: string,
  _competition: string,
  seasonLabel: string
): Promise<TeamStatisticsSplitRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("team_statistics_split_v1")
    .select(
      `
        team_slug,
        team_source_id,
        team_name,
        competition,
        season_label,
        split_key,
        split_label,
        sort_order,
        played,
        wins,
        draws,
        losses,
        goals_for,
        goals_against,
        goal_difference,
        points,
        points_per_game,
        win_rate_pct
      `
    )
    .eq("team_slug", teamSlug)
    .eq("season_label", seasonLabel)
    .order("sort_order", { ascending: true })
    .returns<TeamStatisticsSplitDbRow[]>();

  if (error) {
    console.error("team statistics split fetch error:", {
      teamSlug,
      seasonLabel,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return [];
  }

  return (data ?? []).map(mapRow);
}