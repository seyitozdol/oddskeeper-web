import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { getLocale, getT } from "@/lib/i18n/server";
import { formatDate } from "@/features/tsl/lib";
import { RESMI_BASE_PATH } from "@/features/tsl/constants";
import {
  getTslMatch,
  getTslMatchPlayers,
  type TslMatchPlayer,
} from "@/features/tsl/server/match";
import { getMatchMarketBars } from "@/features/match-detail/server/getMatchMarketBars";
import MatchPlayerTable, {
  type MatchPlayerRow,
} from "@/features/match-detail/components/MatchPlayerTable";
import { ShowcaseVsBars } from "@/components/showcase/ShowcaseCharts";

function statusRank(s: string | null): number {
  if (s === "starter") return 0;
  if (s === "substitute") return 1;
  return 2;
}

function toPlayerRow(p: TslMatchPlayer): MatchPlayerRow {
  return {
    playerId: p.playerId,
    playerName: p.playerName,
    playerHref: null,
    positionCode: p.positionCode,
    lineupStatus: p.lineupStatus,
    minutes: p.minutes,
    rating: p.rating,
    goals: p.goals,
    assists: p.assists,
    shots: p.shots,
    shotsOnTarget: p.shotsOnTarget,
    totalPasses: p.totalPasses,
    keyPasses: p.keyPasses,
    tackles: p.tackles,
    fouls: p.fouls,
    saves: p.saves,
  };
}

export default async function TslMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { matchId } = await params;
  const { returnTo } = await searchParams;
  const [t, locale] = await Promise.all([getT(), getLocale()]);

  const match = await getTslMatch(matchId);
  if (!match) notFound();
  const players = await getTslMatchPlayers(matchId);

  const sortRows = (rows: TslMatchPlayer[]) =>
    [...rows].sort(
      (a, b) =>
        statusRank(a.lineupStatus) - statusRank(b.lineupStatus) ||
        (b.minutes ?? 0) - (a.minutes ?? 0)
    );
  const homeRows = sortRows(players.filter((p) => p.teamId === match.homeId));
  const awayRows = sortRows(players.filter((p) => p.teamId === match.awayId));

  const back = returnTo && returnTo.startsWith("/dashboard") ? returnTo : RESMI_BASE_PATH;

  // Takim-market kiyasi (Teams sekmesindeki 10 ana market). SofaScore takim-mac
  // stat'i olmayan tarihsel maclarda bos doner -> bolum gizlenir.
  const vsRows = await getMatchMarketBars(matchId, match.homeId, match.awayId, locale === "tr");

  const teamBlock = (
    logo: string | null,
    name: string,
    align: "left" | "right"
  ) => (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center gap-3 ${align === "left" ? "sm:items-start" : "sm:items-end"}`}
    >
      <div className="flex h-[140px] w-[140px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-card-2 to-canvas p-4">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={name} className="h-full w-full object-contain" />
        ) : (
          <span className="text-3xl font-semibold text-ink-3">{name.slice(0, 1)}</span>
        )}
      </div>
      <span className="max-w-full truncate text-lg font-bold text-ink sm:text-xl">
        {name}
      </span>
    </div>
  );

  return (
    <section className="w-full space-y-3 px-4 py-6 lg:px-8">
      {/* üst çubuk */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={back}
          className="rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink-2 transition hover:text-ink"
        >
          ← {t("tsl.backToDesigns")}
        </Link>
        <span className="rounded-full border border-line-strong bg-accent-soft px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-accent-ink">
          Trendyol Süper Lig
        </span>
      </div>

      {/* hero */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-card p-5 sm:p-6">
        <div className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />

        <p className="relative text-center text-[11px] font-medium uppercase tracking-[0.3em] text-accent-ink">
          {t("tsl.matchDetailTitle")}
        </p>

        <div className="relative mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
          {teamBlock(match.homeLogo, match.homeName, "left")}

          <div className="flex shrink-0 flex-col items-center gap-2 sm:pt-8">
            <div className="text-5xl font-bold tabular-nums tracking-tight text-ink sm:text-6xl">
              {match.homeScore ?? "-"}
              <span className="mx-2 text-ink-3">:</span>
              {match.awayScore ?? "-"}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={13} className="text-accent-ink" />
                {formatDate(match.datetime, locale)}
              </span>
              {match.competition ? (
                <>
                  <span className="text-ink-3">•</span>
                  <span>{match.competition}</span>
                </>
              ) : null}
              {match.season ? (
                <>
                  <span className="text-ink-3">•</span>
                  <span>{match.season}</span>
                </>
              ) : null}
            </div>
          </div>

          {teamBlock(match.awayLogo, match.awayName, "right")}
        </div>

        {vsRows.length > 0 ? (
          <div className="relative mx-auto mt-6 max-w-2xl rounded-xl border border-line bg-field px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-ink">
              <span className="truncate">{match.homeName}</span>
              <span className="truncate text-right">{match.awayName}</span>
            </div>
            <ShowcaseVsBars rows={vsRows} />
          </div>
        ) : null}
      </div>

      {/* oyuncu performansları */}
      <div className="rounded-2xl border border-line bg-card p-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3">
          {t("tsl.lineupsSection")}
        </h2>

        {players.length === 0 ? (
          <div className="mt-2 rounded-lg border border-line bg-veil p-4 text-sm text-ink-2">
            {t("tsl.noMatchLog")}
          </div>
        ) : (
          <div className="mt-3 grid gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">{match.homeName}</h3>
              <MatchPlayerTable rows={homeRows.map(toPlayerRow)} tr={locale === "tr"} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">{match.awayName}</h3>
              <MatchPlayerTable rows={awayRows.map(toPlayerRow)} tr={locale === "tr"} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
