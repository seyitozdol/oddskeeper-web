import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { TeamMetricBenchmarkRow } from "../types";

const DEFAULT_LIMIT = 24;

export const getTeamMetricBenchmarks = cache(
  async (
    teamSlug: string | null | undefined,
    options?: {
      seasonLabel?: string;
      limit?: number;
    }
  ): Promise<TeamMetricBenchmarkRow[]> => {
    if (!teamSlug) {
      return [];
    }

    const supabase = await createClient();

    let query = supabase
      .schema("analytics")
      .from("team_metric_benchmarks_v1")
      .select(
        `
          season_label,
          competition,
          source_team_id,
          team_slug,
          team_name,
          metric_key,
          display_label,
          category,
          display_priority,
          value_basis,
          rank_direction,
          metric_value,
          league_rank,
          league_percentile,
          league_avg,
          league_median,
          vs_league_avg_abs,
          vs_league_avg_pct,
          above_league_avg_flag
        `
      )
      .eq("team_slug", teamSlug)
      .order("category", { ascending: true })
      .order("display_priority", { ascending: true })
      .order("league_rank", { ascending: true });

    if (options?.seasonLabel) {
      query = query.eq("season_label", options.seasonLabel);
    }

    query = query.limit(options?.limit ?? DEFAULT_LIMIT);

    const { data, error } = await query;

    if (error) {
      console.error("getTeamMetricBenchmarks failed", {
        teamSlug,
        seasonLabel: options?.seasonLabel ?? null,
        message: error.message,
      });
      return [];
    }

    return ((data ?? []).map((row) => ({
      ...row,
      metric_label: row.display_label,
    })) as unknown) as TeamMetricBenchmarkRow[];
  }
);
