import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { formatMatchDate } from "@/features/tff1/lib";
import {
  ShowcaseVsBars,
  type ShowcaseVsRow,
} from "@/components/showcase/ShowcaseCharts";
import {
  getTff1Match,
  getTff1MatchPlayers,
  getTff1TeamLogos,
} from "@/features/tff1/server/getTff1Stats";
import { getMatchMarketBars } from "@/features/match-detail/server/getMatchMarketBars";
import type { Tff1MatchLogRow } from "@/features/tff1/types";
import { getLocale, getT } from "@/lib/i18n/server";

function num(v: number | string | null | undefined): number {
  const x = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(x as number) ? (x as number) : 0;
}

function fmt(v: number | string | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return digits > 0 ? n.toFixed(digits) : String(Math.round(n));
}

// Ilk 11 once, sonra oynayan yedekler, en sonda oynamayanlar; kendi icinde dakika desc
function sortPlayers(rows: Tff1MatchLogRow[]): Tff1MatchLogRow[] {
  const rankOf = (r: Tff1MatchLogRow) =>
    r.lineup_status === "starter" ? 0 : num(r.minutes) > 0 ? 1 : 2;
  return [...rows].sort(
    (a, b) => rankOf(a) - rankOf(b) || num(b.minutes) - num(a.minutes)
  );
}

function TeamTable({
  rows,
  t,
}: {
  rows: Tff1MatchLogRow[];
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="min-w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
            <th className="px-3 py-2 font-medium">{t("tff1.colPlayer")}</th>
            <th className="px-3 py-2 font-medium">{t("tff1.colPosition")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("tff1.colMinutes")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("tff1.colRating")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("tff1.colGoals")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("tff1.colAssists")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("tff1.colShots")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("tff1.colShotsOnTarget")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("tff1.colPasses")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("tff1.colKeyPasses")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("tff1.colTackles")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("tff1.colFouls")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("tff1.colSaves")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const played = num(p.minutes) > 0;
            const status =
              p.lineup_status === "starter"
                ? t("tff1.statusStarter")
                : played
                  ? t("tff1.statusSub")
                  : t("tff1.statusBench");
            return (
              <tr
                key={p.player_id}
                className={`border-t border-line ${played ? "text-ink" : "text-ink-3"}`}
              >
                <td className="whitespace-nowrap px-3 py-1.5 font-medium">
                  <Link
                    href={`/dashboard/tff-1-lig/player/${p.player_id}`}
                    className="transition hover:text-accent-ink hover:underline"
                  >
                    {p.player_name}
                  </Link>
                  <span className="ml-1.5 text-[10px] uppercase text-ink-3">{status}</span>
                </td>
                <td className="px-3 py-1.5 text-ink-2">{p.position_code ?? "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(p.minutes)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {played && p.rating !== null ? fmt(p.rating, 2) : "—"}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(p.goals)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(p.assists)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(p.shots)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(p.shots_on_target)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(p.total_passes)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(p.key_passes)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(p.tackles)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(p.fouls)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {p.position_code === "G" ? fmt(p.saves) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function Tff1MatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const [match, playerRows, logos, t, locale] = await Promise.all([
    getTff1Match(matchId),
    getTff1MatchPlayers(matchId),
    getTff1TeamLogos(),
    getT(),
    getLocale(),
  ]);

  if (!match) notFound();

  const logoByTeam: Record<string, string> = {};
  for (const l of logos) if (l.logo_url) logoByTeam[l.team_id] = l.logo_url;

  const homeRows = sortPlayers(
    playerRows.filter((p) => p.team_id === match.home_team_id)
  );
  const awayRows = sortPlayers(
    playerRows.filter((p) => p.team_id === match.away_team_id)
  );

  // Takim-market kiyasi (Teams sekmesindeki 10 ana market): SofaScore takim-mac
  // stat'indan (match_team_stats_v1). Veri yoksa bolum gizlenir.
  const vsRows: ShowcaseVsRow[] = await getMatchMarketBars(
    matchId,
    String(match.home_team_id ?? ""),
    String(match.away_team_id ?? ""),
    locale === "tr"
  );

  const teamBlock = (
    teamId: string | null,
    teamName: string | null,
    align: "left" | "right"
  ) => (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center gap-3 ${align === "left" ? "sm:items-start" : "sm:items-end"}`}
    >
      <div className="flex h-[140px] w-[140px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-card-2 to-canvas p-4">
        {teamId && logoByTeam[teamId] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoByTeam[teamId]}
            alt={teamName ?? ""}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-3xl font-semibold text-ink-3">
            {(teamName ?? "?").slice(0, 1)}
          </span>
        )}
      </div>
      {teamId ? (
        <Link
          href={`/dashboard/tff-1-lig/team/${teamId}?season=${encodeURIComponent(match.season_label)}`}
          className="max-w-full truncate text-lg font-bold text-ink transition hover:text-accent-ink hover:underline sm:text-xl"
        >
          {teamName}
        </Link>
      ) : (
        <span className="max-w-full truncate text-lg font-bold text-ink sm:text-xl">
          {teamName}
        </span>
      )}
    </div>
  );

  return (
    <section className="w-full space-y-3">
      {/* üst çubuk */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/dashboard/stats-analysis/tff1/resmi?season=2026%2F2027&section=league"
          className="rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink-2 transition hover:text-ink"
        >
          ← {t("tff1.backToLeague")}
        </Link>
        <span className="rounded-full border border-line-strong bg-accent-soft px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-accent-ink">
          Trendyol 1. Lig
        </span>
      </div>

      {/* hero */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-card p-5 sm:p-6">
        <div className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />

        <p className="relative text-center text-[11px] font-medium uppercase tracking-[0.3em] text-accent-ink">
          {t("tff1.matchDetailTitle")}
        </p>

        <div className="relative mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
          {teamBlock(match.home_team_id, match.home_team_name, "left")}

          <div className="flex shrink-0 flex-col items-center gap-2 sm:pt-8">
            <div className="text-5xl font-bold tabular-nums tracking-tight text-ink sm:text-6xl">
              {match.home_score ?? "-"}
              <span className="mx-2 text-ink-3">:</span>
              {match.away_score ?? "-"}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={13} className="text-accent-ink" />
                {formatMatchDate(match.match_datetime, locale)}
              </span>
              <span className="text-ink-3">•</span>
              <span>{match.competition}</span>
              <span className="text-ink-3">•</span>
              <span>{match.season_label}</span>
            </div>
          </div>

          {teamBlock(match.away_team_id, match.away_team_name, "right")}
        </div>

        {vsRows.length > 0 ? (
          <div className="relative mx-auto mt-6 max-w-2xl rounded-xl border border-line bg-field px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-ink">
              <span className="truncate">{match.home_team_name}</span>
              <span className="truncate text-right">{match.away_team_name}</span>
            </div>
            <ShowcaseVsBars rows={vsRows} />
          </div>
        ) : null}
      </div>

      {/* oyuncu performansları */}
      <div className="rounded-2xl border border-line bg-card p-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3">
          {t("tff1.lineupsSection")}
        </h2>

        {playerRows.length === 0 ? (
          <div className="mt-2 rounded-lg border border-line bg-veil p-4 text-sm text-ink-2">
            {t("tff1.noMatchLog")}
          </div>
        ) : (
          <div className="mt-3 grid gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">
                {match.home_team_name}
              </h3>
              <TeamTable rows={homeRows} t={t} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">
                {match.away_team_name}
              </h3>
              <TeamTable rows={awayRows} t={t} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
