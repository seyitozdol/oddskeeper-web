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
};

// ─── Market definitions ───────────────────────────────────────────────────────

export const MARKET_OPTIONS: MarketOption[] = [
  { key: "shots",           label: "Shot",             metricKey: "shots_on_target_total", logField: "shots_on_target" },
  { key: "shots_total",     label: "Shots Total",      metricKey: "attempts_ibox_total",   logField: "shots_total" },
  { key: "shots_on_target", label: "Shots on Target",  metricKey: "shots_on_target_total", logField: "shots_on_target" },
  { key: "passes",          label: "Passes",           metricKey: "passes_total",          logField: "passes" },
  { key: "accurate_passes", label: "Accurate Passes",  metricKey: "accurate_pass_total",   logField: "accurate_pass" },
  { key: "tackles",         label: "Tackles",          metricKey: "tackles_total",         logField: "tackles" },
  { key: "fouls",           label: "Fouls",            metricKey: "fouls_conceded_total",  logField: "fouls_conceded" },
  { key: "yellow_cards",    label: "Yellow Cards",     metricKey: "cards_yellow_total",    logField: "cards_yellow" },
  { key: "offsides",        label: "Offsides",         metricKey: "offsides_total",        logField: "offsides" },
  { key: "saves",           label: "Saves",            metricKey: "saves_total_total",     logField: "saves_total" },
];

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

// ─── Fetch team players (active only, current season) ────────────────────────

export async function fetchTeamPlayers(
  sourceTeamId: string,
  seasonLabel = "2025/2026"
): Promise<PlayerRow[]> {
  const supabase = createClient();

  // Get active player_source_ids from dim_player
  const { data: dimData, error: dimError } = await supabase
    .schema("analytics")
    .from("dim_player")
    .select("source_player_id")
    .eq("current_source_team_id", sourceTeamId)
    .eq("is_active", true);

  if (dimError) {
    console.error("fetchTeamPlayers dim_player error:", dimError);
    return [];
  }

  const activeIds = (dimData ?? []).map((r) => r.source_player_id).filter(Boolean);
  if (activeIds.length === 0) return [];

  // Get profile data from player_profile_v1
  const { data, error } = await supabase
    .schema("analytics")
    .from("player_profile_v1")
    .select(
      "player_source_id, player_name, player_slug, primary_position_code, position_group, appearances, starts, sub_appearances, starter_rate_pct, last_match_datetime"
    )
    .eq("team_source_id", sourceTeamId)
    .eq("season_label", seasonLabel)
    .in("player_source_id", activeIds)
    .order("appearances", { ascending: false });

  if (error) {
    console.error("fetchTeamPlayers profile error:", error);
    return [];
  }

  return data ?? [];
}

// ─── Fetch last N matches per player for status inference ────────────────────

export async function fetchPlayerRecentMatches(
  playerSourceIds: string[],
  seasonLabel = "2025/2026",
  lastN = 10
): Promise<Record<string, PlayerMatchEntry[]>> {
  if (playerSourceIds.length === 0) return {};
  const supabase = createClient();

  // player_match_log_v1 uses player_source_id directly
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

  // Group by player and take last N
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
