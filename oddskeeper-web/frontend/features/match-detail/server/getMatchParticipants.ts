import { createClient } from "../../../lib/supabase/server";
import type { MatchParticipantRow } from "../types";

export async function getMatchParticipants(sourceMatchId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("match_participants_v1")
    .select(
      `
        source_match_id,
        competition,
        match_datetime,
        team_side,
        team_slug,
        source_team_id,
        team_name,
        player_source_id,
        player_name,
        player_slug,
        lineup_status,
        position_code,
        minutes_played,
        goals,
        assists,
        cards_yellow,
        cards_red,
        shots_on_target,
        saves_total
      `
    )
    .eq("source_match_id", sourceMatchId)
    .returns<MatchParticipantRow[]>();

  if (error) {
    console.error("match participants fetch error:", error);
    return [];
  }

  return data ?? [];
}