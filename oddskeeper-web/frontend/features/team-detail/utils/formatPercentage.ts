import { formatDecimal } from "./formatDecimal";

export function formatPercentage(value: number | string | null | undefined) {
  const formatted = formatDecimal(value, 2);
  return formatted === "—" ? "—" : `${formatted}%`;
}