import { getLocale, getT } from "@/lib/i18n/server";
import { formatDate } from "@/features/tsl/lib";
import type { ResmiResultsBundle } from "@/features/tsl/server/resmiLoaders";
import { MatchRow, ResmiCompactStandings, standingsLabels } from "./parts";
import CupRoundsChart from "./CupRoundsChart";

export default async function ResmiResults({ data }: { data: ResmiResultsBundle }) {
  const t = await getT();
  const locale = await getLocale();
  const { standings, league, rounds, teamHrefById, basePath, matchBase, cupRounds } = data;
  const isCup = !!cupRounds;

  if (!standings.length && !isCup) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  const labels = standingsLabels(t);
  const returnTo = `${basePath}?season=${encodeURIComponent(data.season)}&section=results`;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      {/* Hafta hafta sonuclar (en son hafta üstte; rounds loader'da ters çevrili) */}
      <div>
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
          {t("tsl.weekResults")}
        </h2>
        <div className="space-y-3">
          {rounds.map((r) => (
            <div key={r.round} className="overflow-hidden rounded-2xl border border-line bg-card">
              <div className="flex items-center justify-between border-b border-line px-4 py-2">
                <span className="text-[12px] font-semibold text-ink-2">
                  {r.startIso && r.endIso && formatDate(r.startIso, locale) !== formatDate(r.endIso, locale)
                    ? `${formatDate(r.startIso, locale)} - ${formatDate(r.endIso, locale)}`
                    : formatDate(r.startIso, locale)}
                </span>
                <span className="text-[10px] text-ink-3">{r.matches.length}</span>
              </div>
              <div className="divide-y divide-line/60">
                {r.matches.map((m) => (
                  <MatchRow key={m.matchId} match={m} locale={locale} returnTo={returnTo} matchBase={matchBase} teamHrefById={teamHrefById} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sağ sütun: kompakt puan durumu (kupada tur grafiği). Detay için League. */}
      <div>
        {isCup ? (
          <CupRoundsChart rounds={cupRounds!} />
        ) : (
          <>
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
              {t("tsl.standings")}
            </h2>
            <ResmiCompactStandings
              standings={standings}
              teamHrefById={teamHrefById}
              labels={labels}
              league={league}
            />
          </>
        )}
      </div>
    </div>
  );
}
