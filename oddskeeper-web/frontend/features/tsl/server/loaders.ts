import {
  computeSummary,
  getTslLeaderboard,
  getTslMatches,
  getTslPlayerCatalog,
  getTslPlayerOverview,
  getTslStandings,
  getTslTeamLeaderboard,
  getTslTeamMeta,
  getTslTeamMetrics,
} from "./queries";
import type {
  TslLeaderRow,
  TslMatch,
  TslMetricOption,
  TslPlayerOverview,
  TslStandingRow,
  TslSummary,
  TslTeamLeaderRow,
  TslTeamMeta,
  TslTeamMetric,
} from "../types";

export type LeagueBundle = {
  season: string;
  standings: TslStandingRow[];
  matches: TslMatch[];
  summary: TslSummary;
  leaders: {
    goals: TslLeaderRow[];
    assists: TslLeaderRow[];
    rating: TslLeaderRow[];
    xg: TslLeaderRow[];
  };
  teamMetrics: TslTeamMetric[];
  meta: Record<string, TslTeamMeta>;
};

export async function loadLeague(season: string): Promise<LeagueBundle> {
  const meta = await getTslTeamMeta(season);
  const matches = await getTslMatches(season, meta);
  // P-4: UI en fazla ilk 6-10 lideri gosteriyor; 4x600 satir yerine DB'den
  // toplam-sirali ilk 12 satir cekilir.
  const [standings, goals, assists, rating, xg, teamMetrics] = await Promise.all([
    getTslStandings(season, meta, matches),
    getTslLeaderboard(season, "goals_total", { topByTotal: 12 }),
    getTslLeaderboard(season, "assists_total", { topByTotal: 12 }),
    getTslLeaderboard(season, "rating_avg", { topByTotal: 12 }),
    getTslLeaderboard(season, "expected_goals_total", { topByTotal: 12 }),
    getTslTeamMetrics(season, meta),
  ]);

  // View'lar per90'a gore siralanir; lig liderleri (gol krali/asist lideri/xG)
  // TOPLAM degere gore siralanmali. Reyting zaten sezon ortalamasidir.
  const byTotalDesc = (rows: TslLeaderRow[]) =>
    rows.slice().sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

  return {
    season,
    standings,
    matches,
    summary: computeSummary(matches, standings.length),
    leaders: {
      goals: byTotalDesc(goals),
      assists: byTotalDesc(assists),
      rating: byTotalDesc(rating),
      xg: byTotalDesc(xg),
    },
    teamMetrics,
    meta,
  };
}

export type PlayersBundle = {
  season: string;
  catalog: TslMetricOption[];
  metricKey: string;
  metric: TslMetricOption | null;
  rows: TslLeaderRow[];
  overview: TslPlayerOverview[];
  scatterGoals: TslLeaderRow[];
  scatterXg: TslLeaderRow[];
};

export async function loadPlayers(
  season: string,
  requestedMetric?: string
): Promise<PlayersBundle> {
  const catalog = await getTslPlayerCatalog(season);
  // istenen metrik gecerliyse onu, degilse gol'u, o da yoksa ilkini sec.
  const valid = catalog.find((c) => c.metricKey === requestedMetric);
  const fallback =
    catalog.find((c) => c.metricKey === "goals_total") ?? catalog[0] ?? null;
  const metric = valid ?? fallback;
  const metricKey = metric?.metricKey ?? "goals_total";

  const [rows, overview, scatterGoals, scatterXg] = await Promise.all([
    getTslLeaderboard(season, metricKey),
    getTslPlayerOverview(season),
    getTslLeaderboard(season, "goals_total"),
    getTslLeaderboard(season, "expected_goals_total"),
  ]);

  return { season, catalog, metricKey, metric, rows, overview, scatterGoals, scatterXg };
}

export type TeamsBundle = {
  season: string;
  standings: TslStandingRow[];
  meta: Record<string, TslTeamMeta>;
  teamMetrics: TslTeamMetric[];
  teamLeaderboard: TslTeamLeaderRow[];
};

export async function loadTeams(season: string): Promise<TeamsBundle> {
  const meta = await getTslTeamMeta(season);
  const matches = await getTslMatches(season, meta);
  const [standings, teamMetrics, teamLeaderboard] = await Promise.all([
    getTslStandings(season, meta, matches),
    getTslTeamMetrics(season, meta),
    getTslTeamLeaderboard(season, meta),
  ]);
  return { season, standings, meta, teamMetrics, teamLeaderboard };
}
