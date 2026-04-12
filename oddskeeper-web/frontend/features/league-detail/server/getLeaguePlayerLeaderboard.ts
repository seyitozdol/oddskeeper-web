import { createClient } from "../../../lib/supabase/server";

export type LeaguePlayerLeaderboardRow = {
  season_label: string | null;
  competition: string | null;

  player_source_id: string | null;
  player_name: string | null;
  position_code: string | null;
  role_group: string | null;

  source_team_id: string | null;
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

  rank_direction: string | null;
  is_higher_better: boolean | null;
  value_format: string | null;

  home_away_gap_abs: number | null;
  sample_matches: number | null;
  coverage_flag: boolean | null;
};

type LeaguePlayerLeaderboardDbRow = LeaguePlayerLeaderboardRow;

function mapRow(row: LeaguePlayerLeaderboardDbRow): LeaguePlayerLeaderboardRow {
  return {
    season_label: row.season_label,
    competition: row.competition,

    player_source_id: row.player_source_id,
    player_name: row.player_name,
    position_code: row.position_code,
    role_group: row.role_group,

    source_team_id: row.source_team_id,
    team_slug: row.team_slug,
    team_name: row.team_name,

    metric_key: row.metric_key,
    metric_label: row.metric_label,
    category_key: row.category_key,
    category_label: row.category_label,

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

export async function getLeaguePlayerLeaderboard(
  competition: string,
  season: string
): Promise<LeaguePlayerLeaderboardRow[]> {
  const supabase = await createClient();

  const pageSize = 1000;
  let from = 0;
  let allRows: LeaguePlayerLeaderboardDbRow[] = [];

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .schema("analytics")
      .from("league_player_metric_leaderboard_v1")
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
          coverage_flag
        `
      )
      .eq("competition", competition)
      .eq("season_label", season)
      .order("category_key", { ascending: true })
      .order("metric_label", { ascending: true })
      .order("league_rank", { ascending: true, nullsFirst: false })
      .range(from, to)
      .returns<LeaguePlayerLeaderboardDbRow[]>();

    if (error) {
      return [];
    }

    const pageRows = data ?? [];
    allRows = allRows.concat(pageRows);

    if (pageRows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows.map(mapRow);
}
