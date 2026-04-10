import { cache } from "react";
import { createClient } from "../../../lib/supabase/server";
import type { TeamMetricLeaderboardRow } from "../types";

type TeamMetricLeaderboardDbRow = {
  season_label: string | null;
  competition: string | null;

  team_slug: string | null;
  source_team_id: string | number | null;
  team_name: string | null;

  metric_key: string;
  metric_label: string;
  category_key: string | null;
  category_label: string | null;

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

  sample_matches: number | null;
  coverage_flag: boolean | null;
};

function mapRow(row: TeamMetricLeaderboardDbRow): TeamMetricLeaderboardRow {
  return {
    season_label: row.season_label,
    competition: row.competition,

    team_slug: row.team_slug,
    source_team_id: row.source_team_id,
    team_name: row.team_name,

    metric_key: row.metric_key,
    metric_label: row.metric_label,
    category_key: (row.category_key ?? "attack") as TeamMetricLeaderboardRow["category_key"],
    category_label: row.category_label ?? "Attack",

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

    sample_matches: row.sample_matches,
    coverage_flag: row.coverage_flag,
  };
}

export const getTeamMetricLeaderboard = cache(
  async (options: {
    metricKey: string | null | undefined;
    seasonLabel?: string;
    competition?: string;
  }): Promise<TeamMetricLeaderboardRow[]> => {
    if (!options.metricKey) {
      return [];
    }

    const supabase = await createClient();

    let query = supabase
      .schema("analytics")
      .from("team_detailed_metrics_v2_1")
      .select(
        `
          season_label,
          competition,
          team_slug,
          source_team_id,
          team_name,
          metric_key,
          metric_label,
          category_key,
          category_label,
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
          sample_matches,
          coverage_flag
        `
      )
      .eq("metric_key", options.metricKey)
      .order("league_rank", { ascending: true })
      .order("team_name", { ascending: true });

    if (options.seasonLabel) {
      query = query.eq("season_label", options.seasonLabel);
    }

    if (options.competition) {
      query = query.eq("competition", options.competition);
    }

    const { data, error } =
      await query.returns<TeamMetricLeaderboardDbRow[]>();

    if (error) {
      console.error("getTeamMetricLeaderboard failed", {
        metricKey: options.metricKey,
        seasonLabel: options.seasonLabel ?? null,
        competition: options.competition ?? null,
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