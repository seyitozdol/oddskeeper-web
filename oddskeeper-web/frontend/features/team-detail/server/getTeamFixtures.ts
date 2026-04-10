import { createClient } from "../../../lib/supabase/server";
import type { TeamFixtureRow } from "../types";

type TeamFixturesDbRow = {
  fixture_id: number;

  competition: string | null;
  season_label: string | null;
  round_number: number;

  fixture_date: string | null;
  fixture_datetime: string | null;
  kickoff_time_known: boolean;
  kickoff_time_text: string | null;

  fixture_status: "scheduled" | "postponed" | "cancelled" | "completed" | string;
  venue: string | null;

  team_slug: string;
  team_source_id: string;
  team_name: string;

  is_home: boolean;
  is_away: boolean;

  opponent_team_slug: string;
  opponent_team_source_id: string;
  opponent_name: string | null;
};

function mapRow(row: TeamFixturesDbRow): TeamFixtureRow {
  return {
    fixture_id: row.fixture_id,

    competition: row.competition,
    season_label: row.season_label,
    round_number: row.round_number,

    fixture_date: row.fixture_date,
    fixture_datetime: row.fixture_datetime,
    kickoff_time_known: row.kickoff_time_known,
    kickoff_time_text: row.kickoff_time_text,

    fixture_status: row.fixture_status,
    venue: row.venue,

    team_slug: row.team_slug,
    team_source_id: row.team_source_id,
    team_name: row.team_name,

    is_home: row.is_home,
    is_away: row.is_away,

    opponent_team_slug: row.opponent_team_slug,
    opponent_team_source_id: row.opponent_team_source_id,
    opponent_name: row.opponent_name,
  };
}

export async function getTeamFixtures(
  teamSlug: string
): Promise<TeamFixtureRow[]> {
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
    .returns<TeamFixturesDbRow[]>();

  if (error) {
    console.error("team fixtures fetch error:", {
      teamSlug,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return [];
  }

  return (data ?? []).map(mapRow);
}