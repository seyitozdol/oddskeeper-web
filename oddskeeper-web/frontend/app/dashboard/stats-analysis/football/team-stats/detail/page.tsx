import { notFound } from "next/navigation";
import { FixturePanel } from "../../../../../../features/team-detail/panels/FixturePanel";
import { ResultsPanel } from "../../../../../../features/team-detail/panels/ResultsPanel";
import { SquadPanel } from "../../../../../../features/team-detail/panels/SquadPanel";
import DetailedStatsPanel from "../../../../../../features/team-detail/panels/DetailedStatsPanel";
import { TeamShowcasePanel } from "../../../../../../features/team-detail/panels/TeamShowcasePanel";
import TeamAdvancedOverviewPanel from "../../../../../../features/team-detail/panels/TeamAdvancedOverviewPanel";
import { TeamStatisticsPanel } from "../../../../../../features/team-detail/panels/TeamStatisticsPanel";
import { TEAM_DETAIL_TABS, VALID_TABS } from "../../../../../../features/team-detail/constants";
import { SideTabMenu } from "@/components/nav/SideTabMenu";
import {
  BarChart3,
  CalendarDays,
  Gauge,
  Goal,
  History,
  LayoutDashboard,
  Scale,
  Table2,
  Users,
} from "lucide-react";
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
import { getNavAccess } from "@/lib/nav-access-server";
import { getNotesForSlugs } from "@/lib/team-notes";
import { getTeamSeasonHistory } from "../../../../../../features/team-detail/server/getTeamSeasonHistory";
import { SeasonHistoryPanel } from "../../../../../../features/team-detail/panels/SeasonHistoryPanel";
import { getTeamComparison } from "../../../../../../features/team-detail/server/getTeamComparison";
import { getTeamPlayerStats } from "../../../../../../features/team-detail/server/getTeamPlayerStats";
import TeamPlayerStatsPanel from "../../../../../../features/team-detail/panels/TeamPlayerStatsPanel";
import TeamComparisonPanel from "../../../../../../features/team-detail/panels/TeamComparisonPanel";
import { getFootballTeams } from "../../../../../../lib/football-teams";
import type {
  TeamAdvancedFormSnapshot,
  ValidTab,
} from "../../../../../../features/team-detail/types";
import { getAnyFootballTeamBySlug } from "../../../../../../lib/football-teams";

type TeamDetailPageProps = {
  searchParams: Promise<{
    team?: string;
    tab?: string;
    opponent?: string;
    season?: string;
    design?: string;
    metric?: string;
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

  // Vitrin (showcase) tasarımı varsayılan takım görünümüdür (2026-08-10);
  // eski düzen design=classic ile açılır.
  const showcaseDesign =
    activeTab === "team-statistics" &&
    resolvedSearchParams.design !== "classic";

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

  const localTeam = await getAnyFootballTeamBySlug(teamSlug);

  if (!localTeam) {
    notFound();
  }

  // Fikstür sekmesi yalnız yaklaşan maçları gösterir; geçmiş sezonlar
  // Results sekmesinde (sezon seçici fikstürde yok).

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
    activeTab === "results" || showcaseDesign
      ? getTeamResults(teamSlug, requestedSeason ?? null)
      : Promise.resolve([]),
    getTeamSeasonHistory(teamSlug),
    activeTab === "squad" ? getTeamSquad(teamSlug) : Promise.resolve([]),
    activeTab === "squad" ? getTeamCurrentSquad(teamSlug) : Promise.resolve([]),
    activeTab === "fixture" ? getTeamFixtures(teamSlug) : Promise.resolve([]),
  ]);

  // Sekmelerin çoğu geçmiş sezonları destekler: özet, sezon geçmişi
  // satırlarından seçilen sezona göre alınır (varsayılan: en güncel sezon).
  const seasonsSorted = [...seasonHistoryRows].sort((a, b) =>
    (b.season_label ?? "").localeCompare(a.season_label ?? "")
  );
  // Aynı sezonda iki satır olabiliyor (ör. sezon içinde lig değiştiren takım);
  // sezon seçicide tekilleştir, yoksa aynı etiket iki kez çıkıyor.
  const seasonLabels = Array.from(
    new Set(
      seasonsSorted
        .map((row) => row.season_label)
        .filter((label): label is string => Boolean(label))
    )
  );
  // Sayfa bağlamı (özet, form, split, radar havuzu) LİG satırından kurulur:
  // dual takımlarda (GS/FB) aynı sezonda kupa satırları da var; kupa maçları
  // sonuç listesinde rozetle görünür ama sezon özeti kupaya kaymamalı.
  const CUP_COMPETITIONS = new Set([
    "UEFA Şampiyonlar Ligi",
    "UEFA Avrupa Ligi",
    "UEFA Konferans Ligi",
    "Türkiye Kupası",
  ]);
  const leagueRowFor = (season: string | null | undefined) =>
    seasonsSorted.find(
      (row) =>
        row.season_label === season &&
        !CUP_COMPETITIONS.has(row.competition ?? "")
    ) ?? seasonsSorted.find((row) => row.season_label === season);
  const statsSummary =
    leagueRowFor(requestedSeason) ??
    seasonsSorted.find(
      (row) => !CUP_COMPETITIONS.has(row.competition ?? "")
    ) ??
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
    (activeTab === "detailed-stats" || activeTab === "advanced" || showcaseDesign) &&
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

  // Takım notları (başlıkta logo rozeti + "not ekle" modalı için).
  const notesViewer = await getNavAccess();
  const notesBySlug = await getNotesForSlugs([localTeam.slug], {
    userId: notesViewer.userId,
    isAdmin: notesViewer.isAdmin,
  });
  const teamNotes = notesBySlug[localTeam.slug] ?? [];

  // Sol mini menu: sekmeler her iki gorunumde de ayni yerde sabit.
  const detailBase = `/dashboard/stats-analysis/football/team-stats/detail?team=${teamSlug}`;
  const TAB_ICONS: Record<string, React.ReactNode> = {
    "team-statistics": <LayoutDashboard />,
    "detailed-stats": <Table2 />,
    "player-stats": <BarChart3 />,
    advanced: <Gauge />,
    "season-history": <History />,
    results: <Goal />,
    squad: <Users />,
    fixture: <CalendarDays />,
    comparison: <Scale />,
  };
  const sideItems = TEAM_DETAIL_TABS.map((tab) => ({
    key: tab.key,
    href: `${detailBase}&tab=${tab.key}`,
    label: t(tab.labelKey),
    icon: TAB_ICONS[tab.key],
    count:
      tab.key === "results" && activeTab === "results" && resultsRows.length > 0
        ? resultsRows.length
        : null,
  }));
  const sideActiveKey = showcaseDesign ? "team-statistics" : activeTab;

  const playerStatsData =
    activeTab === "player-stats"
      ? await getTeamPlayerStats(
          teamSlug,
          requestedSeason ?? null,
          resolvedSearchParams.metric ?? null
        )
      : null;

  const sideMenu = (
    <SideTabMenu
      items={sideItems}
      activeKey={sideActiveKey}
      teamName={teamProfile?.display_name ?? localTeam.name}
      teamLogo={localTeam.logoPath}
    />
  );

  if (showcaseDesign) {
    return (
      <section className="w-full">
        <div className="grid items-start gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
          {sideMenu}
          <div className="min-w-0">
            <TeamShowcasePanel
              teamSlug={localTeam.slug}
              teamName={teamProfile?.display_name ?? localTeam.name}
              logoPath={localTeam.logoPath}
              teamProfile={teamProfile}
              summary={statsSummary}
              seasonHistory={seasonHistoryRows}
              recentForm={recentFormRows}
              results={teamResults}
              detailedMetrics={detailedMetricRows}
              teamNotes={teamNotes}
            />
          </div>
        </div>
      </section>
    );
  }

  // Sezon seçici gösterilen sekmeler ve sekmeye göre seçili sezon.
  // Fikstür sekmesinde YOK: yalnız yaklaşan maçlar (geçmiş sezonlar Results'ta).
  const SEASON_TABS: ValidTab[] = [
    "team-statistics",
    "detailed-stats",
    "advanced",
    "results",
    "comparison",
  ];
  const selectedSeasonForTab =
    activeTab === "comparison"
      ? comparisonData?.season_label ?? requestedSeason ?? null
      : activeTab === "results"
      ? requestedSeason ?? statsSummary?.season_label ?? null
      : statsSummary?.season_label ?? null;

  return (
    <section className="w-full">
      <div className="grid items-start gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
      {sideMenu}
      <div className="min-w-0">

      {SEASON_TABS.includes(activeTab) && seasonLabels.length > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-3">
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
          />
        </div>
      ) : null}

      <div className="mt-3 rounded-xl border border-line bg-card p-3">
        {activeTab === "team-statistics" ? (
          <TeamStatisticsPanel
            teamProfile={teamProfile}
            summary={statsSummary}
            splits={splitRows}
            recentForm={recentFormRows}
          />
        ) : activeTab === "detailed-stats" ? (
          <DetailedStatsPanel rows={detailedMetricRows} />
        ) : activeTab === "player-stats" && playerStatsData ? (
          <TeamPlayerStatsPanel teamSlug={teamSlug} data={playerStatsData} />
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
          <SquadPanel
            rows={squadRows}
            currentSquad={currentSquadRows}
            teamName={teamProfile?.display_name ?? localTeam.name}
            logoPath={localTeam.logoPath}
            profile={teamProfile}
          />
        ) : activeTab === "fixture" ? (
          <FixturePanel rows={fixtureRows} />
        ) : activeTab === "comparison" && comparisonData ? (
          <TeamComparisonPanel
            initialData={comparisonData}
            currentTeamSlug={teamSlug}
            availableTeams={allTeams.map((t) => ({ slug: t.slug, name: t.name }))}
            seasonLabel={comparisonData.season_label ?? null}
          />
         ) : null}
      </div>
      </div>
      </div>
    </section>
  );
}