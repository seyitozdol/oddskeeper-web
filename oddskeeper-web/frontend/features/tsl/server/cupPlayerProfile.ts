import { createClient } from "../../../lib/supabase/server";
import type {
  Tff1MatchLogRow,
  Tff1MatchRow,
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

// Capraz-lig profil baglantilari (basketbol toggle deseni). Ayni oyuncunun
// bulundugu ligler: 3 kupa (sofascore player_id) + Super Lig (sofascore->football
// koprusu). current=bulunulan sayfa. Tek link varsa toggle gizlenir.
export type CupCrossLink = {
  key: string;
  nameKey: string; // i18n anahtari (EN/TR lokalize)
  logo: string;
  invert: boolean; // koyu modda logo beyaza cevrilsin (kupa logolari koyu)
  href: string;
  current: boolean;
};

const CUP_LINKS = [
  { key: "ucl", view: "ucl_player_season_stats_v1", nameKey: "tsl.uclName", logo: "/images/leagues/ucl.png", base: "/dashboard/euro-cups/cl/player" },
  { key: "uel", view: "uel_player_season_stats_v1", nameKey: "tsl.uelName", logo: "/images/leagues/uel.png", base: "/dashboard/euro-cups/el/player" },
  { key: "uecl", view: "uecl_player_season_stats_v1", nameKey: "tsl.ueclName", logo: "/images/leagues/uecl.png", base: "/dashboard/euro-cups/conf/player" },
];

export async function getCupPlayerCrossLinks(
  sofascoreId: string,
  currentKey: string
): Promise<CupCrossLink[]> {
  const supabase = await createClient();
  const links: CupCrossLink[] = [];
  for (const cup of CUP_LINKS) {
    if (cup.key !== currentKey) {
      const { data } = await supabase
        .schema("analytics")
        .from(cup.view)
        .select("player_id")
        .eq("player_id", sofascoreId)
        .limit(1);
      if (!data || data.length === 0) continue;
    }
    links.push({
      key: cup.key,
      nameKey: cup.nameKey,
      logo: cup.logo,
      invert: true,
      href: `${cup.base}/${encodeURIComponent(sofascoreId)}`,
      current: cup.key === currentKey,
    });
  }
  // Super Lig (football) profili varsa
  const { data: fb } = await supabase
    .schema("analytics")
    .from("sofascore_football_player_link_v1")
    .select("player_slug")
    .eq("sofascore_player_id", sofascoreId)
    .limit(1);
  if (fb && fb.length > 0 && fb[0].player_slug) {
    links.push({
      key: "tsl",
      nameKey: "tsl.leagueName",
      logo: "/images/leagues/super-lig.png",
      invert: false,
      href: `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(
        fb[0].player_slug as string
      )}`,
      current: false,
    });
  }
  return links;
}

// Bir kupanin tum maclari (takim profili Results/form icin). eurocup_stage_
// matches_v1 uc kupayi kapsar -> competition ile suzulur. Tff1MatchRow uyumlu.
export async function getCupMatches(
  competition: string
): Promise<Tff1MatchRow[]> {
  const supabase = await createClient();
  const rows: Tff1MatchRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("eurocup_stage_matches_v1")
      .select("*")
      .eq("competition", competition)
      .order("match_datetime", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
      .returns<Tff1MatchRow[]>();
    if (error) {
      console.error("getCupMatches error:", error.message);
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

// Takim capraz-lig baglantilari (oyuncudaki getCupPlayerCrossLinks'in takim surumu):
// 3 kupa (sofascore team_id) + Super Lig (sofascore_football_team_link_v1 -> slug).
export async function getCupTeamCrossLinks(
  sofascoreTeamId: string,
  currentKey: string
): Promise<CupCrossLink[]> {
  const supabase = await createClient();
  const links: CupCrossLink[] = [];
  const cups = [
    { key: "ucl", view: "ucl_team_season_stats_v1", nameKey: "tsl.uclName", logo: "/images/leagues/ucl.png", base: "/dashboard/euro-cups/cl/team" },
    { key: "uel", view: "uel_team_season_stats_v1", nameKey: "tsl.uelName", logo: "/images/leagues/uel.png", base: "/dashboard/euro-cups/el/team" },
    { key: "uecl", view: "uecl_team_season_stats_v1", nameKey: "tsl.ueclName", logo: "/images/leagues/uecl.png", base: "/dashboard/euro-cups/conf/team" },
  ];
  for (const cup of cups) {
    if (cup.key !== currentKey) {
      const { data } = await supabase
        .schema("analytics")
        .from(cup.view)
        .select("team_id")
        .eq("team_id", sofascoreTeamId)
        .limit(1);
      if (!data || data.length === 0) continue;
    }
    links.push({
      key: cup.key,
      nameKey: cup.nameKey,
      logo: cup.logo,
      invert: true,
      href: `${cup.base}/${encodeURIComponent(sofascoreTeamId)}`,
      current: cup.key === currentKey,
    });
  }
  const { data: fb } = await supabase
    .schema("analytics")
    .from("sofascore_football_team_link_v1")
    .select("team_slug")
    .eq("sofascore_team_id", sofascoreTeamId)
    .limit(1);
  if (fb && fb.length > 0 && fb[0].team_slug) {
    links.push({
      key: "tsl",
      nameKey: "tsl.leagueName",
      logo: "/images/leagues/super-lig.png",
      invert: false,
      href: `/dashboard/stats-analysis/football/team-stats/detail?team=${encodeURIComponent(
        fb[0].team_slug as string
      )}`,
      current: false,
    });
  }
  return links;
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
