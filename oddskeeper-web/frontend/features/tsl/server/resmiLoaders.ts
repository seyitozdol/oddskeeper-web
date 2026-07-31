import { getAllFootballTeamLogos, getFootballTeams } from "../../../lib/football-teams";
import { getTeamDetailHref } from "../../../lib/routes";
import {
  playerHrefFor,
  teamHrefFor,
  type LeagueConfig,
} from "../leagues";
import { normalizeSearch, slugFromLogo } from "../lib";
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
  getTslTeamMeta,
  getTslTeamMetrics,
} from "./queries";
import {
  buildZeroStandings,
  clusterRounds,
  getPlayerAssets,
  getResmiPlayers,
  getResmiTransfers,
  getResmiUpcoming,
  getTeamAggression,
  getTslMatches,
  type MatchRound,
  type PlayerAsset,
  type ResmiLeaderRow,
  type ResmiPlayerRow,
  type ResmiTransfer,
  type TeamAggression,
} from "./resmi";
import {
  tff1Aggression,
  tff1Assets,
  tff1Leaderboard,
  tff1Matches,
  tff1Players,
  tff1PlayerCatalog,
  tff1Standings,
  tff1TeamLeaderboard,
  tff1TeamMeta,
  tff1TeamMetrics,
  tff1Upcoming,
} from "./tff1data";

// ---- Lig kaynak sağlayıcısı (tsl_ss vs tff1) ----
type Provider = {
  teamMeta(season: string): Promise<Record<string, TslTeamMeta>>;
  matches(season: string, meta: Record<string, TslTeamMeta>): Promise<TslMatch[]>;
  upcoming(season: string, meta: Record<string, TslTeamMeta>): Promise<TslMatch[]>;
  standings(season: string, meta: Record<string, TslTeamMeta>, matches: TslMatch[]): Promise<TslStandingRow[]>;
  players(season: string, meta: Record<string, TslTeamMeta>, assets: Record<string, PlayerAsset>): Promise<ResmiPlayerRow[]>;
  assets(): Promise<Record<string, PlayerAsset>>;
  catalog(season: string): Promise<TslMetricOption[]>;
  leaderboard(season: string, metricKey: string, meta: Record<string, TslTeamMeta>): Promise<TslLeaderRow[]>;
  teamMetrics(season: string, meta: Record<string, TslTeamMeta>): Promise<TslTeamMetric[]>;
  teamLeaderboard(season: string, meta: Record<string, TslTeamMeta>): Promise<TslTeamLeaderRow[]>;
  aggression(season: string): Promise<Record<string, TeamAggression>>;
  transfers(season: string): Promise<ResmiTransfer[]>;
};

function providerFor(config: LeagueConfig): Provider {
  if (config.source === "tff1") {
    return {
      teamMeta: () => tff1TeamMeta(),
      matches: (s, meta) => tff1Matches(s, meta),
      upcoming: (s, meta) => tff1Upcoming(s, meta),
      standings: (s, meta, m) => tff1Standings(s, meta, m),
      players: (s, meta) => tff1Players(s, meta),
      assets: () => tff1Assets(),
      catalog: () => Promise.resolve(tff1PlayerCatalog()),
      leaderboard: (s, mk, meta) => tff1Leaderboard(s, mk, meta),
      teamMetrics: (s, meta) => tff1TeamMetrics(s, meta),
      teamLeaderboard: (s, meta) => tff1TeamLeaderboard(s, meta),
      aggression: (s) => tff1Aggression(s),
      transfers: () => Promise.resolve([]),
    };
  }
  return {
    teamMeta: (s) => getTslTeamMeta(s),
    matches: (s, meta) => getTslMatches(s, meta),
    upcoming: (s, meta) => getResmiUpcoming(s, meta),
    standings: (s, meta, m) => getTslStandings(s, meta, m),
    players: (s, meta, assets) => getResmiPlayers(s, meta, assets),
    assets: () => getPlayerAssets(),
    catalog: (s) => getTslPlayerCatalog(s),
    leaderboard: (s, mk) => getTslLeaderboard(s, mk),
    teamMetrics: (s, meta) => getTslTeamMetrics(s, meta),
    teamLeaderboard: (s, meta) => getTslTeamLeaderboard(s, meta),
    aggression: (s) => getTeamAggression(s),
    transfers: (s) => getResmiTransfers(s),
  };
}

// Takım id -> detay href (lig kaynağına göre; tsl slug doğrulamalı).
async function teamHrefMap(
  config: LeagueConfig,
  meta: Record<string, TslTeamMeta>,
  season: string
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  // Güncel + arşiv logolar: ligden düşen takımlar (arşivde) da profillerine
  // bağlanabilsin (aksi halde eski TSL sezonunda takıma tıklanınca link boştu).
  const valid =
    config.source === "tsl"
      ? new Set(Object.keys(await getAllFootballTeamLogos()))
      : null;
  for (const m of Object.values(meta)) {
    const slug = config.source === "tsl" ? slugFromLogo(m.logo) : null;
    const okSlug = slug && valid?.has(slug) ? slug : null;
    out[m.teamId] = teamHrefFor(config, m.teamId, okSlug, season);
  }
  return out;
}

async function buildZeroTeamMetrics(
  p: Provider,
  teams: TslStandingRow[],
  meta: Record<string, TslTeamMeta>
): Promise<TslTeamMetric[]> {
  const defsRaw = await p.teamMetrics("2025/2026", meta);
  const defMap = new Map<string, TslTeamMetric>();
  for (const d of defsRaw) if (!defMap.has(d.metricKey)) defMap.set(d.metricKey, d);
  const defs = [...defMap.values()];
  const out: TslTeamMetric[] = [];
  for (const team of teams)
    for (const d of defs)
      out.push({
        teamId: team.teamId, teamName: team.teamName, metricKey: d.metricKey, metricLabel: d.metricLabel,
        categoryKey: d.categoryKey, total: 0, perMatch: 0, leagueAvg: 0, leaguePct: 0, leagueRank: null,
        valueFormat: d.valueFormat, isHigherBetter: d.isHigherBetter,
      });
  return out;
}

// =================== Loaders ===================

export type ResmiLigBundle = {
  season: string;
  basePath: string;
  matchBase: string;
  standings: TslStandingRow[];
  leaderMetric: string;
  leaders: ResmiLeaderRow[];
  lastRound: MatchRound | null;
  upcoming: TslMatch[];
  teamHrefById: Record<string, string | null>;
};

export async function loadResmiLig(
  config: LeagueConfig,
  season: string,
  leaderMetric: string
): Promise<ResmiLigBundle> {
  const p = providerFor(config);
  const meta = await p.teamMeta(season);
  const matches = await p.matches(season, meta);
  const [standingsReal, assets, upcoming, leaderRows] = await Promise.all([
    p.standings(season, meta, matches),
    p.assets(),
    p.upcoming(season, meta),
    p.leaderboard(season, leaderMetric, meta),
  ]);
  const teamHrefById = await teamHrefMap(config, meta, season);
  const standings = standingsReal.length ? standingsReal : buildZeroStandings(upcoming, meta);

  const leaders: ResmiLeaderRow[] = leaderRows
    .slice()
    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
    .slice(0, 10)
    .map((r, i) => ({
      rank: i + 1,
      playerId: r.playerId,
      playerName: r.playerName,
      playerHref: playerHrefFor(config, r.playerId, assets[r.playerId]?.slug ?? null),
      photo: assets[r.playerId]?.photo ?? null,
      nationality: assets[r.playerId]?.nationality ?? null,
      teamName: r.teamName,
      teamHref: r.teamId ? teamHrefById[r.teamId] ?? null : null,
      total: r.total,
      perMatch: r.perMatch,
      valueFormat: r.valueFormat,
    }));

  const rounds = clusterRounds(matches);
  return {
    season, basePath: config.basePath, matchBase: config.matchBase, standings, leaderMetric, leaders,
    lastRound: rounds.length ? rounds[rounds.length - 1] : null, upcoming, teamHrefById,
  };
}

export type ResmiResultsBundle = {
  season: string;
  basePath: string;
  matchBase: string;
  standings: TslStandingRow[];
  rounds: MatchRound[];
  teamHrefById: Record<string, string | null>;
};

export async function loadResmiResults(config: LeagueConfig, season: string): Promise<ResmiResultsBundle> {
  const p = providerFor(config);
  const meta = await p.teamMeta(season);
  const matches = await p.matches(season, meta);
  const [standingsReal, upcoming] = await Promise.all([p.standings(season, meta, matches), p.upcoming(season, meta)]);
  const standings = standingsReal.length ? standingsReal : buildZeroStandings(upcoming, meta);
  const teamHrefById = await teamHrefMap(config, meta, season);
  const rounds = clusterRounds(matches).reverse();
  return { season, basePath: config.basePath, matchBase: config.matchBase, standings, rounds, teamHrefById };
}

export type ResmiTeamsBundle = {
  season: string;
  standings: TslStandingRow[];
  meta: Record<string, TslTeamMeta>;
  teamMetrics: TslTeamMetric[];
  aggression: Record<string, TeamAggression>;
  transfers: ResmiTransfer[];
  teamHrefById: Record<string, string | null>;
};

export async function loadResmiTeams(config: LeagueConfig, season: string): Promise<ResmiTeamsBundle> {
  const p = providerFor(config);
  const meta = await p.teamMeta(season);
  const matches = await p.matches(season, meta);
  const [standingsReal, teamMetricsReal, aggression, transfers, upcoming] = await Promise.all([
    p.standings(season, meta, matches),
    p.teamMetrics(season, meta),
    p.aggression(season),
    p.transfers(season),
    p.upcoming(season, meta),
  ]);
  const standings = standingsReal.length ? standingsReal : buildZeroStandings(upcoming, meta);
  const teamMetrics = teamMetricsReal.length ? teamMetricsReal : await buildZeroTeamMetrics(p, standings, meta);
  const teamHrefById = await teamHrefMap(config, meta, season);

  // Transfer hedef kulübü (TSL) href'i normalize-isim eşleşmesiyle.
  const valid = config.source === "tsl" ? new Set((await getFootballTeams()).map((t) => t.slug)) : new Set<string>();
  const nameToHref: Record<string, string> = {};
  if (config.source === "tsl") {
    for (const m of Object.values(meta)) {
      const slug = slugFromLogo(m.logo);
      if (slug && valid.has(slug)) {
        const href = getTeamDetailHref(slug);
        if (href) nameToHref[normalizeSearch(m.name)] = href;
      }
    }
  }
  const transfersLinked = transfers.map((tr) => ({
    ...tr,
    toHref: tr.toName ? nameToHref[normalizeSearch(tr.toName)] ?? null : null,
  }));

  return { season, standings, meta, teamMetrics, aggression, transfers: transfersLinked, teamHrefById };
}

export type ResmiPlayersBundle = {
  season: string;
  rows: ResmiPlayerRow[];
};

export async function loadResmiPlayers(config: LeagueConfig, season: string): Promise<ResmiPlayersBundle> {
  const p = providerFor(config);
  const meta = await p.teamMeta(season);
  const assets = await p.assets();
  const rows = await p.players(season, meta, assets);
  const teamHrefById = await teamHrefMap(config, meta, season);
  const filled = rows.map((r) => ({
    ...r,
    playerHref: playerHrefFor(config, r.playerId, r.slug),
    teamHref: teamHrefById[r.teamId] ?? null,
  }));
  return { season, rows: filled };
}

export type ResmiPlayerRankingsBundle = {
  season: string;
  basePath: string;
  catalog: TslMetricOption[];
  metricKey: string;
  metric: TslMetricOption | null;
  rows: TslLeaderRow[];
  playerHrefById: Record<string, string | null>;
  teamHrefById: Record<string, string | null>;
};

export async function loadResmiPlayerRankings(
  config: LeagueConfig,
  season: string,
  requestedMetric?: string
): Promise<ResmiPlayerRankingsBundle> {
  const p = providerFor(config);
  const meta = await p.teamMeta(season);
  let catalog = await p.catalog(season);
  if (!catalog.length) catalog = await p.catalog("2025/2026");
  const metric =
    catalog.find((c) => c.metricKey === requestedMetric) ??
    catalog.find((c) => c.metricKey === "goals_total") ??
    catalog[0] ??
    null;
  const metricKey = metric?.metricKey ?? "goals_total";
  const [rows, assets] = await Promise.all([p.leaderboard(season, metricKey, meta), p.assets()]);
  const teamHrefById = await teamHrefMap(config, meta, season);
  const playerHrefById: Record<string, string | null> = {};
  for (const r of rows) playerHrefById[r.playerId] = playerHrefFor(config, r.playerId, assets[r.playerId]?.slug ?? null);
  return { season, basePath: config.basePath, catalog, metricKey, metric, rows, playerHrefById, teamHrefById };
}

export type ResmiTeamRankingsBundle = {
  season: string;
  basePath: string;
  catalog: { key: string; label: string; category: string; categoryKey: string | null }[];
  metricKey: string;
  metricLabel: string;
  rows: TslTeamLeaderRow[];
  metaById: Record<string, TslTeamMeta>;
  teamHrefById: Record<string, string | null>;
};

export async function loadResmiTeamRankings(
  config: LeagueConfig,
  season: string,
  requestedMetric?: string
): Promise<ResmiTeamRankingsBundle> {
  const p = providerFor(config);
  const meta = await p.teamMeta(season);
  const all = await p.teamLeaderboard(season, meta);
  const refAll = all.length ? all : await p.teamLeaderboard("2025/2026", meta);
  const catMap = new Map<string, { key: string; label: string; category: string; categoryKey: string | null }>();
  for (const r of refAll)
    if (!catMap.has(r.metricKey))
      catMap.set(r.metricKey, { key: r.metricKey, label: r.metricLabel, category: r.categoryLabel ?? "", categoryKey: r.categoryKey });
  const catalog = [...catMap.values()];
  const metricKey =
    catalog.find((c) => c.key === requestedMetric)?.key ??
    catalog.find((c) => c.key === "team_goals_for")?.key ??
    catalog[0]?.key ??
    "team_goals_for";

  let rows = all.filter((r) => r.metricKey === metricKey);
  if (!rows.length) {
    const upcoming = await p.upcoming(season, meta);
    const ids = [...new Set(upcoming.flatMap((m) => [m.homeId, m.awayId]))].filter(Boolean);
    const def = refAll.find((r) => r.metricKey === metricKey);
    rows = ids
      .map((id) => ({
        rank: 0, teamId: id, teamName: meta[id]?.name ?? id, metricKey, metricLabel: def?.metricLabel ?? metricKey,
        categoryKey: def?.categoryKey ?? null, categoryLabel: def?.categoryLabel ?? null, total: 0, perMatch: 0,
        leagueAvg: 0, vsAvgPct: null, valueFormat: def?.valueFormat ?? "count", isHigherBetter: def?.isHigherBetter ?? true,
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName, "tr"))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }

  const teamHrefById = await teamHrefMap(config, meta, season);
  return {
    season, basePath: config.basePath, catalog, metricKey, metricLabel: catMap.get(metricKey)?.label ?? metricKey,
    rows, metaById: meta, teamHrefById,
  };
}
