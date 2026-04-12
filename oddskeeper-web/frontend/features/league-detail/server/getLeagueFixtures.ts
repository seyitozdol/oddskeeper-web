import { createClient } from "../../../lib/supabase/server";
import type { LeagueFixtureRow } from "../types";

type LeagueFixtureDbRow = LeagueFixtureRow;

function mapRow(row: LeagueFixtureDbRow): LeagueFixtureRow {
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
    home_team_slug: row.home_team_slug,
    home_team_source_id: row.home_team_source_id,
    home_team_name: row.home_team_name,
    away_team_slug: row.away_team_slug,
    away_team_source_id: row.away_team_source_id,
    away_team_name: row.away_team_name,
  };
}

export async function getLeagueFixtures(
  competition: string,
  seasonLabel: string,
): Promise<LeagueFixtureRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("league_fixtures_v1")
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
        home_team_slug,
        home_team_source_id,
        home_team_name,
        away_team_slug,
        away_team_source_id,
        away_team_name
      `,
    )
    .eq("competition", competition)
    .eq("season_label", seasonLabel)
    .order("fixture_date", { ascending: true })
    .order("kickoff_time_text", { ascending: true, nullsFirst: false })
    .returns<LeagueFixtureDbRow[]>();

  if (error) {
    console.error("league fixtures fetch error:", {
      competition,
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
