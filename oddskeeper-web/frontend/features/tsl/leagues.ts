import { getPlayerDetailHref, getTeamDetailHref } from "@/lib/routes";

// Resmi deneyimini besleyen lig yapilandirmasi. TSL tsl_ss_* (opta-keyed)
// kaynaktan; 1. Lig tff1_* (sofascore-keyed) kaynaktan beslenir.
export type LeagueSource = "tsl" | "tff1";

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
};

// Takım detay linki (lig kaynağına göre).
export function teamHrefFor(
  config: LeagueConfig,
  teamId: string,
  teamSlug: string | null,
  season?: string
): string | null {
  if (config.source === "tsl") return getTeamDetailHref(teamSlug);
  // tff1: sofascore takım id'li mevcut sayfa
  const s = season ? `?season=${encodeURIComponent(season)}` : "";
  return `/dashboard/tff-1-lig/team/${encodeURIComponent(teamId)}${s}`;
}

// Oyuncu detay linki.
export function playerHrefFor(
  config: LeagueConfig,
  playerId: string,
  playerSlug: string | null
): string | null {
  if (config.source === "tsl") return getPlayerDetailHref(playerSlug);
  return `/dashboard/tff-1-lig/player/${encodeURIComponent(playerId)}`;
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
