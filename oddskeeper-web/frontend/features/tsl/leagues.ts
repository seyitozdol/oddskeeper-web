import { getPlayerDetailHref, getTeamDetailHref } from "@/lib/routes";
import { currentSeasonLabel, previousSeasonLabel } from "@/lib/season";
import { RESMI_SECTIONS, CUP_SECTIONS, EUROCUP_SECTIONS, type ResmiSection } from "./constants";

// Resmi deneyimini besleyen lig yapilandirmasi. TSL tsl_ss_* (opta-keyed)
// kaynaktan; 1. Lig tff1_* (sofascore-keyed); Kupa cup_* (mackolik, uuid=opta);
// Avrupa kupasi ucl_* (sofascore-keyed, tff1 deseni).
export type LeagueSource = "tsl" | "tff1" | "cup" | "eurocl" | "euel" | "euecl";

// Avrupa kupasi kaynaklari (ortak Cup League/Teams mantigi + prefix_* view'lar).
export function isEuroCupSource(source: LeagueSource): boolean {
  return source === "eurocl" || source === "euel" || source === "euecl";
}

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
  viewPrefix?: string; // Avrupa kupasi: prefix_* view seti (ucl/uel/uecl)
};

// Sezon listeleri takvimden turetilir (24 Haziran siniri, lib/season.ts; DB esi
// ref.current_season_label). Her yaz elle guncelleme GEREKMEZ (sahip karari
// 2026-08-19). Kupa (CUP_LEAGUE) istisna: sezonu Aralik'ta basladigi ve veri
// kapsami ayri oldugu icin elle yonetilir.
const CUR_SEASON = currentSeasonLabel();
const PREV_SEASON = previousSeasonLabel(CUR_SEASON) ?? CUR_SEASON;
const PREV2_SEASON = previousSeasonLabel(PREV_SEASON) ?? PREV_SEASON;
const SEASONS = [CUR_SEASON, PREV_SEASON, PREV2_SEASON];

export const TSL_LEAGUE: LeagueConfig = {
  source: "tsl",
  competition: "Süper Lig",
  seasons: SEASONS,
  defaultSeason: CUR_SEASON,
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
  defaultSeason: CUR_SEASON,
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

// Avrupa kupasi — Sampiyonlar Ligi (ucl_* view'lari, sofascore-keyed). v1: veri/
// goruntuleme ekranlari; takim/oyuncu/mac drill-down detay sayfalari sonraki artis
// (href'ler simdilik null -> tiklanmaz, kirik link yok). 24/25 yok; 25/26 tam veri
// oldugundan varsayilan sezon o (26/27 elemeler/lig fazi basi, kismi).
export const EUROCL_LEAGUE: LeagueConfig = {
  source: "eurocl",
  competition: "UEFA Şampiyonlar Ligi",
  seasons: [CUR_SEASON, PREV_SEASON],
  defaultSeason: CUR_SEASON,
  basePath: "/dashboard/euro-cups/cl/resmi",
  matchBase: "/dashboard/euro-cups/cl/match",
  logo: "/images/leagues/ucl.png",
  nameKey: "tsl.uclName",
  transfersLeague: null,
  sections: EUROCUP_SECTIONS,
  defaultSection: "league",
  viewPrefix: "ucl",
};

// Avrupa Ligi — CL ile ayni yapi (uel_* view'lari, eurocup_* paylasimli katman).
export const EUEL_LEAGUE: LeagueConfig = {
  source: "euel",
  competition: "UEFA Avrupa Ligi",
  seasons: [CUR_SEASON, PREV_SEASON],
  defaultSeason: CUR_SEASON,
  basePath: "/dashboard/euro-cups/el/resmi",
  matchBase: "/dashboard/euro-cups/el/match",
  logo: "/images/leagues/uel.png",
  nameKey: "tsl.uelName",
  transfersLeague: null,
  sections: EUROCUP_SECTIONS,
  defaultSection: "league",
  viewPrefix: "uel",
};

// Konferans Ligi — uecl_* view'lari.
export const EUECL_LEAGUE: LeagueConfig = {
  source: "euecl",
  competition: "UEFA Konferans Ligi",
  seasons: [CUR_SEASON, PREV_SEASON],
  defaultSeason: CUR_SEASON,
  basePath: "/dashboard/euro-cups/conf/resmi",
  matchBase: "/dashboard/euro-cups/conf/match",
  logo: "/images/leagues/uecl.png",
  nameKey: "tsl.ueclName",
  transfersLeague: null,
  sections: EUROCUP_SECTIONS,
  defaultSection: "league",
  viewPrefix: "uecl",
};

// Takım detay linki (lig kaynağına göre).
export function teamHrefFor(
  config: LeagueConfig,
  teamId: string,
  teamSlug: string | null,
  season?: string
): string | null {
  // Avrupa kupasi: TEK profil ilkesi — Super Lig eslesmesi olan (dual) takim
  // football takim profiline; yabanci takim birlesik kupa takim sayfasina
  // (kupa kirilimi o sayfanin icinde, kupa basina ayri sayfa yok).
  if (isEuroCupSource(config.source)) {
    if (teamSlug) return getTeamDetailHref(teamSlug);
    return `/dashboard/euro-cups/team/${encodeURIComponent(teamId)}`;
  }
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
  // Avrupa kupasi: TEK football profili (slug). Faz 2b sonrasi her kupa
  // oyuncusunun slug'i var (sofascore_football_player_link_v1 ile cozulur);
  // slug gelmemisse (veri gecikmesi) link duz metne duser, ayri kupa
  // profil sayfasi YOK.
  if (isEuroCupSource(config.source)) {
    return getPlayerDetailHref(playerSlug);
  }
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
