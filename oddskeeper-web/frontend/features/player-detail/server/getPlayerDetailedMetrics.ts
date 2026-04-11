import { cache } from "react";
import { createClient } from "../../../lib/supabase/server";
import type {
  PlayerDetailedCategoryKey,
  PlayerDetailedMetricRow,
} from "../types";
import { getPlayerProfile } from "./getPlayerProfile";

type PlayerDetailedMetricsDbRow = {
  season_label: string | null;
  competition: string | null;

  player_source_id: string | number | null;
  player_name: string | null;
  position_code: string | null;
  role_group: string | null;

  source_team_id: string | number | null;
  team_slug: string | null;
  team_name: string | null;

  metric_key: string;
  metric_label: string;
  category_key: string | null;
  category_label: string | null;
  display_priority: number | null;

  total_value: number | null;
  per_match_value: number | null;
  per90_value: number | null;
  home_value: number | null;
  away_value: number | null;
  last5_value: number | null;

  league_avg: number | null;
  league_median: number | null;
  league_rank: number | null;
  league_percentile: number | null;

  vs_league_avg_abs: number | null;
  vs_league_avg_pct: number | null;

  rank_direction: "asc" | "desc" | string | null;
  is_higher_better: boolean | null;
  value_format: string | null;

  home_away_gap_abs: number | null;
  sample_matches: number | null;
  coverage_flag: boolean | null;
};

function mapRow(row: PlayerDetailedMetricsDbRow): PlayerDetailedMetricRow {
  return {
    season_label: row.season_label,
    competition: row.competition,

    player_source_id: row.player_source_id,
    player_name: row.player_name,
    position_code: row.position_code,
    role_group: row.role_group,

    source_team_id: row.source_team_id,
    team_slug: row.team_slug,
    team_name: row.team_name,

    metric_key: row.metric_key,
    metric_label: row.metric_label,
    category_key: (row.category_key ?? "output") as PlayerDetailedCategoryKey,
    category_label: row.category_label ?? "Output",
    display_priority: row.display_priority,

    total_value: row.total_value,
    per_match_value: row.per_match_value,
    per90_value: row.per90_value,
    home_value: row.home_value,
    away_value: row.away_value,
    last5_value: row.last5_value,

    league_avg: row.league_avg,
    league_median: row.league_median,
    league_rank: row.league_rank,
    league_percentile: row.league_percentile,

    vs_league_avg_abs: row.vs_league_avg_abs,
    vs_league_avg_pct: row.vs_league_avg_pct,

    rank_direction: row.rank_direction,
    is_higher_better: row.is_higher_better,
    value_format: row.value_format,

    home_away_gap_abs: row.home_away_gap_abs,
    sample_matches: row.sample_matches,
    coverage_flag: row.coverage_flag,
  };
}

export const getPlayerDetailedMetrics = cache(
  async (
    playerSlug: string,
    options?: {
      seasonLabel?: string | null;
      competition?: string | null;
    }
  ): Promise<PlayerDetailedMetricRow[]> => {
    const profileRow = await getPlayerProfile(playerSlug);

    if (!profileRow?.player_source_id) {
      return [];
    }

    const supabase = await createClient();

    let query = supabase
      .schema("analytics")
      .from("player_detailed_metrics_v2_1")
      .select(
        `
          season_label,
          competition,
          player_source_id,
          player_name,
          position_code,
          role_group,
          source_team_id,
          team_slug,
          team_name,
          metric_key,
          metric_label,
          category_key,
          category_label,
          display_priority,
          total_value,
          per_match_value,
          per90_value,
          home_value,
          away_value,
          last5_value,
          league_avg,
          league_median,
          league_rank,
          league_percentile,
          vs_league_avg_abs,
          vs_league_avg_pct,
          rank_direction,
          is_higher_better,
          value_format,
          home_away_gap_abs,
          sample_matches,
          coverage_flag
        `
      )
      .eq("player_source_id", String(profileRow.player_source_id))
      .order("category_key", { ascending: true })
      .order("display_priority", { ascending: true, nullsFirst: false })
      .order("metric_label", { ascending: true });

    const effectiveSeasonLabel =
      options?.seasonLabel ?? profileRow.season_label ?? null;
    const effectiveCompetition =
      options?.competition ?? profileRow.competition ?? null;

    if (effectiveSeasonLabel) {
      query = query.eq("season_label", effectiveSeasonLabel);
    }

    if (effectiveCompetition) {
      query = query.eq("competition", effectiveCompetition);
    }

    const { data, error } =
      await query.returns<PlayerDetailedMetricsDbRow[]>();

    if (error) {
      console.error(
        "getPlayerDetailedMetrics failed ::",
        JSON.stringify(
          {
            playerSlug,
            playerSourceId: profileRow.player_source_id,
            seasonLabel: effectiveSeasonLabel,
            competition: effectiveCompetition,
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          },
          null,
          2
        )
      );
      return [];
    }

    return (data ?? []).map(mapRow);
  }
);