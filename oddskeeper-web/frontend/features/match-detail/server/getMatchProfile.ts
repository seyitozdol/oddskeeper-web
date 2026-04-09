import { createClient } from "../../../lib/supabase/server";
import type { MatchProfileRow } from "../types";

export async function getMatchProfile(sourceMatchId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("match_profile_v1")
    .select(
      `
        source_match_id,
        competition,
        match_datetime,
        match_date_text,
        venue,
        home_team_source_id,
        home_team_name,
        home_team_slug,
        away_team_source_id,
        away_team_name,
        away_team_slug,
        home_score,
        away_score,
        score_display
      `
    )
    .eq("source_match_id", sourceMatchId)
    .maybeSingle<MatchProfileRow>();

  if (error) {
    console.error("match profile fetch error:", error);
    return null;
  }

  return data;
}