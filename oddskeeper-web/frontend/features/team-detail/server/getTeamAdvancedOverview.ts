import { createClient } from "@/lib/supabase/server";

export async function getTeamAdvancedOverview(
  teamSlug: string | null | undefined,
  options?: {
    seasonLabel?: string;
  }
): Promise<any | null> {
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

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("getTeamAdvancedOverview failed", {
      teamSlug,
      seasonLabel: options?.seasonLabel ?? null,
      message: error.message,
    });
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    strongest_metric_rank: data.strongest_metric_league_rank,
    strongest_metric_vs_league_pct: data.strongest_metric_vs_league_avg_pct,
    weakest_metric_rank: data.weakest_metric_league_rank,
    weakest_metric_vs_league_pct: data.weakest_metric_vs_league_avg_pct,
    home_away_gap_metric_label: data.home_away_gap_metric_key,
  };
}