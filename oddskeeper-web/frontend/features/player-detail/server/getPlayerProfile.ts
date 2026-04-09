import { createClient } from "../../../lib/supabase/server";
import type { PlayerProfileRow } from "../types";

export async function getPlayerProfile(playerSlug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_profile_v1")
    .select(
      `
        team_slug,
        team_source_id,
        team_name,
        competition,
        season_label,
        player_source_id,
        player_name,
        player_slug,
        primary_position_code,
        position_group,
        appearances,
        starts,
        sub_appearances,
        starter_rate_pct,
        total_minutes,
        avg_minutes,
        goals,
        assists,
        first_match_datetime,
        last_match_datetime
      `
    )
    .eq("player_slug", playerSlug)
    .maybeSingle<PlayerProfileRow>();

  if (error) {
    console.error("player profile fetch error:", error);
    return null;
  }

  return data;
}