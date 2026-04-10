import { createClient } from "@/lib/supabase/server";
import type { TeamAdvancedOverviewRow } from "../types";

type TeamAdvancedOverviewDbRow = {
  season_label: string | null;
  competition: string | null;

  source_team_id: string | number | null;
  team_slug: string | null;
  team_name: string | null;

  attack_profile_label: string | null;
  defence_profile_label: string | null;
  recent_form_label: string | null;
  form_shift_last5_flag: boolean | null;

  strongest_metric_key: string | null;
  strongest_metric_label: string | null;
  strongest_metric_category: string | null;
  strongest_metric_value: string | number | boolean | null;
  strongest_metric_league_rank: number | null;
  strongest_metric_league_percentile: number | null;
  strongest_metric_vs_league_avg_pct: number | null;

  weakest_metric_key: string | null;
  weakest_metric_label: string | null;
  weakest_metric_category: string | null;
  weakest_metric_value: string | number | boolean | null;
  weakest_metric_league_rank: number | null;
  weakest_metric_league_percentile: number | null;
  weakest_metric_vs_league_avg_pct: number | null;

  home_away_gap_metric_key: string | null;
  home_away_gap_home_value: string | number | boolean | null;
  home_away_gap_away_value: string | number | boolean | null;
  home_away_gap_abs: number | null;
};

function mapRow(row: TeamAdvancedOverviewDbRow): TeamAdvancedOverviewRow {
  return {
    season_label: row.season_label,
    competition: row.competition,

    source_team_id: row.source_team_id,
    team_source_id: row.source_team_id,

    team_slug: row.team_slug,
    team_name: row.team_name,

    attack_profile_label: row.attack_profile_label,
    defence_profile_label: row.defence_profile_label,
    recent_form_label: row.recent_form_label,
    form_shift_last5_flag: row.form_shift_last5_flag,

    strongest_metric_key: row.strongest_metric_key,
    strongest_metric_label: row.strongest_metric_label,
    strongest_metric_category: row.strongest_metric_category,
    strongest_metric_value: row.strongest_metric_value,
    strongest_metric_league_rank: row.strongest_metric_league_rank,
    strongest_metric_league_percentile: row.strongest_metric_league_percentile,
    strongest_metric_vs_league_avg_pct: row.strongest_metric_vs_league_avg_pct,

    weakest_metric_key: row.weakest_metric_key,
    weakest_metric_label: row.weakest_metric_label,
    weakest_metric_category: row.weakest_metric_category,
    weakest_metric_value: row.weakest_metric_value,
    weakest_metric_league_rank: row.weakest_metric_league_rank,
    weakest_metric_league_percentile: row.weakest_metric_league_percentile,
    weakest_metric_vs_league_avg_pct: row.weakest_metric_vs_league_avg_pct,

    home_away_gap_metric_key: row.home_away_gap_metric_key,
    home_away_gap_home_value: row.home_away_gap_home_value,
    home_away_gap_away_value: row.home_away_gap_away_value,
    home_away_gap_abs: row.home_away_gap_abs,

    strongest_metric_rank: row.strongest_metric_league_rank,
    strongest_metric_vs_league_pct: row.strongest_metric_vs_league_avg_pct,
    weakest_metric_rank: row.weakest_metric_league_rank,
    weakest_metric_vs_league_pct: row.weakest_metric_vs_league_avg_pct,
    home_away_gap_metric_label: row.home_away_gap_metric_key,
  };
}

export async function getTeamAdvancedOverview(
  teamSlug: string | null | undefined,
  options?: {
    seasonLabel?: string;
  }
): Promise<TeamAdvancedOverviewRow | null> {
  if (!teamSlug) {
    return null;
  }

  const supabase = await createClient();

  let query = supabase
    .schema("analytics")
    .from("team_overview_advanced_v1")
    .select(
      `
        season_label,
        competition,
        source_team_id,
        team_slug,
        team_name,
        attack_profile_label,
        defence_profile_label,
        recent_form_label,
        form_shift_last5_flag,
        strongest_metric_key,
        strongest_metric_label,
        strongest_metric_category,
        strongest_metric_value,
        strongest_metric_league_rank,
        strongest_metric_league_percentile,
        strongest_metric_vs_league_avg_pct,
        weakest_metric_key,
        weakest_metric_label,
        weakest_metric_category,
        weakest_metric_value,
        weakest_metric_league_rank,
        weakest_metric_league_percentile,
        weakest_metric_vs_league_avg_pct,
        home_away_gap_metric_key,
        home_away_gap_home_value,
        home_away_gap_away_value,
        home_away_gap_abs
      `
    )
    .eq("team_slug", teamSlug)
    .order("season_label", { ascending: false })
    .limit(1);

  if (options?.seasonLabel) {
    query = query.eq("season_label", options.seasonLabel);
  }

  const { data, error } =
    await query.returns<TeamAdvancedOverviewDbRow[]>();

  if (error) {
    console.error("getTeamAdvancedOverview failed", {
      teamSlug,
      seasonLabel: options?.seasonLabel ?? null,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  const row = data?.[0] ?? null;

  if (!row) {
    return null;
  }

  return mapRow(row);
}