"use client";

import { createClient } from "@/lib/supabase/client";
import type { BktPlayerLogRow, BktPlayerSeasonRow } from "./types";

// Oyuncu seçilince maç geçmişini çek (drawer için tam log).
export async function fetchBasketballPlayerLog(playerSlug: string, limit = 60): Promise<BktPlayerLogRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_match_log_v1")
    .select("*")
    .eq("season_label", "2025-2026")
    .eq("player_slug", playerSlug)
    .order("match_date", { ascending: false })
    .limit(limit)
    .returns<BktPlayerLogRow[]>();
  if (error) {
    console.error("fetchBasketballPlayerLog error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function fetchBasketballPlayerSeason(playerSlug: string): Promise<BktPlayerSeasonRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_season_stats_v1")
    .select("*")
    .eq("season_label", "2025-2026")
    .eq("player_slug", playerSlug)
    .maybeSingle<BktPlayerSeasonRow>();
  if (error) {
    console.error("fetchBasketballPlayerSeason error:", error.message);
    return null;
  }
  return data ?? null;
}
