import { PlayerDetailHeader } from "@/features/player-detail/components/PlayerDetailHeader";
import { VALID_PLAYER_TABS } from "@/features/player-detail/constants";
import DetailedPlayerStatsPanel from "@/features/player-detail/panels/DetailedPlayerStatsPanel";
import { PlayerMatchLogPanel } from "@/features/player-detail/panels/PlayerMatchLogPanel";
import PlayerAdvancedOverviewPanel from "@/features/player-detail/panels/PlayerAdvancedOverviewPanel";
import { PlayerShowcasePanel } from "@/features/player-detail/panels/PlayerShowcasePanel";
import { getPlayerAdvancedOverview } from "@/features/player-detail/server/getPlayerAdvancedOverview";
import { getPlayerDetailedMetrics } from "@/features/player-detail/server/getPlayerDetailedMetrics";
import { getPlayerMatchLog } from "@/features/player-detail/server/getPlayerMatchLog";
import { getPlayerProfile } from "@/features/player-detail/server/getPlayerProfile";
import { getPlayerCurrentInfo } from "@/features/player-detail/server/getPlayerCurrentInfo";
import { getTeamAliases } from "@/features/player-detail/server/getTeamAliases";
import { getLeagueLastMatchDate } from "@/features/player-detail/server/getLeagueLastMatchDate";
import { getPlayerMarketValue } from "@/features/player-detail/server/getPlayerMarketValue";
import { getTeamLogoPath } from "@/features/player-detail/utils/getTeamLogoPath";
import type {
  PlayerCurrentInfoRow,
  PlayerProfileRow,
  ValidPlayerTab,
} from "@/features/player-detail/types";
import { SideTabMenu } from "@/components/nav/SideTabMenu";
import { CalendarDays, Gauge, LayoutDashboard, Table2 } from "lucide-react";
import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server";
import { knownDisplayName } from "@/lib/player-name";

type PageProps = {
  searchParams?: Promise<{
    player?: string;
    tab?: string;
  }>;
};

function isValidPlayerTab(value: string | undefined): value is ValidPlayerTab {
  return VALID_PLAYER_TABS.includes(value as ValidPlayerTab);
}

const TAB_LABEL_KEYS: Record<ValidPlayerTab, string> = {
  overview: "playerDetail.tabOverview",
  "detailed-stats": "playerDetail.tabDetailedStats",
  advanced: "playerDetail.tabAdvanced",
  "match-log": "playerDetail.tabMatchLog",
};

const TAB_ICONS: Record<ValidPlayerTab, ReactNode> = {
  overview: <LayoutDashboard />,
  "detailed-stats": <Table2 />,
  advanced: <Gauge />,
  "match-log": <CalendarDays />,
};

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
    knownDisplayName(info.player_name, info.first_name) ||
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

  // Genel bakış (overview) sekmesi vitrin (showcase) düzenini gösterir; diğer
  // sekmeler başlık + panel. Sekme navigasyonu artık soldaki dikey menüde
  // (takım profiliyle aynı düzen); eski "classic" görünüm kaldırıldı.
  const isOverview = activeTab === "overview";

  if (!playerSlug) {
    const t = await getT();

    return (
      <section className="w-full">
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="text-sm text-ink-2">
            {t("playerDetail.noPlayerSelected")}
          </div>
        </div>
      </section>
    );
  }

  const [optaProfile, matchLog, currentInfo, marketValueEur] = await Promise.all([
    getPlayerProfile(playerSlug),
    getPlayerMatchLog(playerSlug),
    getPlayerCurrentInfo(playerSlug),
    getPlayerMarketValue(playerSlug),
  ]);

  const profile =
    optaProfile ??
    (currentInfo ? buildFallbackProfile(playerSlug, currentInfo) : null);

  if (!profile) {
    const t = await getT();

    return (
      <section className="w-full">
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="text-sm text-ink-2">
            {t("playerDetail.playerProfileNotFound")}
          </div>
        </div>
      </section>
    );
  }

  const playerSourceId = profile.player_source_id ?? null;
  const seasonLabel = profile.season_label ?? null;

  const [advancedOverview, detailedMetricRows] = await Promise.all([
    (activeTab === "advanced" || isOverview) && playerSourceId
      ? getPlayerAdvancedOverview(playerSourceId)
      : Promise.resolve(null),

    activeTab === "detailed-stats" || isOverview
      ? getPlayerDetailedMetrics(playerSlug, {
          seasonLabel: seasonLabel ?? undefined,
        })
      : Promise.resolve([]),
  ]);

  const t = await getT();

  // Sol dikey menü: sekmeler her sekmede aynı yerde sabit (takım profiliyle
  // aynı SideTabMenu). Menü başlığında oyuncu kimliği (foto/logo + ad).
  const displayPlayerName =
    knownDisplayName(currentInfo?.player_name, currentInfo?.first_name) ||
    currentInfo?.full_name ||
    profile.player_name;
  const displayTeamSlug = currentInfo?.current_team_slug ?? profile.team_slug;
  const menuIcon = currentInfo?.photo_url ?? getTeamLogoPath(displayTeamSlug);

  const detailBase = `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(
    playerSlug
  )}`;
  const sideItems = VALID_PLAYER_TABS.map((tab) => ({
    key: tab,
    href: `${detailBase}&tab=${tab}`,
    label: t(TAB_LABEL_KEYS[tab]),
    icon: TAB_ICONS[tab],
  }));

  const sideMenu = (
    <SideTabMenu
      items={sideItems}
      activeKey={activeTab}
      teamName={displayPlayerName}
      teamLogo={menuIcon}
    />
  );

  let content: React.ReactNode;

  if (isOverview) {
    const [teamAliases, leagueLastMatchDate] = await Promise.all([
      getTeamAliases(),
      getLeagueLastMatchDate(profile.competition),
    ]);

    content = (
      <PlayerShowcasePanel
        profile={profile}
        currentInfo={currentInfo}
        marketValueEur={marketValueEur}
        matchLog={matchLog}
        advancedOverview={advancedOverview}
        detailedMetrics={detailedMetricRows}
        teamAliases={teamAliases}
        leagueLastMatchDate={leagueLastMatchDate}
      />
    );
  } else {
    content = (
      <div className="space-y-3">
        <PlayerDetailHeader
          profile={profile}
          currentInfo={currentInfo}
          marketValueEur={marketValueEur}
        />

        {activeTab === "detailed-stats" ? (
          <DetailedPlayerStatsPanel
            rows={detailedMetricRows}
            playerSlug={playerSlug}
          />
        ) : activeTab === "advanced" ? (
          <PlayerAdvancedOverviewPanel overview={advancedOverview} />
        ) : activeTab === "match-log" ? (
          <PlayerMatchLogPanel rows={matchLog} />
        ) : null}
      </div>
    );
  }

  return (
    <section className="w-full">
      <div className="grid items-start gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
        {sideMenu}
        <div className="min-w-0">{content}</div>
      </div>
    </section>
  );
}
