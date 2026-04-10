import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { TeamMetricBenchmarkRow } from "../types";

const DEFAULT_LIMIT = 24;

type TeamMetricBenchmarksDbRow = {
  season_label: string | null;
  competition: string | null;
  source_team_id: string | number | null;
  team_slug: string | null;
  team_name: string | null;

  metric_key: string;
  display_label: string | null;
  category: string | null;
  display_priority: number | null;
  value_basis: string | null;
  rank_direction: string | null;

  metric_value: string | number | boolean | null;
  league_rank: number | null;
  league_percentile: number | null;
  league_avg: number | null;
  league_median: number | null;
  vs_league_avg_abs: number | null;
  vs_league_avg_pct: number | null;
  above_league_avg_flag: boolean | null;
};

function mapRow(row: TeamMetricBenchmarksDbRow): TeamMetricBenchmarkRow {
  return {
    season_label: row.season_label,
    competition: row.competition,

    source_team_id: row.source_team_id,
    team_source_id: row.source_team_id,

    team_slug: row.team_slug,
    team_name: row.team_name,

    metric_key: row.metric_key,
    display_label: row.display_label,
    metric_label: row.display_label,
    category: row.category,
    display_priority: row.display_priority,
    value_basis: row.value_basis,
    rank_direction: row.rank_direction,

    metric_value: row.metric_value,
    league_rank: row.league_rank,
    league_percentile: row.league_percentile,
    league_avg: row.league_avg,
    league_median: row.league_median,
    vs_league_avg_abs: row.vs_league_avg_abs,
    vs_league_avg_pct: row.vs_league_avg_pct,
    above_league_avg_flag: row.above_league_avg_flag,
  };
}

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

    const { data, error } = await query.returns<TeamMetricBenchmarksDbRow[]>();

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

    return (data ?? []).map(mapRow);
  }
);