// Yuzdelik / oran bari. tone: iyi(pos)/kotu(neg)/aksan/notr.
export default function PercentBar({
  pct,
  tone = "accent",
  height = "sm",
}: {
  pct: number | null | undefined; // 0-100
  tone?: "accent" | "pos" | "neg" | "neutral";
  height?: "xs" | "sm" | "md";
}) {
  const clamped = Math.max(0, Math.min(100, pct ?? 0));
  const h = height === "md" ? "h-2" : height === "xs" ? "h-1" : "h-1.5";
  const fill =
    tone === "pos"
      ? "bg-pos"
      : tone === "neg"
        ? "bg-neg"
        : tone === "neutral"
          ? "bg-ink-3"
          : "bg-accent";
  return (
    <div className={`${h} w-full overflow-hidden rounded-full bg-veil`}>
      <div
        className={`${h} rounded-full ${fill} transition-[width] duration-500`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
