import { createClient } from "../../../lib/supabase/server";
import type { TeamStatisticsSummaryRow } from "../types";

export async function getTeamStatisticsSummary(teamSlug: string) {
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
    .returns<TeamStatisticsSummaryRow[]>();

  if (error) {
    console.error("team statistics summary fetch error:", error);
    return null;
  }

  return data?.[0] ?? null;
}