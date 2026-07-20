import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getLeagueOverview } from "@/features/league-detail/server/getLeagueOverview";
import { getLeagueFixtures } from "@/features/league-detail/server/getLeagueFixtures";
import {
  getLeaguePlayerLeaderboard,
  getLeaguePlayerLeaderboardMeta,
} from "@/features/league-detail/server/getLeaguePlayerLeaderboard";
import { getLeagueResults } from "@/features/league-detail/server/getLeagueResults";
import { getLeagueStandings } from "@/features/league-detail/server/getLeagueStandings";
import { getLeagueTeamLeaderboard } from "@/features/league-detail/server/getLeagueTeamLeaderboard";
import { LeagueOverviewPanel } from "@/features/league-detail/panels/LeagueOverviewPanel";
import { LeagueFixturesPanel } from "@/features/league-detail/panels/LeagueFixturesPanel";
import { LeaguePlayerLeadersPanel } from "@/features/league-detail/panels/LeaguePlayerLeadersPanel";
import { LeagueResultsPanel } from "@/features/league-detail/panels/LeagueResultsPanel";
import { LeagueStandingsPanel } from "@/features/league-detail/panels/LeagueStandingsPanel";
import { LeagueTeamLeadersPanel } from "@/features/league-detail/panels/LeagueTeamLeadersPanel";

type PageSearchParams = {
  competition?: string | string[];
  season?: string | string[];
  tab?: string | string[];
  metric?: string | string[];
  category?: string | string[];
  role?: string | string[];
  team?: string | string[];
  minApps?: string | string[];
  basis?: string | string[];
};

type PageProps = {
  searchParams?: Promise<PageSearchParams>;
};

type LeagueDetailTab =
  | "overview"
  | "standings"
  | "results"
  | "fixtures"
  | "team_leaders"
  | "player_leaders";

type ValueBasis = "per90" | "per_match" | "total";
type RoleFilter = "all" | "starter_core" | "starters" | "substitutes";

const TAB_LABEL_KEYS: Record<LeagueDetailTab, string> = {
  overview: "leagueDetail.tabOverview",
  standings: "leagueDetail.tabStandings",
  results: "leagueDetail.tabResults",
  fixtures: "leagueDetail.tabFixtures",
  team_leaders: "leagueDetail.tabTeamLeaders",
  player_leaders: "leagueDetail.tabPlayerLeaders",
};

function getSingleValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isLeagueTab(value: string | null): value is LeagueDetailTab {
  return (
    value === "overview" ||
    value === "standings" ||
    value === "results" ||
    value === "fixtures" ||
    value === "team_leaders" ||
    value === "player_leaders"
  );
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

export default async function LeagueDetailPage({ searchParams }: PageProps) {
  const [resolvedSearchParams, t] = await Promise.all([searchParams, getT()]);

  const competition =
    getSingleValue(resolvedSearchParams?.competition)?.trim() ?? "";
  const season = getSingleValue(resolvedSearchParams?.season)?.trim() ?? "";
  const requestedTab = getSingleValue(resolvedSearchParams?.tab)?.trim() ?? null;

  const activeTab: LeagueDetailTab = isLeagueTab(requestedTab)
    ? requestedTab
    : "overview";

  if (!competition || !season) {
    return (
      <div className="rounded-xl border border-line bg-veil px-3 py-3 text-sm text-ink-2">
        {t("leagueDetail.requiresParams")}
      </div>
    );
  }

  let overviewData: Awaited<ReturnType<typeof getLeagueOverview>> | null = null;
  let standingsData: Awaited<ReturnType<typeof getLeagueStandings>> = [];
  let resultsData: Awaited<ReturnType<typeof getLeagueResults>> = [];
  let fixturesData: Awaited<ReturnType<typeof getLeagueFixtures>> = [];
  let teamLeaderboardData: Awaited<ReturnType<typeof getLeagueTeamLeaderboard>> =
    [];
  let playerLeaderboardData: Awaited<
    ReturnType<typeof getLeaguePlayerLeaderboard>
  > = [];
  let playerMetricOptions: Awaited<
    ReturnType<typeof getLeaguePlayerLeaderboardMeta>
  > = [];

  const currentCategory =
    getSingleValue(resolvedSearchParams?.category)?.trim() ?? "all";

  const currentRoleRaw =
    getSingleValue(resolvedSearchParams?.role)?.trim() ?? "starter_core";
  const currentRole: RoleFilter =
    currentRoleRaw === "all" ||
    currentRoleRaw === "starters" ||
    currentRoleRaw === "substitutes" ||
    currentRoleRaw === "starter_core"
      ? currentRoleRaw
      : "starter_core";

  const currentTeam =
    getSingleValue(resolvedSearchParams?.team)?.trim() ?? "all";

  const currentMinApps = Math.max(
    1,
    Number(getSingleValue(resolvedSearchParams?.minApps) ?? "5") || 5
  );

  const currentBasisRaw =
    getSingleValue(resolvedSearchParams?.basis)?.trim() ?? "per90";
  const currentBasis: ValueBasis =
    currentBasisRaw === "per_match" || currentBasisRaw === "total"
      ? currentBasisRaw
      : "per90";

  switch (activeTab) {
    case "overview":
      // Genel bakış paneli puan durumu, sonuç ve fikstür özetleri de
      // gösterir; hepsi paralel çekilir.
      [overviewData, standingsData, resultsData, fixturesData] =
        await Promise.all([
          getLeagueOverview(competition, season),
          getLeagueStandings(competition, season),
          getLeagueResults(competition, season),
          getLeagueFixtures(competition, season),
        ]);
      break;

    case "standings":
      standingsData = await getLeagueStandings(competition, season);
      break;

    case "results":
      resultsData = await getLeagueResults(competition, season);
      break;

    case "fixtures":
      fixturesData = await getLeagueFixtures(competition, season);
      break;

    case "team_leaders":
      teamLeaderboardData = await getLeagueTeamLeaderboard(competition, season);
      break;

    case "player_leaders":
      playerMetricOptions = await getLeaguePlayerLeaderboardMeta(
        competition,
        season
      );

      const requestedMetric =
        getSingleValue(resolvedSearchParams?.metric)?.trim() ?? null;

      const categoryScopedOptions =
        currentCategory === "all"
          ? playerMetricOptions
          : playerMetricOptions.filter(
              (item) => item.category_key === currentCategory
            );

      const resolvedMetric =
        categoryScopedOptions.find((item) => item.metric_key === requestedMetric)
          ?.metric_key ??
        playerMetricOptions.find((item) => item.metric_key === requestedMetric)
          ?.metric_key ??
        // Metrik seçilmemişse alfabetik ilk metrik yerine gol ile başla.
        categoryScopedOptions.find((item) => item.metric_key === "goals_total")
          ?.metric_key ??
        categoryScopedOptions[0]?.metric_key ??
        playerMetricOptions[0]?.metric_key ??
        null;

      if (resolvedMetric) {
        playerLeaderboardData = await getLeaguePlayerLeaderboard({
          competition,
          season,
          metricKey: resolvedMetric,
          minApps: currentMinApps,
          role: currentRole,
          teamSlug: currentTeam === "all" ? null : currentTeam,
        });
      }

      break;
  }

  const effectivePlayerMetricKey =
    activeTab === "player_leaders"
      ? playerLeaderboardData[0]?.metric_key ??
        (currentCategory === "all"
          ? playerMetricOptions[0]?.metric_key
          : playerMetricOptions.find(
              (item) => item.category_key === currentCategory
            )?.metric_key) ??
        null
      : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-veil px-3 py-3">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.20em] text-ink-3">
              {t("leagueDetail.kicker")}
            </div>
            <h1 className="mt-2 text-xl font-semibold text-ink">
              {competition}
            </h1>
            <div className="mt-1 text-sm text-ink-2">{season}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                "overview",
                "standings",
                "results",
                "fixtures",
                "team_leaders",
                "player_leaders",
              ] as LeagueDetailTab[]
            ).map((tab) => {
              const isActive = tab === activeTab;

              return (
                <Link
                  key={tab}
                  href={buildLeagueTabHref(competition, season, tab)}
                  prefetch
                  scroll={false}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                    isActive
                      ? "border-line-strong bg-card-2 text-ink"
                      : "border-line bg-veil text-ink-2 hover:bg-veil"
                  }`}
                >
                  {t(TAB_LABEL_KEYS[tab])}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {activeTab === "overview" && overviewData ? (
        <LeagueOverviewPanel
          overview={overviewData}
          standings={standingsData}
          results={resultsData}
          fixtures={fixturesData}
        />
      ) : null}

      {activeTab === "standings" ? (
        <LeagueStandingsPanel rows={standingsData} />
      ) : null}

      {activeTab === "results" ? (
        <LeagueResultsPanel rows={resultsData} />
      ) : null}

      {activeTab === "fixtures" ? (
        <LeagueFixturesPanel rows={fixturesData} />
      ) : null}

      {activeTab === "team_leaders" ? (
        <LeagueTeamLeadersPanel rows={teamLeaderboardData} />
      ) : null}

      {activeTab === "player_leaders" ? (
        <LeaguePlayerLeadersPanel
          rows={playerLeaderboardData}
          metricOptions={playerMetricOptions}
          competition={competition}
          season={season}
          currentMetricKey={effectivePlayerMetricKey}
          currentCategory={currentCategory}
          currentRole={currentRole}
          currentTeam={currentTeam}
          currentMinApps={currentMinApps}
          currentBasis={currentBasis}
        />
      ) : null}
    </div>
  );
}