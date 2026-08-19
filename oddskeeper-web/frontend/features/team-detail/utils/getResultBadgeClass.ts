export function getResultBadgeClass(resultCode: "W" | "D" | "L" | null) {
  if (resultCode === "W") {
    return "border-pos/25 bg-pos/10 text-pos";
  }

  if (resultCode === "D") {
    return "border-warn/25 bg-warn/10 text-warn";
  }

  if (resultCode === "L") {
    return "border-neg/25 bg-neg/10 text-neg";
  }

  return "border-line bg-veil text-ink-3";
}
