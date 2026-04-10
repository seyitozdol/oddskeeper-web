import { createClient } from "../../../lib/supabase/server";
import type { TeamRecentFormRow } from "../types";

type TeamRecentFormDbRow = {
  team_slug: string;
  team_source_id: string;
  team_name: string;

  competition: string | null;
  season_label: string | null;

  recent_rank: number;
  source_match_id: string;
  match_datetime: string | null;

  is_home: boolean;
  opponent_name: string | null;

  team_score: number | null;
  opponent_score: number | null;
  score_display: string | null;

  result_code: "W" | "D" | "L" | null;
  result_points: number | null;
};

function mapRow(row: TeamRecentFormDbRow): TeamRecentFormRow {
  return {
    team_slug: row.team_slug,
    team_source_id: row.team_source_id,
    team_name: row.team_name,

    competition: row.competition,
    season_label: row.season_label,

    recent_rank: row.recent_rank,
    source_match_id: row.source_match_id,
    match_datetime: row.match_datetime,

    is_home: row.is_home,
    opponent_name: row.opponent_name,

    team_score: row.team_score,
    opponent_score: row.opponent_score,
    score_display: row.score_display,

    result_code: row.result_code,
    result_points: row.result_points,
  };
}

export async function getTeamRecentForm(
  teamSlug: string,
  _competition: string,
  seasonLabel: string
): Promise<TeamRecentFormRow[]> {
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
    .returns<TeamRecentFormDbRow[]>();

  if (error) {
    console.error("team recent form fetch error:", {
      teamSlug,
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