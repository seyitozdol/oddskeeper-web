export function formatDecimal(value: number | string | null | undefined, digits = 2) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numeric = Number(value);

  if (Number.isNaN(numeric)) {
    return "—";
  }

  return numeric.toFixed(digits);
}