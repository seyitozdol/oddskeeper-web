import { createClient } from "../../../lib/supabase/server";
import type { PlayerMatchLogRow } from "../types";

export async function getPlayerMatchLog(playerSlug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_match_log_v1")
    .select(
      `
        player_slug,
        player_source_id,
        player_name,
        team_slug,
        team_source_id,
        team_name,
        source_match_id,
        competition,
        season_label,
        match_datetime,
        is_home,
        is_away,
        opponent_name,
        opponent_team_slug,
        score_display,
        result_code,
        lineup_status,
        position_code,
        points,
        minutes_played,
        goals,
        assists,
        shots_on_target,
        shots_off_target,
        shots_blocked,
        passes,
        crosses,
        tackles,
        interceptions,
        fouls_won,
        fouls_conceded,
        offsides,
        cards_yellow,
        cards_red,
        penalties_won,
        saves_total,
        expected_goals,
        accurate_pass
      `
    )
    .eq("player_slug", playerSlug)
    .order("match_datetime", { ascending: false })
    .returns<PlayerMatchLogRow[]>();

  if (error) {
    console.error("player match log fetch error:", error);
    return [];
  }

  return data ?? [];
}