import { getLocale, getT } from "@/lib/i18n/server";
import { formatMetric } from "@/features/tsl/lib";
import { zoneLegendFromMap } from "@/features/tsl/standingsZones";
import type { ResmiTournamentBundle } from "@/features/tsl/server/resmiLoaders";
import LeaderTabs from "./LeaderTabs";
import {
  Flag,
  MatchRow,
  PlayerFace,
  PlayerNameLink,
  ResmiStandings,
  standingsLabels,
} from "./parts";

// Milli takim "Tournaments" sekmesi (TSL'deki League sekmesinin karsiligi):
// secili turnuva baskisinin grup tablosu + Turkiye'nin o turnuvadaki maclari +
// turnuva liderleri + siradaki maclar. Baski secimi sag ustteki secicide;
// "Tumu" seciliyken guncel turnuva gosterilir.
export default async function ResmiTournament({ data }: { data: ResmiTournamentBundle }) {
  const t = await getT();
  const locale = await getLocale();
  const {
    standings, league, leaders, leaderMetric, upcoming, teamHrefById, basePath, matchBase,
    edition, isCurrent, groupName, matches, stageByMatchId, zoneByTeamId, highlightTeamId,
  } = data;

  if (!edition && !upcoming.length) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  const labels = standingsLabels(t);
  const legend = zoneByTeamId
    ? zoneLegendFromMap(standings.map((s) => s.teamId), zoneByTeamId)
    : [];
  const returnTo = `${basePath}?season=${encodeURIComponent(data.season)}&section=league`;
  const title = edition ? (locale === "tr" ? edition.nameTr : edition.nameEn) : "";
  const label = edition ? (locale === "tr" ? edition.labelTr : edition.labelEn) : "";

  return (
    <div className="space-y-5">
      {edition ? (
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-ink" title={title}>
            {label}
          </h2>
          {isCurrent ? (
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-ink">
              {t("tsl.tournamentCurrent")}
            </span>
          ) : null}
          {groupName ? <span className="text-[12px] text-ink-3">{groupName}</span> : null}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        {/* Grup tablosu */}
        <div>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
            {t("tsl.standings")}
          </h2>
          {standings.length ? (
            <ResmiStandings
              standings={standings}
              teamHrefById={teamHrefById}
              labels={labels}
              league={league}
              legend={legend}
              zoneByTeamId={zoneByTeamId}
              highlightTeamId={highlightTeamId}
            />
          ) : (
            <p className="rounded-2xl border border-line bg-card px-4 py-6 text-center text-[12px] text-ink-3">
              {t("tsl.tournamentNoTable")}
            </p>
          )}
        </div>

        {/* Turnuva liderleri (Turkiye oyunculari) */}
        <div className="flex flex-col rounded-2xl border border-line bg-card">
          <div className="space-y-2 border-b border-line p-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
              {t("tsl.leaders")}
            </h2>
            <LeaderTabs active={leaderMetric} />
          </div>
          <div className="divide-y divide-line/60">
            {leaders.length ? (
              leaders.map((p) => (
                <div key={p.playerId} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-4 shrink-0 text-center text-[12px] font-bold tabular-nums text-ink-3">
                    {p.rank}
                  </span>
                  <PlayerFace photo={p.photo} name={p.playerName} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <PlayerNameLink
                        name={p.playerName}
                        href={p.playerHref}
                        className="truncate text-[13px] font-medium text-accent-ink hover:text-accent"
                      />
                      <Flag nationality={p.nationality} />
                    </div>
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
              ))
            ) : (
              <p className="px-4 py-6 text-center text-[12px] text-ink-3">{t("tsl.noData")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Turnuvadaki maclar + siradaki maclar */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <h3 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
            {t("tsl.results")} · {label}
          </h3>
          <div className="divide-y divide-line/60">
            {matches.length ? (
              matches.map((m) => (
                <div key={m.matchId}>
                  {stageByMatchId[m.matchId] ? (
                    <div className="px-3 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                      {stageByMatchId[m.matchId]}
                    </div>
                  ) : null}
                  <MatchRow match={m} locale={locale} returnTo={returnTo} matchBase={matchBase} teamHrefById={teamHrefById} />
                </div>
              ))
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
                .map((m) => <MatchRow key={m.matchId} match={m} locale={locale} returnTo={returnTo} matchBase={matchBase} teamHrefById={teamHrefById} />)
            ) : (
              <p className="px-4 py-6 text-center text-[12px] text-ink-3">{t("tsl.tournamentNoUpcoming")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
