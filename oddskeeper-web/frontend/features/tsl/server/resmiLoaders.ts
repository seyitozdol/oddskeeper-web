import { getFootballTeams } from "../../../lib/football-teams";
import { slugFromLogo } from "../lib";
import type {
  TslLeaderRow,
  TslMatch,
  TslMetricOption,
  TslStandingRow,
  TslTeamLeaderRow,
  TslTeamMeta,
  TslTeamMetric,
} from "../types";
import {
  getTslLeaderboard,
  getTslPlayerCatalog,
  getTslStandings,
  getTslTeamLeaderboard,
  getTslTeamMetrics,
} from "./queries";
import type { PlayerAsset } from "./resmi";
import {
  clusterRounds,
  getPlayerAssets,
  getResmiLeaders,
  getResmiTransfers,
  getResmiUpcoming,
  getTeamAggression,
  getTslMatches,
  getTslTeamMeta,
  type MatchRound,
  type ResmiLeaderRow,
  type ResmiTransfer,
  type TeamAggression,
} from "./resmi";

// Gecerli takim slug seti + isim->slug (yerel logodan tureyip football teams ile dogrulanir).
async function buildSlugMaps(standings: TslStandingRow[]) {
  const valid = new Set((await getFootballTeams()).map((t) => t.slug));
  const byName: Record<string, string> = {};
  const byId: Record<string, string> = {};
  for (const s of standings) {
    const slug = slugFromLogo(s.logo);
    if (slug && valid.has(slug)) {
      byName[s.teamName] = slug;
      byId[s.teamId] = slug;
    }
  }
  return { valid, byName, byId };
}

export type ResmiLigBundle = {
  season: string;
  standings: TslStandingRow[];
  leaderMetric: string;
  leaders: ResmiLeaderRow[];
  lastRound: MatchRound | null;
  upcoming: TslMatch[];
  teamSlugById: Record<string, string>;
};

export async function loadResmiLig(
  season: string,
  leaderMetric: string
): Promise<ResmiLigBundle> {
  const meta = await getTslTeamMeta(season);
  const matches = await getTslMatches(season, meta);
  const [standings, assets] = await Promise.all([
    getTslStandings(season, meta, matches),
    getPlayerAssets(),
  ]);
  const { byName, byId } = await buildSlugMaps(standings);
  const [leaders, upcoming] = await Promise.all([
    getResmiLeaders(season, leaderMetric, assets, byName),
    getResmiUpcoming(season, meta),
  ]);
  const rounds = clusterRounds(matches);
  return {
    season,
    standings,
    leaderMetric,
    leaders,
    lastRound: rounds.length ? rounds[rounds.length - 1] : null,
    upcoming,
    teamSlugById: byId,
  };
}

export type ResmiResultsBundle = {
  season: string;
  standings: TslStandingRow[];
  rounds: MatchRound[];
  teamSlugById: Record<string, string>;
};

export async function loadResmiResults(season: string): Promise<ResmiResultsBundle> {
  const meta = await getTslTeamMeta(season);
  const matches = await getTslMatches(season, meta);
  const standings = await getTslStandings(season, meta, matches);
  const { byId } = await buildSlugMaps(standings);
  const rounds = clusterRounds(matches).reverse(); // en son hafta ustte
  return { season, standings, rounds, teamSlugById: byId };
}

export type ResmiTeamsBundle = {
  season: string;
  standings: TslStandingRow[];
  meta: Record<string, TslTeamMeta>;
  teamMetrics: TslTeamMetric[];
  aggression: Record<string, TeamAggression>;
  transfers: ResmiTransfer[];
  teamSlugById: Record<string, string>;
};

export async function loadResmiTeams(season: string): Promise<ResmiTeamsBundle> {
  const meta = await getTslTeamMeta(season);
  const matches = await getTslMatches(season, meta);
  const [standings, teamMetrics, aggression, transfers] = await Promise.all([
    getTslStandings(season, meta, matches),
    getTslTeamMetrics(season, meta),
    getTeamAggression(season),
    getResmiTransfers(season),
  ]);
  const { byId } = await buildSlugMaps(standings);
  return { season, standings, meta, teamMetrics, aggression, transfers, teamSlugById: byId };
}

// meta'dan (id->{name,logo}) slug haritalari (yerel logodan + football teams dogrulama)
async function slugMapsFromMeta(meta: Record<string, TslTeamMeta>) {
  const valid = new Set((await getFootballTeams()).map((t) => t.slug));
  const byName: Record<string, string> = {};
  const byId: Record<string, string> = {};
  for (const m of Object.values(meta)) {
    const slug = slugFromLogo(m.logo);
    if (slug && valid.has(slug)) {
      byName[m.name] = slug;
      byId[m.teamId] = slug;
    }
  }
  return { byName, byId };
}

// ---- Player Rankings (metrik siralamasi, resmi icinde) ----

export type ResmiPlayerRankingsBundle = {
  season: string;
  catalog: TslMetricOption[];
  metricKey: string;
  metric: TslMetricOption | null;
  rows: TslLeaderRow[];
  assets: Record<string, PlayerAsset>;
  teamSlugByName: Record<string, string>;
};

export async function loadResmiPlayerRankings(
  season: string,
  requestedMetric?: string
): Promise<ResmiPlayerRankingsBundle> {
  const catalog = await getTslPlayerCatalog(season);
  const metric =
    catalog.find((c) => c.metricKey === requestedMetric) ??
    catalog.find((c) => c.metricKey === "goals_total") ??
    catalog[0] ??
    null;
  const metricKey = metric?.metricKey ?? "goals_total";
  const [rows, assets, meta] = await Promise.all([
    getTslLeaderboard(season, metricKey),
    getPlayerAssets(),
    getTslTeamMeta(season),
  ]);
  const { byName } = await slugMapsFromMeta(meta);
  return { season, catalog, metricKey, metric, rows, assets, teamSlugByName: byName };
}

// ---- Team Rankings ----

export type ResmiTeamRankingsBundle = {
  season: string;
  catalog: { key: string; label: string; category: string }[];
  metricKey: string;
  metricLabel: string;
  rows: TslTeamLeaderRow[];
  metaById: Record<string, TslTeamMeta>;
  teamSlugById: Record<string, string>;
};

export async function loadResmiTeamRankings(
  season: string,
  requestedMetric?: string
): Promise<ResmiTeamRankingsBundle> {
  const meta = await getTslTeamMeta(season);
  const all = await getTslTeamLeaderboard(season, meta);
  // katalog: benzersiz metrikler
  const catMap = new Map<string, { key: string; label: string; category: string }>();
  for (const r of all) {
    if (!catMap.has(r.metricKey)) {
      catMap.set(r.metricKey, {
        key: r.metricKey,
        label: r.metricLabel,
        category: r.categoryLabel ?? "",
      });
    }
  }
  const catalog = [...catMap.values()];
  const metricKey =
    catalog.find((c) => c.key === requestedMetric)?.key ??
    catalog.find((c) => c.key === "team_goals_for")?.key ??
    catalog[0]?.key ??
    "team_goals_for";
  const rows = all.filter((r) => r.metricKey === metricKey);
  const { byId } = await slugMapsFromMeta(meta);
  return {
    season,
    catalog,
    metricKey,
    metricLabel: catMap.get(metricKey)?.label ?? metricKey,
    rows,
    metaById: meta,
    teamSlugById: byId,
  };
}
