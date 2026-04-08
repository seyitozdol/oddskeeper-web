import { notFound } from "next/navigation";
import { TeamDetailHeader } from "../../../../../../features/team-detail/components/TeamDetailHeader";
import { FixturePanel } from "../../../../../../features/team-detail/panels/FixturePanel";
import { ResultsPanel } from "../../../../../../features/team-detail/panels/ResultsPanel";
import { SquadPanel } from "../../../../../../features/team-detail/panels/SquadPanel";
import { TeamStatisticsPanel } from "../../../../../../features/team-detail/panels/TeamStatisticsPanel";
import { getTeamProfile } from "../../../../../../features/team-detail/server/getTeamProfile";
import { getTeamRecentForm } from "../../../../../../features/team-detail/server/getTeamRecentForm";
import { getTeamResults } from "../../../../../../features/team-detail/server/getTeamResults";
import { getTeamStatisticsSplit } from "../../../../../../features/team-detail/server/getTeamStatisticsSplit";
import { getTeamStatisticsSummary } from "../../../../../../features/team-detail/server/getTeamStatisticsSummary";
import type { ValidTab } from "../../../../../../features/team-detail/types";
import { VALID_TABS } from "../../../../../../features/team-detail/types";
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

  const teamResults =
    activeTab === "results" ? await getTeamResults(teamSlug) : [];

  const summary =
    activeTab === "team-statistics"
      ? await getTeamStatisticsSummary(teamSlug)
      : null;

  const splitRows =
    activeTab === "team-statistics" && summary?.competition && summary?.season_label
      ? await getTeamStatisticsSplit(
          teamSlug,
          summary.competition,
          summary.season_label
        )
      : [];

  const recentFormRows =
    activeTab === "team-statistics" && summary?.competition && summary?.season_label
      ? await getTeamRecentForm(teamSlug, summary.competition, summary.season_label)
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
        {activeTab === "results" && <ResultsPanel rows={teamResults} />}

        {activeTab === "team-statistics" && (
          <TeamStatisticsPanel
            teamProfile={teamProfile}
            summary={summary}
            splitRows={splitRows}
            recentFormRows={recentFormRows}
          />
        )}

        {activeTab === "squad" && <SquadPanel />}

        {activeTab === "fixture" && <FixturePanel />}
      </div>
    </section>
  );
}