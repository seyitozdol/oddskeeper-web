// TSL deneyim merkezi sabitleri.

export const TSL_COMPETITION = "Süper Lig";

// Elimizdeki sezonlar (güncel önce). tsl_ss_* view'lari bu iki sezonu kapsar.
export const TSL_SEASONS = ["2025/2026", "2024/2025"] as const;
export type TslSeason = (typeof TSL_SEASONS)[number];

export const TSL_DEFAULT_SEASON: TslSeason = "2025/2026";

export function isTslSeason(v: string | undefined | null): v is TslSeason {
  return !!v && (TSL_SEASONS as readonly string[]).includes(v);
}

// Uc tasarim. slug rota parcasi, key i18n + stil.
export const TSL_DESIGNS = ["sahne", "radar", "panel"] as const;
export type TslDesign = (typeof TSL_DESIGNS)[number];

export function isTslDesign(v: string | undefined | null): v is TslDesign {
  return !!v && (TSL_DESIGNS as readonly string[]).includes(v);
}

export const TSL_SECTIONS = ["league", "players", "teams"] as const;
export type TslSection = (typeof TSL_SECTIONS)[number];

export function isTslSection(v: string | undefined | null): v is TslSection {
  return !!v && (TSL_SECTIONS as readonly string[]).includes(v);
}

export const TSL_BASE_PATH = "/dashboard/stats-analysis/tsl";

// Puan durumunda renk bantlari (2025/26 18 takim; Avrupa ust ~5, kume alt 3).
export function standingsZone(
  rank: number,
  totalTeams: number
): "champion" | "europe" | "relegation" | null {
  if (rank === 1) return "champion";
  if (rank <= 5) return "europe";
  if (rank > totalTeams - 3) return "relegation";
  return null;
}
