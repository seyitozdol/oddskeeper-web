import { PlayerDetailHeader } from "@/features/player-detail/components/PlayerDetailHeader";
import { VALID_PLAYER_TABS } from "@/features/player-detail/constants";
import DetailedPlayerStatsPanel from "@/features/player-detail/panels/DetailedPlayerStatsPanel";
import { PlayerMatchLogPanel } from "@/features/player-detail/panels/PlayerMatchLogPanel";
import PlayerAdvancedOverviewPanel from "@/features/player-detail/panels/PlayerAdvancedOverviewPanel";
import PlayerBenchmarksPanel from "@/features/player-detail/panels/PlayerBenchmarksPanel";
import { PlayerOverviewPanel } from "@/features/player-detail/panels/PlayerOverviewPanel";
import { getPlayerAdvancedOverview } from "@/features/player-detail/server/getPlayerAdvancedOverview";
import { getPlayerDetailedMetrics } from "@/features/player-detail/server/getPlayerDetailedMetrics";
import { getPlayerMatchLog } from "@/features/player-detail/server/getPlayerMatchLog";
import { getPlayerMetricBenchmarks } from "@/features/player-detail/server/getPlayerMetricBenchmarks";
import { getPlayerProfile } from "@/features/player-detail/server/getPlayerProfile";
import type { ValidPlayerTab } from "@/features/player-detail/types";

type PageProps = {
  searchParams?: Promise<{
    player?: string;
    tab?: string;
  }>;
};

function isValidPlayerTab(value: string | undefined): value is ValidPlayerTab {
  return VALID_PLAYER_TABS.includes(value as ValidPlayerTab);
}

export default async function FootballPlayerDetailPage({
  searchParams,
}: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const playerSlug = resolvedSearchParams.player;
  const requestedTab = resolvedSearchParams.tab;

  const activeTab: ValidPlayerTab = isValidPlayerTab(requestedTab)
    ? requestedTab
    : "overview";

  if (!playerSlug) {
    return (
      <section className="w-full">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] p-8">
          <div className="text-sm text-white/70">No player selected.</div>
        </div>
      </section>
    );
  }

  const [profile, matchLog] = await Promise.all([
    getPlayerProfile(playerSlug),
    getPlayerMatchLog(playerSlug),
  ]);

  if (!profile) {
    return (
      <section className="w-full">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] p-8">
          <div className="text-sm text-white/70">
            Player profile not found for this slug.
          </div>
        </div>
      </section>
    );
  }

  const playerSourceId = profile.player_source_id ?? null;
  const seasonLabel = profile.season_label ?? null;

  const [advancedOverview, detailedMetricRows] = await Promise.all([
    activeTab === "advanced" && playerSourceId
      ? getPlayerAdvancedOverview(playerSourceId)
      : Promise.resolve(null),



    activeTab === "detailed-stats"
      ? getPlayerDetailedMetrics(playerSlug, {
          seasonLabel: seasonLabel ?? undefined,
        })
      : Promise.resolve([]),
  ]);

  return (
    <section className="w-full space-y-3">
      <PlayerDetailHeader profile={profile} activeTab={activeTab} />

      {activeTab === "overview" ? (
        <PlayerOverviewPanel profile={profile} matchLog={matchLog} />
      ) : activeTab === "detailed-stats" ? (
        <DetailedPlayerStatsPanel rows={detailedMetricRows} />
      ) : activeTab === "advanced" ? (
        <PlayerAdvancedOverviewPanel overview={advancedOverview} />
      ) : activeTab === "match-log" ? (
        <PlayerMatchLogPanel rows={matchLog} />
      ) : null}
    </section>
  );
}