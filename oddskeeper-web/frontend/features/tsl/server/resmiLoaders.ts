import { createClient } from "../../../lib/supabase/server";
import { getAllFootballTeamLogos } from "../../../lib/football-teams";
import { getTeamDetailHref } from "../../../lib/routes";
import {
  playerHrefFor,
  teamHrefFor,
  type LeagueConfig,
} from "../leagues";
import { slugifyTeamName } from "../../../lib/football-teams";
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
import {
  cupAggression,
  cupAssets,
  cupLeaderboard,
  cupMatches,
  cupPlayerCatalog,
  cupPlayers,
  cupStandings,
  cupTeamLeaderboard,
  cupTeamLogo,
  cupTeamMeta,
  cupTeamMetrics,
  cupUpcoming,
} from "./cupdata";

// ---- Lig kaynak sağlayıcısı (tsl_ss vs tff1 vs cup) ----
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
  if (config.source === "cup") {
    return {
      teamMeta: () => cupTeamMeta(),
      matches: (s, meta) => cupMatches(s, meta),
      upcoming: () => cupUpcoming(),
      standings: (s, meta, m) => cupStandings(s, meta, m),
      players: (s, meta) => cupPlayers(s, meta),
      assets: () => cupAssets(),
      catalog: () => Promise.resolve(cupPlayerCatalog()),
      leaderboard: (s, mk, meta) => cupLeaderboard(s, mk, meta),
      teamMetrics: (s, meta) => cupTeamMetrics(s, meta),
      teamLeaderboard: (s, meta) => cupTeamLeaderboard(s, meta),
      aggression: (s) => cupAggression(s),
      transfers: () => Promise.resolve([]),
    };
  }
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

// Bir takım adı/logosundan yerel football slug'ı çözer. Önce logo yolundan
// (yerel /images/football_logos/...), sonra ad slug'ından, sonra ad slug'ının
// gitgide kısalan ön-eklerinden dener (ör. "Amed Sportif Faaliyetler" -> amed,
// "Çorum FK" -> corum, "Erzurumspor FK" -> erzurumspor). Böylece logosu CDN
// URL'i olan yeni yükselen takımlar da doğru profile bağlanır.
function resolveFootballSlug(
  teamName: string | null,
  logo: string | null,
  valid: Set<string>
): string | null {
  const fromLogo = slugFromLogo(logo);
  if (fromLogo && valid.has(fromLogo)) return fromLogo;
  const base = teamName ? slugifyTeamName(teamName) : "";
  if (base && valid.has(base)) return base;
  if (base) {
    const parts = base.split("-").filter(Boolean);
    for (let k = parts.length - 1; k >= 1; k--) {
      const cand = parts.slice(0, k).join("-");
      if (valid.has(cand)) return cand;
    }
  }
  return null;
}

type HrefEntry = { teamId: string; teamName: string | null; logo: string | null };

function pushEntry(
  map: Map<string, HrefEntry>,
  teamId: string | null | undefined,
  teamName: string | null | undefined,
  logo: string | null | undefined
) {
  if (!teamId) return;
  const cur = map.get(teamId);
  if (!cur) {
    map.set(teamId, { teamId, teamName: teamName ?? null, logo: logo ?? null });
    return;
  }
  if (!cur.teamName && teamName) cur.teamName = teamName;
  if (!cur.logo && logo) cur.logo = logo;
}

// Gösterilecek TÜM takımlardan (meta + puan durumu + maçlar) href girdileri
// toplar; böylece meta'da (logo tablosunda) olmayan takımlar da link alır.
function collectEntries(
  meta: Record<string, TslTeamMeta>,
  opts: {
    standings?: TslStandingRow[];
    matches?: TslMatch[];
    upcoming?: TslMatch[];
    players?: { teamId: string; teamName: string | null; teamLogo?: string | null }[];
    leaders?: { teamId?: string | null; teamName?: string | null }[];
  } = {}
): HrefEntry[] {
  const map = new Map<string, HrefEntry>();
  for (const m of Object.values(meta)) pushEntry(map, m.teamId, m.name, m.logo);
  for (const s of opts.standings ?? []) pushEntry(map, s.teamId, s.teamName, s.logo);
  for (const list of [opts.matches ?? [], opts.upcoming ?? []])
    for (const mm of list) {
      pushEntry(map, mm.homeId, mm.homeName, mm.homeLogo);
      pushEntry(map, mm.awayId, mm.awayName, mm.awayLogo);
    }
  for (const p of opts.players ?? []) pushEntry(map, p.teamId, p.teamName, p.teamLogo ?? null);
  for (const l of opts.leaders ?? []) pushEntry(map, l.teamId ?? null, l.teamName ?? null, null);
  return [...map.values()];
}

// Takım id -> detay href. tff1: her id için geçerli URL (slug gerekmez).
// tsl: ad/logo'dan çözülen slug varsa football profiline, yoksa null.
async function buildTeamHrefs(
  config: LeagueConfig,
  entries: HrefEntry[],
  season: string
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  // tsl + cup opta-slug'lı football profillerine gider; ikisi de valid slug seti ister.
  const valid =
    config.source !== "tff1"
      ? new Set(Object.keys(await getAllFootballTeamLogos()))
      : null;
  for (const e of entries) {
    if (config.source === "tff1") {
      out[e.teamId] = teamHrefFor(config, e.teamId, null, season);
    } else {
      const slug = resolveFootballSlug(e.teamName, e.logo, valid!);
      out[e.teamId] = teamHrefFor(config, e.teamId, slug, season);
    }
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
  const standings = standingsReal.length ? standingsReal : buildZeroStandings(upcoming, meta);
  const teamHrefById = await buildTeamHrefs(
    config,
    collectEntries(meta, { standings, matches, upcoming, leaders: leaderRows }),
    season
  );

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
  // Kupa: lig tablosu yerine tur bazlı grafik verisi.
  cupRounds?: CupStageRow[];
};

async function loadCupRounds(season: string): Promise<CupStageRow[]> {
  const sb = await createClient();
  const { data } = await sb.schema("analytics").from("cup_stages_v1").select("*").eq("season_label", season);
  return (data ?? [])
    .map((r) => ({
      roundId: r.round_id == null ? null : Number(r.round_id),
      roundName: (r.round_name as string) ?? "—",
      matchCount: Number(r.match_count ?? 0),
      playedCount: Number(r.played_count ?? 0),
      goals: Number(r.goals ?? 0),
      firstMatch: (r.first_match as string) ?? null,
      lastMatch: (r.last_match as string) ?? null,
    }))
    .sort((a, b) => (a.firstMatch ?? "").localeCompare(b.firstMatch ?? ""));
}

export async function loadResmiResults(config: LeagueConfig, season: string): Promise<ResmiResultsBundle> {
  const p = providerFor(config);
  const meta = await p.teamMeta(season);
  const matches = await p.matches(season, meta);
  const [standingsReal, upcoming] = await Promise.all([p.standings(season, meta, matches), p.upcoming(season, meta)]);
  const standings = standingsReal.length ? standingsReal : buildZeroStandings(upcoming, meta);
  const teamHrefById = await buildTeamHrefs(
    config,
    collectEntries(meta, { standings, matches, upcoming }),
    season
  );
  const rounds = clusterRounds(matches).reverse();
  const cupRounds = config.source === "cup" ? await loadCupRounds(season) : undefined;
  return { season, basePath: config.basePath, matchBase: config.matchBase, standings, rounds, teamHrefById, cupRounds };
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
  const teamHrefById = await buildTeamHrefs(
    config,
    collectEntries(meta, { standings, upcoming }),
    season
  );

  // Transfer hedef kulübü (TSL) href'i normalize-isim eşleşmesiyle.
  const nameToHref: Record<string, string> = {};
  if (config.source === "tsl") {
    const valid = new Set(Object.keys(await getAllFootballTeamLogos()));
    for (const m of Object.values(meta)) {
      const slug = resolveFootballSlug(m.name, m.logo, valid);
      const href = slug ? getTeamDetailHref(slug) : null;
      if (href) nameToHref[normalizeSearch(m.name)] = href;
    }
  }
  const transfersLinked = transfers.map((tr) => ({
    ...tr,
    toHref: tr.toName ? nameToHref[normalizeSearch(tr.toName)] ?? null : null,
  }));

  return { season, standings, meta, teamMetrics, aggression, transfers: transfersLinked, teamHrefById };
}

// ── Transferler (ayri sekme; eskiden Teams ekraninin sag sutunuydu) ──────────
export type ResmiTransfersBundle = {
  season: string;
  transfers: ResmiTransfer[];
};

export async function loadResmiTransfers(
  config: LeagueConfig,
  season: string
): Promise<ResmiTransfersBundle> {
  const p = providerFor(config);
  const transfers = await p.transfers(season);
  if (!transfers.length) return { season, transfers: [] };

  // TSL: hedef kulup href'i (normalize-isim eslesmesi ile football profiline).
  const nameToHref: Record<string, string> = {};
  if (config.source === "tsl") {
    const meta = await p.teamMeta(season);
    const valid = new Set(Object.keys(await getAllFootballTeamLogos()));
    for (const m of Object.values(meta)) {
      const slug = resolveFootballSlug(m.name, m.logo, valid);
      const href = slug ? getTeamDetailHref(slug) : null;
      if (href) nameToHref[normalizeSearch(m.name)] = href;
    }
  }
  const linked = transfers.map((tr) => ({
    ...tr,
    toHref: tr.toName ? nameToHref[normalizeSearch(tr.toName)] ?? null : null,
  }));
  return { season, transfers: linked };
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
  const teamHrefById = await buildTeamHrefs(
    config,
    collectEntries(meta, {
      players: rows.map((r) => ({ teamId: r.teamId, teamName: r.teamName, teamLogo: r.teamLogo })),
    }),
    season
  );
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
  // Gorsel zenginlestirme: oyuncu foto/bayrak + takim logosu (Players gibi).
  photoById: Record<string, string | null>;
  nationalityById: Record<string, string | null>;
  teamLogoById: Record<string, string | null>;
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
  const teamHrefById = await buildTeamHrefs(
    config,
    collectEntries(meta, { leaders: rows }),
    season
  );
  const playerHrefById: Record<string, string | null> = {};
  const photoById: Record<string, string | null> = {};
  const nationalityById: Record<string, string | null> = {};
  const teamLogoById: Record<string, string | null> = {};
  for (const r of rows) {
    playerHrefById[r.playerId] = playerHrefFor(config, r.playerId, assets[r.playerId]?.slug ?? null);
    photoById[r.playerId] = assets[r.playerId]?.photo ?? null;
    nationalityById[r.playerId] = assets[r.playerId]?.nationality ?? null;
    if (r.teamId) teamLogoById[r.teamId] = meta[r.teamId]?.logo ?? null;
  }
  return {
    season, basePath: config.basePath, catalog, metricKey, metric, rows,
    playerHrefById, teamHrefById, photoById, nationalityById, teamLogoById,
  };
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

  const teamHrefById = await buildTeamHrefs(
    config,
    collectEntries(meta, { leaders: rows }),
    season
  );
  return {
    season, basePath: config.basePath, catalog, metricKey, metricLabel: catMap.get(metricKey)?.label ?? metricKey,
    rows, metaById: meta, teamHrefById,
  };
}

// =================== Referees ===================

export type RefereeRow = {
  referee: string;
  apps: number;
  foulsPg: number | null;
  foulsPerTackle: number | null;
  penPg: number | null;
  yelPg: number | null;
  yelTotal: number;
  redPg: number | null;
  redTotal: number;
  cardsPg: number | null;
};

export type RefereeAverages = {
  apps: number;
  foulsPg: number | null;
  foulsPerTackle: number | null;
  penPg: number | null;
  yelPg: number | null;
  redPg: number | null;
  cardsPg: number | null;
};

export type ResmiRefereesBundle = {
  season: string;
  rows: RefereeRow[];
  averages: RefereeAverages | null;
};

const num = (v: unknown): number | null => (v == null ? null : Number(v));

// Hakem sezon istatistikleri (o lige ait yönettiği maçları baz alır).
// Kaynak: analytics.msm_referee_season_stats_v1 (lig+sezon başına tek kaynak).
export async function loadResmiReferees(config: LeagueConfig, season: string): Promise<ResmiRefereesBundle> {
  const supabase = await createClient();
  // Kupa hakem verisi ayrı view'da (aynı şekil); diğer ligler msm_* ortak tablodan.
  const refTable = config.source === "cup" ? "cup_referee_season_stats_v1" : "msm_referee_season_stats_v1";
  const { data, error } = await supabase
    .schema("analytics")
    .from(refTable)
    .select(
      "referee, apps, fouls_total, tackles_total, yellow_total, red_total, pen_total, fouls_pg, fouls_per_tackle, pen_pg, yel_pg, red_pg, cards_pg"
    )
    .eq("league", config.source)
    .eq("season", season)
    .order("apps", { ascending: false });
  if (error) {
    console.error("loadResmiReferees", error.message);
    return { season, rows: [], averages: null };
  }
  const raw = data ?? [];
  const rows: RefereeRow[] = raw.map((r) => ({
    referee: r.referee as string,
    apps: Number(r.apps),
    foulsPg: num(r.fouls_pg),
    foulsPerTackle: num(r.fouls_per_tackle),
    penPg: num(r.pen_pg),
    yelPg: num(r.yel_pg),
    yelTotal: Number(r.yellow_total ?? 0),
    redPg: num(r.red_pg),
    redTotal: Number(r.red_total ?? 0),
    cardsPg: num(r.cards_pg),
  }));

  // Genel ortalamalar (lig geneli, maç ağırlıklı): Σtotal / Σapps.
  let averages: RefereeAverages | null = null;
  if (rows.length) {
    let apps = 0, fouls = 0, tackles = 0, yellow = 0, red = 0, pens = 0;
    let tacklesSeen = false, pensSeen = false;
    for (const r of raw) {
      apps += Number(r.apps);
      fouls += Number(r.fouls_total ?? 0);
      yellow += Number(r.yellow_total ?? 0);
      red += Number(r.red_total ?? 0);
      if (r.tackles_total != null) { tackles += Number(r.tackles_total); tacklesSeen = true; }
      if (r.pen_total != null) { pens += Number(r.pen_total); pensSeen = true; }
    }
    const r2 = (v: number) => Math.round(v * 100) / 100;
    averages = {
      apps,
      foulsPg: apps ? r2(fouls / apps) : null,
      foulsPerTackle: tacklesSeen && tackles > 0 ? r2(fouls / tackles) : null,
      penPg: pensSeen && apps ? r2(pens / apps) : null,
      yelPg: apps ? r2(yellow / apps) : null,
      redPg: apps ? r2(red / apps) : null,
      cardsPg: apps ? r2((yellow + red * 2) / apps) : null,
    };
  }
  return { season, rows, averages };
}

// ---- Cup Stages (kupaya özel: turlar/bracket) ----
export type CupStageRow = {
  roundId: number | null;
  roundName: string;
  matchCount: number;
  playedCount: number;
  goals: number;
  firstMatch: string | null;
  lastMatch: string | null;
};
export type CupStageMatch = {
  matchId: string;
  datetime: string | null;
  roundName: string;
  homeName: string;
  awayName: string;
  homeSlug: string | null;
  awaySlug: string | null;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string | null;
};
export type ResmiCupStagesBundle = {
  season: string;
  matchBase: string;
  stages: CupStageRow[];
  matchesByRound: Record<string, CupStageMatch[]>;
};

export async function loadResmiCupStages(config: LeagueConfig, season: string): Promise<ResmiCupStagesBundle> {
  const sb = await createClient();
  const [{ data: stageData }, { data: matchData }, localLogos] = await Promise.all([
    sb.schema("analytics").from("cup_stages_v1").select("*").eq("season_label", season),
    sb.schema("analytics").from("cup_matches_v1")
      .select("match_id, match_datetime, round_id, round_name, status, home_team_name, home_team_slug, home_team_uuid, away_team_name, away_team_slug, away_team_uuid, home_score, away_score")
      .eq("season_label", season)
      .order("match_datetime", { ascending: true })
      .limit(400),
    getAllFootballTeamLogos(),
  ]);
  // Eşleşen takım: yerel football logosu; değilse Mackolik CDN (uuid ile).
  const teamLogo = (slug: string | null, uuid: string | null): string | null =>
    (slug ? localLogos[slug] : null) ?? cupTeamLogo(uuid);
  const stages: CupStageRow[] = (stageData ?? [])
    .map((r) => ({
      roundId: r.round_id == null ? null : Number(r.round_id),
      roundName: (r.round_name as string) ?? "—",
      matchCount: Number(r.match_count ?? 0),
      playedCount: Number(r.played_count ?? 0),
      goals: Number(r.goals ?? 0),
      firstMatch: (r.first_match as string) ?? null,
      lastMatch: (r.last_match as string) ?? null,
    }))
    .sort((a, b) => (a.firstMatch ?? "").localeCompare(b.firstMatch ?? ""));
  const matchesByRound: Record<string, CupStageMatch[]> = {};
  for (const r of matchData ?? []) {
    const key = (r.round_name as string) ?? "—";
    (matchesByRound[key] ??= []).push({
      matchId: String(r.match_id),
      datetime: (r.match_datetime as string) ?? null,
      roundName: key,
      homeName: (r.home_team_name as string) ?? "—",
      awayName: (r.away_team_name as string) ?? "—",
      homeSlug: (r.home_team_slug as string) ?? null,
      awaySlug: (r.away_team_slug as string) ?? null,
      homeLogo: teamLogo((r.home_team_slug as string) ?? null, (r.home_team_uuid as string) ?? null),
      awayLogo: teamLogo((r.away_team_slug as string) ?? null, (r.away_team_uuid as string) ?? null),
      homeScore: r.home_score == null ? null : Number(r.home_score),
      awayScore: r.away_score == null ? null : Number(r.away_score),
      status: (r.status as string) ?? null,
    });
  }
  return { season, matchBase: config.matchBase, stages, matchesByRound };
}
