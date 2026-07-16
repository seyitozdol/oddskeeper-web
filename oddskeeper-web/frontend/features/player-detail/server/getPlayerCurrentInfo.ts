import { createClient } from "../../../lib/supabase/server";
import type { PlayerCurrentInfoRow } from "../types";

export async function getPlayerCurrentInfo(
  playerSlug: string
): Promise<PlayerCurrentInfoRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_current_info_v1")
    .select(
      `
        player_slug,
        opta_player_id,
        apifootball_player_id,
        current_team_slug,
        current_team_name,
        player_name,
        age,
        shirt_number,
        position,
        photo_url,
        fetched_at
      `
    )
    .eq("player_slug", playerSlug)
    .limit(1)
    .returns<PlayerCurrentInfoRow[]>();

  if (error) {
    console.error("player current info fetch error:", {
      playerSlug,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  return data?.[0] ?? null;
}
