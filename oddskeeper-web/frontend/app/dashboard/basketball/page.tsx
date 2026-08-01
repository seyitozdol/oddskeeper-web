import { getBasketballStandings, getBasketballPlayerLeaderboard, getBasketballTeamPointsModel } from "@/features/basketball/server/getBasketballStats";
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
  const [standings, leaderboard, teamPoints, t] = await Promise.all([
    getBasketballStandings(seasonLabel),
    getBasketballPlayerLeaderboard(seasonLabel),
    getBasketballTeamPointsModel(),
    getT(),
  ]);
  const initialTab =
    tab === "players" || tab === "teams" || tab === "match" ? tab : "standings";

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-ink">
              {t("basketball.kicker")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">{t("basketball.title")}</h1>
            <p className="mt-1 text-sm text-ink-3">{t("basketball.subtitle")}</p>
          </div>
          <SeasonToggle seasons={EURO_SEASONS} current={seasonLabel} />
        </div>

        <BasketballExplorer standings={standings} leaderboard={leaderboard} teamPoints={teamPoints} initialTab={initialTab} season={seasonLabel} />
      </div>
    </section>
  );
}
