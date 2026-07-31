import { createClient } from "../../../lib/supabase/server";
import { TSL_COMPETITION } from "../constants";
import { toNum } from "../lib";
import type { TslMatch, TslStandingRow, TslTeamMeta } from "../types";
import { getTslMatches, getTslTeamMeta } from "./queries";

// Sezon başlamadıysa (istatistik yok) fikstür takımlarından 0-0-0 puan durumu.
export function buildZeroStandings(
  fixtures: TslMatch[],
  meta: Record<string, TslTeamMeta>
): TslStandingRow[] {
  const ids = new Set<string>();
  for (const m of fixtures) {
    if (m.homeId) ids.add(m.homeId);
    if (m.awayId) ids.add(m.awayId);
  }
  const rows = [...ids].map((id) => ({
    teamId: id,
    teamName: meta[id]?.name ?? id,
    logo: meta[id]?.logo ?? null,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
    ppg: 0,
    form: [] as TslStandingRow["form"],
    attackLabel: null,
    defenceLabel: null,
    formLabel: null,
    strongestLabel: null,
    strongestPct: null,
    weakestLabel: null,
    weakestPct: null,
  }));
  rows.sort((a, b) => a.teamName.localeCompare(b.teamName, "tr"));
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

// ---- Oyuncu varliklari (foto / slug / uyruk) opta id bazinda ----

export type PlayerAsset = {
  slug: string | null;
  photo: string | null;
  nationality: string | null;
};

export async function getPlayerAssets(): Promise<Record<string, PlayerAsset>> {
  const supabase = await createClient();
  const out: Record<string, PlayerAsset> = {};
  // player_current_info_v1: opta id -> slug/photo/nationality (guncel kadro)
  const { data } = await supabase
    .schema("analytics")
    .from("player_current_info_v1")
    .select("opta_player_id, player_slug, photo_url, nationality")
    .not("opta_player_id", "is", null)
    .limit(2000);
  for (const r of data ?? []) {
    out[String(r.opta_player_id)] = {
      slug: r.player_slug ?? null,
      photo: r.photo_url ?? null,
      nationality: r.nationality ?? null,
    };
  }
  return out;
}

// ---- Lig liderleri (4 metrik, top 10, foto + link) ----

export type ResmiLeaderRow = {
  rank: number;
  playerId: string;
  playerName: string;
  slug: string | null;
  photo: string | null;
  nationality: string | null;
  teamName: string | null;
  teamSlug: string | null;
  total: number | null;
  perMatch: number | null;
  valueFormat: string;
};

export async function getResmiLeaders(
  season: string,
  metricKey: string,
  assets: Record<string, PlayerAsset>,
  teamSlugByName: Record<string, string>
): Promise<ResmiLeaderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("tsl_ss_player_leaderboard_rows_v1")
    .select(
      "player_source_id, player_name, team_name, total_value, per_match_value, value_format"
    )
    .eq("competition", TSL_COMPETITION)
    .eq("season_label", season)
    .eq("metric_key", metricKey)
    .order("total_value", { ascending: false, nullsFirst: false })
    .limit(10);

  if (error) {
    console.error("resmi leaders error", metricKey, error.message);
    return [];
  }
  return (data ?? []).map((r, i) => {
    const id = String(r.player_source_id ?? "");
    const a = assets[id];
    return {
      rank: i + 1,
      playerId: id,
      playerName: r.player_name ?? "—",
      slug: a?.slug ?? null,
      photo: a?.photo ?? null,
      nationality: a?.nationality ?? null,
      teamName: r.team_name ?? null,
      teamSlug: r.team_name ? teamSlugByName[r.team_name] ?? null : null,
      total: toNum(r.total_value),
      perMatch: toNum(r.per_match_value),
      valueFormat: r.value_format ?? "count",
    };
  });
}

// ---- Maclari haftalara ayir (football.matches'te round yok -> tarih kumeleme) ----

export type MatchRound = {
  round: number;
  startIso: string | null;
  endIso: string | null;
  matches: TslMatch[];
};

function mkRound(round: number, matches: TslMatch[]): MatchRound {
  return {
    round,
    startIso: matches[0]?.datetime ?? null,
    endIso: matches[matches.length - 1]?.datetime ?? null,
    matches,
  };
}

export function clusterRounds(matches: TslMatch[]): MatchRound[] {
  // matches datetime DESC gelir; kronolojige cevir. football.matches'te round
  // kolonu yok -> tarih bosluguyla haftalara kumele (yaklasik).
  const asc = matches
    .slice()
    .filter((m) => m.datetime)
    .sort((a, b) => new Date(a.datetime!).getTime() - new Date(b.datetime!).getTime());
  const rounds: MatchRound[] = [];
  let current: TslMatch[] = [];
  let prev: number | null = null;
  const GAP = 3.5 * 24 * 60 * 60 * 1000; // 3.5 gun
  for (const m of asc) {
    const t = new Date(m.datetime!).getTime();
    if (prev !== null && t - prev > GAP && current.length) {
      rounds.push(mkRound(rounds.length + 1, current));
      current = [];
    }
    current.push(m);
    prev = t;
  }
  if (current.length) rounds.push(mkRound(rounds.length + 1, current));
  return rounds;
}

// ---- Gelecek maclar (fikstur; secili sezonda) ----

export async function getResmiUpcoming(
  season: string,
  meta: Record<string, TslTeamMeta>
): Promise<TslMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("tsl_ss_fixtures_v1")
    .select(
      "fixture_id, fixture_datetime, home_team_id, home_team_name, away_team_id, away_team_name, fixture_status, round_number"
    )
    .eq("season_label", season)
    .order("fixture_datetime", { ascending: true })
    .limit(60);
  if (error || !data) return [];
  return data
    .filter((r) => (r.fixture_status ?? "").toLowerCase() !== "finished")
    .map((r) => {
      const homeId = String(r.home_team_id);
      const awayId = String(r.away_team_id);
      return {
        matchId: String(r.fixture_id),
        datetime: r.fixture_datetime,
        homeId,
        awayId,
        homeName: meta[homeId]?.name ?? r.home_team_name ?? homeId,
        awayName: meta[awayId]?.name ?? r.away_team_name ?? awayId,
        homeLogo: meta[homeId]?.logo ?? null,
        awayLogo: meta[awayId]?.logo ?? null,
        homeScore: -1,
        awayScore: -1,
      } as TslMatch;
    });
}

// ---- Takim agresyonu (sari+kirmizi) oyuncu kartlarindan ----

export type TeamAggression = { yellow: number; red: number; total: number; matches: number };

export async function getTeamAggression(
  season: string
): Promise<Record<string, TeamAggression>> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema("analytics")
    .from("tsl_ss_player_detailed_metrics_global_mat")
    .select("source_team_id, metric_key, total_value")
    .eq("competition", TSL_COMPETITION)
    .eq("season_label", season)
    .in("metric_key", ["cards_yellow_total", "cards_red_total"])
    .limit(2000);
  const out: Record<string, TeamAggression> = {};
  for (const r of data ?? []) {
    const id = String(r.source_team_id);
    if (!out[id]) out[id] = { yellow: 0, red: 0, total: 0, matches: 0 };
    const v = toNum(r.total_value) ?? 0;
    if (r.metric_key === "cards_yellow_total") out[id].yellow += v;
    else out[id].red += v;
    out[id].total = out[id].yellow + out[id].red;
  }
  return out;
}

// ---- Transferler ----

export type ResmiTransfer = {
  playerName: string;
  playerSlug: string | null;
  photo: string | null;
  fromName: string | null;
  fromLogo: string | null;
  toName: string | null;
  toSlug: string | null;
  toLogo: string | null;
  feeText: string | null;
  feeEur: number | null;
  isLoan: boolean;
};

// TM oyuncu adini bizim oyuncu detayina (opta slug) ve fotografina (api-sports)
// isimden eslesme ile bagla; eslesmezse bas harf/link yok.
async function getPlayerNameAssetMap(): Promise<
  Record<string, { slug: string | null; photo: string | null }>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema("analytics")
    .from("player_current_info_v1")
    .select("player_slug, player_name, full_name, photo_url")
    .limit(2000);
  const out: Record<string, { slug: string | null; photo: string | null }> = {};
  const { normalizeSearch } = await import("../lib");
  for (const r of data ?? []) {
    const asset = { slug: r.player_slug ?? null, photo: r.photo_url ?? null };
    for (const nm of [r.full_name, r.player_name]) {
      if (!nm) continue;
      const key = normalizeSearch(nm);
      if (key && !out[key]) out[key] = asset;
    }
  }
  return out;
}

export async function getResmiTransfers(season: string): Promise<ResmiTransfer[]> {
  const supabase = await createClient();
  const [{ data, error }, nameAssets] = await Promise.all([
    supabase
      .schema("analytics")
      .from("tsl_transfers_v1")
      .select(
        "player_name, player_slug, player_photo_url, from_team_name, from_team_logo, to_team_name, to_team_logo, fee_text, fee_eur"
      )
      .eq("season_label", season)
      .order("fee_eur", { ascending: false, nullsFirst: false })
      .limit(200),
    getPlayerNameAssetMap(),
  ]);
  if (error || !data) return [];
  const { normalizeSearch } = await import("../lib");
  return data.map((r) => {
    const matched = nameAssets[normalizeSearch(r.player_name ?? "")];
    const feeText = r.fee_text ?? null;
    return {
      playerName: r.player_name,
      playerSlug: r.player_slug ?? matched?.slug ?? null,
      photo: r.player_photo_url ?? matched?.photo ?? null,
      fromName: r.from_team_name ?? null,
      fromLogo: r.from_team_logo ?? null,
      toName: r.to_team_name ?? null,
      toSlug: null,
      toLogo: r.to_team_logo ?? null,
      feeText,
      feeEur: toNum(r.fee_eur),
      isLoan: /loan|kiral/i.test(feeText ?? ""),
    };
  });
}

// ---- Sezon-duyarli oyuncu listesi (Players sekmesi) ----

// Tabloda gosterilen tum metrik anahtarlari (detay mat'tan cekilir).
export const RESMI_PLAYER_METRIC_KEYS = [
  "appearances", "starts", "goals_total", "assists_total", "total_minutes",
  "expected_goals_total", "expected_goals_on_target_total", "expected_assists_total",
  "cards_yellow_total", "cards_red_total", "rating_avg", "key_passes_total",
  "big_chances_created_total", "shots_total", "dribbles_won_total", "passes_total",
  "accurate_pass_total", "pass_accuracy_pct", "long_balls_total", "tackles_total",
  "interceptions_total", "clearances_total", "ball_recoveries_total", "duels_won_total",
  "aerials_won_total", "km_covered_total", "sprints_total", "top_speed",
];

export type ResmiPlayerStat = { total: number | null; perMatch: number | null; per90: number | null };

export type ResmiPlayerRow = {
  playerId: string;
  name: string;
  positionCode: string | null;
  teamId: string;
  teamName: string | null;
  teamLogo: string | null;
  slug: string | null;
  photo: string | null;
  nationality: string | null;
  inCurrentSquad: boolean;
  metrics: Record<string, ResmiPlayerStat>;
};

export async function getResmiPlayers(
  season: string,
  meta: Record<string, TslTeamMeta>,
  assets: Record<string, PlayerAsset>
): Promise<ResmiPlayerRow[]> {
  const supabase = await createClient();
  const base = supabase
    .schema("analytics")
    .from("tsl_ss_player_detailed_metrics_global_mat")
    .select(
      "player_source_id, player_name, position_code, source_team_id, team_name, metric_key, total_value, per_match_value, per90_value",
      { count: "exact", head: true }
    )
    .eq("competition", TSL_COMPETITION)
    .eq("season_label", season)
    .in("metric_key", RESMI_PLAYER_METRIC_KEYS);

  const { count } = await base;
  const total = count ?? 0;
  if (!total) return [];

  const PAGE = 1000;
  const pages = Math.ceil(total / PAGE);
  const chunks = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      supabase
        .schema("analytics")
        .from("tsl_ss_player_detailed_metrics_global_mat")
        .select(
          "player_source_id, player_name, position_code, source_team_id, team_name, metric_key, total_value, per_match_value, per90_value"
        )
        .eq("competition", TSL_COMPETITION)
        .eq("season_label", season)
        .in("metric_key", RESMI_PLAYER_METRIC_KEYS)
        .range(i * PAGE, i * PAGE + PAGE - 1)
    )
  );

  const byPlayer = new Map<string, ResmiPlayerRow>();
  for (const ch of chunks) {
    for (const r of ch.data ?? []) {
      const id = String(r.player_source_id ?? "");
      if (!id) continue;
      let row = byPlayer.get(id);
      if (!row) {
        const teamId = String(r.source_team_id ?? "");
        const a = assets[id];
        row = {
          playerId: id,
          name: r.player_name ?? "—",
          positionCode: r.position_code ?? null,
          teamId,
          teamName: meta[teamId]?.name ?? r.team_name ?? null,
          teamLogo: meta[teamId]?.logo ?? null,
          slug: a?.slug ?? null,
          photo: a?.photo ?? null,
          nationality: a?.nationality ?? null,
          inCurrentSquad: !!a,
          metrics: {},
        };
        byPlayer.set(id, row);
      }
      row.metrics[r.metric_key] = {
        total: toNum(r.total_value),
        perMatch: toNum(r.per_match_value),
        per90: toNum(r.per90_value),
      };
    }
  }
  return [...byPlayer.values()];
}

// ---- Yardimci: meta'dan isim->slug (yerel logo yolundan) ----
export { getTslTeamMeta, getTslMatches };
