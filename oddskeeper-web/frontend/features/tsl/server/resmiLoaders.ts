import { getFootballTeams } from "../../../lib/football-teams";
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
  getTslTeamMetrics,
} from "./queries";
import type { PlayerAsset } from "./resmi";
import {
  buildZeroStandings,
  clusterRounds,
  getPlayerAssets,
  getResmiLeaders,
  getResmiPlayers,
  getResmiTransfers,
  getResmiUpcoming,
  getTeamAggression,
  getTslMatches,
  getTslTeamMeta,
  type MatchRound,
  type ResmiLeaderRow,
  type ResmiPlayerRow,
  type ResmiTransfer,
  type TeamAggression,
} from "./resmi";

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
  const [standingsReal, assets, upcoming] = await Promise.all([
    getTslStandings(season, meta, matches),
    getPlayerAssets(),
    getResmiUpcoming(season, meta),
  ]);
  const { byName, byId } = await slugMapsFromMeta(meta);
  // Sezon başlamadıysa fikstür takımlarından 0-0-0 puan durumu göster.
  const standings = standingsReal.length ? standingsReal : buildZeroStandings(upcoming, meta);
  const leaders = await getResmiLeaders(season, leaderMetric, assets, byName);
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
  const [standingsReal, upcoming] = await Promise.all([
    getTslStandings(season, meta, matches),
    getResmiUpcoming(season, meta),
  ]);
  const standings = standingsReal.length ? standingsReal : buildZeroStandings(upcoming, meta);
  const { byId } = await slugMapsFromMeta(meta);
  const rounds = clusterRounds(matches).reverse(); // en son hafta ustte
  return { season, standings, rounds, teamSlugById: byId };
}

// 26/27 gibi veri olmayan sezonda takım metrik tablosu 0 değerlerle (tanımlar
// son tam sezondan alınır).
async function buildZeroTeamMetrics(
  teams: TslStandingRow[],
  meta: Record<string, TslTeamMeta>
): Promise<TslTeamMetric[]> {
  const defsRaw = await getTslTeamMetrics("2025/2026", meta);
  const defMap = new Map<string, TslTeamMetric>();
  for (const d of defsRaw) if (!defMap.has(d.metricKey)) defMap.set(d.metricKey, d);
  const defs = [...defMap.values()];
  const out: TslTeamMetric[] = [];
  for (const team of teams) {
    for (const d of defs) {
      out.push({
        teamId: team.teamId,
        teamName: team.teamName,
        metricKey: d.metricKey,
        metricLabel: d.metricLabel,
        categoryKey: d.categoryKey,
        total: 0,
        perMatch: 0,
        leagueAvg: 0,
        leaguePct: 0,
        leagueRank: null,
        valueFormat: d.valueFormat,
        isHigherBetter: d.isHigherBetter,
      });
    }
  }
  return out;
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
  const [standingsReal, teamMetricsReal, aggression, transfers, upcoming] = await Promise.all([
    getTslStandings(season, meta, matches),
    getTslTeamMetrics(season, meta),
    getTeamAggression(season),
    getResmiTransfers(season),
    getResmiUpcoming(season, meta),
  ]);
  // Sezon başlamadıysa 0 değerli tablo + fikstür takımları.
  const standings = standingsReal.length ? standingsReal : buildZeroStandings(upcoming, meta);
  const teamMetrics = teamMetricsReal.length
    ? teamMetricsReal
    : await buildZeroTeamMetrics(standings, meta);
  const { byId } = await slugMapsFromMeta(meta);

  // Transfer hedef kulübünü (TSL takımı) normalize-isim eşleşmesiyle slug'a bağla.
  const valid = new Set((await getFootballTeams()).map((tm) => tm.slug));
  const normNameToSlug: Record<string, string> = {};
  for (const m of Object.values(meta)) {
    const slug = slugFromLogo(m.logo);
    if (slug && valid.has(slug)) normNameToSlug[normalizeSearch(m.name)] = slug;
  }
  const transfersLinked = transfers.map((tr) => ({
    ...tr,
    toSlug: tr.toName ? normNameToSlug[normalizeSearch(tr.toName)] ?? null : null,
  }));

  return {
    season,
    standings,
    meta,
    teamMetrics,
    aggression,
    transfers: transfersLinked,
    teamSlugById: byId,
  };
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

// ---- Players (sezon-duyarli tablo) ----

export type ResmiPlayersBundle = {
  season: string;
  rows: ResmiPlayerRow[];
  teamSlugById: Record<string, string>;
};

export async function loadResmiPlayers(season: string): Promise<ResmiPlayersBundle> {
  const meta = await getTslTeamMeta(season);
  const assets = await getPlayerAssets();
  const [rows] = await Promise.all([getResmiPlayers(season, meta, assets)]);
  const { byId } = await slugMapsFromMeta(meta);
  return { season, rows, teamSlugById: byId };
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
  // Sezon başlamadıysa katalog boş olur; dropdown kalsın diye son sezondan al.
  let catalog = await getTslPlayerCatalog(season);
  if (!catalog.length) catalog = await getTslPlayerCatalog("2025/2026");
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
  catalog: { key: string; label: string; category: string; categoryKey: string | null }[];
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
  // Sezon başlamadıysa katalog/tanımlar için son sezona düş.
  const refAll = all.length ? all : await getTslTeamLeaderboard("2025/2026", meta);
  const catMap = new Map<
    string,
    { key: string; label: string; category: string; categoryKey: string | null }
  >();
  for (const r of refAll) {
    if (!catMap.has(r.metricKey)) {
      catMap.set(r.metricKey, {
        key: r.metricKey,
        label: r.metricLabel,
        category: r.categoryLabel ?? "",
        categoryKey: r.categoryKey,
      });
    }
  }
  const catalog = [...catMap.values()];
  const metricKey =
    catalog.find((c) => c.key === requestedMetric)?.key ??
    catalog.find((c) => c.key === "team_goals_for")?.key ??
    catalog[0]?.key ??
    "team_goals_for";

  let rows = all.filter((r) => r.metricKey === metricKey);
  // Veri yoksa fikstür takımlarını 0 değerle göster (No data yerine).
  if (!rows.length) {
    const upcoming = await getResmiUpcoming(season, meta);
    const ids = [...new Set(upcoming.flatMap((m) => [m.homeId, m.awayId]))].filter(Boolean);
    const def = refAll.find((r) => r.metricKey === metricKey);
    rows = ids
      .map((id) => ({
        rank: 0,
        teamId: id,
        teamName: meta[id]?.name ?? id,
        metricKey,
        metricLabel: def?.metricLabel ?? metricKey,
        categoryKey: def?.categoryKey ?? null,
        categoryLabel: def?.categoryLabel ?? null,
        total: 0,
        perMatch: 0,
        leagueAvg: 0,
        vsAvgPct: null,
        valueFormat: def?.valueFormat ?? "count",
        isHigherBetter: def?.isHigherBetter ?? true,
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName, "tr"))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }

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
