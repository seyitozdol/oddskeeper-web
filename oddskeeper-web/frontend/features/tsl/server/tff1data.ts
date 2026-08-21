import { cache } from "react";
import { createClient } from "../../../lib/supabase/server";
import { cachedQuery } from "../../../lib/supabase/cached";
import { toNum } from "../lib";
import type {
  FormResult,
  TslLeaderRow,
  TslMatch,
  TslMetricOption,
  TslStandingRow,
  TslTeamLeaderRow,
  TslTeamMeta,
  TslTeamMetric,
} from "../types";
import type { PlayerAsset, ResmiPlayerRow, TeamAggression } from "./resmi";

const COMP = "Trendyol 1. Lig";

// tff1 kolon -> resmi metrik anahtari (metricLabel i18n TSL ile ortak calissin).
const PLAYER_MAP: Record<string, string> = {
  appearances: "appearances", starts: "starts", minutes: "total_minutes",
  goals: "goals_total", assists: "assists_total", xg: "expected_goals_total",
  xgot: "expected_goals_on_target_total", xa: "expected_assists_total",
  yellow_cards: "cards_yellow_total", red_cards: "cards_red_total", rating_avg: "rating_avg",
  shots: "shots_total", key_passes: "key_passes_total", big_chances_created: "big_chances_created_total",
  total_passes: "passes_total", accurate_passes: "accurate_pass_total", pass_accuracy: "pass_accuracy_pct",
  long_balls: "long_balls_total", tackles: "tackles_total", interceptions: "interceptions_total",
  clearances: "clearances_total", ball_recoveries: "ball_recoveries_total", duels_won: "duels_won_total",
  aerials_won: "aerials_won_total", dribbles_won: "dribbles_won_total", km_covered: "km_covered_total",
  sprints: "sprints_total", top_speed: "top_speed",
};
// oran metrikleri: per_match/per90 = total (bolme yok)
const RATE_KEYS = new Set(["pass_accuracy_pct", "rating_avg", "top_speed"]);

// Oyuncu metrik katalogu (dropdown/rankings icin). categoryKey TSL ile ortak.
export const TFF1_PLAYER_CATALOG: TslMetricOption[] = [
  ["appearances", "playing_time", "Oynama Süresi", "count", true],
  ["starts", "playing_time", "Oynama Süresi", "count", true],
  ["total_minutes", "playing_time", "Oynama Süresi", "count", true],
  ["goals_total", "attacking", "Hücum", "count", true],
  ["expected_goals_total", "attacking", "Hücum", "decimal", true],
  ["expected_goals_on_target_total", "attacking", "Hücum", "decimal", true],
  ["shots_total", "attacking", "Hücum", "count", true],
  ["assists_total", "creation", "Yaratıcılık", "count", true],
  ["expected_assists_total", "creation", "Yaratıcılık", "decimal", true],
  ["key_passes_total", "creation", "Yaratıcılık", "count", true],
  ["big_chances_created_total", "creation", "Yaratıcılık", "count", true],
  ["passes_total", "passing", "Pas", "count", true],
  ["accurate_pass_total", "passing", "Pas", "count", true],
  ["pass_accuracy_pct", "passing", "Pas", "pct", true],
  ["long_balls_total", "passing", "Pas", "count", true],
  ["tackles_total", "defending", "Savunma", "count", true],
  ["interceptions_total", "defending", "Savunma", "count", true],
  ["clearances_total", "defending", "Savunma", "count", true],
  ["ball_recoveries_total", "defending", "Savunma", "count", true],
  ["duels_won_total", "duels", "İkili Mücadele", "count", true],
  ["aerials_won_total", "duels", "İkili Mücadele", "count", true],
  ["dribbles_won_total", "duels", "İkili Mücadele", "count", true],
  ["cards_yellow_total", "discipline", "Disiplin", "count", false],
  ["cards_red_total", "discipline", "Disiplin", "count", false],
  ["km_covered_total", "physical", "Fiziksel", "decimal", true],
  ["sprints_total", "physical", "Fiziksel", "count", true],
  ["top_speed", "physical", "Fiziksel", "decimal", true],
  ["rating_avg", "overall", "Genel", "decimal", true],
].map(([metricKey, categoryKey, categoryLabel, valueFormat, isHigherBetter], i) => ({
  metricKey: metricKey as string,
  metricLabel: metricKey as string,
  categoryKey: categoryKey as string,
  categoryLabel: categoryLabel as string,
  categorySort: i,
  valueFormat: valueFormat as string,
  isHigherBetter: isHigherBetter as boolean,
  defaultBasis: "total",
}));

const TEAM_MAP: [string, string, string, boolean][] = [
  ["goals_for", "team_goals_for", "count", true],
  ["goals_against", "team_goals_against", "count", false],
  ["shots", "team_shots", "count", true],
  ["shots_on_target", "team_shots_on_target", "count", true],
  ["pass_accuracy", "team_pass_accuracy_pct", "pct", true],
  ["total_passes", "team_passes", "count", true],
  ["accurate_passes", "team_accurate_pass", "count", true],
  ["tackles", "team_tackles", "count", true],
  ["interceptions", "team_interceptions", "count", true],
  ["fouls", "team_fouls_conceded", "count", false],
];
const TEAM_CAT: Record<string, string> = {
  team_goals_for: "attacking", team_goals_against: "defending", team_shots: "attacking",
  team_shots_on_target: "attacking", team_pass_accuracy_pct: "build_up", team_passes: "build_up",
  team_accurate_pass: "build_up", team_tackles: "defending", team_interceptions: "defending",
  team_fouls_conceded: "discipline",
};

export async function tff1TeamMeta(): Promise<Record<string, TslTeamMeta>> {
  const sb = await createClient();
  // K-3: hata kismi/bos veriyle sessizce render etmek yerine yuksek sesle patlar.
  const { data, error } = await sb.schema("analytics").from("tff1_team_logos_v1").select("team_id, team_name, logo_url").limit(200);
  if (error) throw new Error(`tff1_team_logos_v1: ${error.message}`);
  const out: Record<string, TslTeamMeta> = {};
  for (const r of data ?? []) out[String(r.team_id)] = { teamId: String(r.team_id), name: r.team_name ?? String(r.team_id), logo: r.logo_url ?? null };
  return out;
}

// C-1 Faz 3: dekorasyon haritasi sezonun kendi satirlarindan (playerRows
// cache'li, ekstra istek SIFIR). Onceden 11 istek / 10.979 satir tam-taramaydi.
export async function tff1Assets(season: string): Promise<Record<string, PlayerAsset>> {
  const rows = await playerRows(season);
  const out: Record<string, PlayerAsset> = {};
  for (const r of rows) {
    const id = String(r.player_id);
    if (!out[id]) out[id] = { slug: null, photo: (r.photo_url as string) ?? null, nationality: (r.country as string) ?? null };
  }
  return out;
}

export async function tff1Matches(season: string, meta: Record<string, TslTeamMeta>): Promise<TslMatch[]> {
  const sb = await createClient();
  const { data, error } = await sb.schema("analytics").from("tff1_matches_v1")
    .select("match_id, match_datetime, home_team_id, home_team_name, away_team_id, away_team_name, home_score, away_score")
    .eq("season_label", season).eq("competition", COMP).not("home_score", "is", null)
    .order("match_datetime", { ascending: false }).limit(700);
  if (error) throw new Error(`tff1_matches_v1: ${error.message}`);
  return (data ?? []).map((r) => {
    const h = String(r.home_team_id), a = String(r.away_team_id);
    return {
      matchId: String(r.match_id), datetime: r.match_datetime, homeId: h, awayId: a,
      homeName: meta[h]?.name ?? r.home_team_name ?? h, awayName: meta[a]?.name ?? r.away_team_name ?? a,
      homeLogo: meta[h]?.logo ?? null, awayLogo: meta[a]?.logo ?? null,
      homeScore: toNum(r.home_score) ?? 0, awayScore: toNum(r.away_score) ?? 0,
    };
  });
}

export async function tff1Upcoming(season: string, meta: Record<string, TslTeamMeta>): Promise<TslMatch[]> {
  const sb = await createClient();
  // fixture_status bayat kalabiliyor (oynanmis mac hala "scheduled"); 3+ saat
  // once baslamis maclari sorguda ele (bkz. getResmiUpcoming'deki ayni filtre).
  const cutoff = new Date(Date.now() - 3 * 3600_000).toISOString();
  const { data, error } = await sb.schema("analytics").from("tff1_fixtures_v1")
    .select("fixture_id, fixture_datetime, home_team_id, home_team_name, away_team_id, away_team_name, fixture_status")
    .eq("season_label", season).gte("fixture_datetime", cutoff).order("fixture_datetime", { ascending: true }).limit(80);
  if (error) throw new Error(`tff1_fixtures_v1: ${error.message}`);
  return (data ?? []).filter((r) => (r.fixture_status ?? "").toLowerCase() !== "finished").map((r) => {
    const h = String(r.home_team_id), a = String(r.away_team_id);
    return {
      matchId: String(r.fixture_id), datetime: r.fixture_datetime, homeId: h, awayId: a,
      homeName: meta[h]?.name ?? r.home_team_name ?? h, awayName: meta[a]?.name ?? r.away_team_name ?? a,
      homeLogo: meta[h]?.logo ?? null, awayLogo: meta[a]?.logo ?? null, homeScore: -1, awayScore: -1,
    } as TslMatch;
  });
}

function formOf(teamId: string, matches: TslMatch[]): FormResult[] {
  const played = matches.filter((m) => m.homeId === teamId || m.awayId === teamId).slice().reverse().slice(-5);
  return played.map((m) => {
    const home = m.homeId === teamId;
    const gf = home ? m.homeScore : m.awayScore, ga = home ? m.awayScore : m.homeScore;
    return gf > ga ? "W" : gf < ga ? "L" : "D";
  });
}

// P-5 (select-yildiz): tff1Standings + tff1TeamMetrics'in fiilen okudugu
// kolonlar. TEAM_MAP'e yeni metrik kolonu eklenince otomatik gelir.
const TEAM_STAT_COLS = [
  ...new Set([
    "team_id", "team_name", "season_label", "played", "wins", "draws", "losses",
    "goals_for", "goals_against", "points",
    ...TEAM_MAP.map(([col]) => col),
  ]),
].join(",");
// Dinamik select string'i supabase-js tip-parser'indan gecmez; kolonlar
// TEAM_STAT_COLS ile sinirli, erisim toNum/String uzerinden.
type TeamStatRow = { team_id: string | number; team_name: string | null } & Record<
  string,
  unknown
>;

async function teamStatRows(season: string) {
  const sb = await createClient();
  const { data, error } = await sb.schema("analytics").from("tff1_team_season_stats_mat").select(TEAM_STAT_COLS).eq("season_label", season).limit(200).returns<TeamStatRow[]>();
  if (error) throw new Error(`tff1_team_season_stats_mat: ${error.message}`);
  return data ?? [];
}

export async function tff1Standings(season: string, meta: Record<string, TslTeamMeta>, matches: TslMatch[]): Promise<TslStandingRow[]> {
  const rows = (await teamStatRows(season)).map((r) => {
    const id = String(r.team_id);
    const wins = toNum(r.wins) ?? 0, draws = toNum(r.draws) ?? 0, losses = toNum(r.losses) ?? 0;
    const played = toNum(r.played) ?? wins + draws + losses;
    const gf = toNum(r.goals_for) ?? 0, ga = toNum(r.goals_against) ?? 0;
    const points = toNum(r.points) ?? wins * 3 + draws;
    return {
      teamId: id, teamName: meta[id]?.name ?? r.team_name ?? id, logo: meta[id]?.logo ?? null,
      played, wins, draws, losses, goalsFor: gf, goalsAgainst: ga, goalDiff: gf - ga, points,
      ppg: played > 0 ? points / played : 0, form: formOf(id, matches),
      attackLabel: null, defenceLabel: null, formLabel: null, strongestLabel: null,
      strongestPct: null, weakestLabel: null, weakestPct: null,
    };
  });
  rows.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.teamName.localeCompare(b.teamName, "tr"));
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

// C-1 Faz 3: view foto/ulkeyi DB'de join'liyor (tff1_player_table_v1, sql/
// 2026-08-20_player_table_views.sql); playerInfoMap tam-taramasi (10.979 satir,
// 11 istek) gereksizlesti. cache(): players+leaderboard+aggression+assets ayni
// render'da tek fetch paylasir. player_id ikincil sira sayfa kaymasini onler.
// Dar kolon listesi PLAYER_MAP anahtarlarindan turetilir (select('*') yerine;
// yeni metrik MAP'e eklenince otomatik gelir).
const PLAYER_COLS = [
  "player_id", "player_name", "position_code", "team_id", "team_name",
  ...Object.keys(PLAYER_MAP), "photo_url", "country",
].join(",");
// P-3 (2026-08-20): sezon satirlari kullanici-bagimsiz -> 120 sn istek-arasi
// cache (unstable_cache, cookie'siz client). cache() ayni render dedup'unu korur.
const fetchPlayerRows = cachedQuery("tff1-player-rows", async (sb, season: string) => {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < 10; i++) {
    const { data, error } = await sb.schema("analytics").from("tff1_player_table_v1").select(PLAYER_COLS).eq("season_label", season).order("minutes", { ascending: false, nullsFirst: false }).order("player_id").range(i * 1000, i * 1000 + 999).returns<Record<string, unknown>[]>();
    if (error) throw new Error(`tff1_player_table_v1 (sayfa ${i}): ${error.message}`);
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
});
const playerRows = cache((season: string) => fetchPlayerRows(season));

export async function tff1Players(
  season: string, meta: Record<string, TslTeamMeta>
): Promise<ResmiPlayerRow[]> {
  const rows = await playerRows(season);
  return rows.map((r) => {
    const id = String(r.player_id);
    const teamId = String(r.team_id ?? "");
    const apps = toNum(r.appearances) ?? 0;
    const min = toNum(r.minutes) ?? 0;
    const metrics: ResmiPlayerRow["metrics"] = {};
    for (const [col, key] of Object.entries(PLAYER_MAP)) {
      const total = toNum(r[col]);
      if (RATE_KEYS.has(key)) metrics[key] = { total, perMatch: total, per90: total };
      else metrics[key] = {
        total,
        perMatch: total != null && apps > 0 ? total / apps : null,
        per90: total != null && min > 0 ? (total / min) * 90 : null,
      };
    }
    return {
      playerId: id, name: (r.player_name as string) ?? "—", positionCode: (r.position_code as string) ?? null,
      teamId, teamName: meta[teamId]?.name ?? (r.team_name as string) ?? null, teamLogo: meta[teamId]?.logo ?? null,
      slug: null, playerHref: null, teamHref: null,
      photo: (r.photo_url as string) ?? null, nationality: (r.country as string) ?? null, inCurrentSquad: true,
      metrics,
    };
  });
}

export function tff1PlayerCatalog(): TslMetricOption[] {
  return TFF1_PLAYER_CATALOG;
}

export async function tff1Leaderboard(season: string, metricKey: string, meta: Record<string, TslTeamMeta>): Promise<TslLeaderRow[]> {
  const col = Object.entries(PLAYER_MAP).find(([, k]) => k === metricKey)?.[0];
  if (!col) return [];
  const def = TFF1_PLAYER_CATALOG.find((c) => c.metricKey === metricKey);
  const rows = await playerRows(season);
  const arr = rows.map((r) => {
    const apps = toNum(r.appearances) ?? 0, min = toNum(r.minutes) ?? 0;
    const total = toNum(r[col]);
    const teamId = String(r.team_id ?? "");
    return {
      playerId: String(r.player_id), playerName: (r.player_name as string) ?? "—",
      teamName: meta[teamId]?.name ?? (r.team_name as string) ?? null, teamId: teamId || null,
      positionCode: (r.position_code as string) ?? null,
      metricKey, metricLabel: metricKey, total,
      perMatch: RATE_KEYS.has(metricKey) ? total : total != null && apps > 0 ? total / apps : null,
      per90: RATE_KEYS.has(metricKey) ? total : total != null && min > 0 ? (total / min) * 90 : null,
      matches: toNum(r.appearances),
      leagueAvg: null, vsAvgPct: null, valueFormat: def?.valueFormat ?? "count", isHigherBetter: def?.isHigherBetter ?? true,
    };
  }).filter((x) => x.total != null);
  const higher = def?.isHigherBetter ?? true;
  arr.sort((a, b) => (higher ? (b.total ?? 0) - (a.total ?? 0) : (a.total ?? 0) - (b.total ?? 0)));
  return arr.map((x, i) => ({ rank: i + 1, ...x }));
}

export async function tff1TeamMetrics(season: string, meta: Record<string, TslTeamMeta>): Promise<TslTeamMetric[]> {
  const rows = await teamStatRows(season);
  const out: TslTeamMetric[] = [];
  for (const r of rows) {
    const id = String(r.team_id);
    const played = toNum(r.played) ?? 0;
    for (const [col, key, fmt, hb] of TEAM_MAP) {
      const total = toNum(r[col]);
      out.push({
        teamId: id, teamName: meta[id]?.name ?? r.team_name ?? id, metricKey: key, metricLabel: key,
        categoryKey: TEAM_CAT[key] ?? null, total,
        perMatch: total != null && played > 0 ? total / played : null,
        leagueAvg: null, leaguePct: null, leagueRank: null, valueFormat: fmt, isHigherBetter: hb,
      });
    }
  }
  return out;
}

export async function tff1TeamLeaderboard(season: string, meta: Record<string, TslTeamMeta>): Promise<TslTeamLeaderRow[]> {
  const metrics = await tff1TeamMetrics(season, meta);
  return metrics.map((m, i) => ({
    rank: i + 1, teamId: m.teamId, teamName: m.teamName, metricKey: m.metricKey, metricLabel: m.metricLabel,
    categoryKey: m.categoryKey, categoryLabel: catLabel(m.categoryKey), total: m.total, perMatch: m.perMatch,
    leagueAvg: null, vsAvgPct: null, valueFormat: m.valueFormat, isHigherBetter: m.isHigherBetter,
  }));
}

function catLabel(key: string | null): string {
  const m: Record<string, string> = { attacking: "Hücum", build_up: "Oyun Kurma", defending: "Savunma", discipline: "Disiplin" };
  return key ? m[key] ?? key : "";
}

export async function tff1Aggression(season: string): Promise<Record<string, TeamAggression>> {
  const rows = await playerRows(season);
  const out: Record<string, TeamAggression> = {};
  for (const r of rows) {
    const id = String(r.team_id ?? "");
    if (!id) continue;
    if (!out[id]) out[id] = { yellow: 0, red: 0, total: 0, matches: 0 };
    out[id].yellow += toNum(r.yellow_cards) ?? 0;
    out[id].red += toNum(r.red_cards) ?? 0;
    out[id].total = out[id].yellow + out[id].red * 2;
  }
  return out;
}
