import { createClient } from "../../../lib/supabase/server";
import type { TeamRecentFormRow } from "../types";

export async function getTeamRecentForm(
  teamSlug: string,
  _competition: string,
  seasonLabel: string
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("team_recent_form_v1")
    .select(
      `
        team_slug,
        team_source_id,
        team_name,
        competition,
        season_label,
        recent_rank,
        source_match_id,
        match_datetime,
        is_home,
        opponent_name,
        team_score,
        opponent_score,
        score_display,
        result_code,
        result_points
      `
    )
    .eq("team_slug", teamSlug)
    .eq("season_label", seasonLabel)
    .order("recent_rank", { ascending: true })
    .returns<TeamRecentFormRow[]>();

  if (error) {
    console.error("team recent form fetch error:", error);
    return [];
  }

  return data ?? [];
}