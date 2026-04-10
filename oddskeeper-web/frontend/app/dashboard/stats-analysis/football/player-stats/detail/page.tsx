import { PlayerDetailHeader } from "@/features/player-detail/components/PlayerDetailHeader";
import { VALID_PLAYER_TABS } from "@/features/player-detail/constants";
import { PlayerMatchLogPanel } from "@/features/player-detail/panels/PlayerMatchLogPanel";
import PlayerAdvancedOverviewPanel from "@/features/player-detail/panels/PlayerAdvancedOverviewPanel";
import PlayerBenchmarksPanel from "@/features/player-detail/panels/PlayerBenchmarksPanel";
import { PlayerOverviewPanel } from "@/features/player-detail/panels/PlayerOverviewPanel";
import { getPlayerAdvancedOverview } from "@/features/player-detail/server/getPlayerAdvancedOverview";
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

const playerSourceId =
  (profile as any)?.player_source_id ??
  (profile as any)?.source_player_id ??
  null;

const seasonLabel =
  (profile as any)?.season_label ??
  null;

const [advancedOverview, benchmarks] = await Promise.all([
  getPlayerAdvancedOverview(playerSourceId),
  getPlayerMetricBenchmarks(playerSourceId, {
    seasonLabel: seasonLabel ?? undefined,
  }),
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

  return (
    <section className="w-full space-y-3">
      <PlayerDetailHeader profile={profile} activeTab={activeTab} />

      {activeTab === "overview" ? (
        <PlayerOverviewPanel profile={profile} matchLog={matchLog} />
      ) : activeTab === "advanced" ? (
        <PlayerAdvancedOverviewPanel overview={advancedOverview} />
      ) : activeTab === "benchmarks" ? (
        <PlayerBenchmarksPanel benchmarks={benchmarks} />
      ) : activeTab === "match-log" ? (
        <PlayerMatchLogPanel rows={matchLog} />
      ) : null}
    </section>
  );
}