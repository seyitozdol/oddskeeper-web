// Basketbol için sunum bileşenleri (hook yok → hem server hem client'ta çalışır).

import { teamLogoPath, teamInitials, RESULT_BADGE_CLASS } from "../lib";

export function TeamCrest({
  slug,
  name,
  size = 20,
}: {
  slug: string | null | undefined;
  name: string | null | undefined;
  size?: number;
}) {
  const src = teamLogoPath(slug);
  if (!src) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded bg-veil text-[9px] font-semibold text-ink-2"
        style={{ width: size, height: size }}
      >
        {teamInitials(name)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ?? ""}
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

export function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "accent";
}) {
  const valueClass =
    tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "accent" ? "text-accent-ink" : "text-ink";
  return (
    <div className="rounded-lg border border-line bg-veil px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{label}</div>
      <div className={`text-sm font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

export function FormBadge({ result }: { result: string | null | undefined }) {
  const cls = RESULT_BADGE_CLASS[result ?? ""] ?? "bg-veil text-ink-2";
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold ${cls}`}>
      {result ?? "-"}
    </span>
  );
}
