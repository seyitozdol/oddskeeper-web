"use client";

import { createClient } from "@/lib/supabase/client";
import type { BktPlayerLogRow } from "./types";

// Oyuncu seçilince son maçlarını çek (Excel'deki oyuncu geçmiş maçları).
export async function fetchBasketballPlayerLog(playerSlug: string): Promise<BktPlayerLogRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_match_log_v1")
    .select("*")
    .eq("season_label", "2025-2026")
    .eq("player_slug", playerSlug)
    .order("match_date", { ascending: false })
    .limit(20)
    .returns<BktPlayerLogRow[]>();
  if (error) {
    console.error("fetchBasketballPlayerLog error:", error.message);
    return [];
  }
  return data ?? [];
}
