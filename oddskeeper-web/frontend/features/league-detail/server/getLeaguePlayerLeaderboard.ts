import { createClient } from "../../../lib/supabase/server";

export type LeaguePlayerMetricOption = {
  metric_key: string;
  metric_label: string;
  category_key: string | null;
  category_label: string | null;
};

export type LeaguePlayerLeaderboardRow = {
  season_label: string | null;
  competition: string | null;
  player_source_id: string | null;
  player_name: string | null;
  position_code: string | null;
  role_group: string | null;
  team_slug: string | null;
  team_name: string | null;
  metric_key: string;
  metric_label: string;
  category_key: string | null;
  category_label: string | null;
  total_value: number | null;
  per_match_value: number | null;
  per90_value: number | null;
  league_avg: number | null;
  league_rank: number | null;
  vs_league_avg_pct: number | null;
  is_higher_better: boolean | null;
  value_format: string | null;
  sample_matches: number | null;
};

type MetricOptionDbRow = {
  metric_key: string;
  metric_label: string | null;
  category_key: string | null;
  category_label: string | null;
};

type LeaderboardDbRow = LeaguePlayerLeaderboardRow;

function mapLeaderboardRow(row: LeaderboardDbRow): LeaguePlayerLeaderboardRow {
  return {
    season_label: row.season_label,
    competition: row.competition,
    player_source_id: row.player_source_id,
    player_name: row.player_name,
    position_code: row.position_code,
    role_group: row.role_group,
    team_slug: row.team_slug,
    team_name: row.team_name,
    metric_key: row.metric_key,
    metric_label: row.metric_label,
    category_key: row.category_key,
    category_label: row.category_label,
    total_value: row.total_value,
    per_match_value: row.per_match_value,
    per90_value: row.per90_value,
    league_avg: row.league_avg,
    league_rank: row.league_rank,
    vs_league_avg_pct: row.vs_league_avg_pct,
    is_higher_better: row.is_higher_better,
    value_format: row.value_format,
    sample_matches: row.sample_matches,
  };
}

export async function getLeaguePlayerLeaderboardMeta(
  competition: string,
  season: string
): Promise<LeaguePlayerMetricOption[]> {
  const supabase = await createClient();

  const pageSize = 1000;
  let from = 0;
  let allRows: MetricOptionDbRow[] = [];

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .schema("analytics")
      .from("league_player_metric_leaderboard_v1")
      .select("metric_key, metric_label, category_key, category_label")
      .eq("competition", competition)
      .eq("season_label", season)
      .range(from, to)
      .returns<MetricOptionDbRow[]>();

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

  const unique = new Map<string, LeaguePlayerMetricOption>();

  allRows.forEach((row) => {
    if (!row.metric_key) return;
    if (!unique.has(row.metric_key)) {
      unique.set(row.metric_key, {
        metric_key: row.metric_key,
        metric_label: row.metric_label ?? row.metric_key,
        category_key: row.category_key,
        category_label: row.category_label,
      });
    }
  });

  return Array.from(unique.values()).sort((a, b) => {
    const catA = a.category_label ?? a.category_key ?? "";
    const catB = b.category_label ?? b.category_key ?? "";
    if (catA !== catB) return catA.localeCompare(catB);
    return a.metric_label.localeCompare(b.metric_label);
  });
}

export async function getLeaguePlayerLeaderboard(
  competition: string,
  season: string,
  metricKey: string
): Promise<LeaguePlayerLeaderboardRow[]> {
  const supabase = await createClient();

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
        team_slug,
        team_name,
        metric_key,
        metric_label,
        category_key,
        category_label,
        total_value,
        per_match_value,
        per90_value,
        league_avg,
        league_rank,
        vs_league_avg_pct,
        is_higher_better,
        value_format,
        sample_matches
      `
    )
    .eq("competition", competition)
    .eq("season_label", season)
    .eq("metric_key", metricKey)
    .order("league_rank", { ascending: true, nullsFirst: false })
    .returns<LeaderboardDbRow[]>();

  if (error) {
    return [];
  }

  return (data ?? []).map(mapLeaderboardRow);
}
