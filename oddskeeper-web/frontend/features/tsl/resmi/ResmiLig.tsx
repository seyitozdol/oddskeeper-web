import { getLocale, getT } from "@/lib/i18n/server";
import { formatMetric } from "@/features/tsl/lib";
import { RESMI_BASE_PATH } from "@/features/tsl/constants";
import type { ResmiLigBundle } from "@/features/tsl/server/resmiLoaders";
import LeaderTabs from "./LeaderTabs";
import {
  Flag,
  MatchRow,
  PlayerFace,
  PlayerNameLink,
  ResmiStandings,
  TeamNameLink,
} from "./parts";

export default async function ResmiLig({ data }: { data: ResmiLigBundle }) {
  const t = await getT();
  const locale = await getLocale();
  const { standings, leaders, leaderMetric, lastRound, upcoming, teamSlugById } = data;

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
  const returnTo = `${RESMI_BASE_PATH}?season=${encodeURIComponent(data.season)}&section=league`;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        {/* Puan durumu (kompakt) */}
        <div>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
            {t("tsl.standings")}
          </h2>
          <ResmiStandings standings={standings} teamSlugById={teamSlugById} compact labels={labels} />
        </div>

        {/* Gol krallligi / liderler */}
        <div className="flex flex-col rounded-2xl border border-line bg-card">
          <div className="space-y-2 border-b border-line p-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
              {t("tsl.leaders")}
            </h2>
            <LeaderTabs active={leaderMetric} />
          </div>
          <div className="divide-y divide-line/60">
            {leaders.map((p) => (
              <div key={p.playerId} className="flex items-center gap-3 px-3 py-2">
                <span className="w-4 shrink-0 text-center text-[12px] font-bold tabular-nums text-ink-3">
                  {p.rank}
                </span>
                <PlayerFace photo={p.photo} name={p.playerName} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <PlayerNameLink
                      name={p.playerName}
                      slug={p.slug}
                      className="truncate text-[13px] font-medium text-accent-ink hover:text-accent"
                    />
                    <Flag nationality={p.nationality} />
                  </div>
                  <TeamNameLink
                    name={p.teamName}
                    slug={p.teamSlug}
                    className="block truncate text-[11px] text-ink-3"
                  />
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[15px] font-bold tabular-nums text-ink">
                    {formatMetric(p.total, p.valueFormat)}
                  </div>
                  <div className="text-[10px] tabular-nums text-ink-3">
                    ({formatMetric(p.perMatch, "decimal")} {t("tsl.perMatchShort")})
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Son hafta + gelecek maclar */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <h3 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
            {t("tsl.results")} · {t("tsl.lastWeek")}
          </h3>
          <div className="divide-y divide-line/60">
            {lastRound?.matches.length ? (
              lastRound.matches
                .slice()
                .reverse()
                .map((m) => <MatchRow key={m.matchId} match={m} locale={locale} returnTo={returnTo} />)
            ) : (
              <p className="px-4 py-6 text-center text-[12px] text-ink-3">{t("tsl.noData")}</p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <h3 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
            {t("tsl.upcoming")}
          </h3>
          <div className="divide-y divide-line/60">
            {upcoming.length ? (
              upcoming
                .slice(0, 10)
                .map((m) => <MatchRow key={m.matchId} match={m} locale={locale} returnTo={returnTo} />)
            ) : (
              <p className="px-4 py-6 text-center text-[12px] text-ink-3">{t("tsl.noUpcoming")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
