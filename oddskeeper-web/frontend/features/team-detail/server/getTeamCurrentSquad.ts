import { createClient } from "../../../lib/supabase/server";
import type { TeamCurrentSquadRow } from "../types";

export async function getTeamCurrentSquad(
  teamSlug: string
): Promise<TeamCurrentSquadRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("team_current_squad_v1")
    .select(
      `
        team_slug,
        team_source_id,
        team_name,
        player_source_id,
        player_name,
        age,
        shirt_number,
        position,
        position_group,
        position_sort,
        photo_url,
        fetched_at,
        player_slug
      `
    )
    .eq("team_slug", teamSlug)
    .order("position_sort", { ascending: true })
    .order("shirt_number", { ascending: true, nullsFirst: false })
    .returns<TeamCurrentSquadRow[]>();

  if (error) {
    console.error("team current squad fetch error:", {
      teamSlug,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return [];
  }

  return data ?? [];
}
