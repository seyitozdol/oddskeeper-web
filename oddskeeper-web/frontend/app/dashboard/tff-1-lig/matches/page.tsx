import Link from "next/link";
import { formatMatchDate } from "@/features/tff1/lib";
import {
  getTff1Fixtures,
  getTff1Matches,
  getTff1TeamLogos,
} from "@/features/tff1/server/getTff1Stats";
import type { Tff1FixtureRow } from "@/features/tff1/types";
import { getLocale, getT } from "@/lib/i18n/server";

export default async function Tff1MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { season: seasonParam } = await searchParams;
  const [matches, fixtures, logos, t, locale] = await Promise.all([
    getTff1Matches(),
    getTff1Fixtures(),
    getTff1TeamLogos(),
    getT(),
    getLocale(),
  ]);

  const logoByTeam: Record<string, string> = {};
  for (const l of logos) if (l.logo_url) logoByTeam[l.team_id] = l.logo_url;

  const seasons = Array.from(new Set(matches.map((m) => m.season_label))).sort(
    (a, b) => b.localeCompare(a)
  );
  const season =
    seasonParam && seasons.includes(seasonParam) ? seasonParam : seasons[0];

  const results = matches
    .filter((m) => m.season_label === season)
    .sort((a, b) => (b.match_datetime ?? "").localeCompare(a.match_datetime ?? ""));

  const upcoming = fixtures.filter((f) => f.fixture_status !== "completed");
  const rounds = new Map<number, Tff1FixtureRow[]>();
  for (const f of upcoming) {
    const r = f.round_number ?? 0;
    if (!rounds.has(r)) rounds.set(r, []);
    rounds.get(r)!.push(f);
  }
  const roundList = Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]);

  const logo = (teamId: string | null) =>
    teamId && logoByTeam[teamId] ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoByTeam[teamId]}
        alt=""
        style={{ width: 16, height: 16 }}
        className="inline-block object-contain"
      />
    ) : null;

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <Link
          href="/dashboard/tff-1-lig"
          className="text-[13px] text-ink-3 transition hover:text-ink"
        >
          ← {t("tff1.backToLeague")}
        </Link>

        <h1 className="mt-3 text-2xl font-semibold text-ink lg:text-3xl">
          {t("tff1.matchesTitle")}
        </h1>

        <div className="mt-6 grid gap-8 xl:grid-cols-2">
          {/* Sonuclar */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                {t("tff1.resultsSection")}
              </h2>
              <div className="flex gap-1">
                {seasons.map((s) => (
                  <Link
                    key={s}
                    href={`/dashboard/tff-1-lig/matches?season=${encodeURIComponent(s)}`}
                    className={`rounded-md border px-2 py-0.5 text-[12px] transition ${
                      s === season
                        ? "border-line-strong bg-card-2 text-ink"
                        : "border-line bg-veil text-ink-2 hover:text-ink"
                    }`}
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-2 max-h-[720px] overflow-y-auto rounded-lg border border-line">
              <table className="min-w-full border-collapse text-[13px]">
                <tbody>
                  {results.map((m) => (
                    <tr
                      key={m.match_id}
                      className="border-t border-line text-ink first:border-t-0"
                    >
                      <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-ink-3">
                        {formatMatchDate(m.match_datetime, locale)}
                        {m.competition.includes("Play-off") ? (
                          <span className="ml-1 text-[10px] uppercase">PO</span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5">
                        <Link
                          href={`/dashboard/tff-1-lig/match/${m.match_id}`}
                          className="inline-flex items-center gap-1.5 transition hover:text-accent-ink"
                        >
                          {logo(m.home_team_id)}
                          <span>{m.home_team_name}</span>
                          <span className="rounded bg-veil px-1.5 py-0.5 text-[12px] tabular-nums">
                            {m.home_score ?? "-"}:{m.away_score ?? "-"}
                          </span>
                          <span>{m.away_team_name}</span>
                          {logo(m.away_team_id)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fikstur */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {t("tff1.fixturesSection")}
            </h2>
            {roundList.length === 0 ? (
              <div className="mt-2 rounded-lg border border-line bg-veil p-4 text-sm text-ink-2">
                {t("tff1.noFixtures")}
              </div>
            ) : (
              <div className="mt-2 max-h-[720px] space-y-4 overflow-y-auto pr-1">
                {roundList.map(([round, rows]) => (
                  <div key={round} className="rounded-lg border border-line">
                    <p className="border-b border-line bg-veil px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                      {t("tff1.roundLabel", { round })}
                      <span className="ml-2 normal-case tracking-normal">
                        {rows[0]?.season_label}
                      </span>
                    </p>
                    <table className="min-w-full border-collapse text-[13px]">
                      <tbody>
                        {rows.map((f) => (
                          <tr
                            key={f.fixture_id}
                            className="border-t border-line text-ink first:border-t-0"
                          >
                            <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-ink-3">
                              {formatMatchDate(f.fixture_datetime, locale)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-1.5">
                              <span className="inline-flex items-center gap-1.5">
                                {logo(f.home_team_id)}
                                <span>{f.home_team_name}</span>
                                <span className="text-ink-3">-</span>
                                <span>{f.away_team_name}</span>
                                {logo(f.away_team_id)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
