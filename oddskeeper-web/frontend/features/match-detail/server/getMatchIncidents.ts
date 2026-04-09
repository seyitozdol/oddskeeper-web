import { createClient } from "../../../lib/supabase/server";
import type { MatchIncidentRow } from "../types";

export async function getMatchIncidents(sourceMatchId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("match_incidents_v1")
    .select(
      `
        source_match_id,
        competition,
        match_datetime,
        side,
        event_type_code,
        event_title,
        minute_text,
        minute_sort,
        primary_player_text,
        secondary_player_text,
        raw_text
      `
    )
    .eq("source_match_id", sourceMatchId)
    .order("minute_sort", { ascending: true, nullsFirst: false })
    .returns<MatchIncidentRow[]>();

  if (error) {
    console.error("match incidents fetch error:", error);
    return [];
  }

  return data ?? [];
}