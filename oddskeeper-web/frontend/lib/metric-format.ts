// Metrik değerlerini value_format'a göre biçimler (drawer'lardaki
// formatMetricValue ile aynı davranış; sayfalarda paylaşılır).
function formatRawNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

// Maç başı / 90 dk gibi oran kolonlarında tam sayı formatı yetersiz kalır
// (2.26 yerine 2 görünür); bu yardımcı integer formatını 2 ondalığa yükseltir.
export function formatRateValue(
  value: number | null | undefined,
  valueFormat: string | null | undefined
) {
  return formatMetricValue(
    value,
    valueFormat === "integer" ? "decimal_2" : valueFormat
  );
}

export function formatMetricValue(
  value: number | null | undefined,
  valueFormat: string | null | undefined
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  if (valueFormat === "integer") {
    return formatRawNumber(value, 0);
  }

  if (valueFormat === "decimal_1") {
    return formatRawNumber(value, 1);
  }

  if (valueFormat === "decimal_2") {
    return formatRawNumber(value, 2);
  }

  if (valueFormat === "decimal_3") {
    return formatRawNumber(value, 3);
  }

  if (valueFormat === "pct_1") {
    const normalized = Math.abs(value) <= 1 ? value * 100 : value;
    return `${formatRawNumber(normalized, 1)}%`;
  }

  return formatRawNumber(value, 2);
}
