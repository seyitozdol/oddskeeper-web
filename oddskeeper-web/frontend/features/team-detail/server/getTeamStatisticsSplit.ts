import { createClient } from "../../../lib/supabase/server";
import type { TeamStatisticsSplitRow } from "../types";

export async function getTeamStatisticsSplit(
  teamSlug: string,
  competition: string,
  seasonLabel: string
) {
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
    .eq("competition", competition)
    .eq("season_label", seasonLabel)
    .order("sort_order", { ascending: true })
    .returns<TeamStatisticsSplitRow[]>();

  if (error) {
    console.error("team statistics split fetch error:", error);
    return [];
  }

  return data ?? [];
}