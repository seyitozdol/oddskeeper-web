import { createClient } from "../../../lib/supabase/server";
import type { TeamSquadRow } from "../types";

export async function getTeamSquad(teamSlug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("team_squad_v1")
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
    .eq("team_slug", teamSlug)
    .returns<TeamSquadRow[]>();

  if (error) {
    console.error("team squad fetch error:", error);
    return [];
  }

  return data ?? [];
}