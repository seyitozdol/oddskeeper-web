// EuroLeague / EuroCup ortak konfig. URL param "comp" = euroleague | eurocup.
// competition code E/U, sezon E2025/U2025 vb. Sezon toggle sonra seasonLabel ile gelir.

export type EuroCompKey = "euroleague" | "eurocup";

export type EuroCompConfig = {
  key: EuroCompKey;
  code: "E" | "U";      // API/DB competition code
  name: string;         // EuroLeague | EuroCup
  logo: string;         // public logo yolu
  accent: string;       // rozet/tema rengi
};

export const EURO_COMPS: Record<EuroCompKey, EuroCompConfig> = {
  euroleague: { key: "euroleague", code: "E", name: "EuroLeague", logo: "/images/leagues/euroleague.svg", accent: "#fa5500" },
  eurocup: { key: "eurocup", code: "U", name: "EuroCup", logo: "/images/leagues/eurocup.svg", accent: "#0071ce" },
};

// Desteklenen sezonlar (toggle). seasonLabel -> her turnuva icin season_code onekli.
export const EURO_SEASONS = ["2025-2026", "2026-2027"] as const;
export type EuroSeasonLabel = (typeof EURO_SEASONS)[number];
export const DEFAULT_EURO_SEASON: EuroSeasonLabel = "2025-2026";

export function seasonCodeFor(code: "E" | "U", seasonLabel: string): string {
  const year = seasonLabel.slice(0, 4); // "2025-2026" -> "2025"
  return `${code}${year}`;
}

export function resolveEuroComp(comp: string | undefined): EuroCompConfig | null {
  if (comp === "euroleague" || comp === "eurocup") return EURO_COMPS[comp];
  return null;
}

export function normalizeSeason(season: string | undefined): EuroSeasonLabel {
  return (EURO_SEASONS as readonly string[]).includes(season ?? "") ? (season as EuroSeasonLabel) : DEFAULT_EURO_SEASON;
}
