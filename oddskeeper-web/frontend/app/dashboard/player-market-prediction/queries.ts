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
  metricKey: string; // key in player_metric_leaderboard_current
  logField: string;  // field in player_match_log_v1
  includeGk: boolean; // false ise kaleciler listede gosterilmez
};

// ─── Market definitions ───────────────────────────────────────────────────────

export const MARKET_OPTIONS: MarketOption[] = [
  { key: "shots_on_target", label: "Shots on Target",   metricKey: "shots_on_target_total",  logField: "shots_on_target",  includeGk: false },
  { key: "attempts_ibox",   label: "Attempts In Box",   metricKey: "attempts_ibox_total",    logField: "shots_on_target",  includeGk: false },
  { key: "attempts_obox",   label: "Attempts Out Box",  metricKey: "attempts_obox_total",    logField: "shots_off_target", includeGk: false },
  { key: "passes",          label: "Passes",            metricKey: "passes_total",           logField: "passes",           includeGk: true },
  { key: "accurate_passes", label: "Accurate Passes",   metricKey: "accurate_pass_total",    logField: "accurate_pass",    includeGk: true },
  { key: "tackles",         label: "Tackles",           metricKey: "tackles_total",          logField: "tackles",          includeGk: false },
  { key: "fouls",           label: "Fouls",             metricKey: "fouls_conceded_total",   logField: "fouls_conceded",   includeGk: false },
  { key: "yellow_cards",    label: "Yellow Cards",      metricKey: "cards_yellow_total",     logField: "cards_yellow",     includeGk: true },
  { key: "offsides",        label: "Offsides",          metricKey: "offsides_total",         logField: "offsides",         includeGk: false },
  { key: "saves",           label: "Saves",             metricKey: "saves_total_total",      logField: "saves_total",      includeGk: true },
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
        [row.first_name, row.last_name].filter(Boolean).join(" ") ||
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
  if (playerSourceIds.length === 0) return {};
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_match_log_v1")
    .select(
      "player_source_id, match_datetime, shots_on_target, shots_off_target, shots_blocked, passes, accurate_pass, tackles, fouls_conceded, cards_yellow, offsides, saves_total, expected_goals"
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
      const val = (row as Record<string, unknown>)[logField];
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

// ─── Fetch player metric stats (season avg + last5) ──────────────────────────

export async function fetchPlayerMetricStats(
  playerSourceIds: string[],
  metricKey: string,
  seasonLabel = "2025/2026"
): Promise<Record<string, PlayerMetricStat>> {
  if (playerSourceIds.length === 0) return {};
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
