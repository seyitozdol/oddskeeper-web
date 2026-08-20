import { createClient } from "../../../lib/supabase/server";
import type {
  Tff1MatchRow,
  Tff1PlayerRow,
  Tff1TeamRow,
} from "../../tff1/types";

// Avrupa kupasi veri yukleyicileri (birlesik takim profili + kupa listeleri).
// Kupa sezon view'lari tff1 klonu (birebir ayni kolonlar) oldugundan Tff1*
// tipleri yeniden kullanilir. Kimlik = SofaScore id; oyuncu LINKLERI tek
// football profiline gider (getFootballSlugsByIds / sofascore_football_player_link_v1).

const PAGE_SIZE = 1000; // PostgREST tek istekte en fazla 1000 satir

// {prefix}_player_season_stats_v1 (ucl/uel/uecl) satirlari. teamId verilirse
// suzme DB'de yapilir (takim profili ~30-100 satir ceker; 3.5k satirlik kupa
// havuzunu tasima anti-deseni C-1 kapsaminda kaldirildi). teamId'siz cagri
// eski davranis (tum kupa, sayfali).
export async function getCupPlayerSeasonStats(
  prefix: string,
  teamId?: string
): Promise<Tff1PlayerRow[]> {
  const supabase = await createClient();
  const rows: Tff1PlayerRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .schema("analytics")
      .from(`${prefix}_player_season_stats_v1`)
      .select("*")
      .order("minutes", { ascending: false })
      .order("player_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (teamId) query = query.eq("team_id", teamId);
    const { data, error } = await query.returns<Tff1PlayerRow[]>();
    if (error) {
      console.error("getCupPlayerSeasonStats error:", error.message);
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

// {prefix}_team_season_stats_v1 — takim profili baglamlari + sezon sirasi/radar
// kiyasi icin TUM takim-sezon satirlari. Sayfali cekilir: eleme turlu kupalarda
// (ozellikle uecl) satir sayisi sabit limitleri asar (2026-08-20: uecl 299 satir,
// eski limit(200) FC Sion'u kirpip takim sayfasini 404'a dusuruyordu).
export async function getCupTeamSeasonStats(
  prefix: string
): Promise<Tff1TeamRow[]> {
  const supabase = await createClient();
  const rows: Tff1TeamRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from(`${prefix}_team_season_stats_v1`)
      .select("*")
      .order("season_label", { ascending: false })
      .order("team_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .returns<Tff1TeamRow[]>();
    if (error) {
      console.error("getCupTeamSeasonStats error:", error.message);
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

// Tek-profil birlestirme (Faz 3): oyuncu capraz-lig toggle'i ve ayri kupa oyuncu
// profili KALDIRILDI — her oyuncu linki slug-keyed football profiline gider.
// Sofascore id -> slug cozumu icin toplu yardimci (mac detayi oyuncu tablolari).
export async function getFootballSlugsByIds(
  sofascoreIds: string[]
): Promise<Record<string, string>> {
  const ids = Array.from(new Set(sofascoreIds.filter(Boolean)));
  const out: Record<string, string> = {};
  if (!ids.length) return out;
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("sofascore_football_player_link_v1")
    .select("sofascore_player_id, player_slug")
    .in("sofascore_player_id", ids);
  if (error) {
    console.error("getFootballSlugsByIds error:", error.message);
    return out;
  }
  for (const r of data ?? [])
    if (r.player_slug) out[String(r.sofascore_player_id)] = String(r.player_slug);
  return out;
}

// Kupa maclari (birlesik takim profili Results/form icin). eurocup_stage_
// matches_v1 uc kupayi kapsar; competition verilirse suzulur, verilmezse
// TUM kupalar doner (satirlar competition kolonuyla etiketli). Tff1MatchRow uyumlu.
// teamId verilirse yalniz o takimin (ev VEYA deplasman) maclari DB'de suzulur.
export async function getCupMatches(
  competition?: string,
  teamId?: string
): Promise<Tff1MatchRow[]> {
  // .or() filtre dizisine ham gomuldugu icin id'yi beyaz-listeyle dogrula
  // (SofaScore takim id'leri sayisal; route paramindan gelir).
  if (teamId && !/^[\w-]+$/.test(teamId)) return [];
  const supabase = await createClient();
  const rows: Tff1MatchRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .schema("analytics")
      .from("eurocup_stage_matches_v1")
      .select("*")
      .order("match_datetime", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (competition) query = query.eq("competition", competition);
    if (teamId)
      query = query.or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
    const { data, error } = await query.returns<Tff1MatchRow[]>();
    if (error) {
      console.error("getCupMatches error:", error.message);
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
