export function formatDecimal(
  value: number | string | null | undefined,
  digits = 2
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const num = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(num)) {
    return "—";
  }

  return num.toFixed(digits);
}