type PlayerResultBadgeProps = {
  resultCode: "W" | "D" | "L" | null;
};

function getBadgeClass(resultCode: PlayerResultBadgeProps["resultCode"]) {
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

export function PlayerResultBadge({ resultCode }: PlayerResultBadgeProps) {
  return (
    <span
      className={`inline-flex min-w-[34px] items-center justify-center rounded-md border px-2 py-[2px] text-[10px] font-semibold uppercase ${getBadgeClass(
        resultCode
      )}`}
    >
      {resultCode ?? "—"}
    </span>
  );
}