import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { TeamMetricBenchmarkRow } from "../types";

const DEFAULT_LIMIT = 24;

export const getTeamMetricBenchmarks = cache(
  async (
    teamSlug: string,
    options?: {
      seasonLabel?: string;
      limit?: number;
    }
  ): Promise<TeamMetricBenchmarkRow[]> => {
    const supabase = await createClient();

    let query = supabase
      .from("team_metric_benchmarks_v1")
      .select("*")
      .eq("team_slug", teamSlug)
      .order("category", { ascending: true })
      .order("display_priority", { ascending: true })
      .order("league_rank", { ascending: true });

    if (options?.seasonLabel) {
      query = query.eq("season_label", options.seasonLabel);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(DEFAULT_LIMIT);
    }

    const { data, error } = await query;

    if (error) {
      console.error("getTeamMetricBenchmarks failed", {
        teamSlug,
        seasonLabel: options?.seasonLabel ?? null,
        error,
      });
      return [];
    }

    return (data ?? []) as TeamMetricBenchmarkRow[];
  }
);
