type PlayerResultBadgeProps = {
  resultCode: "W" | "D" | "L" | null;
};

function getBadgeClass(resultCode: PlayerResultBadgeProps["resultCode"]) {
  if (resultCode === "W") {
    return "border-pos/25 bg-pos/15 text-pos";
  }

  if (resultCode === "D") {
    return "border-amber-500/25 bg-amber-400/15 text-amber-500";
  }

  if (resultCode === "L") {
    return "border-neg/25 bg-neg/15 text-neg";
  }

  return "border-line bg-veil text-ink-2";
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
