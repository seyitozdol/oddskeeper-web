// Basketbol için sunum bileşenleri (hook yok → hem server hem client'ta çalışır).

import { teamLogoPath, teamInitials, RESULT_BADGE_CLASS } from "../lib";

export function TeamCrest({
  slug,
  name,
  size = 20,
  url,
}: {
  slug: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  url?: string | null;   // verilirse yerel slug logosu yerine bu URL (EL/EC CDN crest)
}) {
  const src = url || teamLogoPath(slug);
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
  // Düz logo (EL/EC ile aynı; beyaz çip yok).
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name ?? ""} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

export function StatTile({
  label,
  value,
  tone,
  info,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "accent";
  info?: string;   // hover aciklama (metrik anlami/formulu)
}) {
  const valueClass =
    tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "accent" ? "text-accent-ink" : "text-ink";
  return (
    <div className={`rounded-lg border border-line bg-veil px-3 py-2 ${info ? "cursor-help" : ""}`} title={info || undefined}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-ink-3">
        {label}
        {info ? <span className="inline-flex h-[11px] w-[11px] items-center justify-center rounded-full border border-ink-3/40 text-[8px] font-semibold normal-case leading-none text-ink-3/70">i</span> : null}
      </div>
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
