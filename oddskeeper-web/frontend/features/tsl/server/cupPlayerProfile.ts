import { createClient } from "../../../lib/supabase/server";
import type {
  Tff1MatchLogRow,
  Tff1PlayerRow,
  Tff1TeamRow,
} from "../../tff1/types";

// Avrupa kupasi oyuncu profili veri yukleyicileri. Kupa sezon/mac-logu view'lari
// tff1 klonu (birebir ayni kolonlar) oldugundan Tff1* tipleri yeniden kullanilir
// ve Tff1PlayerShowcase kupa verisiyle beslenebilir. Kimlik = SofaScore player_id;
// bio (foto/boy/uyruk) paylasilan tff1_player_info_v1'den gelir (kupa oyunculari
// da orada). Piyasa degeri kupada YOK.

const PAGE_SIZE = 1000; // PostgREST tek istekte en fazla 1000 satir

// {prefix}_player_season_stats_v1 (ucl/uel/uecl) tum satirlari (radar lig havuzu
// icin tum oyuncular gerekir; sayfa tek oyuncuyu client-side suzer).
export async function getCupPlayerSeasonStats(
  prefix: string
): Promise<Tff1PlayerRow[]> {
  const supabase = await createClient();
  const rows: Tff1PlayerRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from(`${prefix}_player_season_stats_v1`)
      .select("*")
      .order("minutes", { ascending: false })
      .order("player_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .returns<Tff1PlayerRow[]>();
    if (error) {
      console.error("getCupPlayerSeasonStats error:", error.message);
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

// {prefix}_team_season_stats_v1 — squadRole icin takimin oynadigi mac sayisi (played).
export async function getCupTeamSeasonStats(
  prefix: string
): Promise<Tff1TeamRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from(`${prefix}_team_season_stats_v1`)
    .select("*")
    .limit(200)
    .returns<Tff1TeamRow[]>();
  if (error) {
    console.error("getCupTeamSeasonStats error:", error.message);
    return [];
  }
  return data ?? [];
}

// Oyuncunun bu kupadaki mac-bazli logu. eurocup_player_match_log_v1 uc kupayi
// kapsar -> competition ile ayirt edilir.
export async function getCupPlayerMatchLog(
  playerId: string,
  competition: string
): Promise<Tff1MatchLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("eurocup_player_match_log_v1")
    .select("*")
    .eq("player_id", playerId)
    .eq("competition", competition)
    .order("match_datetime", { ascending: false })
    .limit(300)
    .returns<Tff1MatchLogRow[]>();
  if (error) {
    console.error("getCupPlayerMatchLog error:", error.message);
    return [];
  }
  return data ?? [];
}
