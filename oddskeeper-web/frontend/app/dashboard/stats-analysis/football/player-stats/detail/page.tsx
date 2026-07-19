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
import { getPlayerCurrentInfo } from "@/features/player-detail/server/getPlayerCurrentInfo";
import type {
  PlayerCurrentInfoRow,
  PlayerProfileRow,
  ValidPlayerTab,
} from "@/features/player-detail/types";
import { getT } from "@/lib/i18n/server";

type PageProps = {
  searchParams?: Promise<{
    player?: string;
    tab?: string;
  }>;
};

function isValidPlayerTab(value: string | undefined): value is ValidPlayerTab {
  return VALID_PLAYER_TABS.includes(value as ValidPlayerTab);
}

const POSITION_CODES: Record<string, { code: string; group: string }> = {
  Goalkeeper: { code: "GK", group: "GOALKEEPER" },
  Defender: { code: "DF", group: "DEFENDER" },
  Midfielder: { code: "MF", group: "MIDFIELDER" },
  Attacker: { code: "FW", group: "FORWARD" },
};

// Opta maç verisi olmayan (yeni transfer) oyuncular için güncel kadro
// bilgisinden asgari bir profil kurar; sayfa böylece boş kalmaz.
function buildFallbackProfile(
  playerSlug: string,
  info: PlayerCurrentInfoRow
): PlayerProfileRow {
  const fullName =
    [info.first_name, info.last_name].filter(Boolean).join(" ") ||
    info.full_name ||
    info.player_name;
  const position = POSITION_CODES[info.position ?? ""] ?? {
    code: "—",
    group: "OTHER",
  };

  return {
    team_slug: info.current_team_slug,
    team_source_id: "",
    team_name: info.current_team_name,
    competition: "Süper Lig",
    season_label: null,
    player_source_id: info.apifootball_player_id,
    player_name: fullName,
    player_slug: playerSlug,
    primary_position_code: position.code,
    position_group: position.group,
    appearances: 0,
    starts: 0,
    sub_appearances: 0,
    starter_rate_pct: null,
    total_minutes: 0,
    avg_minutes: null,
    goals: 0,
    assists: 0,
    first_match_datetime: null,
    last_match_datetime: null,
  };
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
    const t = await getT();

    return (
      <section className="w-full">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] p-8">
          <div className="text-sm text-white/70">
            {t("playerDetail.noPlayerSelected")}
          </div>
        </div>
      </section>
    );
  }

  const [optaProfile, matchLog, currentInfo] = await Promise.all([
    getPlayerProfile(playerSlug),
    getPlayerMatchLog(playerSlug),
    getPlayerCurrentInfo(playerSlug),
  ]);

  const profile =
    optaProfile ??
    (currentInfo ? buildFallbackProfile(playerSlug, currentInfo) : null);

  if (!profile) {
    const t = await getT();

    return (
      <section className="w-full">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] p-8">
          <div className="text-sm text-white/70">
            {t("playerDetail.playerProfileNotFound")}
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
      <PlayerDetailHeader
        profile={profile}
        activeTab={activeTab}
        currentInfo={currentInfo}
      />

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