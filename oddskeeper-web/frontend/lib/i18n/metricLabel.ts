import type { Translator } from "./messages";

// DB'den gelen metric_key/category_key için çevrilmiş etiket döndürür;
// sözlükte yoksa DB'deki etikete (fallback) düşer.
export function metricLabel(
  t: Translator,
  metricKey: string | null | undefined,
  fallbackLabel?: string | null
): string {
  if (!metricKey) {
    return fallbackLabel ?? "—";
  }

  const messageKey = `metrics.${metricKey}`;
  const text = t(messageKey);
  return text === messageKey ? fallbackLabel ?? metricKey : text;
}

export function categoryLabel(
  t: Translator,
  categoryKey: string | null | undefined,
  fallbackLabel?: string | null
): string {
  if (!categoryKey) {
    return fallbackLabel ?? "—";
  }

  const messageKey = `metrics.cat_${categoryKey}`;
  const text = t(messageKey);
  return text === messageKey ? fallbackLabel ?? categoryKey : text;
}
