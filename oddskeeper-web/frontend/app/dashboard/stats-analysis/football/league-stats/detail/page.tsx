import Link from "next/link";
import { getLeagueFixtures } from "@/features/league-detail/server/getLeagueFixtures";
import { getLeagueResults } from "@/features/league-detail/server/getLeagueResults";
import { getLeagueStandings } from "@/features/league-detail/server/getLeagueStandings";
import { LeagueFixturesPanel } from "@/features/league-detail/panels/LeagueFixturesPanel";
import { LeagueResultsPanel } from "@/features/league-detail/panels/LeagueResultsPanel";
import { LeagueStandingsPanel } from "@/features/league-detail/panels/LeagueStandingsPanel";
import type { LeagueDetailTab } from "@/features/league-detail/types";

type PageSearchParams = {
  competition?: string | string[];
  season?: string | string[];
  tab?: string | string[];
};

type PageProps = {
  searchParams?: Promise<PageSearchParams>;
};

const TAB_LABELS: Record<LeagueDetailTab, string> = {
  standings: "Standings",
  results: "Results",
  fixtures: "Fixtures",
};

function getSingleValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function isLeagueTab(value: string | null): value is LeagueDetailTab {
  return value === "standings" || value === "results" || value === "fixtures";
}

function buildLeagueTabHref(
  competition: string,
  season: string,
  tab: LeagueDetailTab
): string {
  const params = new URLSearchParams();
  params.set("competition", competition);
  params.set("season", season);
  params.set("tab", tab);

  return `/dashboard/stats-analysis/football/league-stats/detail?${params.toString()}`;
}

function SummaryCard({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">
        {label}
      </div>
      <div className="mt-1 text-[20px] font-semibold text-white">{value}</div>
      {subvalue ? (
        <div className="mt-1 text-[11px] text-white/55">{subvalue}</div>
      ) : null}
    </div>
  );
}

export default async function LeagueDetailPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;

  const competition =
    getSingleValue(resolvedSearchParams?.competition)?.trim() ?? "";
  const season = getSingleValue(resolvedSearchParams?.season)?.trim() ?? "";
  const requestedTab = getSingleValue(resolvedSearchParams?.tab)?.trim() ?? null;
  const activeTab: LeagueDetailTab = isLeagueTab(requestedTab)
    ? requestedTab
    : "standings";

  if (!competition || !season) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        League detail requires both competition and season query params.
      </div>
    );
  }

  const [standings, results, fixtures] = await Promise.all([
    getLeagueStandings(competition, season),
    getLeagueResults(competition, season),
    getLeagueFixtures(competition, season),
  ]);

  const totalGoals = results.reduce(
    (sum, row) => sum + (row.home_score ?? 0) + (row.away_score ?? 0),
    0
  );

  const goalsPerMatch = results.length > 0 ? totalGoals / results.length : 0;


  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.20em] text-white/35">
              League Stats
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-white">
              {competition}
            </h1>
            <div className="mt-1 text-sm text-white/60">{season}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["standings", "results", "fixtures"] as LeagueDetailTab[]).map(
              (tab) => {
                const isActive = tab === activeTab;

                return (
                  <Link
                    key={tab}
                    href={buildLeagueTabHref(competition, season, tab)}
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                      isActive
                        ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
                    }`}
                  >
                    {TAB_LABELS[tab]}
                  </Link>
                );
              }
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Teams"
            value={String(standings.length)}
            subvalue="League table entries"
          />
          <SummaryCard
            label="Completed Matches"
            value={String(results.length)}
            subvalue="Results view"
          />
          <SummaryCard
            label="Upcoming Fixtures"
            value={String(fixtures.length)}
            subvalue="Open fixture list"
          />
          <SummaryCard
            label="Goals / Match"
            value={new Intl.NumberFormat("en-GB", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(goalsPerMatch)}
            subvalue={`${totalGoals} total goals`}
          />
        </div>
      </div>

      {activeTab === "standings" ? <LeagueStandingsPanel rows={standings} /> : null}
      {activeTab === "results" ? <LeagueResultsPanel rows={results} /> : null}
      {activeTab === "fixtures" ? <LeagueFixturesPanel rows={fixtures} /> : null}
    </div>
  );
}