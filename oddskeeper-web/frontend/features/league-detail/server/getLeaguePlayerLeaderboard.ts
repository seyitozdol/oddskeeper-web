import { createClient } from "../../../lib/supabase/server";
import { getPlayerDisplayNameMap } from "../../../lib/player-display-names";

export type LeaguePlayerMetricOption = {
  metric_key: string;
  metric_label: string;
  category_key: string | null;
  category_label: string | null;
  value_format: string | null;
  is_higher_better: boolean | null;
  default_basis: string | null;
};

export type LeaguePlayerLeaderboardRow = {
  competition: string | null;
  season_label: string | null;

  category_key: string | null;
  category_label: string | null;
  metric_key: string;
  metric_label: string;

  player_source_id: string | null;
  player_name: string | null;
  player_slug: string | null;

  position_code: string | null;
  role_group: string | null;

  source_team_id: string | null;
  team_slug: string | null;
  team_name: string | null;

  sample_matches: number | null;

  total_value: number | null;
  per_match_value: number | null;
  per90_value: number | null;

  league_avg: number | null;
  league_rank: number | null;
  vs_league_avg_pct: number | null;

  value_format: string | null;
  is_higher_better: boolean | null;
};

type MetricCatalogDbRow = LeaguePlayerMetricOption;

type LeaderboardDbRow = LeaguePlayerLeaderboardRow;

function mapMetricRow(row: MetricCatalogDbRow): LeaguePlayerMetricOption {
  return {
    metric_key: row.metric_key,
    metric_label: row.metric_label ?? row.metric_key,
    category_key: row.category_key,
    category_label: row.category_label,
    value_format: row.value_format,
    is_higher_better: row.is_higher_better,
    default_basis: row.default_basis,
  };
}

function mapLeaderboardRow(row: LeaderboardDbRow): LeaguePlayerLeaderboardRow {
  return {
    competition: row.competition,
    season_label: row.season_label,

    category_key: row.category_key,
    category_label: row.category_label,
    metric_key: row.metric_key,
    metric_label: row.metric_label,

    player_source_id: row.player_source_id,
    player_name: row.player_name,
    player_slug: row.player_slug,

    position_code: row.position_code,
    role_group: row.role_group,

    source_team_id: row.source_team_id,
    team_slug: row.team_slug,
    team_name: row.team_name,

    sample_matches: row.sample_matches,

    total_value: row.total_value,
    per_match_value: row.per_match_value,
    per90_value: row.per90_value,

    league_avg: row.league_avg,
    league_rank: row.league_rank,
    vs_league_avg_pct: row.vs_league_avg_pct,

    value_format: row.value_format,
    is_higher_better: row.is_higher_better,
  };
}

export async function getLeaguePlayerLeaderboardMeta(
  competition: string,
  season: string
): Promise<LeaguePlayerMetricOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_leaderboard_metric_catalog_v1")
    .select(
      `
        metric_key,
        metric_label,
        category_key,
        category_label,
        value_format,
        is_higher_better,
        default_basis
      `
    )
    .eq("competition", competition)
    .eq("season_label", season)
    .eq("is_active", true)
    .order("category_sort", { ascending: true })
    .order("metric_sort", { ascending: true })
    .returns<MetricCatalogDbRow[]>();

  if (error) {
    return [];
  }

  return (data ?? []).map(mapMetricRow);
}

type GetLeaguePlayerLeaderboardParams = {
  competition: string;
  season: string;
  metricKey: string;
  minApps?: number;
  role?: "all" | "starter_core" | "starters" | "substitutes";
  teamSlug?: string | null;
};

export async function getLeaguePlayerLeaderboard({
  competition,
  season,
  metricKey,
  minApps = 5,
  role = "starter_core",
  teamSlug = null,
}: GetLeaguePlayerLeaderboardParams): Promise<LeaguePlayerLeaderboardRow[]> {
  const supabase = await createClient();

  let query = supabase
    .schema("analytics")
    .from("player_leaderboard_rows_v1")
    .select(
      `
        competition,
        season_label,
        category_key,
        category_label,
        metric_key,
        metric_label,
        player_source_id,
        player_name,
        player_slug,
        position_code,
        role_group,
        source_team_id,
        team_slug,
        team_name,
        sample_matches,
        total_value,
        per_match_value,
        per90_value,
        league_avg,
        league_rank,
        vs_league_avg_pct,
        value_format,
        is_higher_better
      `
    )
    .eq("competition", competition)
    .eq("season_label", season)
    .eq("metric_key", metricKey)
    .gte("sample_matches", minApps)
    .order("league_rank", { ascending: true, nullsFirst: false });

  if (role === "starter_core" || role === "starters") {
    query = query.neq("role_group", "SUBSTITUTE");
  } else if (role === "substitutes") {
    query = query.eq("role_group", "SUBSTITUTE");
  }

  if (teamSlug && teamSlug !== "all") {
    query = query.eq("team_slug", teamSlug);
  }

  const { data, error } = await query.returns<LeaderboardDbRow[]>();

  if (error) {
    return [];
  }

  const rows = (data ?? []).map(mapLeaderboardRow);
  const nameMap = await getPlayerDisplayNameMap(
    rows.map((row) => row.player_slug)
  );

  return rows.map((row) => ({
    ...row,
    player_name:
      (row.player_slug ? nameMap.get(row.player_slug) : null) ??
      row.player_name,
  }));
}