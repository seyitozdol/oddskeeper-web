import PlayerStatsExplorer from "@/features/player-stats/components/PlayerStatsExplorer";
import { getPlayerStatsList } from "@/features/player-stats/server/getPlayerStatsList";
import { getAllFootballTeamLogos } from "@/lib/football-teams";
import { getT } from "@/lib/i18n/server";

export default async function FootballPlayerStatsPage() {
  const [rows, teamLogos, t] = await Promise.all([
    getPlayerStatsList(),
    getAllFootballTeamLogos(),
    getT(),
  ]);

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-accent-ink">
            {t("statsHub.playerStatsKicker")}
          </p>

          <h1 className="text-3xl font-semibold text-ink lg:text-5xl">
            {t("statsHub.playerStatsTitle")}
          </h1>
        </div>

        {rows.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-line bg-veil p-6 text-sm text-ink-2">
            {t("statsHub.playersNotFound")}
          </div>
        ) : (
          <PlayerStatsExplorer rows={rows} teamLogos={teamLogos} />
        )}
      </div>
    </section>
  );
}
