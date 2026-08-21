// Türkiye Kupası veri sağlayıcısı (Resmi deneyimi "cup" kaynağı).
// analytics.cup_* view'larını okur; Mackolik verisi ama uuid=Opta olduğundan
// eşleşen takımlar football profillerine slug ile bağlanır. Oyuncu tarafı
// (players/catalog/leaderboard/assets) Faz 5'e kadar boş döner.
import { createClient } from "../../../lib/supabase/server";
import { fetchAllPaged } from "../../../lib/supabase/paginate";
import { getAllFootballTeamLogos } from "../../../lib/football-teams";
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

// Gösterilecek takım metrikleri (sıra + okunur etiket + kategori + format + higher-better).
const TEAM_METRICS: {
  key: string;
  label: string;
  cat: string;
  catLabel: string;
  fmt: string;
  hb: boolean;
}[] = [
  { key: "possession", label: "Topa Sahip Olma", cat: "build_up", catLabel: "Oyun Kurma", fmt: "pct", hb: true },
  { key: "expected_goals", label: "Gol Beklentisi (xG)", cat: "attacking", catLabel: "Hücum", fmt: "decimal", hb: true },
  { key: "shots", label: "Toplam Şut", cat: "attacking", catLabel: "Hücum", fmt: "count", hb: true },
  { key: "shots_on_target", label: "İsabetli Şut", cat: "attacking", catLabel: "Hücum", fmt: "count", hb: true },
  { key: "corners", label: "Korner", cat: "attacking", catLabel: "Hücum", fmt: "count", hb: true },
  { key: "big_chances_missed", label: "Kaçan Büyük Şans", cat: "attacking", catLabel: "Hücum", fmt: "count", hb: false },
  { key: "passes", label: "Pas", cat: "build_up", catLabel: "Oyun Kurma", fmt: "count", hb: true },
  { key: "passing_accuracy", label: "Pas İsabeti", cat: "build_up", catLabel: "Oyun Kurma", fmt: "pct", hb: true },
  { key: "crosses", label: "Orta", cat: "build_up", catLabel: "Oyun Kurma", fmt: "count", hb: true },
  { key: "successful_tackles", label: "Top Kapma", cat: "defending", catLabel: "Savunma", fmt: "count", hb: true },
  { key: "interceptions", label: "Araya Girme", cat: "defending", catLabel: "Savunma", fmt: "count", hb: true },
  { key: "clearances", label: "Uzaklaştırma", cat: "defending", catLabel: "Savunma", fmt: "count", hb: true },
  { key: "throw_in", label: "Taç", cat: "set_piece", catLabel: "Duran Top", fmt: "count", hb: true },
  { key: "total_offside", label: "Ofsayt", cat: "discipline", catLabel: "Disiplin", fmt: "count", hb: false },
  { key: "fouls", label: "Faul", cat: "discipline", catLabel: "Disiplin", fmt: "count", hb: false },
];
const METRIC_KEYS = TEAM_METRICS.map((m) => m.key);
const DEF = new Map(TEAM_METRICS.map((m) => [m.key, m]));

async function logos(): Promise<Record<string, string>> {
  return getAllFootballTeamLogos();
}

// Mackolik CDN: her kupa takım/oyuncusunun logosu/fotoğrafı uuid ile (auth'suz).
// Sistemde-olmayan alt lig/amatör takımları da kapsar.
export function cupTeamLogo(uuid: string | null): string | null {
  return uuid ? `https://api.mackolikfeeds.com/soccer/images/teams/150x150/${uuid}.png` : null;
}
export function cupPlayerPhoto(uuid: string | null): string | null {
  return uuid ? `https://api.mackolikfeeds.com/soccer/images/players/150x150/${uuid}.png` : null;
}

export async function cupTeamMeta(): Promise<Record<string, TslTeamMeta>> {
  const sb = await createClient();
  const [{ data }, lg] = await Promise.all([
    sb.schema("analytics").from("cup_team_meta_v1").select("team_id, team_uuid, team_name, team_slug").limit(500),
    logos(),
  ]);
  const out: Record<string, TslTeamMeta> = {};
  for (const r of data ?? []) {
    const id = String(r.team_id);
    const slug = r.team_slug as string | null;
    // Eşleşen takım: yerel football logosu (tema-tutarlı); değilse Mackolik CDN.
    const logo = (slug ? lg[slug] : null) ?? cupTeamLogo(r.team_uuid as string | null);
    out[id] = { teamId: id, name: r.team_name ?? id, logo };
  }
  return out;
}

export async function cupMatches(season: string, meta: Record<string, TslTeamMeta>): Promise<TslMatch[]> {
  const sb = await createClient();
  const { data } = await sb
    .schema("analytics")
    .from("cup_matches_v1")
    .select("match_id, match_datetime, home_team_id, home_team_name, away_team_id, away_team_name, home_score, away_score")
    .eq("season_label", season)
    .not("home_score", "is", null)
    .order("match_datetime", { ascending: false })
    .limit(700);
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

export async function cupUpcoming(): Promise<TslMatch[]> {
  return [];
}

function formOf(teamId: string, matches: TslMatch[]): FormResult[] {
  const played = matches.filter((m) => m.homeId === teamId || m.awayId === teamId).slice().reverse().slice(-5);
  return played.map((m) => {
    const home = m.homeId === teamId;
    const gf = home ? m.homeScore : m.awayScore, ga = home ? m.awayScore : m.homeScore;
    return gf > ga ? "W" : gf < ga ? "L" : "D";
  });
}

export async function cupStandings(
  season: string, meta: Record<string, TslTeamMeta>, matches: TslMatch[]
): Promise<TslStandingRow[]> {
  const sb = await createClient();
  const { data } = await sb.schema("analytics").from("cup_standings_v1")
    .select("team_id, team_name, played, wins, draws, losses, goals_for, goals_against, points")
    .eq("season_label", season).limit(500);
  const rows = (data ?? []).map((r) => {
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

// Takım metrikleri: cup_team_leaderboard_rows_v1 (rank/avg/pct hazır) + curated set.
async function leaderboardRows(season: string) {
  const sb = await createClient();
  // Sezon basina 1.667 satir: .limit(2000) sessizce 1000'e kirpiliyordu, kupa
  // Teams leaderboard'u eksik veriden geliyordu (C-2, 2026-08-20). row_id unique
  // oldugu icin sayfalar kaymaz.
  const data = await fetchAllPaged((from, to) =>
    sb
      .schema("analytics")
      .from("cup_team_leaderboard_rows_v1")
      .select("team_id, team_name, metric_key, total_value, per_match_value, league_avg, league_rank, vs_league_avg_pct")
      .eq("season_label", season)
      .in("metric_key", METRIC_KEYS)
      .not("team_slug", "is", null)
      .order("row_id")
      .range(from, to)
  );
  return data ?? [];
}

const METRIC_ORDER = new Map(TEAM_METRICS.map((m, i) => [m.key, i]));

export async function cupTeamMetrics(season: string, meta: Record<string, TslTeamMeta>): Promise<TslTeamMetric[]> {
  const rows = await leaderboardRows(season);
  const out = rows.map((r) => {
    const id = String(r.team_id);
    const d = DEF.get(r.metric_key as string);
    return {
      teamId: id, teamName: meta[id]?.name ?? r.team_name ?? id,
      metricKey: r.metric_key as string, metricLabel: d?.label ?? (r.metric_key as string),
      categoryKey: d?.cat ?? null,
      total: toNum(r.total_value), perMatch: toNum(r.per_match_value),
      leagueAvg: toNum(r.league_avg), leaguePct: toNum(r.vs_league_avg_pct), leagueRank: toNum(r.league_rank),
      valueFormat: d?.fmt ?? "count", isHigherBetter: d?.hb ?? true,
    };
  });
  // TEAM_METRICS sırası: ilk metrik possession (tüm 18 takım) olsun ki board
  // varsayılanda 8 değil 18 takım göstersin.
  out.sort((a, b) => (METRIC_ORDER.get(a.metricKey) ?? 99) - (METRIC_ORDER.get(b.metricKey) ?? 99));
  return out;
}

export async function cupTeamLeaderboard(season: string, meta: Record<string, TslTeamMeta>): Promise<TslTeamLeaderRow[]> {
  const metrics = await cupTeamMetrics(season, meta);
  return metrics.map((m, i) => {
    const d = DEF.get(m.metricKey);
    return {
      rank: i + 1, teamId: m.teamId, teamName: m.teamName, metricKey: m.metricKey, metricLabel: m.metricLabel,
      categoryKey: m.categoryKey, categoryLabel: d?.catLabel ?? null,
      total: m.total, perMatch: m.perMatch, leagueAvg: m.leagueAvg, vsAvgPct: m.leaguePct,
      valueFormat: m.valueFormat, isHigherBetter: m.isHigherBetter,
    };
  });
}

export async function cupAggression(season: string): Promise<Record<string, TeamAggression>> {
  const sb = await createClient();
  const { data } = await sb
    .schema("analytics")
    .from("cup_team_metrics_v1")
    .select("team_id, stat_type, total_value, apps")
    .eq("season_label", season)
    .in("stat_type", ["yellow_card", "red_card", "second_yellow_card", "direct_red_card"])
    .not("team_slug", "is", null)
    // 1000-cap: sezon basi kart-satiri max ~226 (2026-08-20 olcumu), tek sayfa yeter.
    .limit(1000);
  const out: Record<string, TeamAggression> = {};
  for (const r of data ?? []) {
    const id = String(r.team_id);
    if (!out[id]) out[id] = { yellow: 0, red: 0, total: 0, matches: 0 };
    const v = toNum(r.total_value) ?? 0;
    if (r.stat_type === "yellow_card" || r.stat_type === "second_yellow_card") out[id].yellow += v;
    else out[id].red += v;
    out[id].matches = Math.max(out[id].matches, toNum(r.apps) ?? 0);
    out[id].total = out[id].yellow + out[id].red * 2;
  }
  return out;
}

// ---- Oyuncu tarafı (Faz 5: Mackolik statistics-service oyuncu metrikleri) ----
// Katalog: [metricKey, category, categoryLabel, format, higherBetter]. Sayılabilir
// metrikler view'da TOPLAM; oran metrikleri (pass_accuracy/rating) türetilir.
const CUP_PLAYER_CATALOG: TslMetricOption[] = ([
  ["appearances", "playing_time", "Oynama Süresi", "count", true],
  ["minutes", "playing_time", "Oynama Süresi", "count", true],
  ["rating_avg", "overall", "Genel", "decimal", true],
  ["goals_total", "attacking", "Hücum", "count", true],
  ["xg", "attacking", "Hücum", "decimal", true],
  ["xgot", "attacking", "Hücum", "decimal", true],
  ["shots_total", "attacking", "Hücum", "count", true],
  ["shots_on_target", "attacking", "Hücum", "count", true],
  ["touches_opp_box", "attacking", "Hücum", "count", true],
  ["assists_total", "creation", "Yaratıcılık", "count", true],
  ["xa", "creation", "Yaratıcılık", "decimal", true],
  ["key_passes", "creation", "Yaratıcılık", "count", true],
  ["big_chances_missed", "creation", "Yaratıcılık", "count", false],
  ["passes_total", "passing", "Pas", "count", true],
  ["accurate_pass", "passing", "Pas", "count", true],
  ["pass_accuracy_pct", "passing", "Pas", "pct", true],
  ["long_balls", "passing", "Pas", "count", true],
  ["crosses", "passing", "Pas", "count", true],
  ["tackles", "defending", "Savunma", "count", true],
  ["interceptions", "defending", "Savunma", "count", true],
  ["clearances", "defending", "Savunma", "count", true],
  ["blocks", "defending", "Savunma", "count", true],
  ["recoveries", "defending", "Savunma", "count", true],
  ["duels_won", "duels", "İkili Mücadele", "count", true],
  ["aerials_won", "duels", "İkili Mücadele", "count", true],
  ["dribbles_won", "duels", "İkili Mücadele", "count", true],
  ["touches", "possession", "Topla Oynama", "count", true],
  ["fouls_won", "discipline", "Disiplin", "count", true],
  ["fouls", "discipline", "Disiplin", "count", false],
  ["offsides", "discipline", "Disiplin", "count", false],
  ["saves", "goalkeeping", "Kalecilik", "count", true],
] as [string, string, string, string, boolean][]).map(([metricKey, categoryKey, categoryLabel, valueFormat, isHigherBetter], i) => ({
  metricKey, metricLabel: metricKey, categoryKey, categoryLabel, categorySort: i,
  valueFormat, isHigherBetter, defaultBasis: "total",
}));
const RATE_KEYS = new Set(["pass_accuracy_pct", "rating_avg"]);

export function cupPlayerCatalog(): TslMetricOption[] {
  return CUP_PLAYER_CATALOG;
}

// Header (isim/uuid/takım/reyting/apps/pozisyon/slug) + metrik toplamları.
async function playerHeaders(season: string) {
  const sb = await createClient();
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.schema("analytics").from("cup_player_stats_v1")
      .select("player_id, player_uuid, player_name, main_team_id, main_position, apps, avg_rating")
      .eq("season_label", season).order("apps", { ascending: false }).range(from, from + 999);
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
async function playerMetrics(season: string): Promise<Record<string, Record<string, number>>> {
  const sb = await createClient();
  const out: Record<string, Record<string, number>> = {};
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.schema("analytics").from("cup_player_season_metric_v1")
      .select("player_id, metric_key, total").eq("season_label", season).range(from, from + 999);
    if (!data || !data.length) break;
    for (const r of data) {
      const id = String(r.player_id);
      (out[id] ??= {})[r.metric_key as string] = toNum(r.total) ?? 0;
    }
    if (data.length < 1000) break;
  }
  return out;
}
async function playerSlugs(): Promise<Record<string, string | null>> {
  const sb = await createClient();
  const out: Record<string, string | null> = {};
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.schema("ref").from("mackolik_player_map")
      .select("mackolik_player_id, opta_player_slug").not("opta_player_slug", "is", null).range(from, from + 999);
    if (!data || !data.length) break;
    for (const r of data) out[String(r.mackolik_player_id)] = (r.opta_player_slug as string) ?? null;
    if (data.length < 1000) break;
  }
  return out;
}

function buildMetrics(m: Record<string, number>, apps: number, ratingAvg: number | null): ResmiPlayerRow["metrics"] {
  const minutes = m["minutes"] ?? 0;
  const out: ResmiPlayerRow["metrics"] = {};
  for (const c of CUP_PLAYER_CATALOG) {
    const k = c.metricKey;
    if (k === "appearances") { out[k] = { total: apps, perMatch: apps, per90: apps }; continue; }
    if (k === "rating_avg") { out[k] = { total: ratingAvg, perMatch: ratingAvg, per90: ratingAvg }; continue; }
    if (k === "pass_accuracy_pct") {
      const acc = m["accurate_pass"], tot = m["passes_total"];
      const pct = tot ? Math.round((acc / tot) * 1000) / 10 : null;
      out[k] = { total: pct, perMatch: pct, per90: pct }; continue;
    }
    const total = m[k] ?? null;
    if (RATE_KEYS.has(k)) out[k] = { total, perMatch: total, per90: total };
    else out[k] = {
      total,
      perMatch: total != null && apps > 0 ? total / apps : null,
      per90: total != null && minutes > 0 ? (total / minutes) * 90 : null,
    };
  }
  return out;
}

export async function cupPlayers(season: string, meta: Record<string, TslTeamMeta>): Promise<ResmiPlayerRow[]> {
  const [headers, metrics, slugs] = await Promise.all([playerHeaders(season), playerMetrics(season), playerSlugs()]);
  // Oyuncu-istatistiği sadece Çeyrek/Yarı Final + Final'de var. Lineup'ta görünen
  // ama maç-istatistiği olmayan (erken tur) oyuncuları listeleme — tablo boş
  // satırlarla dolmasin. Sadece metriği olan oyuncuları göster.
  return headers.filter((h) => metrics[String(h.player_id)]).map((h) => {
    const id = String(h.player_id);
    const teamId = String(h.main_team_id ?? "");
    const apps = toNum(h.apps) ?? 0;
    const rating = toNum(h.avg_rating);
    return {
      playerId: id, name: (h.player_name as string) ?? "—", positionCode: (h.main_position as string) ?? null,
      teamId, teamName: meta[teamId]?.name ?? null, teamLogo: meta[teamId]?.logo ?? null,
      slug: slugs[id] ?? null, playerHref: null, teamHref: null,
      photo: cupPlayerPhoto(h.player_uuid as string | null), nationality: null, inCurrentSquad: true,
      metrics: buildMetrics(metrics[id] ?? {}, apps, rating),
    };
  });
}

export async function cupAssets(): Promise<Record<string, PlayerAsset>> {
  return {};
}

export async function cupLeaderboard(season: string, metricKey: string, meta: Record<string, TslTeamMeta>): Promise<TslLeaderRow[]> {
  const def = CUP_PLAYER_CATALOG.find((c) => c.metricKey === metricKey);
  if (!def) return [];
  const [headers, metrics] = await Promise.all([playerHeaders(season), playerMetrics(season)]);
  const arr = headers.map((h) => {
    const id = String(h.player_id);
    const teamId = String(h.main_team_id ?? "");
    const apps = toNum(h.apps) ?? 0;
    const m = metrics[id] ?? {};
    let total: number | null;
    if (metricKey === "appearances") total = apps;
    else if (metricKey === "rating_avg") total = toNum(h.avg_rating);
    else if (metricKey === "pass_accuracy_pct") total = m["passes_total"] ? Math.round((m["accurate_pass"] / m["passes_total"]) * 1000) / 10 : null;
    else total = m[metricKey] ?? null;
    return {
      playerId: id, playerName: (h.player_name as string) ?? "—",
      teamName: meta[teamId]?.name ?? null, teamId: teamId || null, positionCode: (h.main_position as string) ?? null,
      metricKey, metricLabel: metricKey, total,
      perMatch: RATE_KEYS.has(metricKey) || metricKey === "appearances" ? total : total != null && apps > 0 ? total / apps : null,
      per90: null, matches: apps,
      leagueAvg: null, vsAvgPct: null, valueFormat: def.valueFormat, isHigherBetter: def.isHigherBetter,
    };
  }).filter((x) => x.total != null && (x.matches ?? 0) > 0);
  const higher = def.isHigherBetter;
  arr.sort((a, b) => (higher ? (b.total ?? 0) - (a.total ?? 0) : (a.total ?? 0) - (b.total ?? 0)));
  return arr.map((x, i) => ({ rank: i + 1, ...x }));
}
