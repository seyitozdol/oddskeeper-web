"use client";

import { useI18n } from "../../../lib/i18n/LanguageProvider";
import type { CupStageRow } from "../server/resmiLoaders";

// Kupada lig tablosu yerine tur bazlı grafik: her tur için maç sayısı barı +
// gol / maç-başı gol. Turnuvanın şeklini (çok maç -> az maç) ve skor eğilimini
// gösterir. Hem Results yan panelinde hem Cup Stages üstünde kullanılır.
export default function CupRoundsChart({ rounds, title }: { rounds: CupStageRow[]; title?: string }) {
  const { t, locale } = useI18n();
  const tr = locale === "tr";
  if (!rounds.length) return null;
  const maxMatches = Math.max(...rounds.map((r) => r.matchCount), 1);

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <h2 className="mb-3 text-[13px] font-semibold text-ink-2">
        {title ?? (tr ? "Turlara Göre" : "By Round")}
      </h2>
      <ul className="space-y-2.5">
        {rounds.map((r) => {
          const avg = r.playedCount > 0 ? (r.goals / r.playedCount).toFixed(2) : "—";
          return (
            <li key={`${r.roundId ?? r.roundName}`}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
                <span className="truncate font-medium text-ink">{r.roundName}</span>
                <span className="shrink-0 tabular-nums text-ink-3">
                  {r.matchCount} {tr ? "maç" : "matches"} · {r.goals} {tr ? "gol" : "goals"} · {tr ? "ort" : "avg"} {avg}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-field">
                <div
                  className="h-full rounded-full bg-accent/70"
                  style={{ width: `${Math.max(4, (r.matchCount / maxMatches) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
