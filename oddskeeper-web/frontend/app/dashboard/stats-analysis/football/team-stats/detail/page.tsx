import { notFound } from "next/navigation";
import { TeamDetailHeader } from "../../../../../../features/team-detail/components/TeamDetailHeader";
import { FixturePanel } from "../../../../../../features/team-detail/panels/FixturePanel";
import { ResultsPanel } from "../../../../../../features/team-detail/panels/ResultsPanel";
import { SquadPanel } from "../../../../../../features/team-detail/panels/SquadPanel";
import DetailedStatsPanel from "../../../../../../features/team-detail/panels/DetailedStatsPanel";
import TeamAdvancedOverviewPanel from "../../../../../../features/team-detail/panels/TeamAdvancedOverviewPanel";
import { TeamStatisticsPanel } from "../../../../../../features/team-detail/panels/TeamStatisticsPanel";
import { VALID_TABS } from "../../../../../../features/team-detail/constants";
import { getTeamDetailedMetrics } from "../../../../../../features/team-detail/server/getTeamDetailedMetrics";
import { getTeamFixtures } from "../../../../../../features/team-detail/server/getTeamFixtures";
import { getTeamProfile } from "../../../../../../features/team-detail/server/getTeamProfile";
import { getTeamRecentForm } from "../../../../../../features/team-detail/server/getTeamRecentForm";
import { getTeamResults } from "../../../../../../features/team-detail/server/getTeamResults";
import { getTeamSquad } from "../../../../../../features/team-detail/server/getTeamSquad";
import { getTeamCurrentSquad } from "../../../../../../features/team-detail/server/getTeamCurrentSquad";
import { getTeamStatisticsSplit } from "../../../../../../features/team-detail/server/getTeamStatisticsSplit";
import { SeasonSelect } from "../../../../../../features/team-detail/components/SeasonSelect";
import { getT } from "@/lib/i18n/server";
import { getTeamSeasonHistory } from "../../../../../../features/team-detail/server/getTeamSeasonHistory";
import { SeasonHistoryPanel } from "../../../../../../features/team-detail/panels/SeasonHistoryPanel";
import { getTeamComparison } from "../../../../../../features/team-detail/server/getTeamComparison";
import TeamComparisonPanel from "../../../../../../features/team-detail/panels/TeamComparisonPanel";
import { getFootballTeams } from "../../../../../../lib/football-teams";
import type {
  TeamAdvancedFormSnapshot,
  ValidTab,
} from "../../../../../../features/team-detail/types";
import { getFootballTeamBySlug } from "../../../../../../lib/football-teams";

type TeamDetailPageProps = {
  searchParams: Promise<{
    team?: string;
    tab?: string;
    opponent?: string;
    season?: string;
  }>;
};

function getValidTab(tab?: string): ValidTab {
  if (tab && VALID_TABS.includes(tab as ValidTab)) {
    return tab as ValidTab;
  }

  return "team-statistics";
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default async function TeamDetailPage({
  searchParams,
}: TeamDetailPageProps) {
  const resolvedSearchParams = await searchParams;
  const teamSlug = resolvedSearchParams.team;
  const activeTab = getValidTab(resolvedSearchParams.tab);
  const requestedSeason = resolvedSearchParams.season;

  const opponentSlug = resolvedSearchParams.opponent;

  const comparisonData =
    activeTab === "comparison" && teamSlug
        ? await getTeamComparison(
            teamSlug,
            opponentSlug ?? "galatasaray",
            "overall",
            requestedSeason ?? null
            )
        : null;

    const allTeams =
      activeTab === "comparison" ? await getFootballTeams() : [];


  if (!teamSlug) {
    notFound();
  }

  const localTeam = await getFootballTeamBySlug(teamSlug);

  if (!localTeam) {
    notFound();
  }

  // Fikstür sekmesinde geçmiş sezon seçilirse yaklaşan fikstür yerine o
  // sezonun oynanmış programı (sonuçlarla) gösterilir.
  const fixturePastSeason =
    activeTab === "fixture" && requestedSeason ? requestedSeason : null;

  // Birbirinden bağımsız sorgular paralel; summary'e bağımlı olanlar ikinci grupta.
  const [
    teamProfile,
    teamResults,
    seasonHistoryRows,
    squadRows,
    currentSquadRows,
    fixtureRows,
  ] = await Promise.all([
    getTeamProfile(teamSlug),
    activeTab === "results" || fixturePastSeason
      ? getTeamResults(teamSlug, requestedSeason ?? null)
      : Promise.resolve([]),
    getTeamSeasonHistory(teamSlug),
    activeTab === "squad" ? getTeamSquad(teamSlug) : Promise.resolve([]),
    activeTab === "squad" ? getTeamCurrentSquad(teamSlug) : Promise.resolve([]),
    activeTab === "fixture" && !fixturePastSeason
      ? getTeamFixtures(teamSlug)
      : Promise.resolve([]),
  ]);

  // Sekmelerin çoğu geçmiş sezonları destekler: özet, sezon geçmişi
  // satırlarından seçilen sezona göre alınır (varsayılan: en güncel sezon).
  const seasonsSorted = [...seasonHistoryRows].sort((a, b) =>
    (b.season_label ?? "").localeCompare(a.season_label ?? "")
  );
  const seasonLabels = seasonsSorted
    .map((row) => row.season_label)
    .filter((label): label is string => Boolean(label));
  const statsSummary =
    seasonsSorted.find((row) => row.season_label === requestedSeason) ??
    seasonsSorted[0] ??
    null;

  // Sonuçlar sekmesi: sezon seçilmemişse en güncel sezona daralt.
  const resultsRows =
    activeTab === "results" && !requestedSeason && statsSummary?.season_label
      ? teamResults.filter(
          (row) => row.season_label === statsSummary.season_label
        )
      : teamResults;

  const [splitRows, recentFormRows, detailedMetricRows] = await Promise.all([
    activeTab === "team-statistics" &&
    statsSummary?.competition &&
    statsSummary?.season_label
      ? getTeamStatisticsSplit(
          teamSlug,
          statsSummary.competition,
          statsSummary.season_label
        )
      : Promise.resolve([]),
    (activeTab === "team-statistics" || activeTab === "advanced") &&
    statsSummary?.competition &&
    statsSummary?.season_label
      ? getTeamRecentForm(
          teamSlug,
          statsSummary.competition,
          statsSummary.season_label
        )
      : Promise.resolve([]),
    (activeTab === "detailed-stats" || activeTab === "advanced") &&
    statsSummary?.season_label
      ? getTeamDetailedMetrics(teamSlug, {
          seasonLabel: statsSummary.season_label,
        })
      : Promise.resolve([]),
  ]);

  const advancedForm: TeamAdvancedFormSnapshot | undefined =
    statsSummary && recentFormRows.length > 0
      ? {
          season_points_per_game: toNullableNumber(
            statsSummary.points_per_game
          ),
          last5_points_per_game:
            recentFormRows.reduce(
              (sum, row) => sum + (toNullableNumber(row.result_points) ?? 0),
              0
            ) / recentFormRows.length,
          season_goals_for_per_game: toNullableNumber(
            statsSummary.goals_for_per_game
          ),
          last5_goals_for_per_game:
            recentFormRows.reduce(
              (sum, row) => sum + (toNullableNumber(row.team_score) ?? 0),
              0
            ) / recentFormRows.length,
          season_goals_against_per_game: toNullableNumber(
            statsSummary.goals_against_per_game
          ),
          last5_goals_against_per_game:
            recentFormRows.reduce(
              (sum, row) => sum + (toNullableNumber(row.opponent_score) ?? 0),
              0
            ) / recentFormRows.length,
        }
      : undefined;

  const t = await getT();

  // Sezon seçici gösterilen sekmeler ve sekmeye göre seçili sezon.
  const SEASON_TABS: ValidTab[] = [
    "team-statistics",
    "detailed-stats",
    "advanced",
    "results",
    "fixture",
    "comparison",
  ];
  const selectedSeasonForTab =
    activeTab === "fixture"
      ? requestedSeason ?? "upcoming"
      : activeTab === "comparison"
      ? comparisonData?.season_label ?? requestedSeason ?? null
      : activeTab === "results"
      ? requestedSeason ?? statsSummary?.season_label ?? null
      : statsSummary?.season_label ?? null;

  return (
    <section className="w-full">
      <TeamDetailHeader
        logoPath={localTeam.logoPath}
        teamName={teamProfile?.display_name ?? localTeam.name}
        teamSlug={localTeam.slug}
        activeTab={activeTab}
        resultsCount={resultsRows.length}
      />

      {SEASON_TABS.includes(activeTab) && seasonLabels.length > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-3">
          {fixturePastSeason ? (
            <span className="text-[12px] text-white/45">
              {t("teamDetail.pastSeasonScheduleNote")}
            </span>
          ) : null}
          <SeasonSelect
            teamSlug={teamSlug}
            tab={activeTab}
            seasons={seasonLabels}
            selectedSeason={selectedSeasonForTab}
            extraParams={
              activeTab === "comparison" && opponentSlug
                ? { opponent: opponentSlug }
                : undefined
            }
            leadingOption={
              activeTab === "fixture"
                ? {
                    value: "upcoming",
                    label: t("teamDetail.upcomingFixturesOption"),
                  }
                : null
            }
          />
        </div>
      ) : null}

      <div className="mt-3 rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.90),rgba(5,10,18,0.96))] p-3 shadow-[0_0_16px_rgba(34,104,189,0.03)]">
        {activeTab === "team-statistics" ? (
          <TeamStatisticsPanel
            teamProfile={teamProfile}
            summary={statsSummary}
            splits={splitRows}
            recentForm={recentFormRows}
          />
        ) : activeTab === "detailed-stats" ? (
          <DetailedStatsPanel rows={detailedMetricRows} />
        ) : activeTab === "advanced" ? (
          <TeamAdvancedOverviewPanel
            rows={detailedMetricRows}
            form={advancedForm}
          />
        ) : activeTab === "season-history" ? (
          <SeasonHistoryPanel rows={seasonHistoryRows} />
        ) : activeTab === "results" ? (
          <ResultsPanel rows={resultsRows} />
        ) : activeTab === "squad" ? (
          <SquadPanel rows={squadRows} currentSquad={currentSquadRows} />
        ) : activeTab === "fixture" ? (
          fixturePastSeason ? (
            <ResultsPanel rows={resultsRows} />
          ) : (
            <FixturePanel rows={fixtureRows} />
          )
        ) : activeTab === "comparison" && comparisonData ? (
          <TeamComparisonPanel
            initialData={comparisonData}
            currentTeamSlug={teamSlug}
            availableTeams={allTeams.map((t) => ({ slug: t.slug, name: t.name }))}
            seasonLabel={comparisonData.season_label ?? null}
          />
         ) : null}
      </div>
    </section>
  );
}