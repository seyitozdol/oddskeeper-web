"use client";

import { createClient } from "@/lib/supabase/client";
import { knownDisplayName } from "@/lib/player-name";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { pmWrite } from "@/lib/pm-write-client";
import { type StatusConfig, DEFAULT_STATUS_CONFIG } from "./compute";

export type { StatusConfig };

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
  // key in player_metric_leaderboard_current; "" = istatistik yok;
  // "log:<kolon>" = sezon ortalamasi player_log_season_avg_v1'den (leaderboard'da
  // karsiligi olmayan metrikler icin, or. shots_off_target)
  // "shots:<kolon>" = SofaScore shotmap turevleri (player_shot_zones_*_v1,
  // opta_player_id koprusuyle; or. sot_ibox / sot_obox)
  metricKey: string;
  logField: string;  // field in player_match_log_v1 ("" = istatistik yok)
  includeGk: boolean; // false ise kaleciler listede gosterilmez
};

// ─── Market definitions ───────────────────────────────────────────────────────
// metricKey/logField bos olan marketlerin verisi yok; secilince Ort. kolonlari
// bos gelir, manuel beklentiyle calisilir. "shots_derived" ozel alan:
// on target + off target + blocked toplami (tek kolon yok).

export const MARKET_OPTIONS: MarketOption[] = [
  { key: "shots_on_target", label: "Shots on Target",   metricKey: "shots_on_target_total",  logField: "shots_on_target",  includeGk: false },
  { key: "shots_off_target", label: "Shots Off Target", metricKey: "log:shots_off_target",   logField: "shots_off_target", includeGk: false },
  { key: "blocked_shots",   label: "Blocked Shots",     metricKey: "log:shots_blocked",      logField: "shots_blocked",    includeGk: false },
  { key: "total_shots",     label: "Total Shots",       metricKey: "shots_total",            logField: "shots_derived",    includeGk: false },
  { key: "attempts_ibox",   label: "Attempts In Box",   metricKey: "attempts_ibox_total",    logField: "shots_on_target",  includeGk: false },
  { key: "attempts_obox",   label: "Attempts Out Box",  metricKey: "attempts_obox_total",    logField: "shots_off_target", includeGk: false },
  { key: "sot_ibox",        label: "SOT In Box",        metricKey: "shots:sot_ibox",         logField: "shots:sot_ibox",   includeGk: false },
  { key: "sot_obox",        label: "SOT Out Box",       metricKey: "shots:sot_obox",         logField: "shots:sot_obox",   includeGk: false },
  { key: "xg",              label: "xG",                metricKey: "expected_goals_total",   logField: "expected_goals",   includeGk: false },
  { key: "fouls_suffered",  label: "Fouls Suffered",    metricKey: "fouls_won_total",        logField: "fouls_won",        includeGk: false },
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

export async function fetchAllCurrentPlayers(): Promise<DirectoryPlayer[]> {
  const supabase = createClient();

  const data = await fetchAllPaged<{
    player_slug: string | null;
    player_name: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    current_team_slug: string | null;
    current_team_name: string | null;
    nationality: string | null;
    position: string | null;
  }>((from, to) =>
    supabase
      .schema("analytics")
      .from("player_current_info_v1")
      .select(
        "player_slug, player_name, full_name, first_name, last_name, current_team_slug, current_team_name, nationality, position"
      )
      .order("current_team_name", { ascending: true })
      .order("player_name", { ascending: true })
      .order("player_slug", { ascending: true })
      .range(from, to)
  );

  // Slug bazinda mukerrer satirlar olabiliyor; ilkini al.
  const seen = new Set<string>();
  const result: DirectoryPlayer[] = [];
  for (const row of data) {
    const slug = row.player_slug;
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    result.push({
      player_slug: slug,
      full_name:
        knownDisplayName(row.player_name, row.first_name) ||
        row.full_name ||
        row.player_name ||
        slug,
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
    // football.fixtures artik TFF 1. Lig fiksturlerini de iceriyor; sizmasin
    .eq("competition", "Süper Lig")
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

  // Shotmap turevleri: son 5 mac player_shot_zones_match_v1'den (appearance
  // tabanli, sut atmayan maclar 0 satiri olarak var -> ortalama dogru).
  if (logField.startsWith("shots:")) {
    const field = logField.slice(6);
    const { data, error } = await supabase
      .schema("analytics")
      .from("player_shot_zones_match_v1")
      .select(`opta_player_id, match_datetime, ${field}`)
      .eq("season_label", seasonLabel)
      .in("opta_player_id", playerSourceIds)
      .order("match_datetime", { ascending: false })
      .limit(Math.min(playerSourceIds.length * 5 * 2, 1000));

    if (error) {
      console.error("fetchPlayerLast5Avg (shots) error:", error);
      return {};
    }

    const grouped: Record<string, number[]> = {};
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const id = String(row.opta_player_id);
      if (!grouped[id]) grouped[id] = [];
      if (grouped[id].length < 5) {
        const val = row[field];
        const num = val !== null && val !== undefined ? Number(val) : null;
        if (num !== null && !isNaN(num)) grouped[id].push(num);
      }
    }
    const shotResult: Record<string, number | null> = {};
    for (const id of playerSourceIds) {
      const vals = grouped[id] ?? [];
      shotResult[id] = vals.length
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : null;
    }
    return shotResult;
  }

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_match_log_v1")
    .select(
      "player_source_id, match_datetime, shots_on_target, shots_off_target, shots_blocked, passes, accurate_pass, tackles, fouls_conceded, fouls_won, cards_yellow, cards_red, offsides, saves_total, goals, assists, expected_goals"
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

// ─── Yurt disi gecmis sezon fallback'i ───────────────────────────────────────
// Yeni transferlerin (Greenwood, Salah vb) TSL/1.Lig verisi yok; LY ortalamasi
// analytics.player_foreign_season_v1'den (SofaScore yurt disi sezon toplamlari,
// player_key ile) doldurulur. Yalniz birincil kaynakta BOS kalan oyuncular icin.
export const FOREIGN_METRIC_COLS: Record<string, string> = {
  shots_on_target_total: "shots_on_target",
  "log:shots_off_target": "shots_off_target",
  "log:shots_blocked": "shots_blocked",
  shots_total: "shots_total",
  attempts_ibox_total: "attempts_ibox",
  attempts_obox_total: "attempts_obox",
  expected_goals_total: "expected_goals",
  fouls_won_total: "fouls_won",
  passes_total: "passes",
  accurate_pass_total: "accurate_pass",
  tackles_total: "tackles",
  fouls_conceded_total: "fouls_conceded",
  cards_yellow_total: "cards_yellow",
  cards_red_total: "cards_red",
  offsides_total: "offsides",
  saves_total_total: "saves_total",
  goals_total: "goals",
  assists_total: "assists",
};

async function fillForeignSeasonAvg(
  result: Record<string, PlayerMetricStat>,
  playerSourceIds: string[],
  metricKey: string,
  seasonLabel: string
): Promise<void> {
  const col = FOREIGN_METRIC_COLS[metricKey];
  if (!col) return;
  const missing = playerSourceIds.filter(
    (id) => result[id]?.per_match_value == null
  );
  if (missing.length === 0) return;
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("player_foreign_season_v1")
    .select(`player_key, ${col}`)
    .eq("season_label", seasonLabel)
    .in("player_key", missing);
  if (error) {
    console.error("fillForeignSeasonAvg error:", error);
    return;
  }
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const id = String(row.player_key);
    const val = row[col];
    if (val == null) continue;
    result[id] = {
      player_source_id: id,
      per_match_value: Number(val),
      last5_value: result[id]?.last5_value ?? null,
    };
  }
}

// ─── Fetch player metric stats (season avg + last5) ──────────────────────────
// metricKey "log:<kolon>" ise sezon ortalamasi leaderboard yerine
// player_log_season_avg_v1'den okunur (leaderboard'da olmayan metrikler).

// Opta'nin uretmedigi guncel sezon(lar): Avg + appearances SofaScore koprusunden
// (analytics.psm_*_bridge_v1) okunur. Opta job'i 2026-07-19'da durdu; 26/27 verisi
// yalniz tsl_ss zincirinde. Bkz. sql/2026-08-15_psm_season_avg_bridge.sql.
// YENI SEZON: bir sonraki sezon acilinca hem bu kume hem bridge view'lari genisletilir.
export const PSM_BRIDGED_SEASONS = new Set(["2026/2027"]);

export async function fetchPlayerMetricStats(
  playerSourceIds: string[],
  metricKey: string,
  seasonLabel = "2025/2026"
): Promise<Record<string, PlayerMetricStat>> {
  if (playerSourceIds.length === 0 || !metricKey) return {};
  const supabase = createClient();

  // Koprulu sezon: tum market tipleri (duz / log: / shots:) tek view'dan, PSM
  // metricKey'i aynen metric_key olarak saklandigi icin uniform sorgu.
  if (PSM_BRIDGED_SEASONS.has(seasonLabel)) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("psm_player_season_avg_bridge_v1")
      .select("player_source_id, per_match_value")
      .eq("season_label", seasonLabel)
      .eq("metric_key", metricKey)
      .in("player_source_id", playerSourceIds);

    if (error) {
      console.error("fetchPlayerMetricStats (bridge) error:", error);
      return {};
    }
    const bridgeResult: Record<string, PlayerMetricStat> = {};
    for (const row of data ?? []) {
      const id = String(row.player_source_id);
      bridgeResult[id] = {
        player_source_id: id,
        per_match_value:
          row.per_match_value !== null && row.per_match_value !== undefined
            ? Number(row.per_match_value)
            : null,
        last5_value: null,
      };
    }
    await fillForeignSeasonAvg(bridgeResult, playerSourceIds, metricKey, seasonLabel);
    return bridgeResult;
  }

  // Shotmap turevleri: sezon ortalamasi player_shot_zones_season_v1'den
  // (appearance tabanli; sut atilmayan maclar 0 sayilir). TSL oyuncu id'si
  // opta uzayinda -> view'daki opta_player_id koprusuyle eslenir.
  if (metricKey.startsWith("shots:")) {
    const field = metricKey.slice(6);
    const { data, error } = await supabase
      .schema("analytics")
      .from("player_shot_zones_season_v1")
      .select(`opta_player_id, ${field}`)
      .eq("season_label", seasonLabel)
      .in("opta_player_id", playerSourceIds);

    if (error) {
      console.error("fetchPlayerMetricStats (shots avg) error:", error);
      return {};
    }

    const shotResult: Record<string, PlayerMetricStat> = {};
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const id = String(row.opta_player_id);
      const val = row[field];
      shotResult[id] = {
        player_source_id: id,
        per_match_value: val !== null && val !== undefined ? Number(val) : null,
        last5_value: null,
      };
    }
    await fillForeignSeasonAvg(shotResult, playerSourceIds, metricKey, seasonLabel);
    return shotResult;
  }

  if (metricKey.startsWith("log:")) {
    const field = metricKey.slice(4);
    const { data, error } = await supabase
      .schema("analytics")
      .from("player_log_season_avg_v1")
      .select(`player_source_id, ${field}`)
      .eq("season_label", seasonLabel)
      .in("player_source_id", playerSourceIds);

    if (error) {
      console.error("fetchPlayerMetricStats (log avg) error:", error);
      return {};
    }

    const logResult: Record<string, PlayerMetricStat> = {};
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const id = String(row.player_source_id);
      const val = row[field];
      logResult[id] = {
        player_source_id: id,
        per_match_value: val !== null && val !== undefined ? Number(val) : null,
        last5_value: null,
      };
    }
    await fillForeignSeasonAvg(logResult, playerSourceIds, metricKey, seasonLabel);
    return logResult;
  }

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
  await fillForeignSeasonAvg(result, playerSourceIds, metricKey, seasonLabel);
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

  // Koprulu sezon: mac sayisi da SofaScore koprusunden (Opta profil view'i 26/27 bos).
  const table = PSM_BRIDGED_SEASONS.has(seasonLabel)
    ? "psm_player_appearances_bridge_v1"
    : "player_profile_v1";

  const { data, error } = await supabase
    .schema("analytics")
    .from(table)
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
    .select("player_slug, external_id")
    .eq("league", "tsl");

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
  return pmWrite("/api/player-market/write", {
    league: "tsl",
    action: "savePlayerIds",
    payload: { entries },
  });
}

// ─── Fixture ID inputs (analytics.pm_fixture_inputs) ─────────────────────────
// Fixture ID sekmesindeki mac basina girilen deger; Model'deki Ekle akisi
// ileride bu kayitlari kullanacak.

export async function fetchFixtureInputs(): Promise<Record<number, string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_fixture_inputs")
    .select("fixture_id, input_value")
    .eq("league", "tsl");

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
    .eq("league", "tsl")
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
  return pmWrite("/api/player-market/write", {
    league: "tsl",
    action: "saveFixtureInputs",
    payload: { entries },
  });
}

// ─── Market store (analytics.pm_markets) ─────────────────────────────────────
// Yeni butonuyla eklenen ozel marketler (is_custom=true) + yerlesik marketlerin
// Market Template ID kayitlari (is_custom=false).

export type MarketType = "static" | "dynamic";

export type StoredMarket = {
  market_key: string;
  label: string;
  template_id: string | null;
  is_custom: boolean;
  sort_order: number;
  market_type: MarketType;
  // Market Listesi'ndeki tik: false ise Model ekranindaki market dropdown'da
  // gizlenir. Kayitli satiri olmayan yerlesik marketler varsayilan olarak dahil.
  in_model: boolean;
};

export async function fetchStoredMarkets(): Promise<StoredMarket[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_markets")
    .select("market_key, label, template_id, is_custom, sort_order, market_type, in_model")
    .eq("league", "tsl")
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
  return pmWrite("/api/player-market/write", {
    league: "tsl",
    action: "upsertMarket",
    payload: {
      market: {
        market_key: market.market_key,
        label: market.label,
        template_id: market.template_id,
        is_custom: market.is_custom,
        sort_order: market.sort_order ?? 0,
        market_type: market.market_type,
        in_model: market.in_model ?? true,
      },
    },
  });
}

export async function deleteStoredMarket(marketKey: string): Promise<boolean> {
  return pmWrite("/api/player-market/write", {
    league: "tsl",
    action: "deleteMarket",
    payload: { market_key: marketKey },
  });
}

// ─── Model config (analytics.pm_model_config) ────────────────────────────────
// Dagitim agirliklari: beklenti, oyuncu LY Avg / Last 5 / Avg metriklerinin
// yuzde-agirlikli karisimina orantili bolunur. Sezon basinda LY=100 verilir.

export type DistWeights = { ly: number; last5: number; avg: number };
// Tablo/veri yoksa duselecek varsayilan (migration seed ile ayni): LY=100.
export const DEFAULT_DIST_WEIGHTS: DistWeights = { ly: 100, last5: 0, avg: 0 };

export async function fetchDistWeights(): Promise<DistWeights> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_model_config")
    .select("config_key, config_value")
    .eq("league", "tsl");

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
  return pmWrite("/api/player-market/write", {
    league: "tsl",
    action: "saveDistWeights",
    payload: { weights: w },
  });
}

// Status kurallari (Model ekranindaki durum cikarimi esikleri).
export async function fetchStatusConfig(): Promise<StatusConfig> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_model_config")
    .select("config_key, config_value")
    .eq("league", "tsl");

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
  return pmWrite("/api/player-market/write", {
    league: "tsl",
    action: "saveStatusConfig",
    payload: { config: c },
  });
}

// ─── Oyuncu durum override'lari (pm_player_status_overrides) ─────────────────
// Model'de elle secilen Starter/Sub/Out kalicidir; loader cikarimin ustune
// bindirir. status=null gonderimi override'i siler (otomatige don).

export async function fetchStatusOverrides(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_player_status_overrides")
    .select("player_key, status")
    .eq("league", "tsl");
  if (error) {
    console.error("fetchStatusOverrides error:", error);
    return {};
  }
  const result: Record<string, string> = {};
  for (const r of data ?? []) result[r.player_key] = r.status;
  return result;
}

export async function saveStatusOverride(
  playerKey: string,
  status: string | null
): Promise<boolean> {
  return pmWrite("/api/player-market/write", {
    league: "tsl",
    action: "savePlayerStatusOverride",
    payload: { player_key: playerKey, status },
  });
}
