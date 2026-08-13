import { getPlayerDetailHref, getTeamDetailHref } from "@/lib/routes";
import { RESMI_SECTIONS, CUP_SECTIONS, type ResmiSection } from "./constants";

// Resmi deneyimini besleyen lig yapilandirmasi. TSL tsl_ss_* (opta-keyed)
// kaynaktan; 1. Lig tff1_* (sofascore-keyed); Kupa cup_* (mackolik, uuid=opta).
export type LeagueSource = "tsl" | "tff1" | "cup";

export type LeagueConfig = {
  source: LeagueSource;
  competition: string;
  seasons: string[]; // güncel önce
  defaultSeason: string;
  basePath: string; // resmi deneyim kök yolu
  matchBase: string; // maç detay kök yolu (/{matchId})
  logo: string; // public/images/leagues/*.png
  nameKey: string; // i18n lig adı anahtarı
  transfersLeague: string | null; // tsl_transfers.season_label yok; league yok -> tsl only
  sections: readonly ResmiSection[]; // gösterilecek sekmeler (sırayla)
  defaultSection: ResmiSection; // section paramı yoksa/lig amblemi linki
};

const SEASONS = ["2026/2027", "2025/2026", "2024/2025"];

export const TSL_LEAGUE: LeagueConfig = {
  source: "tsl",
  competition: "Süper Lig",
  seasons: SEASONS,
  defaultSeason: "2026/2027",
  basePath: "/dashboard/stats-analysis/tsl/resmi",
  matchBase: "/dashboard/stats-analysis/tsl/match",
  logo: "/images/leagues/super-lig.png",
  nameKey: "tsl.leagueName",
  transfersLeague: "tsl",
  sections: RESMI_SECTIONS,
  defaultSection: "league",
};

export const TFF1_LEAGUE: LeagueConfig = {
  source: "tff1",
  competition: "Trendyol 1. Lig",
  seasons: SEASONS,
  defaultSeason: "2026/2027",
  basePath: "/dashboard/stats-analysis/tff1/resmi",
  matchBase: "/dashboard/tff-1-lig/match",
  logo: "/images/leagues/tff-1-lig.png",
  nameKey: "tsl.firstLigName",
  transfersLeague: null,
  sections: RESMI_SECTIONS,
  defaultSection: "league",
};

// Türkiye Kupası — cup_* view'ları, sadece verimiz olan 2 sezon.
export const CUP_LEAGUE: LeagueConfig = {
  source: "cup",
  competition: "Türkiye Kupası",
  seasons: ["2025/2026", "2024/2025"],
  defaultSeason: "2025/2026",
  basePath: "/dashboard/cup",
  matchBase: "/dashboard/cup/match",
  logo: "/images/leagues/turkiye-kupasi.png",
  nameKey: "tsl.cupLeagueName",
  transfersLeague: null,
  sections: CUP_SECTIONS,
  defaultSection: "cupStages",
};

// Takım detay linki (lig kaynağına göre).
export function teamHrefFor(
  config: LeagueConfig,
  teamId: string,
  teamSlug: string | null,
  season?: string
): string | null {
  // tff1: sofascore takım id'li mevcut sayfa.
  if (config.source === "tff1") {
    const s = season ? `?season=${encodeURIComponent(season)}` : "";
    return `/dashboard/tff-1-lig/team/${encodeURIComponent(teamId)}${s}`;
  }
  // cup: eşleşen (slug var) football profiline; eşleşmeyen kupa takım profiline.
  if (config.source === "cup") {
    if (teamSlug) return getTeamDetailHref(teamSlug);
    return `/dashboard/cup/team/${encodeURIComponent(teamId)}`;
  }
  return getTeamDetailHref(teamSlug);
}

// Oyuncu detay linki.
export function playerHrefFor(
  config: LeagueConfig,
  playerId: string,
  playerSlug: string | null
): string | null {
  if (config.source === "tff1") return `/dashboard/tff-1-lig/player/${encodeURIComponent(playerId)}`;
  // cup: eşleşen (slug var) football profiline; eşleşmeyen kupa oyuncu profiline.
  if (config.source === "cup") {
    if (playerSlug) return getPlayerDetailHref(playerSlug);
    return `/dashboard/cup/player/${encodeURIComponent(playerId)}`;
  }
  return getPlayerDetailHref(playerSlug);
}

// Maç detay linki.
export function matchHrefFor(
  config: LeagueConfig,
  matchId: string,
  returnTo?: string
): string {
  const q = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  return `${config.matchBase}/${encodeURIComponent(matchId)}${q}`;
}
