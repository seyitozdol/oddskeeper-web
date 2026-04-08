export function getResultBadgeClass(resultCode: "W" | "D" | "L" | null) {
  if (resultCode === "W") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  if (resultCode === "D") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }

  if (resultCode === "L") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-300";
  }

  return "border-white/10 bg-white/[0.03] text-white/60";
}