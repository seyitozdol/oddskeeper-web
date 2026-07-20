import { MatchDetailHeader } from "@/features/match-detail/components/MatchDetailHeader";
import { VALID_MATCH_TABS } from "@/features/match-detail/constants";
import { MatchIncidentsPanel } from "@/features/match-detail/panels/MatchIncidentsPanel";
import { MatchOverviewPanel } from "@/features/match-detail/panels/MatchOverviewPanel";
import { MatchTeamStatsPanel } from "@/features/match-detail/panels/MatchTeamStatsPanel";
import { getMatchIncidents } from "@/features/match-detail/server/getMatchIncidents";
import { getMatchProfile } from "@/features/match-detail/server/getMatchProfile";
import { getMatchTeamStats } from "@/features/match-detail/server/getMatchTeamStats";
import type { ValidMatchTab } from "@/features/match-detail/types";
import { MatchLineupsPanel } from "@/features/match-detail/panels/MatchLineupsPanel";
import { getMatchParticipants } from "@/features/match-detail/server/getMatchParticipants";
import { getT } from "@/lib/i18n/server";

type PageProps = {
  searchParams?: Promise<{
    match?: string;
    tab?: string;
    returnTo?: string;
  }>;
};

function isValidMatchTab(value: string | undefined): value is ValidMatchTab {
  return VALID_MATCH_TABS.includes(value as ValidMatchTab);
}

export default async function FootballMatchDetailPage({
  searchParams,
}: PageProps) {
  const [resolvedSearchParamsRaw, t] = await Promise.all([searchParams, getT()]);
  const resolvedSearchParams = resolvedSearchParamsRaw ?? {};
  const sourceMatchId = resolvedSearchParams.match;
  const requestedTab = resolvedSearchParams.tab;
  const returnTo =
    resolvedSearchParams.returnTo ||
    "/dashboard/stats-analysis/football/team-stats";

  const activeTab: ValidMatchTab = isValidMatchTab(requestedTab)
    ? requestedTab
    : "overview";

  if (!sourceMatchId) {
    return (
      <section className="w-full">
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="text-sm text-ink-2">{t("matchDetail.noMatchSelected")}</div>
        </div>
      </section>
    );
  }

  const profile = await getMatchProfile(sourceMatchId);

  if (!profile) {
    return (
      <section className="w-full">
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="text-sm text-ink-2">
            {t("matchDetail.matchProfileNotFound")}
          </div>
        </div>
      </section>
    );
  }

  const incidents =
    activeTab === "incidents" ? await getMatchIncidents(sourceMatchId) : [];

  const teamStats =
    activeTab === "team-stats" ? await getMatchTeamStats(sourceMatchId) : [];

  const participants =
    activeTab === "lineups" ? await getMatchParticipants(sourceMatchId) : [];

  return (
    <section className="w-full space-y-4">
      <MatchDetailHeader
        profile={profile}
        activeTab={activeTab}
        backHref={returnTo}
      />

      {activeTab === "overview" && <MatchOverviewPanel profile={profile} />}

      {activeTab === "incidents" && <MatchIncidentsPanel rows={incidents} />}

      {activeTab === "team-stats" && <MatchTeamStatsPanel rows={teamStats} />}

      {activeTab === "lineups" && <MatchLineupsPanel rows={participants} />}

    </section>
  );
}