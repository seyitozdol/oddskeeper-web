// TSL deneyim merkezi sabitleri.

export const TSL_COMPETITION = "Süper Lig";

// Sezonlar (güncel önce). 2026/2027 güncel sezon (14 Ağu 2026 başlar; şu an
// sadece fikstür + transfer verisi var). 25/26 ve 24/25 tam veri (arşiv).
export const TSL_SEASONS = ["2026/2027", "2025/2026", "2024/2025"] as const;
export type TslSeason = (typeof TSL_SEASONS)[number];

// Eski 3 tasarim (sahne/radar/panel) tam veri olan son sezonda açılsın.
export const TSL_DEFAULT_SEASON: TslSeason = "2025/2026";
// Resmi şablon güncel sezonda açılır.
export const RESMI_DEFAULT_SEASON: TslSeason = "2026/2027";

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

// 4. sablon (resmi): kendi rota agaci, lig amblemi + bayrak, 4 bolum.
export const RESMI_BASE_PATH = "/dashboard/stats-analysis/tsl/resmi";

export const RESMI_SECTIONS = [
  "league",
  "players",
  "teams",
  "results",
  "referees",
  "playerRankings",
  "teamRankings",
  // Team Rankings ile modeller arasinda; TSL-only (1.Lig'de transfer verisi yok,
  // ResmiControlBar tff1'de gizler). Eskiden Teams ekraninin sag sutunundaydi.
  "transfers",
  // Team Rankings sağındaki iki model sekmesi. matchStatsModel şimdilik boş;
  // playerStatsModel eski "Player Participant Tools" aracını lig kaynağına göre
  // (TSL / 1. Lig) gömer.
  "matchStatsModel",
  "playerStatsModel",
] as const;

// Türkiye Kupası sekmeleri (kullanıcı sırası). "league" yok; ilk sekme
// "cupStages" (bracket/turlar, kupaya özel). Diğerleri TSL bileşenlerini
// paylaşır (Players/Rankings/PSM Faz 5'e kadar placeholder).
export const CUP_SECTIONS = [
  "cupStages",
  "players",
  "teams",
  "results",
  "referees",
  "playerRankings",
  "teamRankings",
  "matchStatsModel",
  "playerStatsModel",
] as const;

// Avrupa kupasi (CL/EL/ConL) sekmeleri. Sofascore-keyed, tff1 deseni. v1'de
// veri/goruntuleme: transfer (kupada yok), MSM/PSM (Faz 5), cupStages (Mackolik'e
// ozel) ve referees (CL hakem view'i henuz yok) HARIC.
export const EUROCUP_SECTIONS = [
  "league",
  "players",
  "teams",
  "results",
  "playerRankings",
  "teamRankings",
] as const;

const ALL_SECTIONS = [...RESMI_SECTIONS, "cupStages"] as const;
export type ResmiSection = (typeof ALL_SECTIONS)[number];

export function isResmiSection(v: string | undefined | null): v is ResmiSection {
  return !!v && (ALL_SECTIONS as readonly string[]).includes(v);
}

// Lig liderleri metrik seti (client + server ortak; server modulu import etme).
export const RESMI_LEADER_METRICS = [
  { key: "goals_total", labelKey: "tsl.topScorer" },
  { key: "assists_total", labelKey: "tsl.topAssist" },
  { key: "expected_goals_total", labelKey: "tsl.topXg" },
  { key: "key_passes_total", labelKey: "tsl.topKeyPass" },
] as const;

export function tslMatchHref(matchId: string, returnTo?: string): string {
  const q = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  return `${TSL_BASE_PATH}/match/${encodeURIComponent(matchId)}${q}`;
}

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
