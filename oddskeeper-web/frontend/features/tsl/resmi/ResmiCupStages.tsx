"use client";

import Link from "next/link";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import type { ResmiCupStagesBundle } from "../server/resmiLoaders";

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
      day: "2-digit", month: "short",
    });
  } catch {
    return "";
  }
}

export default function ResmiCupStages({ data }: { data: ResmiCupStagesBundle }) {
  const { t, locale } = useI18n();
  const { stages, matchesByRound, matchBase, season } = data;

  if (!stages.length) {
    return (
      <div className="rounded-xl border border-line bg-card p-6 text-center text-[13px] text-ink-3">
        {t("tsl.noData")}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h2 className="text-[15px] font-semibold text-ink">
        {t("tsl.sectionCupStages")} · {season}
      </h2>
      {stages.map((st) => {
        const matches = matchesByRound[st.roundName] ?? [];
        return (
          <section key={`${st.roundId ?? st.roundName}`} className="rounded-xl border border-line bg-card">
            <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <h3 className="text-[14px] font-semibold text-ink">{st.roundName}</h3>
              <span className="text-[11px] tabular-nums text-ink-3">
                {st.playedCount}/{st.matchCount} · {fmtDate(st.firstMatch, locale)}
                {st.lastMatch && st.lastMatch !== st.firstMatch ? `–${fmtDate(st.lastMatch, locale)}` : ""}
              </span>
            </header>
            <ul className="divide-y divide-line">
              {matches.map((m) => {
                const played = m.homeScore != null && m.awayScore != null;
                const homeWin = played && (m.homeScore ?? 0) > (m.awayScore ?? 0);
                const awayWin = played && (m.awayScore ?? 0) > (m.homeScore ?? 0);
                return (
                  <li key={m.matchId}>
                    <Link
                      href={`${matchBase}/${encodeURIComponent(m.matchId)}`}
                      className="flex items-center gap-2 px-4 py-2 text-[13px] transition hover:bg-veil"
                    >
                      <span className="w-14 shrink-0 text-[10px] tabular-nums text-ink-3">
                        {fmtDate(m.datetime, locale)}
                      </span>
                      <span className={`flex-1 text-right ${homeWin ? "font-semibold text-ink" : "text-ink-2"}`}>
                        {m.homeName}
                      </span>
                      <span className="w-12 shrink-0 text-center tabular-nums">
                        {played ? (
                          <span className="rounded bg-veil px-1.5 py-0.5 font-semibold text-ink">
                            {m.homeScore}-{m.awayScore}
                          </span>
                        ) : (
                          <span className="text-ink-3">-</span>
                        )}
                      </span>
                      <span className={`flex-1 ${awayWin ? "font-semibold text-ink" : "text-ink-2"}`}>
                        {m.awayName}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
