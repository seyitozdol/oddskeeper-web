import { cache } from "react";
import { createClient } from "../../../lib/supabase/server";

type PlayerSlugDbRow = {
  player_source_id: string;
  player_slug: string;
};

// player_source_id -> player_slug haritası. tsl_ss_* SofaScore
// view'ları player_slug taşımaz (NULL); site linkleri slug uzayında
// çalıştığından slug bu haritayla doldurulur. İstek başına cache'lenir.
// Kaynak player_profile_bridged_v1: Opta profilleri + Opta karşılığı
// olmayan oyuncular için SofaScore'dan türetilen profiller
// (sql/2026-08-15_player_profile_sofascore_bridge.sql). Yine de haritada
// olmayan biri çıkarsa null kalır ve link düz metne düşer.
// team_slug filtresi: bu harita yalnız Türk ligi yüzeylerinde kullanılır;
// kupa-only yabancılar (team_slug NULL, ~9k satır) dışarıda kalır ki
// harita küçük kalsın. Sayfalama şart: PostgREST tek istekte 1000 satır
// döndürür, filtresiz/sayfasız hali sessizce kırpılıyordu.
export const getPlayerSlugMap = cache(
  async (): Promise<Record<string, string>> => {
    const supabase = await createClient();
    const map: Record<string, string> = {};

    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .schema("analytics")
        .from("player_profile_bridged_v1")
        .select("player_source_id, player_slug")
        .not("team_slug", "is", null)
        .order("player_slug", { ascending: true })
        .range(from, from + 999)
        .returns<PlayerSlugDbRow[]>();

      if (error) {
        console.error("player slug map fetch error:", {
          message: error.message,
          code: error.code,
        });
        return map;
      }

      for (const row of data ?? []) {
        if (row.player_source_id && row.player_slug) {
          map[String(row.player_source_id)] = row.player_slug;
        }
      }
      if (!data || data.length < 1000) break;
    }
    return map;
  }
);
