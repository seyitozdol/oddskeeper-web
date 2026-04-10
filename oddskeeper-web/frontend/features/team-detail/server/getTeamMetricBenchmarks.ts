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
      .select("*")
      .eq("team_slug", teamSlug)
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
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return [];
    }

    return ((data ?? []).map((row: any) => ({
      ...row,
      metric_label: row.metric_label ?? row.display_label ?? null,
    })) as TeamMetricBenchmarkRow[]);
  }
);