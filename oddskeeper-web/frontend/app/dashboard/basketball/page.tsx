import { getBasketballStandings, getBasketballPlayerLeaderboard, getBasketballTeamPointsModel, getBasketballGames, getBasketballFixtures } from "@/features/basketball/server/getBasketballStats";
import BasketballExplorer from "@/features/basketball/components/BasketballExplorer";
import { normalizeSeason, EURO_SEASONS } from "@/features/euroleague/config";
import SeasonToggle from "@/components/SeasonToggle";
import { getT } from "@/lib/i18n/server";

export default async function BasketballPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; season?: string }>;
}) {
  const { tab, season } = await searchParams;
  const seasonLabel = normalizeSeason(season);
  const [standings, leaderboard, teamPoints, games, fixtures, t] = await Promise.all([
    getBasketballStandings(seasonLabel),
    getBasketballPlayerLeaderboard(seasonLabel),
    getBasketballTeamPointsModel(),
    getBasketballGames(seasonLabel),
    getBasketballFixtures(),
    getT(),
  ]);
  const VALID_TABS = ["league", "players", "teams", "results", "playerRankings", "teamRankings", "match"] as const;
  const initialTab = (VALID_TABS as readonly string[]).includes(tab ?? "")
    ? (tab as (typeof VALID_TABS)[number])
    : "league";

  return (
    <section className="w-full px-4 pb-14 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/leagues/bsl.svg" alt="BSL" width={44} height={44} className="h-11 w-11 object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-ink">{t("basketball.leagueLongName")}</h1>
        </div>
        <SeasonToggle seasons={EURO_SEASONS} current={seasonLabel} />
      </div>

      <BasketballExplorer standings={standings} leaderboard={leaderboard} teamPoints={teamPoints} games={games} fixtures={fixtures} initialTab={initialTab} season={seasonLabel} />
    </section>
  );
}
