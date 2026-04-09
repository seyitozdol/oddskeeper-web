import { createClient } from "../../../lib/supabase/server";
import type { TeamFixtureRow } from "../types";

export async function getTeamFixtures(teamSlug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("team_fixtures_v1")
    .select(
      `
        fixture_id,
        competition,
        season_label,
        round_number,
        fixture_date,
        fixture_datetime,
        kickoff_time_known,
        kickoff_time_text,
        fixture_status,
        venue,
        team_slug,
        team_source_id,
        team_name,
        is_home,
        is_away,
        opponent_team_slug,
        opponent_team_source_id,
        opponent_name
      `
    )
    .eq("team_slug", teamSlug)
    .order("fixture_date", { ascending: true })
    .order("kickoff_time_text", { ascending: true, nullsFirst: false })
    .returns<TeamFixtureRow[]>();

  if (error) {
    console.error("team fixtures fetch error:", error);
    return [];
  }

  return data ?? [];
}