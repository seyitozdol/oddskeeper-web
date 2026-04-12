import { createClient } from "../../../lib/supabase/server";
import type { LeagueResultRow } from "../types";

type LeagueResultDbRow = LeagueResultRow;

function mapRow(row: LeagueResultDbRow): LeagueResultRow {
  return {
    source_match_id: row.source_match_id,
    competition: row.competition,
    season_label: row.season_label,
    round_number: row.round_number,
    match_datetime: row.match_datetime,
    match_date: row.match_date,
    home_team_source_id: row.home_team_source_id,
    home_team_slug: row.home_team_slug,
    home_team_name: row.home_team_name,
    away_team_source_id: row.away_team_source_id,
    away_team_slug: row.away_team_slug,
    away_team_name: row.away_team_name,
    home_score: row.home_score,
    away_score: row.away_score,
    venue: row.venue,
    match_status: row.match_status,
    result_code: row.result_code,
  };
}

export async function getLeagueResults(
  competition: string,
  seasonLabel: string,
): Promise<LeagueResultRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("league_results_v1")
    .select(
      `
        source_match_id,
        competition,
        season_label,
        round_number,
        match_datetime,
        match_date,
        home_team_source_id,
        home_team_slug,
        home_team_name,
        away_team_source_id,
        away_team_slug,
        away_team_name,
        home_score,
        away_score,
        venue,
        match_status,
        result_code
      `,
    )
    .eq("competition", competition)
    .eq("season_label", seasonLabel)
    .order("match_datetime", { ascending: false })
    .returns<LeagueResultDbRow[]>();

  if (error) {
    console.error("league results fetch error:", {
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
