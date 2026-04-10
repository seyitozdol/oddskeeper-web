import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { PlayerMetricBenchmarkRow } from "../types";

const DEFAULT_LIMIT = 24;

export const getPlayerMetricBenchmarks = cache(
  async (
    playerSourceId: string | number | null | undefined,
    options?: {
      seasonLabel?: string;
      limit?: number;
    }
  ): Promise<PlayerMetricBenchmarkRow[]> => {
    if (!playerSourceId) {
      return [];
    }

    const supabase = await createClient();

    let query = supabase
      .schema("analytics")
      .from("player_metric_benchmarks_v1")
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
          metric_key,
          display_label,
          category,
          display_priority,
          value_basis,
          rank_direction,
          metric_value,
          team_rank,
          league_rank,
          team_percentile,
          league_percentile,
          league_avg,
          league_median,
          vs_league_avg_abs,
          vs_league_avg_pct,
          above_league_avg_flag
        `
      )
      .eq("player_source_id", playerSourceId)
      .order("category", { ascending: true })
      .order("display_priority", { ascending: true })
      .order("league_rank", { ascending: true });

    if (options?.seasonLabel) {
      query = query.eq("season_label", options.seasonLabel);
    }

    query = query.limit(options?.limit ?? DEFAULT_LIMIT);

    const { data, error } = await query;

    if (error) {
      console.error("getPlayerMetricBenchmarks failed", {
        playerSourceId,
        seasonLabel: options?.seasonLabel ?? null,
        message: error.message,
      });
      return [];
    }

    return ((data ?? []).map((row) => ({
      ...row,
      metric_label: row.display_label,
    })) as unknown) as PlayerMetricBenchmarkRow[];
  }
);