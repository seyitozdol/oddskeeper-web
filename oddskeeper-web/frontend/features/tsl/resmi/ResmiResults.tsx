import { getLocale, getT } from "@/lib/i18n/server";
import { RESMI_BASE_PATH } from "@/features/tsl/constants";
import { formatDate } from "@/features/tsl/lib";
import type { ResmiResultsBundle } from "@/features/tsl/server/resmiLoaders";
import { MatchRow, ResmiStandings } from "./parts";

export default async function ResmiResults({ data }: { data: ResmiResultsBundle }) {
  const t = await getT();
  const locale = await getLocale();
  const { standings, rounds, teamSlugById } = data;

  if (!standings.length) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  const labels = {
    rank: t("tsl.rank"),
    team: t("tsl.team"),
    played: t("tsl.played"),
    won: t("tsl.won"),
    drawn: t("tsl.drawn"),
    lost: t("tsl.lost"),
    goalDiff: t("tsl.goalDiff"),
    form: t("tsl.form"),
    points: t("tsl.points"),
  };
  const returnTo = `${RESMI_BASE_PATH}?season=${encodeURIComponent(data.season)}&section=ranking`;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      {/* Ranking (tam puan durumu) */}
      <div>
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
          {t("tsl.standings")}
        </h2>
        <ResmiStandings
          standings={standings}
          teamSlugById={teamSlugById}
          compact={false}
          labels={labels}
        />
      </div>

      {/* Hafta hafta sonuclar */}
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
                  <MatchRow key={m.matchId} match={m} locale={locale} returnTo={returnTo} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
