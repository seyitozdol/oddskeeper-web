import { createClient } from "../../../lib/supabase/server";
import type { TeamResultRow } from "../types";

export async function getTeamResults(teamSlug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("team_results_v1")
    .select(
      `
        team_slug,
        team_source_id,
        team_name,
        source_match_id,
        competition,
        match_datetime,
        match_date_label:match_datetime,
        is_home,
        is_away,
        opponent_name,
        opponent_team_name:opponent_name,
        opponent_team_slug,
        opponent_source_team_id,
        team_score,
        opponent_score,
        score_display,
        result_code,
        result_label:result_code,
        result_points,
        venue,
        venue_label:venue
      `
    )
    .eq("team_slug", teamSlug)
    .order("match_datetime", { ascending: false })
    .returns<TeamResultRow[]>();

  if (error) {
    console.error("team results fetch error:", error);
    return [];
  }

  return data ?? [];
}