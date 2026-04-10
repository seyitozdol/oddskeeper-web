import { createClient } from "../../../lib/supabase/server";
import type { TeamProfileRow } from "../types";

type TeamProfileDbRow = {
  team_slug: string;
  display_name: string;
  founded_year: number | null;
  stadium_name: string | null;
  head_coach: string | null;
  website_url: string | null;
  capacity: number | null;
  market_value_display: string | null;
};

function mapRow(row: TeamProfileDbRow): TeamProfileRow {
  return {
    team_slug: row.team_slug,
    display_name: row.display_name,
    founded_year: row.founded_year,
    stadium_name: row.stadium_name,
    head_coach: row.head_coach,
    website_url: row.website_url,
    capacity: row.capacity,
    market_value_display: row.market_value_display,
  };
}

export async function getTeamProfile(
  teamSlug: string
): Promise<TeamProfileRow | null> {
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
    .limit(1)
    .returns<TeamProfileDbRow[]>();

  if (error) {
    console.error("team profile fetch error:", {
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