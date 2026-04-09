import { createClient } from "../../../lib/supabase/server";
import type { MatchTeamStatsRow } from "../types";

export async function getMatchTeamStats(sourceMatchId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("match_team_stats_v1")
    .select(
      `
        source_match_id,
        competition,
        match_datetime,
        team_side,
        team_slug,
        source_team_id,
        team_name,
        opponent_team_slug,
        opponent_team_source_id,
        opponent_team_name,
        score_for,
        score_against,
        result_code,
        summary_goals,
        summary_assists,
        summary_red_cards,
        summary_yellow_cards,
        summary_corners_won,
        summary_shots,
        summary_shots_on_target,
        summary_blocked_shots,
        summary_passes,
        summary_crosses,
        summary_tackles,
        summary_offsides,
        summary_fouls_conceded,
        summary_fouls_won,
        summary_saves,
        details_accurate_pass,
        details_attempts_ibox,
        details_attempts_obox,
        details_expected_goals
      `
    )
    .eq("source_match_id", sourceMatchId)
    .returns<MatchTeamStatsRow[]>();

  if (error) {
    console.error("match team stats fetch error:", error);
    return [];
  }

  return data ?? [];
}