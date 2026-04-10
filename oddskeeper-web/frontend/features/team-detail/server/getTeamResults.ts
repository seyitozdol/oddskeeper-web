import { createClient } from "../../../lib/supabase/server";
import type { TeamResultRow } from "../types";

type TeamResultsDbRow = {
  team_slug: string;
  team_source_id: string;
  team_name: string;

  source_match_id: string;
  competition: string | null;
  match_datetime: string | null;

  is_home: boolean;
  is_away: boolean;

  opponent_name: string | null;
  opponent_team_slug: string | null;
  opponent_source_team_id: string | null;

  team_score: number | null;
  opponent_score: number | null;
  score_display: string | null;

  result_code: "W" | "D" | "L" | null;
  result_points: number | null;

  venue: string | null;
};

function mapResultLabel(resultCode: "W" | "D" | "L" | null): string | null {
  if (resultCode === "W") return "Win";
  if (resultCode === "D") return "Draw";
  if (resultCode === "L") return "Loss";
  return null;
}

function mapRow(row: TeamResultsDbRow): TeamResultRow {
  return {
    team_slug: row.team_slug,
    team_source_id: row.team_source_id,
    team_name: row.team_name,

    source_match_id: row.source_match_id,
    competition: row.competition,
    match_datetime: row.match_datetime,

    is_home: row.is_home,
    is_away: row.is_away,

    opponent_name: row.opponent_name,
    opponent_team_name: row.opponent_name,
    opponent_team_slug: row.opponent_team_slug,
    opponent_source_team_id: row.opponent_source_team_id,

    team_score: row.team_score,
    opponent_score: row.opponent_score,
    score_display: row.score_display,

    result_code: row.result_code,
    result_label: mapResultLabel(row.result_code),
    result_points: row.result_points,

    venue: row.venue,
    venue_label: row.venue,
    match_date_label: row.match_datetime,
  };
}

export async function getTeamResults(teamSlug: string): Promise<TeamResultRow[]> {
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
        is_home,
        is_away,
        opponent_name,
        opponent_team_slug,
        opponent_source_team_id,
        team_score,
        opponent_score,
        score_display,
        result_code,
        result_points,
        venue
      `
    )
    .eq("team_slug", teamSlug)
    .order("match_datetime", { ascending: false })
    .returns<TeamResultsDbRow[]>();

  if (error) {
    console.error("team results fetch error:", {
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