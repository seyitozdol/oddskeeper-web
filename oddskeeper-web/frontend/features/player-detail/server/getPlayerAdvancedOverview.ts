import { createClient } from "@/lib/supabase/server";
import type { PlayerAdvancedOverviewRow } from "../types";

export async function getPlayerAdvancedOverview(
  playerSourceId: string | number | null | undefined,
): Promise<PlayerAdvancedOverviewRow | null> {
  if (!playerSourceId) {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_overview_advanced_v1")
    .select(
      `
        season_label,
        competition,
        source_team_id,
        team_slug,
        team_name,
        player_source_id,
        player_name,
        position_code,
        role_group,
        appearances,
        starts,
        sub_appearances,
        total_minutes,
        avg_minutes,
        usage_label,
        recent_form_label,
        primary_strength_metric_key,
        primary_strength_metric_label,
        primary_strength_category,
        primary_strength_metric_value,
        primary_strength_league_rank,
        primary_strength_league_percentile,
        primary_strength_vs_league_avg_pct,
        secondary_strength_metric_key,
        secondary_strength_metric_label,
        secondary_strength_category,
        secondary_strength_metric_value,
        secondary_strength_league_rank,
        secondary_strength_league_percentile,
        secondary_strength_vs_league_avg_pct
      `,
    )
    .eq("player_source_id", playerSourceId)
    .order("season_label", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getPlayerAdvancedOverview error", {
      playerSourceId,
      message: error.message,
    });
    return null;
  }

  return (data ?? null) as PlayerAdvancedOverviewRow | null;
}