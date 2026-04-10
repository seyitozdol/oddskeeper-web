import { createClient } from "@/lib/supabase/server";
import type { PlayerAdvancedOverviewRow } from "../types";

type PlayerAdvancedOverviewDbRow = {
  season_label: string | null;
  competition: string | null;

  source_team_id: string | number | null;
  team_slug: string | null;
  team_name: string | null;

  player_source_id: string | number | null;
  player_name: string | null;
  position_code: string | null;
  role_group: string | null;

  appearances: number | null;
  starts: number | null;
  sub_appearances: number | null;
  total_minutes: number | null;
  avg_minutes: number | null;

  usage_label: string | null;
  recent_form_label: string | null;

  primary_strength_metric_key: string | null;
  primary_strength_metric_label: string | null;
  primary_strength_category: string | null;
  primary_strength_metric_value: string | number | boolean | null;
  primary_strength_league_rank: number | null;
  primary_strength_league_percentile: number | null;
  primary_strength_vs_league_avg_pct: number | null;

  secondary_strength_metric_key: string | null;
  secondary_strength_metric_label: string | null;
  secondary_strength_category: string | null;
  secondary_strength_metric_value: string | number | boolean | null;
  secondary_strength_league_rank: number | null;
  secondary_strength_league_percentile: number | null;
  secondary_strength_vs_league_avg_pct: number | null;
};

function mapRow(row: PlayerAdvancedOverviewDbRow): PlayerAdvancedOverviewRow {
  return {
    season_label: row.season_label,
    competition: row.competition,

    source_team_id: row.source_team_id,
    team_source_id: row.source_team_id,

    team_slug: row.team_slug,
    team_name: row.team_name,

    player_source_id: row.player_source_id,
    player_name: row.player_name,
    position_code: row.position_code,
    role_group: row.role_group,

    appearances: row.appearances,
    starts: row.starts,
    sub_appearances: row.sub_appearances,
    total_minutes: row.total_minutes,
    avg_minutes: row.avg_minutes,

    usage_label: row.usage_label,
    recent_form_label: row.recent_form_label,

    primary_strength_metric_key: row.primary_strength_metric_key,
    primary_strength_metric_label: row.primary_strength_metric_label,
    primary_strength_category: row.primary_strength_category,
    primary_strength_metric_value: row.primary_strength_metric_value,
    primary_strength_league_rank: row.primary_strength_league_rank,
    primary_strength_league_percentile: row.primary_strength_league_percentile,
    primary_strength_vs_league_avg_pct: row.primary_strength_vs_league_avg_pct,
    primary_strength_vs_league_pct: row.primary_strength_vs_league_avg_pct,

    secondary_strength_metric_key: row.secondary_strength_metric_key,
    secondary_strength_metric_label: row.secondary_strength_metric_label,
    secondary_strength_category: row.secondary_strength_category,
    secondary_strength_metric_value: row.secondary_strength_metric_value,
    secondary_strength_league_rank: row.secondary_strength_league_rank,
    secondary_strength_league_percentile: row.secondary_strength_league_percentile,
    secondary_strength_vs_league_avg_pct: row.secondary_strength_vs_league_avg_pct,
    secondary_strength_vs_league_pct: row.secondary_strength_vs_league_avg_pct,
  };
}

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
      `
    )
    .eq("player_source_id", playerSourceId)
    .order("season_label", { ascending: false })
    .limit(1)
    .returns<PlayerAdvancedOverviewDbRow[]>();

  if (error) {
    console.error("getPlayerAdvancedOverview error", {
      playerSourceId,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  const row = data?.[0] ?? null;

  if (!row) {
    return null;
  }

  return mapRow(row);
}