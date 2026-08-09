import { cache } from "react";
import { createClient } from "../../../lib/supabase/server";
import { slugForSofascoreTeam } from "@/lib/sofascore-team-map";
import type {
  PlayerDetailedCategoryKey,
  PlayerMetricLeaderboardRow,
} from "../types";

type PlayerMetricLeaderboardDbRow = {
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

  player_pool: string | null;
  ranking_pool: string | null;
  ranking_value: number | null;
  is_qualified: boolean | null;
  qualification_minutes_threshold: number | null;
  qualification_apps_threshold: number | null;
  qualification_reason: string | null;
};

function mapRow(row: PlayerMetricLeaderboardDbRow): PlayerMetricLeaderboardRow {
  return {
    season_label: row.season_label,
    competition: row.competition,

    player_source_id: row.player_source_id,
    player_name: row.player_name,
    position_code: row.position_code,
    role_group: row.role_group,

    source_team_id: row.source_team_id,
    team_slug: row.team_slug ?? slugForSofascoreTeam(row.source_team_id),
    team_name: row.team_name,

    metric_key: row.metric_key,
    metric_label: row.metric_label,
    category_key: (row.category_key ?? "attacking") as PlayerDetailedCategoryKey,
    category_label: row.category_label ?? "Attacking",

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

    player_pool: row.player_pool,
    ranking_pool: row.ranking_pool,
    ranking_value: row.ranking_value,
    is_qualified: row.is_qualified,
    // tsl_ss mat'ında bu bayrak yok; kalifikasyon is_qualified ile taşınır
    recent_activity_flag: null,
    qualification_minutes_threshold: row.qualification_minutes_threshold,
    qualification_apps_threshold: row.qualification_apps_threshold,
    qualification_reason: row.qualification_reason,
  };
}

export const getPlayerMetricLeaderboard = cache(
  async (options: {
    metricKey: string | null | undefined;
    seasonLabel?: string;
    competition?: string;
  }): Promise<PlayerMetricLeaderboardRow[]> => {
    if (!options.metricKey) {
      return [];
    }

    const supabase = await createClient();

    let query = supabase
      .schema("analytics")
      .from("tsl_ss_player_metric_leaderboard_mat")
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
          coverage_flag,
          player_pool,
          ranking_pool,
          ranking_value,
          is_qualified,
          qualification_minutes_threshold,
          qualification_apps_threshold,
          qualification_reason
        `
      )
      .eq("metric_key", options.metricKey)
      // Genel sıralama havuzu: tsl_ss mat'ında tek havuz var ('all').
      .eq("ranking_pool", "all")
      .order("league_rank", { ascending: true, nullsFirst: false })
      .order("player_name", { ascending: true });

    if (options.seasonLabel) {
      query = query.eq("season_label", options.seasonLabel);
    }

    if (options.competition) {
      query = query.eq("competition", options.competition);
    }

    const { data, error } =
      await query.returns<PlayerMetricLeaderboardDbRow[]>();

    if (error) {
      console.error("getPlayerMetricLeaderboard failed", {
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

    let rows = data ?? [];

    // tsl_ss mat'ı birden çok sezonu birlikte taşır; sezon verilmemişse
    // sıralama en güncel sezona daraltılır (eski current-only davranışı).
    if (!options.seasonLabel && rows.length > 0) {
      const latestSeason = rows.reduce<string | null>(
        (max, row) =>
          row.season_label && (!max || row.season_label > max)
            ? row.season_label
            : max,
        null
      );
      if (latestSeason) {
        rows = rows.filter((row) => row.season_label === latestSeason);
      }
    }

    return rows.map(mapRow);
  }
);