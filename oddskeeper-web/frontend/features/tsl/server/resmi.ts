import { createClient } from "../../../lib/supabase/server";
import { cachedQuery } from "../../../lib/supabase/cached";
import { fetchAllPaged } from "../../../lib/supabase/paginate";
import { TSL_COMPETITION } from "../constants";
import { toNum } from "../lib";
import type { TslMatch, TslStandingRow, TslTeamMeta } from "../types";
import { getTslMatches, getTslTeamMeta } from "./queries";

// Sezon başlamadıysa (istatistik yok) fikstür takımlarından 0-0-0 puan durumu.
export function buildZeroStandings(
  fixtures: TslMatch[],
  meta: Record<string, TslTeamMeta>
): TslStandingRow[] {
  // Fikstürlerden takım adı/logosu topla (logo tablosunda olmayan yeni takımlar
  // için ad fikstürden gelir, id kalmaz).
  const info = new Map<string, { name: string; logo: string | null }>();
  for (const m of fixtures) {
    if (m.homeId && !info.has(m.homeId)) info.set(m.homeId, { name: m.homeName, logo: m.homeLogo });
    if (m.awayId && !info.has(m.awayId)) info.set(m.awayId, { name: m.awayName, logo: m.awayLogo });
  }
  const rows = [...info.keys()].map((id) => ({
    teamId: id,
    teamName: meta[id]?.name ?? info.get(id)?.name ?? id,
    logo: meta[id]?.logo ?? info.get(id)?.logo ?? null,
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

export async function getPlayerAssets(
  playerIds?: string[]
): Promise<Record<string, PlayerAsset>> {
  const supabase = await createClient();
  const out: Record<string, PlayerAsset> = {};

  // Belirli oyuncular istendiginde (takim sayfasi ~30 oyuncu) tum tabloyu
  // sayfalamak yerine yalniz o opta id'leri cek. Tam tarama tek bir takim
  // istatistigi icin sayfa basina saniyeler ekliyordu.
  if (playerIds) {
    const ids = Array.from(new Set(playerIds.filter(Boolean)));
    if (!ids.length) return out;
    const { data } = await supabase
      .schema("analytics")
      .from("player_current_info_bridged_v1")
      .select("opta_player_id, player_slug, photo_url, nationality")
      .in("opta_player_id", ids);
    for (const r of data ?? []) {
      out[String(r.opta_player_id)] = {
        slug: r.player_slug ?? null,
        photo: r.photo_url ?? null,
        nationality: r.nationality ?? null,
      };
    }
    return out;
  }

  // player_current_info_bridged_v1: opta id -> slug/foto/uyruk. Guncel kadro (Opta
  // kimlikli) + Opta karsiligi olmayan oyuncular icin SofaScore'dan turetilenler;
  // olmasa yeni transfer / yukselen takim oyuncusunun adi duz metin kalirdi.
  // Bkz. sql/2026-08-15_player_current_info_sofascore_bridge.sql
  // current_team_slug filtresi: bu tam tarama yalniz Turk ligi yuzeylerini besler;
  // kupa-only yabancilar (takimi team_mapping'te olmayan ~9k satir) haric ki
  // sayfa basi tarama buyumesin (kupa yuzeyleri fotoyu tff1_player_info_v1'den alir).
  const data = await fetchAllPaged<{
    opta_player_id: string | null;
    player_slug: string | null;
    photo_url: string | null;
    nationality: string | null;
  }>((from, to) =>
    supabase
      .schema("analytics")
      .from("player_current_info_bridged_v1")
      .select("opta_player_id, player_slug, photo_url, nationality")
      .not("opta_player_id", "is", null)
      .not("current_team_slug", "is", null)
      .order("player_slug", { ascending: true })
      .range(from, to)
  );
  for (const r of data) {
    out[String(r.opta_player_id)] = {
      slug: r.player_slug ?? null,
      photo: r.photo_url ?? null,
      nationality: r.nationality ?? null,
    };
  }
  return out;
}

// ---- Lig liderleri (4 metrik, top 10, foto + link) ----

// Lig liderleri satiri (loader provider.leaderboard'dan uretir; href'ler dolu).
export type ResmiLeaderRow = {
  rank: number;
  playerId: string;
  playerName: string;
  playerHref: string | null;
  photo: string | null;
  nationality: string | null;
  teamName: string | null;
  teamHref: string | null;
  total: number | null;
  perMatch: number | null;
  valueFormat: string;
};

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
  // fixture_status kaynakta bayat kalabiliyor (oynanmis mac hala "scheduled").
  // Baslamasi 3+ saat gecmis maclari sorguda ele: hem oynanmis maclar listede
  // kalmaz, hem de limit penceresi gecmis maclarla dolup paneli bosaltmaz.
  const cutoff = new Date(Date.now() - 3 * 3600_000).toISOString();
  const { data, error } = await supabase
    .schema("analytics")
    .from("tsl_ss_fixtures_v1")
    .select(
      "fixture_id, fixture_datetime, home_team_id, home_team_name, away_team_id, away_team_name, fixture_status, round_number"
    )
    .eq("season_label", season)
    .gte("fixture_datetime", cutoff)
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
  // 25/26 icin 1.382 satir: .limit(2000) PostgREST'te sessizce 1000'e kirpiliyordu,
  // takim kart toplamlari eksik veriden hesaplaniyordu (C-2, 2026-08-20). SAYFALA;
  // siralama sayfa kaymasin diye unique (player_source_id, metric_key) ikilisi.
  const data = await fetchAllPaged((from, to) =>
    supabase
      .schema("analytics")
      .from("tsl_ss_player_detailed_metrics_global_mat")
      .select("source_team_id, metric_key, total_value")
      .eq("competition", TSL_COMPETITION)
      .eq("season_label", season)
      .in("metric_key", ["cards_yellow_total", "cards_red_total"])
      .order("player_source_id")
      .order("metric_key")
      .range(from, to)
  );
  const out: Record<string, TeamAggression> = {};
  for (const r of data ?? []) {
    const id = String(r.source_team_id);
    if (!out[id]) out[id] = { yellow: 0, red: 0, total: 0, matches: 0 };
    const v = toNum(r.total_value) ?? 0;
    if (r.metric_key === "cards_yellow_total") out[id].yellow += v;
    else out[id].red += v;
    out[id].total = out[id].yellow + out[id].red * 2;
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
  fromHref: string | null;
  toName: string | null;
  toHref: string | null;
  toLogo: string | null;
  feeText: string | null;
  feeEur: number | null;
  isLoan: boolean;
  isArrival: boolean;
};

// TM oyuncu adini bizim oyuncu detayina (opta slug) ve fotografina (api-sports)
// isimden eslesme ile bagla; eslesmezse bas harf/link yok.
// P-3 (2026-08-20): TAM tablo taramasi (10k+ satir) her SSR'da tekrar
// kosuyordu; kullanici-bagimsiz oldugu icin 120 sn istek-arasi cache'e alindi.
const getPlayerNameAssetMap = cachedQuery(
  "tsl-player-name-asset-map",
  async (sb): Promise<Record<string, { slug: string | null; photo: string | null }>> => {
    const data = await fetchAllPaged<{
      player_slug: string | null;
      player_name: string | null;
      full_name: string | null;
      photo_url: string | null;
    }>((from, to) =>
      sb
        .schema("analytics")
        .from("player_current_info_v1")
        .select("player_slug, player_name, full_name, photo_url")
        .order("player_slug", { ascending: true })
        .range(from, to)
    );
    const out: Record<string, { slug: string | null; photo: string | null }> = {};
    const { normalizeSearch } = await import("../lib");
    for (const r of data) {
      const asset = { slug: r.player_slug ?? null, photo: r.photo_url ?? null };
      for (const nm of [r.full_name, r.player_name]) {
        if (!nm) continue;
        const key = normalizeSearch(nm);
        if (key && !out[key]) out[key] = asset;
      }
    }
    return out;
  }
);

export async function getResmiTransfers(season: string): Promise<ResmiTransfer[]> {
  const supabase = await createClient();
  const [{ data, error }, nameAssets, { data: mvData }] = await Promise.all([
    // Sezon basi 913 satir (2026-08-20) ve transfer penceresi acik: .limit(1200)
    // zaten 1000'e kirpiliyordu, sinir asilinca kuyruk (bedelsizler) sessizce
    // duserdi. SAYFALA; player_slug ikincil sira sayfa kaymasini onler.
    fetchAllPaged((from, to) =>
      supabase
        .schema("analytics")
        .from("tsl_transfers_v1")
        .select(
          "player_name, player_slug, player_photo_url, from_team_name, from_team_logo, to_team_name, to_team_logo, fee_text, fee_eur, is_tsl_arrival"
        )
        .eq("season_label", season)
        .order("fee_eur", { ascending: false, nullsFirst: false })
        .order("player_slug")
        .range(from, to)
    ).then((rows) => ({ data: rows, error: null as { message: string } | null })),
    getPlayerNameAssetMap(),
    supabase
      .schema("analytics")
      .from("player_market_value_v1")
      .select("player_slug, tm_player_name, market_value_eur")
      // 1000-cap: view ~508 satir (2026-08-20 olcumu), tek sayfa yeter.
      .limit(1000),
  ]);
  if (error || !data) return [];
  const { normalizeSearch } = await import("../lib");

  // Piyasa degeri haritalari: bedelsiz (free/loan) transferlerin de onemine gore
  // siralanmasi icin (ör. Vlahovic bedava geldi ama €35m degerinde -> uste ciksin).
  const mvBySlug = new Map<string, number>();
  const mvByName = new Map<string, number>();
  for (const m of mvData ?? []) {
    const v = toNum(m.market_value_eur);
    if (v == null) continue;
    if (m.player_slug) mvBySlug.set(String(m.player_slug), v);
    if (m.tm_player_name) {
      const k = normalizeSearch(String(m.tm_player_name));
      if (k && !mvByName.has(k)) mvByName.set(k, v);
    }
  }

  const rows = data.map((r) => {
    const matched = nameAssets[normalizeSearch(r.player_name ?? "")];
    const feeText = r.fee_text ?? null;
    const slug = r.player_slug ?? matched?.slug ?? null;
    const mv =
      (slug ? mvBySlug.get(slug) : undefined) ??
      mvByName.get(normalizeSearch(r.player_name ?? "")) ??
      null;
    const feeEur = toNum(r.fee_eur);
    return {
      transfer: {
        playerName: r.player_name,
        playerSlug: slug,
        photo: r.player_photo_url ?? matched?.photo ?? null,
        fromName: r.from_team_name ?? null,
        fromLogo: r.from_team_logo ?? null,
        fromHref: null,
        toName: r.to_team_name ?? null,
        toHref: null,
        toLogo: r.to_team_logo ?? null,
        feeText,
        feeEur,
        isLoan: /loan|kiral/i.test(feeText ?? ""),
        isArrival: r.is_tsl_arrival !== false,
      } as ResmiTransfer,
      // Onem: odenen bedel ile piyasa degerinin buyugu.
      weight: Math.max(feeEur ?? 0, mv ?? 0),
    };
  });

  rows.sort((a, b) => b.weight - a.weight || (b.transfer.feeEur ?? 0) - (a.transfer.feeEur ?? 0));
  return rows.map((r) => r.transfer);
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
  playerHref: string | null;
  teamHref: string | null;
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
  // H4: pivot mat (tsl_ss_player_table_mat) — oyuncu-basina 1 satir, tum metrikler
  // jsonb'de. Eski hal detailed_metrics_global_mat'i uzun-format (28 metrik x ~691
  // oyuncu = ~19.348 satir, 1 count + 20 range istegi) cekip JS'te pivotluyordu.
  // Simdi tek istek/~691 satir. TSL bir sezonda <1000 oyuncu; yine de db-max-rows'a
  // karsi sayfala (deterministik player_source_id sirasi).
  type MatRow = {
    player_source_id: string | null;
    player_name: string | null;
    position_code: string | null;
    source_team_id: string | null;
    team_name: string | null;
    metrics: Record<string, { total: unknown; perMatch: unknown; per90: unknown }> | null;
  };
  const rows: MatRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .schema("analytics")
      .from("tsl_ss_player_table_mat")
      .select("player_source_id, player_name, position_code, source_team_id, team_name, metrics")
      .eq("competition", TSL_COMPETITION)
      .eq("season_label", season)
      .order("player_source_id", { ascending: true })
      .range(from, from + 999);
    if (!data || !data.length) break;
    rows.push(...(data as MatRow[]));
    if (data.length < 1000) break;
  }

  const out: ResmiPlayerRow[] = [];
  for (const r of rows) {
    const id = String(r.player_source_id ?? "");
    if (!id) continue;
    const teamId = String(r.source_team_id ?? "");
    const a = assets[id];
    const metrics: Record<string, ResmiPlayerStat> = {};
    for (const [k, v] of Object.entries(r.metrics ?? {})) {
      metrics[k] = { total: toNum(v.total), perMatch: toNum(v.perMatch), per90: toNum(v.per90) };
    }
    out.push({
      playerId: id,
      name: r.player_name ?? "—",
      positionCode: r.position_code ?? null,
      teamId,
      teamName: meta[teamId]?.name ?? r.team_name ?? null,
      teamLogo: meta[teamId]?.logo ?? null,
      slug: a?.slug ?? null,
      playerHref: null,
      teamHref: null,
      photo: a?.photo ?? null,
      nationality: a?.nationality ?? null,
      inCurrentSquad: !!a,
      metrics,
    });
  }
  return out;
}

// ---- Yardimci: meta'dan isim->slug (yerel logo yolundan) ----
export { getTslTeamMeta, getTslMatches };
