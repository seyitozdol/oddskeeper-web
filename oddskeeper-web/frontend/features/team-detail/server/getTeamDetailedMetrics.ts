import { cache } from "react";
import { createClient } from "../../../lib/supabase/server";
import type {
  TeamDetailedCategoryKey,
  TeamDetailedMetricRow,
} from "../types";

type TeamDetailedMetricsDbRow = {
  season_label: string | null;
  competition: string | null;

  source_team_id: string | number | null;
  team_slug: string | null;
  team_name: string | null;

  metric_key: string;
  metric_label: string;
  category_key: TeamDetailedCategoryKey;
  category_label: string;
  display_priority: number | null;

  total_value: number | null;
  per_match_value: number | null;
  home_value: number | null;
  away_value: number | null;

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

function mapRow(row: TeamDetailedMetricsDbRow): TeamDetailedMetricRow {
  return {
    season_label: row.season_label,
    competition: row.competition,

    source_team_id: row.source_team_id,
    team_source_id: row.source_team_id,

    team_slug: row.team_slug,
    team_name: row.team_name,

    metric_key: row.metric_key,
    metric_label: row.metric_label,
    category_key: row.category_key,
    category_label: row.category_label,
    display_priority: row.display_priority,

    total_value: row.total_value,
    per_match_value: row.per_match_value,
    home_value: row.home_value,
    away_value: row.away_value,

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

export const getTeamDetailedMetrics = cache(
  async (
    teamSlug: string | null | undefined,
    options?: {
      seasonLabel?: string;
      categoryKey?: TeamDetailedCategoryKey;
    }
  ): Promise<TeamDetailedMetricRow[]> => {
    if (!teamSlug) {
      return [];
    }

    const supabase = await createClient();

    let query = supabase
      .schema("analytics")
      .from("team_detailed_metrics_v1")
      .select(
        `
          season_label,
          competition,
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
          home_value,
          away_value,
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
      .eq("team_slug", teamSlug)
      .order("category_key", { ascending: true })
      .order("display_priority", { ascending: true })
      .order("metric_label", { ascending: true });

    if (options?.seasonLabel) {
      query = query.eq("season_label", options.seasonLabel);
    }

    if (options?.categoryKey) {
      query = query.eq("category_key", options.categoryKey);
    }

    const { data, error } =
      await query.returns<TeamDetailedMetricsDbRow[]>();

    if (error) {
      console.error("getTeamDetailedMetrics failed", {
        teamSlug,
        seasonLabel: options?.seasonLabel ?? null,
        categoryKey: options?.categoryKey ?? null,
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