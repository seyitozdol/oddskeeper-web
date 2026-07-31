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
