// Basketbol veri erişimi — analytics.bb_* view'ları (anon/authenticated SELECT).
// Futbol tff1 kalıbı: her fn kendi createClient()'ını açar, hata durumunda
// loglar ve boş dizi/null döner (sayfa her zaman render olsun).

import { createClient } from "@/lib/supabase/server";
import type {
  BktTeamSeasonRow,
  BktPlayerSeasonRow,
  BktLeaderboardRow,
  BktPlayerLogRow,
  BktTeamLogRow,
} from "../types";

const SEASON = "2025-2026";

export async function getBasketballStandings(): Promise<BktTeamSeasonRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_season_stats_v1")
    .select("*")
    .eq("season_label", SEASON)
    .order("standings_rank", { ascending: true })
    .returns<BktTeamSeasonRow[]>();
  if (error) {
    console.error("getBasketballStandings error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballPlayerLeaderboard(): Promise<BktLeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_leaderboard_v1")
    .select("*")
    .eq("season_label", SEASON)
    .order("ppg", { ascending: false })
    .returns<BktLeaderboardRow[]>();
  if (error) {
    console.error("getBasketballPlayerLeaderboard error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballTeam(teamSlug: string): Promise<BktTeamSeasonRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_season_stats_v1")
    .select("*")
    .eq("season_label", SEASON)
    .eq("team_slug", teamSlug)
    .maybeSingle<BktTeamSeasonRow>();
  if (error) {
    console.error("getBasketballTeam error:", error.message);
    return null;
  }
  return data ?? null;
}

export async function getBasketballTeamRoster(teamSlug: string): Promise<BktPlayerSeasonRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_season_stats_v1")
    .select("*")
    .eq("season_label", SEASON)
    .eq("team_slug", teamSlug)
    .order("ppg", { ascending: false })
    .returns<BktPlayerSeasonRow[]>();
  if (error) {
    console.error("getBasketballTeamRoster error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballTeamMatchLog(teamSlug: string): Promise<BktTeamLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_match_log_v1")
    .select("*")
    .eq("season_label", SEASON)
    .eq("team_slug", teamSlug)
    .order("match_date", { ascending: false })
    .returns<BktTeamLogRow[]>();
  if (error) {
    console.error("getBasketballTeamMatchLog error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballPlayer(playerSlug: string): Promise<BktPlayerSeasonRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_season_stats_v1")
    .select("*")
    .eq("season_label", SEASON)
    .eq("player_slug", playerSlug)
    .maybeSingle<BktPlayerSeasonRow>();
  if (error) {
    console.error("getBasketballPlayer error:", error.message);
    return null;
  }
  return data ?? null;
}

export async function getBasketballPlayerMatchLog(playerSlug: string): Promise<BktPlayerLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_match_log_v1")
    .select("*")
    .eq("season_label", SEASON)
    .eq("player_slug", playerSlug)
    .order("match_date", { ascending: false })
    .limit(300)
    .returns<BktPlayerLogRow[]>();
  if (error) {
    console.error("getBasketballPlayerMatchLog error:", error.message);
    return [];
  }
  return data ?? [];
}
