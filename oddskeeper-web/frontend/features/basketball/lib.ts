// Basketbol dashboard yardımcıları (formatlama, logo, badge).

import type { Locale } from "@/lib/i18n/config";

// Takım logosu: public/images/basketball_logos/<slug>.png (Teams.zip'ten slug-adlı).
export function teamLogoPath(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return `/images/basketball_logos/${slug}.png`;
}

export function teamInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function formatMatchDate(value: string | null | undefined, locale: Locale): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmt(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "-";
  return Number(value).toFixed(digits);
}

export function fmtInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return String(Math.round(value));
}

export const RESULT_BADGE_CLASS: Record<string, string> = {
  W: "bg-pos/15 text-pos",
  L: "bg-neg/15 text-neg",
  T: "bg-veil text-ink-2",
};

export function homeAwayLabel(ha: string | null | undefined, locale: Locale): string {
  if (ha === "Home") return locale === "tr" ? "Ev" : "Home";
  if (ha === "Away") return locale === "tr" ? "Dep" : "Away";
  return "";
}

// SofaScore ham pozisyon kodu (G|GF|F|FC|C) → uzun etiket. Kaynak: BSL players.position
// (EL/EC position_name Guard/Forward/Center ile de uyumlu kısaltılır).
const POS_LABEL: Record<string, { tr: string; en: string }> = {
  G: { tr: "Oyun Kurucu", en: "Guard" },
  GF: { tr: "Oyun Kurucu / Forvet", en: "Guard-Forward" },
  F: { tr: "Forvet", en: "Forward" },
  FG: { tr: "Forvet / Oyun Kurucu", en: "Forward-Guard" },
  FC: { tr: "Forvet / Pivot", en: "Forward-Center" },
  CF: { tr: "Pivot / Forvet", en: "Center-Forward" },
  C: { tr: "Pivot", en: "Center" },
};

// Ham kodu normalize et: "Guard"→"G" vb. (EL/EC position_name geldiğinde de çalışır).
export function normalizePositionCode(pos: string | null | undefined): string | null {
  if (!pos) return null;
  const p = pos.trim();
  if (POS_LABEL[p.toUpperCase()]) return p.toUpperCase();
  const low = p.toLowerCase();
  if (low.startsWith("guard")) return "G";
  if (low.startsWith("forward")) return "F";
  if (low.startsWith("center") || low.startsWith("centre")) return "C";
  return p.toUpperCase();
}

export function positionLabel(pos: string | null | undefined, locale: Locale): string {
  const code = normalizePositionCode(pos);
  if (!code) return "";
  const entry = POS_LABEL[code];
  if (!entry) return code;
  return locale === "tr" ? entry.tr : entry.en;
}

// Boy: 206 → "2.06 m"
export function formatHeight(cm: number | null | undefined): string {
  if (cm == null || Number.isNaN(cm) || cm <= 0) return "";
  return `${(cm / 100).toFixed(2)} m`;
}

// Oyuncu rol etiketi (bb_player_role_v1.role) → i18n anahtarı + renk sınıfı.
export type PlayerRole = "starter" | "rotation" | "limited" | "garbage" | "departed" | "newcomer" | "euro_focus";
// Tüm roller (Config > Player Roles listesi + açıklama i18n anahtarları).
export const ALL_ROLES: PlayerRole[] = ["starter", "rotation", "limited", "garbage", "departed", "newcomer", "euro_focus"];
export function roleLabelKey(role: string | null | undefined): string | null {
  switch (role) {
    case "starter": return "basketball.roleStarter";
    case "rotation": return "basketball.roleRotation";
    case "limited": return "basketball.roleLimited";
    case "garbage": return "basketball.roleGarbage";
    case "departed": return "basketball.roleDeparted";
    case "newcomer": return "basketball.roleNewcomer";
    case "euro_focus": return "basketball.roleEuroFocus";
    default: return null;
  }
}
export function roleDescKey(role: string): string {
  return `basketball.roleDesc_${role}`;
}
export function roleBadgeClass(role: string | null | undefined): string {
  switch (role) {
    case "starter":  return "bg-pos/15 text-pos";
    case "rotation": return "bg-accent/15 text-accent-ink";
    case "limited":  return "bg-veil text-ink-2";
    case "garbage":  return "bg-veil text-ink-3";
    case "departed": return "bg-neg/12 text-neg";
    case "newcomer": return "bg-amber-500/15 text-amber-300";
    case "euro_focus": return "bg-indigo-500/15 text-indigo-300";
    default:         return "bg-veil text-ink-3";
  }
}

// Takım-lideri rozetleri: metrik → {window market_key, config toggle key, kısa etiket i18n}.
export const LEADER_METRICS: { key: string; market: string; cfg: string; labelKey: string }[] = [
  { key: "minutes",  market: "__minutes", cfg: "leader_minutes",  labelKey: "basketball.leaderMinutes" },
  { key: "points",   market: "points",    cfg: "leader_points",   labelKey: "basketball.leaderPoints" },
  { key: "rebounds", market: "rebounds",  cfg: "leader_rebounds", labelKey: "basketball.leaderRebounds" },
  { key: "assists",  market: "assists",   cfg: "leader_assists",  labelKey: "basketball.leaderAssists" },
  { key: "blocks",   market: "blocks",    cfg: "leader_blocks",   labelKey: "basketball.leaderBlocks" },
  { key: "steals",   market: "steals",    cfg: "leader_steals",   labelKey: "basketball.leaderSteals" },
  { key: "threes",   market: "threes",    cfg: "leader_threes",   labelKey: "basketball.leaderThrees" },
];
