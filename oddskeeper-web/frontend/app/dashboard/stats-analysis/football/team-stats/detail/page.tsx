import { notFound } from "next/navigation";
import { TeamDetailHeader } from "../../../../../../features/team-detail/components/TeamDetailHeader";
import { FixturePanel } from "../../../../../../features/team-detail/panels/FixturePanel";
import { ResultsPanel } from "../../../../../../features/team-detail/panels/ResultsPanel";
import { SquadPanel } from "../../../../../../features/team-detail/panels/SquadPanel";
import DetailedStatsPanel from "../../../../../../features/team-detail/panels/DetailedStatsPanel";
import TeamAdvancedOverviewPanel from "../../../../../../features/team-detail/panels/TeamAdvancedOverviewPanel";
import TeamBenchmarksPanel from "../../../../../../features/team-detail/panels/TeamBenchmarksPanel";
import { TeamStatisticsPanel } from "../../../../../../features/team-detail/panels/TeamStatisticsPanel";
import { VALID_TABS } from "../../../../../../features/team-detail/constants";
import { getTeamAdvancedOverview } from "../../../../../../features/team-detail/server/getTeamAdvancedOverview";
import { getTeamDetailedMetrics } from "../../../../../../features/team-detail/server/getTeamDetailedMetrics";
import { getTeamFixtures } from "../../../../../../features/team-detail/server/getTeamFixtures";
import { getTeamMetricBenchmarks } from "../../../../../../features/team-detail/server/getTeamMetricBenchmarks";
import { getTeamProfile } from "../../../../../../features/team-detail/server/getTeamProfile";
import { getTeamRecentForm } from "../../../../../../features/team-detail/server/getTeamRecentForm";
import { getTeamResults } from "../../../../../../features/team-detail/server/getTeamResults";
import { getTeamSquad } from "../../../../../../features/team-detail/server/getTeamSquad";
import { getTeamStatisticsSplit } from "../../../../../../features/team-detail/server/getTeamStatisticsSplit";
import { getTeamStatisticsSummary } from "../../../../../../features/team-detail/server/getTeamStatisticsSummary";
import type { ValidTab } from "../../../../../../features/team-detail/types";
import { getFootballTeamBySlug } from "../../../../../../lib/football-teams";

type TeamDetailPageProps = {
  searchParams: Promise<{
    team?: string;
    tab?: string;
  }>;
};

function getValidTab(tab?: string): ValidTab {
  if (tab && VALID_TABS.includes(tab as ValidTab)) {
    return tab as ValidTab;
  }

  return "team-statistics";
}

export default async function TeamDetailPage({
  searchParams,
}: TeamDetailPageProps) {
  const resolvedSearchParams = await searchParams;
  const teamSlug = resolvedSearchParams.team;
  const activeTab = getValidTab(resolvedSearchParams.tab);

  if (!teamSlug) {
    notFound();
  }

  const localTeam = await getFootballTeamBySlug(teamSlug);

  if (!localTeam) {
    notFound();
  }

  const teamProfile = await getTeamProfile(teamSlug);

  const [advancedOverview, benchmarks] = await Promise.all([
    activeTab === "advanced"
      ? getTeamAdvancedOverview(teamSlug)
      : Promise.resolve(null),
    activeTab === "benchmarks"
      ? getTeamMetricBenchmarks(teamSlug)
      : Promise.resolve([]),
  ]);

  const teamResults =
    activeTab === "results" ? await getTeamResults(teamSlug) : [];

  const squadRows =
    activeTab === "squad" ? await getTeamSquad(teamSlug) : [];

  const fixtureRows =
    activeTab === "fixture" ? await getTeamFixtures(teamSlug) : [];

  const summary =
    activeTab === "team-statistics" || activeTab === "detailed-stats"
      ? await getTeamStatisticsSummary(teamSlug)
      : null;

  const splitRows =
    activeTab === "team-statistics" &&
    summary?.competition &&
    summary?.season_label
      ? await getTeamStatisticsSplit(
          teamSlug,
          summary.competition,
          summary.season_label
        )
      : [];

  const recentFormRows =
    activeTab === "team-statistics" &&
    summary?.competition &&
    summary?.season_label
      ? await getTeamRecentForm(
          teamSlug,
          summary.competition,
          summary.season_label
        )
      : [];

  const detailedMetricRows =
    activeTab === "detailed-stats" && summary?.season_label
      ? await getTeamDetailedMetrics(teamSlug, {
          seasonLabel: summary.season_label,
        })
      : [];

  return (
    <section className="w-full">
      <TeamDetailHeader
        logoPath={localTeam.logoPath}
        teamName={teamProfile?.display_name ?? localTeam.name}
        teamSlug={localTeam.slug}
        activeTab={activeTab}
        resultsCount={teamResults.length}
      />

      <div className="mt-3 rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.90),rgba(5,10,18,0.96))] p-3 shadow-[0_0_16px_rgba(34,104,189,0.03)]">
        {activeTab === "team-statistics" ? (
          <TeamStatisticsPanel
            teamProfile={teamProfile}
            summary={summary}
            splits={splitRows}
            recentForm={recentFormRows}
          />
        ) : activeTab === "detailed-stats" ? (
          <DetailedStatsPanel rows={detailedMetricRows} />
        ) : activeTab === "advanced" ? (
          <TeamAdvancedOverviewPanel overview={advancedOverview} />
        ) : activeTab === "benchmarks" ? (
          <TeamBenchmarksPanel benchmarks={benchmarks} />
        ) : activeTab === "results" ? (
          <ResultsPanel rows={teamResults} />
        ) : activeTab === "squad" ? (
          <SquadPanel rows={squadRows} />
        ) : activeTab === "fixture" ? (
          <FixturePanel rows={fixtureRows} />
        ) : null}
      </div>
    </section>
  );
}