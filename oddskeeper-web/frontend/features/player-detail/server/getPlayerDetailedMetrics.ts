import { cache } from "react";
import { createClient } from "../../../lib/supabase/server";
import type {
  PlayerDetailedCategoryKey,
  PlayerDetailedMetricRow,
} from "../types";

type PlayerDetailedMetricsDbRow = {
  season_label: string | null;
  competition: string | null;

  source_team_id: string | number | null;
  team_slug: string | null;
  team_name: string | null;

  player_source_id: string | number | null;
  player_name: string | null;
  position_code: string | null;
  role_group: string | null;

  metric_key: string;
  metric_label: string;
  category_key: PlayerDetailedCategoryKey;
  category_label: string;
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

type PlayerProfileLookupRow = {
  player_source_id: string | number;
  season_label: string | null;
};

function mapRow(row: PlayerDetailedMetricsDbRow): PlayerDetailedMetricRow {
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

    metric_key: row.metric_key,
    metric_label: row.metric_label,
    category_key: row.category_key,
    category_label: row.category_label,
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
    playerSlug: string | null | undefined,
    options?: {
      seasonLabel?: string;
      categoryKey?: PlayerDetailedCategoryKey;
    }
  ): Promise<PlayerDetailedMetricRow[]> => {
    if (!playerSlug) {
      return [];
    }

    const supabase = await createClient();

    let profileLookupQuery = supabase
      .schema("analytics")
      .from("player_profile_v1")
      .select("player_source_id, season_label")
      .eq("player_slug", playerSlug)
      .limit(1);

    if (options?.seasonLabel) {
      profileLookupQuery = profileLookupQuery.eq(
        "season_label",
        options.seasonLabel
      );
    }

    const { data: profileData, error: profileError } =
      await profileLookupQuery.returns<PlayerProfileLookupRow[]>();

    if (profileError) {
      console.error("getPlayerDetailedMetrics profile lookup failed", {
        playerSlug,
        seasonLabel: options?.seasonLabel ?? null,
        categoryKey: options?.categoryKey ?? null,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code,
      });
      return [];
    }

    const profileRow = profileData?.[0] ?? null;

    if (!profileRow?.player_source_id) {
      return [];
    }

    let query = supabase
      .schema("analytics")
      .from("player_detailed_metrics_v1")
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
      .order("display_priority", { ascending: true })
      .order("metric_label", { ascending: true });

    if (options?.seasonLabel) {
      query = query.eq("season_label", options.seasonLabel);
    } else if (profileRow.season_label) {
      query = query.eq("season_label", profileRow.season_label);
    }

    if (options?.categoryKey) {
      query = query.eq("category_key", options.categoryKey);
    }

    const { data, error } =
      await query.returns<PlayerDetailedMetricsDbRow[]>();

    if (error) {
      console.error("getPlayerDetailedMetrics failed", {
        playerSlug,
        playerSourceId: profileRow.player_source_id,
        seasonLabel: options?.seasonLabel ?? profileRow.season_label ?? null,
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