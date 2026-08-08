"use client";

import { createClient } from "@/lib/supabase/client";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { type StatusConfig, DEFAULT_STATUS_CONFIG } from "../../player-market-prediction/compute";

export type { StatusConfig };

// TFF 1. Lig player market veri katmani. UI, TSL modulundeki
// app/dashboard/player-market-prediction ile birebir ayni; tek fark burada
// SofaScore kaynakli tff1_* view/mat'larindan okunmasi ve pm_* kalici
// tablolarinda league='tff1' ayriminin kullanilmasi.
// Kimlikler: takim = tff1 team_id (text), oyuncu = sofascore player_id (text).
// Slug kavrami yok; TSL arayuzuyle uyum icin player_slug alanina player_id yazilir.

const LEAGUE = "tff1";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpcomingFixture = {
  fixture_id: number;
  fixture_date: string;
  home_team_name: string;
  away_team_name: string;
  home_source_team_id: string;
  away_source_team_id: string;
  label: string;
};

export type PlayerRow = {
  player_source_id: string;
  player_name: string;
  player_slug: string; // = player_id (sofascore); pm_player_ids anahtari
  primary_position_code: string;
  appearances: number;
  starts: number;
  starter_rate_pct: number | null;
  last_match_datetime: string | null;
};

export type PlayerMatchEntry = {
  player_source_id: string;
  match_datetime: string;
  lineup_status: string; // "starter" | "substitute"
  minutes_played: number;
};

export type PlayerMetricStat = {
  player_source_id: string;
  per_match_value: number | null;
  last5_value: number | null;
};

export type MarketOption = {
  key: string;
  label: string;
  // tff1_pm_player_season_mat kolon adi; "" = istatistik yok. TSL'deki "log:"
  // oneki burada gerekmez (tum metrikler tek uzayda) ama tip yapisi ayni kalir.
  metricKey: string;
  logField: string; // tff1_player_match_log_mat kolon adi ("" = istatistik yok)
  includeGk: boolean; // false ise kaleciler listede gosterilmez
};

// tff1_squad_mat pozisyon kodlari (G/D/M/F) -> TSL arayuzunun bekledigi kisa
// kodlar; sayfa GK dedup/gizleme mantigi "GK" bekliyor.
const POSITION_CODE: Record<string, string> = {
  G: "GK",
  D: "DF",
  M: "MF",
  F: "FW",
};

function toPositionCode(pos: string | null | undefined): string {
  if (!pos) return "";
  return POSITION_CODE[pos] ?? pos;
}

// ─── Market definitions ───────────────────────────────────────────────────────
// metricKey = sezon mat kolonu, logField = mac logu kolonu (ayni adlar).
// Avg CLIENT'ta kolon_toplami / appearances olarak hesaplanir (per_match_value
// karsiligi yok). Saves disinda kaleciler gizlenir (TSL konvansiyonu).

export const MARKET_OPTIONS: MarketOption[] = [
  { key: "shots",           label: "Shots",            metricKey: "shots",            logField: "shots",            includeGk: false },
  { key: "shots_on_target", label: "Shots on Target",  metricKey: "shots_on_target",  logField: "shots_on_target",  includeGk: false },
  { key: "goals",           label: "Goals",            metricKey: "goals",            logField: "goals",            includeGk: false },
  { key: "assists",         label: "Assists",          metricKey: "assists",          logField: "assists",          includeGk: false },
  { key: "passes",          label: "Passes",           metricKey: "total_passes",     logField: "total_passes",     includeGk: false },
  { key: "accurate_passes", label: "Accurate Passes",  metricKey: "accurate_passes",  logField: "accurate_passes",  includeGk: false },
  { key: "key_passes",      label: "Key Passes",       metricKey: "key_passes",       logField: "key_passes",       includeGk: false },
  { key: "crosses",         label: "Crosses",          metricKey: "crosses",          logField: "crosses",          includeGk: false },
  { key: "tackles",         label: "Tackles",          metricKey: "tackles",          logField: "tackles",          includeGk: false },
  { key: "interceptions",   label: "Interceptions",    metricKey: "interceptions",    logField: "interceptions",    includeGk: false },
  { key: "clearances",      label: "Clearances",       metricKey: "clearances",       logField: "clearances",       includeGk: false },
  { key: "ball_recoveries", label: "Ball Recoveries",  metricKey: "ball_recoveries",  logField: "ball_recoveries",  includeGk: false },
  { key: "duels_won",       label: "Duels Won",        metricKey: "duels_won",        logField: "duels_won",        includeGk: false },
  { key: "aerials_won",     label: "Aerials Won",      metricKey: "aerials_won",      logField: "aerials_won",      includeGk: false },
  { key: "fouls",           label: "Fouls",            metricKey: "fouls",            logField: "fouls",            includeGk: false },
  { key: "fouls_suffered",  label: "Fouls Suffered",   metricKey: "was_fouled",       logField: "was_fouled",       includeGk: false },
  { key: "offsides",        label: "Offsides",         metricKey: "offsides",         logField: "offsides",         includeGk: false },
  { key: "dribbles",        label: "Dribbles",         metricKey: "dribbles_won",     logField: "dribbles_won",     includeGk: false },
  { key: "touches",         label: "Touches",          metricKey: "touches",          logField: "touches",          includeGk: false },
  { key: "saves",           label: "Saves",            metricKey: "saves",            logField: "saves",            includeGk: true },
];

// ─── Latest season with metric data ──────────────────────────────────────────
// Avg bu sezondan, LY Avg bir oncekinden okunur (lib/season previousSeasonLabel).

export async function fetchLatestMetricSeason(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_pm_player_season_mat")
    .select("season_label")
    .order("season_label", { ascending: false })
    .limit(1);

  if (error) {
    console.error("fetchLatestMetricSeason error:", error);
    return "2025/2026";
  }
  return data?.[0]?.season_label ?? "2025/2026";
}

// ─── All current squad players (Player List tab) ─────────────────────────────

export type DirectoryPlayer = {
  player_id: string;
  full_name: string;
  team_id: string | null;
  team_name: string | null;
  position: string | null; // kisa kod (GK/DF/MF/FW) veya null
};

export async function fetchAllCurrentPlayers(): Promise<DirectoryPlayer[]> {
  const supabase = createClient();

  const data = await fetchAllPaged<{
    team_id: string | null;
    team_name: string | null;
    player_id: string | null;
    player_name: string | null;
    position: string | null;
  }>((from, to) =>
    supabase
      .schema("analytics")
      .from("tff1_squad_mat")
      .select("team_id, team_name, player_id, player_name, position")
      .order("team_name", { ascending: true })
      .order("player_name", { ascending: true })
      .order("player_id", { ascending: true })
      .range(from, to)
  );

  // Ayni oyuncu iki kadroda gorunebilir (sezon ici transfer); ilk satiri al.
  const seen = new Set<string>();
  const result: DirectoryPlayer[] = [];
  for (const row of data) {
    const pid = row.player_id;
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    result.push({
      player_id: pid,
      full_name: row.player_name ?? "",
      team_id: row.team_id ?? null,
      team_name: row.team_name ?? null,
      position: row.position ? toPositionCode(row.position) : null,
    });
  }
  return result;
}

// ─── Fetch upcoming fixtures ──────────────────────────────────────────────────

export async function fetchUpcomingFixtures(): Promise<UpcomingFixture[]> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_fixtures_v1")
    .select(
      "fixture_id, fixture_date, fixture_datetime, home_team_id, home_team_name, away_team_id, away_team_name, fixture_status"
    )
    .gte("fixture_date", today)
    .eq("fixture_status", "scheduled")
    .order("fixture_datetime", { ascending: true })
    .limit(50);

  if (error) {
    console.error("fetchUpcomingFixtures error:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    fixture_id: row.fixture_id,
    fixture_date: row.fixture_date,
    home_team_name: row.home_team_name,
    away_team_name: row.away_team_name,
    home_source_team_id: String(row.home_team_id),
    away_source_team_id: String(row.away_team_id),
    label: `${row.home_team_name} vs ${row.away_team_name} (${String(row.fixture_date).slice(0, 10)})`,
  }));
}

// ─── Fetch team players (current squad + 2025/2026 stats) ────────────────────
// Kaynak: analytics.tff1_squad_mat (TM kadrosu + roster birlesimi). Yeni
// transferlerde istatistik alanlari null olabilir; 0 olarak normalize edilir.

export async function fetchTeamPlayers(sourceTeamId: string): Promise<PlayerRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_squad_mat")
    .select(
      "player_id, player_name, position, appearances, starts, starter_rate_pct, last_match_datetime"
    )
    .eq("team_id", sourceTeamId)
    .order("appearances", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("fetchTeamPlayers error:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    player_source_id: row.player_id,
    player_name: row.player_name,
    player_slug: row.player_id,
    primary_position_code: toPositionCode(row.position),
    appearances: row.appearances ?? 0,
    starts: row.starts ?? 0,
    starter_rate_pct: row.starter_rate_pct ?? null,
    last_match_datetime: row.last_match_datetime ?? null,
  }));
}

// ─── Fetch last N matches per player for status inference ────────────────────
// lineup_status='bench' kadroda olup oynamayan oyuncudur (minutes 0); TSL
// logunda boyle satir yok. inferPlayerStatus starter/substitute oranina
// baktigindan bench satirlari filtrelenir, yoksa oranlari sulandirir.

export async function fetchPlayerRecentMatches(
  playerSourceIds: string[],
  seasonLabel = "2025/2026",
  lastN = 10
): Promise<Record<string, PlayerMatchEntry[]>> {
  if (playerSourceIds.length === 0) return {};
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_player_match_log_mat")
    .select("player_id, match_datetime, lineup_status, minutes")
    .eq("season_label", seasonLabel)
    .neq("lineup_status", "bench")
    .in("player_id", playerSourceIds)
    .order("match_datetime", { ascending: false })
    .limit(Math.min(playerSourceIds.length * lastN * 2, 1000));

  if (error) {
    console.error("fetchPlayerRecentMatches error:", error);
    return {};
  }

  const grouped: Record<string, PlayerMatchEntry[]> = {};
  for (const row of data ?? []) {
    const id = row.player_id;
    if (!id) continue;
    if (!grouped[id]) grouped[id] = [];
    if (grouped[id].length < lastN) {
      grouped[id].push({
        player_source_id: id,
        match_datetime: row.match_datetime,
        lineup_status: row.lineup_status,
        minutes_played: row.minutes ?? 0,
      });
    }
  }

  return grouped;
}

// ─── Fetch last 5 match avg per player for selected metric ───────────────────
// TSL davranisiyla tutarli: yalnizca oynanan maclar (bench haric) sayilir.

export async function fetchPlayerLast5Avg(
  playerSourceIds: string[],
  logField: string,
  seasonLabel = "2025/2026"
): Promise<Record<string, number | null>> {
  if (playerSourceIds.length === 0 || !logField) return {};
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_player_match_log_mat")
    .select(`player_id, match_datetime, ${logField}`)
    .eq("season_label", seasonLabel)
    .neq("lineup_status", "bench")
    .in("player_id", playerSourceIds)
    .order("match_datetime", { ascending: false })
    .limit(Math.min(playerSourceIds.length * 5 * 2, 1000));

  if (error) {
    console.error("fetchPlayerLast5Avg error:", error);
    return {};
  }

  const grouped: Record<string, number[]> = {};
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const id = row.player_id ? String(row.player_id) : null;
    if (!id) continue;
    if (!grouped[id]) grouped[id] = [];
    if (grouped[id].length < 5) {
      const val = row[logField];
      const num = val !== null && val !== undefined ? Number(val) : null;
      if (num !== null && !isNaN(num)) grouped[id].push(num);
    }
  }

  const result: Record<string, number | null> = {};
  for (const id of playerSourceIds) {
    const vals = grouped[id];
    if (!vals || vals.length === 0) {
      result[id] = null;
    } else {
      result[id] = vals.reduce((s, v) => s + v, 0) / vals.length;
    }
  }
  return result;
}

// ─── Fetch player metric stats (season avg) ──────────────────────────────────
// tff1_pm_player_season_mat sezon x oyuncu greninde TOPLAM tutar; mac basi
// ortalama client'ta toplam / appearances olarak hesaplanir (appearances 0
// ise null). last5 zaten log'dan ayrica hesaplandigindan burada null doner.

export async function fetchPlayerMetricStats(
  playerSourceIds: string[],
  metricKey: string,
  seasonLabel = "2025/2026"
): Promise<Record<string, PlayerMetricStat>> {
  if (playerSourceIds.length === 0 || !metricKey) return {};
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_pm_player_season_mat")
    .select(`player_id, appearances, ${metricKey}`)
    .eq("season_label", seasonLabel)
    .in("player_id", playerSourceIds);

  if (error) {
    console.error("fetchPlayerMetricStats error:", error);
    return {};
  }

  const result: Record<string, PlayerMetricStat> = {};
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const id = String(row.player_id);
    const apps = Number(row.appearances ?? 0);
    const total = row[metricKey] !== null && row[metricKey] !== undefined
      ? Number(row[metricKey])
      : null;
    result[id] = {
      player_source_id: id,
      per_match_value: total !== null && apps > 0 ? total / apps : null,
      last5_value: null,
    };
  }
  return result;
}

// ─── Season appearances (Model: mac sayisi kolonu) ───────────────────────────
// Mat sezon x oyuncu greninde tekildir (takimlar birlesik).

export async function fetchPlayerSeasonAppearances(
  playerSourceIds: string[],
  seasonLabel: string
): Promise<Record<string, number>> {
  if (playerSourceIds.length === 0 || !seasonLabel) return {};
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_pm_player_season_mat")
    .select("player_id, appearances")
    .eq("season_label", seasonLabel)
    .in("player_id", playerSourceIds);

  if (error) {
    console.error("fetchPlayerSeasonAppearances error:", error);
    return {};
  }

  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    result[row.player_id] = (result[row.player_id] ?? 0) + (row.appearances ?? 0);
  }
  return result;
}

// ─── Player IDs (analytics.pm_player_ids, league='tff1') ─────────────────────
// player_slug alanina sofascore player_id yazilir (tff1'de slug yok).

export async function fetchPlayerIds(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_player_ids")
    .select("player_slug, external_id")
    .eq("league", LEAGUE);

  if (error) {
    console.error("fetchPlayerIds error:", error);
    return {};
  }

  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.external_id) result[row.player_slug] = row.external_id;
  }
  return result;
}

export async function savePlayerIds(
  entries: Record<string, string>
): Promise<boolean> {
  const rows = Object.entries(entries).map(([playerId, value]) => ({
    league: LEAGUE,
    player_slug: playerId,
    external_id: value.trim() || null,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return true;

  const supabase = createClient();
  const { error } = await supabase
    .schema("analytics")
    .from("pm_player_ids")
    .upsert(rows, { onConflict: "league,player_slug" });

  if (error) {
    console.error("savePlayerIds error:", error);
    return false;
  }
  return true;
}

// ─── Fixture ID inputs (analytics.pm_fixture_inputs, league='tff1') ──────────

export async function fetchFixtureInputs(): Promise<Record<number, string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_fixture_inputs")
    .select("fixture_id, input_value")
    .eq("league", LEAGUE);

  if (error) {
    console.error("fetchFixtureInputs error:", error);
    return {};
  }

  const result: Record<number, string> = {};
  for (const row of data ?? []) {
    if (row.input_value) result[row.fixture_id] = row.input_value;
  }
  return result;
}

// Bets10 fixture id önerisi (resolver'ın doldurduğu link tablosu). Player Stats
// Model için yalnızca fixture id gerekir (oran değil).
export async function fetchBets10FixtureIds(): Promise<Record<number, string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("fixture_bets10_link_v1")
    .select("fixture_id, bets10_event_id")
    .eq("league", LEAGUE)
    .not("bets10_event_id", "is", null);
  if (error) {
    console.error("fetchBets10FixtureIds error:", error);
    return {};
  }
  const result: Record<number, string> = {};
  for (const row of data ?? []) {
    if (row.bets10_event_id) result[row.fixture_id] = row.bets10_event_id;
  }
  return result;
}

export async function saveFixtureInputs(
  entries: Record<number, string>
): Promise<boolean> {
  const rows = Object.entries(entries).map(([fixtureId, value]) => ({
    league: LEAGUE,
    fixture_id: Number(fixtureId),
    input_value: value.trim() || null,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return true;

  const supabase = createClient();
  const { error } = await supabase
    .schema("analytics")
    .from("pm_fixture_inputs")
    .upsert(rows, { onConflict: "league,fixture_id" });

  if (error) {
    console.error("saveFixtureInputs error:", error);
    return false;
  }
  return true;
}

// ─── Market store (analytics.pm_markets, league='tff1') ──────────────────────

export type MarketType = "static" | "dynamic";

export type StoredMarket = {
  market_key: string;
  label: string;
  template_id: string | null;
  is_custom: boolean;
  sort_order: number;
  market_type: MarketType;
  in_model: boolean;
};

export async function fetchStoredMarkets(): Promise<StoredMarket[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_markets")
    .select("market_key, label, template_id, is_custom, sort_order, market_type, in_model")
    .eq("league", LEAGUE)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchStoredMarkets error:", error);
    return [];
  }
  return data ?? [];
}

export async function upsertStoredMarket(
  market: Omit<StoredMarket, "sort_order" | "in_model"> & {
    sort_order?: number;
    in_model?: boolean;
  }
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("analytics")
    .from("pm_markets")
    .upsert(
      {
        league: LEAGUE,
        market_key: market.market_key,
        label: market.label,
        template_id: market.template_id,
        is_custom: market.is_custom,
        sort_order: market.sort_order ?? 0,
        market_type: market.market_type,
        in_model: market.in_model ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "league,market_key" }
    );

  if (error) {
    console.error("upsertStoredMarket error:", error);
    return false;
  }
  return true;
}

export async function deleteStoredMarket(marketKey: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("analytics")
    .from("pm_markets")
    .delete()
    .eq("league", LEAGUE)
    .eq("market_key", marketKey);

  if (error) {
    console.error("deleteStoredMarket error:", error);
    return false;
  }
  return true;
}

// ─── Model config (analytics.pm_model_config, league='tff1') ─────────────────
// Dagitim agirliklari: beklenti, oyuncu LY Avg / Last 5 / Avg metriklerinin
// yuzde-agirlikli karisimina orantili bolunur. Sezon basinda LY=100 verilir.

export type DistWeights = { ly: number; last5: number; avg: number };
export const DEFAULT_DIST_WEIGHTS: DistWeights = { ly: 100, last5: 0, avg: 0 };

export async function fetchDistWeights(): Promise<DistWeights> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_model_config")
    .select("config_key, config_value")
    .eq("league", LEAGUE);

  if (error) {
    console.error("fetchDistWeights error:", error);
    return DEFAULT_DIST_WEIGHTS;
  }
  const map: Record<string, number> = {};
  for (const r of data ?? []) map[r.config_key as string] = Number(r.config_value);
  return {
    ly: map["dist_weight_ly"] ?? DEFAULT_DIST_WEIGHTS.ly,
    last5: map["dist_weight_last5"] ?? DEFAULT_DIST_WEIGHTS.last5,
    avg: map["dist_weight_avg"] ?? DEFAULT_DIST_WEIGHTS.avg,
  };
}

export async function saveDistWeights(w: DistWeights): Promise<boolean> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const rows = [
    { league: LEAGUE, config_key: "dist_weight_ly", config_value: w.ly, updated_at: now },
    { league: LEAGUE, config_key: "dist_weight_last5", config_value: w.last5, updated_at: now },
    { league: LEAGUE, config_key: "dist_weight_avg", config_value: w.avg, updated_at: now },
  ];
  const { error } = await supabase
    .schema("analytics")
    .from("pm_model_config")
    .upsert(rows, { onConflict: "league,config_key" });

  if (error) {
    console.error("saveDistWeights error:", error);
    return false;
  }
  return true;
}

// Status kurallari (Model ekranindaki durum cikarimi esikleri, league='tff1').
export async function fetchStatusConfig(): Promise<StatusConfig> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_model_config")
    .select("config_key, config_value")
    .eq("league", LEAGUE);

  if (error) {
    console.error("fetchStatusConfig error:", error);
    return DEFAULT_STATUS_CONFIG;
  }
  const m: Record<string, number> = {};
  for (const r of data ?? []) m[r.config_key as string] = Number(r.config_value);
  const d = DEFAULT_STATUS_CONFIG;
  return {
    outN: m["status_out_n"] ?? d.outN,
    outK: m["status_out_k"] ?? d.outK,
    starterN: m["status_starter_n"] ?? d.starterN,
    starterK: m["status_starter_k"] ?? d.starterK,
    subN: m["status_sub_n"] ?? d.subN,
    subK: m["status_sub_k"] ?? d.subK,
    lastOnly: (m["status_last_only"] ?? (d.lastOnly ? 1 : 0)) === 1,
  };
}

export async function saveStatusConfig(c: StatusConfig): Promise<boolean> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const kv: [string, number][] = [
    ["status_out_n", c.outN],
    ["status_out_k", c.outK],
    ["status_starter_n", c.starterN],
    ["status_starter_k", c.starterK],
    ["status_sub_n", c.subN],
    ["status_sub_k", c.subK],
    ["status_last_only", c.lastOnly ? 1 : 0],
  ];
  const rows = kv.map(([config_key, config_value]) => ({
    league: LEAGUE,
    config_key,
    config_value,
    updated_at: now,
  }));
  const { error } = await supabase
    .schema("analytics")
    .from("pm_model_config")
    .upsert(rows, { onConflict: "league,config_key" });

  if (error) {
    console.error("saveStatusConfig error:", error);
    return false;
  }
  return true;
}
