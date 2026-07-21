"use client";

import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpcomingFixture = {
  fixture_id: number;
  fixture_date: string;
  home_team_name: string;
  away_team_name: string;
  home_source_team_id: string;
  away_source_team_id: string;
  home_team_slug: string;
  away_team_slug: string;
  label: string;
};

export type PlayerRow = {
  player_source_id: string;
  player_name: string;
  player_slug: string;
  primary_position_code: string;
  position_group: string;
  appearances: number;
  starts: number;
  sub_appearances: number;
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
  metricKey: string; // key in player_metric_leaderboard_current ("" = istatistik yok)
  logField: string;  // field in player_match_log_v1 ("" = istatistik yok)
  includeGk: boolean; // false ise kaleciler listede gosterilmez
};

// ─── Market definitions ───────────────────────────────────────────────────────
// metricKey/logField bos olan marketlerin verisi yok; secilince Ort. kolonlari
// bos gelir, manuel beklentiyle calisilir. "shots_derived" ozel alan:
// on target + off target + blocked toplami (tek kolon yok).

export const MARKET_OPTIONS: MarketOption[] = [
  { key: "shots_on_target", label: "Shots on Target",   metricKey: "shots_on_target_total",  logField: "shots_on_target",  includeGk: false },
  { key: "total_shots",     label: "Total Shots",       metricKey: "shots_total",            logField: "shots_derived",    includeGk: false },
  { key: "attempts_ibox",   label: "Attempts In Box",   metricKey: "attempts_ibox_total",    logField: "shots_on_target",  includeGk: false },
  { key: "attempts_obox",   label: "Attempts Out Box",  metricKey: "attempts_obox_total",    logField: "shots_off_target", includeGk: false },
  { key: "passes",          label: "Passes",            metricKey: "passes_total",           logField: "passes",           includeGk: true },
  { key: "accurate_passes", label: "Accurate Passes",   metricKey: "accurate_pass_total",    logField: "accurate_pass",    includeGk: true },
  { key: "tackles",         label: "Tackles",           metricKey: "tackles_total",          logField: "tackles",          includeGk: false },
  { key: "fouls",           label: "Fouls",             metricKey: "fouls_conceded_total",   logField: "fouls_conceded",   includeGk: false },
  { key: "yellow_cards",    label: "Yellow Cards",      metricKey: "cards_yellow_total",     logField: "cards_yellow",     includeGk: true },
  { key: "red_card",        label: "Red Card",          metricKey: "cards_red_total",        logField: "cards_red",        includeGk: true },
  { key: "offsides",        label: "Offsides",          metricKey: "offsides_total",         logField: "offsides",         includeGk: false },
  { key: "saves",           label: "Saves",             metricKey: "saves_total_total",      logField: "saves_total",      includeGk: true },
  { key: "score",           label: "Score",             metricKey: "goals_total",            logField: "goals",            includeGk: false },
  { key: "assist",          label: "Assist",            metricKey: "assists_total",          logField: "assists",          includeGk: false },
  { key: "freekick_goal",   label: "Freekick Goal",     metricKey: "",                       logField: "",                 includeGk: false },
  { key: "header_goal",     label: "Header Goal",       metricKey: "",                       logField: "",                 includeGk: false },
  { key: "outsidebox_goal", label: "OutsideBox Goal",   metricKey: "",                       logField: "",                 includeGk: false },
  { key: "brace",           label: "Brace",             metricKey: "",                       logField: "",                 includeGk: false },
  { key: "hat_trick",       label: "Hat Trick",         metricKey: "",                       logField: "",                 includeGk: false },
];

// ─── Latest season with metric data ──────────────────────────────────────────
// Sayfa "Avg" icin bu sezonu, "LY Avg" icin bir oncekini kullanir; yeni sezon
// verisi geldiginde otomatik olarak ona kayar.

export async function fetchLatestMetricSeason(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("player_metric_leaderboard_current")
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
  player_slug: string;
  full_name: string;
  team_slug: string | null;
  team_name: string | null;
  nationality: string | null;
  position: string | null;
};

// Bilindik isim kurali: apifootball kadro ismi bilindik isimdir ("Talisca",
// "Ederson"); "L. Torreira" gibi kisaltmali ise bas harf, bio first_name
// icindeki bas harfe uyan kelimeyle acilir ("Lucas Torreira", "K. Akturkoglu"
// + "Muhammed Kerem" -> "Kerem Akturkoglu"); uyan kelime yoksa ilk kelime.
// Resmi uzun isimler kullanilmaz.
function knownDisplayName(
  playerName: string | null,
  firstName: string | null
): string {
  if (!playerName) return "";
  const m = playerName.match(/^(\p{Lu})\.\s*(.+)$/u);
  if (m) {
    const words = (firstName ?? "").split(" ").filter(Boolean);
    const first = words.find((w) => w.startsWith(m[1])) ?? words[0];
    if (first) return `${first} ${m[2]}`;
  }
  return playerName;
}

export async function fetchAllCurrentPlayers(): Promise<DirectoryPlayer[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_current_info_v1")
    .select(
      "player_slug, player_name, full_name, first_name, last_name, current_team_slug, current_team_name, nationality, position"
    )
    .order("current_team_name", { ascending: true })
    .order("player_name", { ascending: true })
    .limit(2000);

  if (error) {
    console.error("fetchAllCurrentPlayers error:", error);
    return [];
  }

  // Slug bazinda mukerrer satirlar olabiliyor; ilkini al.
  const seen = new Set<string>();
  const result: DirectoryPlayer[] = [];
  for (const row of data ?? []) {
    if (!row.player_slug || seen.has(row.player_slug)) continue;
    seen.add(row.player_slug);
    result.push({
      player_slug: row.player_slug,
      full_name:
        knownDisplayName(row.player_name, row.first_name) ||
        row.full_name ||
        row.player_name,
      team_slug: row.current_team_slug ?? null,
      team_name: row.current_team_name ?? null,
      nationality: row.nationality ?? null,
      position: row.position ?? null,
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
    .from("league_fixtures_v1")
    .select(
      "fixture_id, fixture_date, home_team_name, away_team_name, home_team_source_id, away_team_source_id, home_team_slug, away_team_slug, fixture_status"
    )
    .gte("fixture_date", today)
    .neq("fixture_status", "played")
    .order("fixture_date", { ascending: true })
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
    home_source_team_id: row.home_team_source_id,
    away_source_team_id: row.away_team_source_id,
    home_team_slug: row.home_team_slug,
    away_team_slug: row.away_team_slug,
    label: `${row.home_team_name} vs ${row.away_team_name} (${String(row.fixture_date).slice(0, 10)})`,
  }));
}

// ─── Fetch team players (current squad + latest season stats) ────────────────
// Kaynak: analytics.team_current_squad_profile_v1. Guncel kadro apifootball
// team_squad_current'tan gelir (fixture'daki takim id'leriyle ayni uzay),
// istatistikler player_mapping uzerinden Opta profiline baglanir.
// player_source_id = Opta id (eslesme varsa) yoksa 'af-<id>'; eslesmeyen
// oyuncular (yeni transferler, yukselen takimlar) istatistiksiz gelir.

export async function fetchTeamPlayers(sourceTeamId: string): Promise<PlayerRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("team_current_squad_profile_v1")
    .select(
      "player_key, player_name, display_name, player_slug, primary_position_code, position_group, appearances, starts, sub_appearances, starter_rate_pct, last_match_datetime"
    )
    .eq("team_source_id", sourceTeamId)
    .order("appearances", { ascending: false });

  if (error) {
    console.error("fetchTeamPlayers error:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    player_source_id: row.player_key,
    player_name: row.display_name ?? row.player_name,
    player_slug: row.player_slug,
    primary_position_code: row.primary_position_code,
    position_group: row.position_group,
    appearances: row.appearances ?? 0,
    starts: row.starts ?? 0,
    sub_appearances: row.sub_appearances ?? 0,
    starter_rate_pct: row.starter_rate_pct ?? null,
    last_match_datetime: row.last_match_datetime ?? null,
  }));
}

// ─── Fetch last N matches per player for status inference ────────────────────

export async function fetchPlayerRecentMatches(
  playerSourceIds: string[],
  seasonLabel = "2025/2026",
  lastN = 10
): Promise<Record<string, PlayerMatchEntry[]>> {
  if (playerSourceIds.length === 0) return {};
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_match_log_v1")
    .select("player_source_id, match_datetime, lineup_status, minutes_played")
    .eq("season_label", seasonLabel)
    .in("player_source_id", playerSourceIds)
    .order("match_datetime", { ascending: false })
    .limit(Math.min(playerSourceIds.length * lastN * 2, 1000));

  if (error) {
    console.error("fetchPlayerRecentMatches error:", error);
    return {};
  }

  const grouped: Record<string, PlayerMatchEntry[]> = {};
  for (const row of data ?? []) {
    const id = row.player_source_id;
    if (!id) continue;
    if (!grouped[id]) grouped[id] = [];
    if (grouped[id].length < lastN) {
      grouped[id].push(row as PlayerMatchEntry);
    }
  }

  return grouped;
}

// ─── Fetch last 5 match avg per player for selected metric ───────────────────

export async function fetchPlayerLast5Avg(
  playerSourceIds: string[],
  logField: string,
  seasonLabel = "2025/2026"
): Promise<Record<string, number | null>> {
  if (playerSourceIds.length === 0 || !logField) return {};
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_match_log_v1")
    .select(
      "player_source_id, match_datetime, shots_on_target, shots_off_target, shots_blocked, passes, accurate_pass, tackles, fouls_conceded, cards_yellow, cards_red, offsides, saves_total, goals, assists, expected_goals"
    )
    .eq("season_label", seasonLabel)
    .in("player_source_id", playerSourceIds)
    .order("match_datetime", { ascending: false })
    .limit(Math.min(playerSourceIds.length * 5 * 2, 1000));

  if (error) {
    console.error("fetchPlayerLast5Avg error:", error);
    return {};
  }

  // Group by player, take last 5, compute avg for the requested field
  const grouped: Record<string, number[]> = {};
  for (const row of data ?? []) {
    const id = row.player_source_id;
    if (!id) continue;
    if (!grouped[id]) grouped[id] = [];
    if (grouped[id].length < 5) {
      const r = row as Record<string, unknown>;
      let num: number | null;
      if (logField === "shots_derived") {
        num =
          Number(r.shots_on_target ?? 0) +
          Number(r.shots_off_target ?? 0) +
          Number(r.shots_blocked ?? 0);
      } else {
        const val = r[logField];
        num = val !== null && val !== undefined ? Number(val) : null;
      }
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

// ─── Fetch player metric stats (season avg + last5) ──────────────────────────

export async function fetchPlayerMetricStats(
  playerSourceIds: string[],
  metricKey: string,
  seasonLabel = "2025/2026"
): Promise<Record<string, PlayerMetricStat>> {
  if (playerSourceIds.length === 0 || !metricKey) return {};
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_metric_leaderboard_current")
    .select("player_source_id, per_match_value, last5_value")
    .eq("metric_key", metricKey)
    .eq("season_label", seasonLabel)
    .in("player_source_id", playerSourceIds);

  if (error) {
    console.error("fetchPlayerMetricStats error:", error);
    return {};
  }

  const result: Record<string, PlayerMetricStat> = {};
  for (const row of data ?? []) {
    result[row.player_source_id] = {
      player_source_id: row.player_source_id,
      per_match_value: row.per_match_value ?? null,
      last5_value: row.last5_value ?? null,
    };
  }
  return result;
}

// ─── Season appearances (Model: mac sayisi kolonu) ───────────────────────────
// Ayni oyuncu sezon icinde iki takimda oynadiysa maclari toplanir.

export async function fetchPlayerSeasonAppearances(
  playerSourceIds: string[],
  seasonLabel: string
): Promise<Record<string, number>> {
  if (playerSourceIds.length === 0 || !seasonLabel) return {};
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_profile_v1")
    .select("player_source_id, appearances")
    .eq("season_label", seasonLabel)
    .in("player_source_id", playerSourceIds);

  if (error) {
    console.error("fetchPlayerSeasonAppearances error:", error);
    return {};
  }

  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    result[row.player_source_id] =
      (result[row.player_source_id] ?? 0) + (row.appearances ?? 0);
  }
  return result;
}

// ─── Player IDs (analytics.pm_player_ids) ────────────────────────────────────
// Oyuncu Listesi sekmesindeki ozel ID'ler; Kaydet ile upsert edilir.

export async function fetchPlayerIds(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_player_ids")
    .select("player_slug, external_id");

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
  const rows = Object.entries(entries).map(([slug, value]) => ({
    player_slug: slug,
    external_id: value.trim() || null,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return true;

  const supabase = createClient();
  const { error } = await supabase
    .schema("analytics")
    .from("pm_player_ids")
    .upsert(rows, { onConflict: "player_slug" });

  if (error) {
    console.error("savePlayerIds error:", error);
    return false;
  }
  return true;
}

// ─── Fixture ID inputs (analytics.pm_fixture_inputs) ─────────────────────────
// Fixture ID sekmesindeki mac basina girilen deger; Model'deki Ekle akisi
// ileride bu kayitlari kullanacak.

export async function fetchFixtureInputs(): Promise<Record<number, string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_fixture_inputs")
    .select("fixture_id, input_value");

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

export async function saveFixtureInputs(
  entries: Record<number, string>
): Promise<boolean> {
  const rows = Object.entries(entries).map(([fixtureId, value]) => ({
    fixture_id: Number(fixtureId),
    input_value: value.trim() || null,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return true;

  const supabase = createClient();
  const { error } = await supabase
    .schema("analytics")
    .from("pm_fixture_inputs")
    .upsert(rows, { onConflict: "fixture_id" });

  if (error) {
    console.error("saveFixtureInputs error:", error);
    return false;
  }
  return true;
}

// ─── Market store (analytics.pm_markets) ─────────────────────────────────────
// Yeni butonuyla eklenen ozel marketler (is_custom=true) + yerlesik marketlerin
// Market Template ID kayitlari (is_custom=false).

export type StoredMarket = {
  market_key: string;
  label: string;
  template_id: string | null;
  is_custom: boolean;
  sort_order: number;
};

export async function fetchStoredMarkets(): Promise<StoredMarket[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_markets")
    .select("market_key, label, template_id, is_custom, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchStoredMarkets error:", error);
    return [];
  }
  return data ?? [];
}

export async function upsertStoredMarket(
  market: Omit<StoredMarket, "sort_order"> & { sort_order?: number }
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("analytics")
    .from("pm_markets")
    .upsert(
      {
        market_key: market.market_key,
        label: market.label,
        template_id: market.template_id,
        is_custom: market.is_custom,
        sort_order: market.sort_order ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "market_key" }
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
    .eq("market_key", marketKey);

  if (error) {
    console.error("deleteStoredMarket error:", error);
    return false;
  }
  return true;
}
