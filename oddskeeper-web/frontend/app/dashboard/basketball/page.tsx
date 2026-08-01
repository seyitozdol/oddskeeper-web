import { getBasketballStandings, getBasketballPlayerLeaderboard, getBasketballTeamPointsModel } from "@/features/basketball/server/getBasketballStats";
import BasketballExplorer from "@/features/basketball/components/BasketballExplorer";
import { getT } from "@/lib/i18n/server";

export default async function BasketballPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tab }, standings, leaderboard, teamPoints, t] = await Promise.all([
    searchParams,
    getBasketballStandings(),
    getBasketballPlayerLeaderboard(),
    getBasketballTeamPointsModel(),
    getT(),
  ]);
  const initialTab =
    tab === "players" || tab === "teams" || tab === "match" ? tab : "standings";

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-ink">
            {t("basketball.kicker")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{t("basketball.title")}</h1>
          <p className="mt-1 text-sm text-ink-3">{t("basketball.subtitle")}</p>
        </div>

        <BasketballExplorer standings={standings} leaderboard={leaderboard} teamPoints={teamPoints} initialTab={initialTab} />
      </div>
    </section>
  );
}
