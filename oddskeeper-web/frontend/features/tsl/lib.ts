import type { Locale } from "../../lib/i18n/config";
import type { FormResult, MetricFormat } from "./types";

export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Metrik degerini formatina gore yaz.
export function formatMetric(
  value: number | null | undefined,
  format: MetricFormat
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  if (format === "pct") {
    // pct degerleri ya 0-1 ya 0-100 gelebilir; view'lar 0-100 tutuyor.
    const v = value <= 1 ? value * 100 : value;
    return `${v.toFixed(1)}%`;
  }
  if (format === "decimal") {
    return value.toFixed(2);
  }
  // count
  return Number.isInteger(value)
    ? value.toLocaleString("tr-TR")
    : value.toFixed(1);
}

export function formatSigned(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

// yuzdelik 0-1 -> 0-100
export function pctToPercent(v: number | null | undefined): number | null {
  const n = toNum(v);
  if (n === null) return null;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

// Turkce duyarli kucuk harf + aksan kaldirma (arama icin).
export function normalizeSearch(text: string): string {
  return text
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/Ş/g, "s")
    .replace(/Ğ/g, "g")
    .replace(/Ü/g, "u")
    .replace(/Ö/g, "o")
    .replace(/Ç/g, "c")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function positionLabel(code: string | null | undefined, locale: Locale): string {
  const map: Record<string, { tr: string; en: string }> = {
    G: { tr: "Kaleci", en: "Goalkeeper" },
    D: { tr: "Defans", en: "Defender" },
    M: { tr: "Orta saha", en: "Midfielder" },
    F: { tr: "Forvet", en: "Forward" },
  };
  const key = (code ?? "").toUpperCase();
  const entry = map[key];
  if (!entry) return code ?? "—";
  return locale === "tr" ? entry.tr : entry.en;
}

export function positionShort(code: string | null | undefined): string {
  const map: Record<string, string> = { G: "KL", D: "DF", M: "OS", F: "FV" };
  return map[(code ?? "").toUpperCase()] ?? (code ?? "—");
}

export function formatDate(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
    day: "2-digit",
    month: "short",
  });
}

// Bir takimin son maclarindan form (kronolojik). Sonuncu = en yeni.
export const FORM_STYLE: Record<FormResult, string> = {
  W: "bg-pos/15 text-pos border-pos/30",
  D: "bg-veil text-ink-2 border-line",
  L: "bg-neg/15 text-neg border-neg/30",
};

// Yerel logo yolundan (/images/football_logos/<slug>.png) takim slug'i cikar.
export function slugFromLogo(logo: string | null | undefined): string | null {
  if (!logo) return null;
  const m = logo.match(/football_logos\/([^/]+)\.[a-z0-9]+$/i);
  if (!m) return null;
  return decodeURIComponent(m[1])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Oyuncu kullanim etiketi (Core/Regular/Rotation/Limited) -> TR/EN + ton.
export function usageMeta(
  label: string | null | undefined,
  locale: Locale
): { text: string; tone: "pos" | "accent" | "neutral" } | null {
  if (!label) return null;
  const map: Record<string, { tr: string; en: string; tone: "pos" | "accent" | "neutral" }> = {
    Core: { tr: "Vazgeçilmez", en: "Core", tone: "pos" },
    Regular: { tr: "Düzenli", en: "Regular", tone: "accent" },
    Rotation: { tr: "Rotasyon", en: "Rotation", tone: "neutral" },
    Limited: { tr: "Sınırlı", en: "Limited", tone: "neutral" },
    "Limited role": { tr: "Sınırlı", en: "Limited", tone: "neutral" },
  };
  const m = map[label];
  if (!m) return { text: label, tone: "neutral" };
  return { text: locale === "tr" ? m.tr : m.en, tone: m.tone };
}

// Form egilimi etiketi -> TR/EN + ton + ok.
export function formMeta(
  label: string | null | undefined,
  locale: Locale
): { text: string; tone: "pos" | "neg" | "neutral"; arrow: string } | null {
  if (!label) return null;
  const map: Record<
    string,
    { tr: string; en: string; tone: "pos" | "neg" | "neutral"; arrow: string }
  > = {
    Uptrend: { tr: "Yükselişte", en: "Uptrend", tone: "pos", arrow: "↗" },
    Downtrend: { tr: "Düşüşte", en: "Downtrend", tone: "neg", arrow: "↘" },
    Stable: { tr: "İstikrarlı", en: "Stable", tone: "neutral", arrow: "→" },
    "Low sample": { tr: "Az örnek", en: "Low sample", tone: "neutral", arrow: "·" },
  };
  const m = map[label];
  if (!m) return { text: label, tone: "neutral", arrow: "·" };
  return { text: locale === "tr" ? m.tr : m.en, tone: m.tone, arrow: m.arrow };
}

// Sayim (gol/asist/sut...) metrikleri varsayilan TOPLAM gosterilir (gol krali
// mantigi); oran/ondalik metrikler kataloglarindaki basis'i kullanir.
export function preferredBasis(metric: {
  valueFormat: string;
  defaultBasis: string;
}): string {
  if (metric.valueFormat === "count") return "total";
  return metric.defaultBasis || "total";
}

// Bir metrik icin oyuncu degeri (basis'e gore).
export function pickBasis(
  row: { total: number | null; perMatch: number | null; per90: number | null },
  basis: string
): number | null {
  if (basis === "per90") return row.per90 ?? row.perMatch ?? row.total;
  if (basis === "per_match") return row.perMatch ?? row.per90 ?? row.total;
  return row.total ?? row.perMatch ?? row.per90;
}
