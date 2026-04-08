import { createClient } from "../../../lib/supabase/server";
import type { TeamProfileRow } from "../types";

export async function getTeamProfile(teamSlug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("ref")
    .from("team_profiles")
    .select(
      `
        team_slug,
        display_name,
        founded_year,
        stadium_name,
        head_coach,
        website_url,
        capacity,
        market_value_display
      `
    )
    .eq("team_slug", teamSlug)
    .maybeSingle<TeamProfileRow>();

  if (error) {
    console.error("team profile fetch error:", error);
    return null;
  }

  return data;
}