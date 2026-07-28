import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatMarketValue,
  formatMatchDate,
  positionLabel,
  ROLE_CHIP_CLASS,
  ROLE_LABEL_KEYS,
  squadRole,
} from "@/features/tff1/lib";
import {
  getTff1Matches,
  getTff1MarketValues,
  getTff1PlayerSeasonStats,
  getTff1TeamLogos,
  getTff1TeamSeasonStats,
} from "@/features/tff1/server/getTff1Stats";
import type { Tff1MatchRow } from "@/features/tff1/types";
import { getLocale, getT } from "@/lib/i18n/server";

function num(v: number | string | null | undefined): number {
  const x = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(x as number) ? (x as number) : 0;
}

const RESULT_CLASS: Record<string, string> = {
  W: "bg-pos/15 text-pos",
  D: "bg-veil text-ink-2",
  L: "bg-neg/15 text-neg",
};

export default async function Tff1TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { teamId } = await params;
  const { season: seasonParam } = await searchParams;
  const [players, teams, matches, mvRows, logos, t, locale] = await Promise.all([
    getTff1PlayerSeasonStats(),
    getTff1TeamSeasonStats(),
    getTff1Matches(),
    getTff1MarketValues(),
    getTff1TeamLogos(),
    getT(),
    getLocale(),
  ]);

  const teamSeasons = teams
    .filter((tr) => tr.team_id === teamId)
    .sort((a, b) => b.season_label.localeCompare(a.season_label));
  if (teamSeasons.length === 0) notFound();

  const season =
    seasonParam && teamSeasons.some((tr) => tr.season_label === seasonParam)
      ? seasonParam
      : teamSeasons[0].season_label;
  const team = teamSeasons.find((tr) => tr.season_label === season)!;

  const seasonTeams = teams
    .filter((tr) => tr.season_label === season)
    .sort(
      (a, b) => num(b.points) - num(a.points) || num(b.goal_diff) - num(a.goal_diff)
    );
  const rank = seasonTeams.findIndex((tr) => tr.team_id === teamId) + 1;

  const logo = logos.find((l) => l.team_id === teamId)?.logo_url;
  const marketValues: Record<string, number | null> = {};
  for (const r of mvRows) marketValues[r.player_id] = r.market_value_eur;

  const teamMatches = matches
    .filter(
      (m) =>
        m.season_label === season &&
        (m.home_team_id === teamId || m.away_team_id === teamId)
    )
    .sort((a, b) => (b.match_datetime ?? "").localeCompare(a.match_datetime ?? ""));

  const squad = players
    .filter((p) => p.season_label === season && p.team_id === teamId)
    .sort((a, b) => num(b.minutes) - num(a.minutes));

  const squadValue = squad.reduce((acc, p) => acc + num(marketValues[p.player_id]), 0);

  const resultFor = (m: Tff1MatchRow): "W" | "D" | "L" | null => {
    if (m.home_score === null || m.away_score === null) return null;
    const isHome = m.home_team_id === teamId;
    const gf = isHome ? m.home_score : m.away_score;
    const ga = isHome ? m.away_score : m.home_score;
    return gf > ga ? "W" : gf < ga ? "L" : "D";
  };
  const resultLetter = (r: "W" | "D" | "L" | null) =>
    r === "W" ? "G" : r === "L" ? "M" : r === "D" ? "B" : "—";

  const leagueMatches = teamMatches.filter((m) => !m.competition.includes("Play-off"));
  const form = leagueMatches.slice(0, 5).map(resultFor);

  const summary: Array<[string, string]> = [
    [t("tff1.drawerRank"), `${rank}.`],
    [t("tff1.colPoints"), String(num(team.points))],
    [t("tff1.drawerRecord"), `${num(team.wins)}G ${num(team.draws)}B ${num(team.losses)}M`],
    [t("tff1.drawerGoals"), `${num(team.goals_for)}-${num(team.goals_against)}`],
    [t("tff1.colRating"), team.rating_avg === null ? "—" : String(team.rating_avg)],
    [t("tff1.drawerSquadValue"), formatMarketValue(squadValue || null)],
  ];

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <Link
          href="/dashboard/tff-1-lig"
          className="text-[13px] text-ink-3 transition hover:text-ink"
        >
          ← {t("tff1.backToLeague")}
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={team.team_name ?? ""}
              className="h-16 w-16 object-contain"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-veil text-2xl font-semibold text-ink-3">
              {(team.team_name ?? "?").slice(0, 1)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-ink lg:text-3xl">
              {team.team_name}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-3">
              <span>{t("tff1.kicker")}</span>
              <span>·</span>
              <div className="flex gap-1">
                {teamSeasons.map((tr) => (
                  <Link
                    key={tr.season_label}
                    href={`/dashboard/tff-1-lig/team/${teamId}?season=${encodeURIComponent(tr.season_label)}`}
                    className={`rounded-md border px-2 py-0.5 text-[12px] transition ${
                      tr.season_label === season
                        ? "border-line-strong bg-card-2 text-ink"
                        : "border-line bg-veil text-ink-2 hover:text-ink"
                    }`}
                  >
                    {tr.season_label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {summary.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-veil px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{label}</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">
            {t("tff1.drawerForm")}
          </span>
          {form.map((r, i) => (
            <span
              key={i}
              className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold ${
                r ? RESULT_CLASS[r] : "bg-veil text-ink-3"
              }`}
            >
              {resultLetter(r)}
            </span>
          ))}
        </div>

        <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("tff1.drawerSquad", { count: squad.length })}
        </h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                <th className="px-3 py-2 font-medium">{t("tff1.colPlayer")}</th>
                <th className="px-3 py-2 font-medium">{t("tff1.colPosition")}</th>
                <th className="px-3 py-2 font-medium">{t("tff1.drawerRole")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colAppearances")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colMinutes")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colGoals")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colAssists")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colRating")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colMarketValue")}</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => {
                const role = squadRole(p, num(team.played));
                return (
                  <tr
                    key={p.player_id}
                    className="border-t border-line text-ink transition hover:bg-veil"
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-medium">
                      <Link
                        href={`/dashboard/tff-1-lig/player/${p.player_id}`}
                        className="transition hover:text-accent-ink hover:underline"
                      >
                        {p.player_name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-2">
                      {positionLabel(p, locale)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[11px] ${ROLE_CHIP_CLASS[role]}`}
                      >
                        {t(ROLE_LABEL_KEYS[role])}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(p.appearances)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(p.minutes)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(p.goals)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(p.assists)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {p.rating_avg === null ? "—" : Number(p.rating_avg).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMarketValue(marketValues[p.player_id])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("tff1.drawerResults", { count: teamMatches.length })}
        </h2>
        <div className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-line">
          <table className="min-w-full border-collapse text-[13px]">
            <tbody>
              {teamMatches.map((m) => {
                const r = resultFor(m);
                return (
                  <tr key={m.match_id} className="border-t border-line text-ink first:border-t-0">
                    <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-ink-3">
                      {formatMatchDate(m.match_datetime, locale)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <span className={m.home_team_id === teamId ? "font-semibold" : ""}>
                        {m.home_team_name}
                      </span>
                      <span className="mx-1.5 rounded bg-veil px-1.5 py-0.5 text-[12px] tabular-nums">
                        {m.home_score ?? "-"}:{m.away_score ?? "-"}
                      </span>
                      <span className={m.away_team_id === teamId ? "font-semibold" : ""}>
                        {m.away_team_name}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {m.competition.includes("Play-off") ? (
                        <span className="mr-1.5 text-[10px] uppercase text-ink-3">PO</span>
                      ) : null}
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold ${
                          r ? RESULT_CLASS[r] : "bg-veil text-ink-3"
                        }`}
                      >
                        {resultLetter(r)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[12px] text-ink-3">{t("tff1.tmNote")}</p>
      </div>
    </section>
  );
}
