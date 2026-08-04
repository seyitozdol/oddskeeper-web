import { notFound } from "next/navigation";
import { getEuroStandings, getEuroLeaderboard, getEuroGames } from "@/features/euroleague/server";
import { resolveEuroComp, normalizeSeason, seasonCodeFor, EURO_SEASONS } from "@/features/euroleague/config";
import EuroExplorer from "@/features/euroleague/components/EuroExplorer";
import SeasonToggle from "@/components/SeasonToggle";

export default async function EuroHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ comp: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ comp }, { season }] = await Promise.all([params, searchParams]);
  const cfg = resolveEuroComp(comp);
  if (!cfg) notFound();

  const seasonLabel = normalizeSeason(season);
  const seasonCode = seasonCodeFor(cfg.code, seasonLabel);
  const [standings, leaderboard, games] = await Promise.all([
    getEuroStandings(cfg.code, seasonCode),
    getEuroLeaderboard(cfg.code, seasonCode),
    getEuroGames(cfg.code, seasonCode),
  ]);

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cfg.logo} alt={cfg.name} width={48} height={48} className="h-12 w-12 object-contain" />
            <h1 className="text-3xl font-bold tracking-tight text-ink">{cfg.name}</h1>
          </div>
          <SeasonToggle seasons={EURO_SEASONS} current={seasonLabel} />
        </div>

        <EuroExplorer comp={cfg.key} standings={standings} leaderboard={leaderboard} games={games} season={seasonLabel} />
      </div>
    </section>
  );
}
