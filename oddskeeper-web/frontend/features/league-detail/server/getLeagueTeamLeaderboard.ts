import { createClient } from "../../../lib/supabase/server";

type LeagueTeamCategoryKey =
  | "attack"
  | "defence"
  | "build_up"
  | "discipline"
  | "set_piece"
  | "goal_composition";

export type LeagueTeamLeaderboardRow = {
  season_label: string | null;
  competition: string | null;

  metric_key: string;
  metric_label: string;

  category_key: LeagueTeamCategoryKey | string | null;
  category_label: string | null;

  team_slug: string | null;
  team_name: string | null;

  total_value: number | null;
  per_match_value: number | null;
  home_value: number | null;
  away_value: number | null;

  league_avg: number | null;
  league_median: number | null;
  league_rank: number | null;
  vs_league_avg_pct: number | null;

  value_format: string | null;
  rank_direction: string | null;
  is_higher_better: boolean | null;
};

type LeagueTeamLeaderboardDbRow = LeagueTeamLeaderboardRow;

function mapRow(row: LeagueTeamLeaderboardDbRow): LeagueTeamLeaderboardRow {
  return {
    season_label: row.season_label,
    competition: row.competition,

    metric_key: row.metric_key,
    metric_label: row.metric_label,

    category_key: row.category_key,
    category_label: row.category_label,

    team_slug: row.team_slug,
    team_name: row.team_name,

    total_value: row.total_value,
    per_match_value: row.per_match_value,
    home_value: row.home_value,
    away_value: row.away_value,

    league_avg: row.league_avg,
    league_median: row.league_median,
    league_rank: row.league_rank,
    vs_league_avg_pct: row.vs_league_avg_pct,

    value_format: row.value_format,
    rank_direction: row.rank_direction,
    is_higher_better: row.is_higher_better,
  };
}

export async function getLeagueTeamLeaderboard(
  competition: string,
  season: string
): Promise<LeagueTeamLeaderboardRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("league_team_metric_leaderboard_v1")
    .select(
      `
        season_label,
        competition,
        metric_key,
        metric_label,
        category_key,
        category_label,
        team_slug,
        team_name,
        total_value,
        per_match_value,
        home_value,
        away_value,
        league_avg,
        league_median,
        league_rank,
        vs_league_avg_pct,
        value_format,
        rank_direction,
        is_higher_better
      `
    )
    .eq("competition", competition)
    .eq("season_label", season)
    .order("metric_label", { ascending: true })
    .order("league_rank", { ascending: true, nullsFirst: false })
    .returns<LeagueTeamLeaderboardDbRow[]>();

  if (error) {
    console.error("league team leaderboard fetch error:", {
      competition,
      season,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return [];
  }

  return (data ?? []).map(mapRow);
}