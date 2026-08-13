// Türkiye Kupası veri sağlayıcısı (Resmi deneyimi "cup" kaynağı).
// analytics.cup_* view'larını okur; Mackolik verisi ama uuid=Opta olduğundan
// eşleşen takımlar football profillerine slug ile bağlanır. Oyuncu tarafı
// (players/catalog/leaderboard/assets) Faz 5'e kadar boş döner.
import { createClient } from "../../../lib/supabase/server";
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
  const { data } = await sb.schema("analytics").from("cup_standings_v1").select("*").eq("season_label", season).limit(500);
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
  const { data } = await sb
    .schema("analytics")
    .from("cup_team_leaderboard_rows_v1")
    .select("team_id, team_name, metric_key, total_value, per_match_value, league_avg, league_rank, vs_league_avg_pct")
    .eq("season_label", season)
    .in("metric_key", METRIC_KEYS)
    .not("team_slug", "is", null)
    .limit(2000);
  return data ?? [];
}

export async function cupTeamMetrics(season: string, meta: Record<string, TslTeamMeta>): Promise<TslTeamMetric[]> {
  const rows = await leaderboardRows(season);
  return rows.map((r) => {
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
    .limit(2000);
  const out: Record<string, TeamAggression> = {};
  for (const r of data ?? []) {
    const id = String(r.team_id);
    if (!out[id]) out[id] = { yellow: 0, red: 0, total: 0, matches: 0 };
    const v = toNum(r.total_value) ?? 0;
    if (r.stat_type === "yellow_card" || r.stat_type === "second_yellow_card") out[id].yellow += v;
    else out[id].red += v;
    out[id].matches = Math.max(out[id].matches, toNum(r.apps) ?? 0);
    out[id].total = out[id].yellow + out[id].red;
  }
  return out;
}

// ---- Oyuncu tarafı: Faz 5 (Mackolik oyuncu endpoint'leri) ----
export async function cupPlayers(): Promise<ResmiPlayerRow[]> {
  return [];
}
export async function cupAssets(): Promise<Record<string, PlayerAsset>> {
  return {};
}
export function cupPlayerCatalog(): TslMetricOption[] {
  return [];
}
export async function cupLeaderboard(): Promise<TslLeaderRow[]> {
  return [];
}
