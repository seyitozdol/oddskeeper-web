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
  const initialTab =
    tab === "results" || tab === "fixtures" || tab === "players" || tab === "teams" || tab === "match" ? tab : "standings";

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/leagues/bsl.svg" alt="BSL" width={40} height={40} className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-2xl font-semibold text-ink">BSL · {t("basketball.statsTitle")}</h1>
              <p className="mt-0.5 text-sm text-ink-3">{seasonLabel}</p>
            </div>
          </div>
          <SeasonToggle seasons={EURO_SEASONS} current={seasonLabel} />
        </div>

        <BasketballExplorer standings={standings} leaderboard={leaderboard} teamPoints={teamPoints} games={games} fixtures={fixtures} initialTab={initialTab} season={seasonLabel} />
      </div>
    </section>
  );
}
