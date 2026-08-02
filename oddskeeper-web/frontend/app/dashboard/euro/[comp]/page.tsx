import { notFound } from "next/navigation";
import { getEuroStandings, getEuroLeaderboard, getEuroGames } from "@/features/euroleague/server";
import { resolveEuroComp, normalizeSeason, seasonCodeFor, EURO_SEASONS } from "@/features/euroleague/config";
import EuroExplorer from "@/features/euroleague/components/EuroExplorer";
import SeasonToggle from "@/components/SeasonToggle";
import { getT } from "@/lib/i18n/server";

export default async function EuroHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ comp: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ comp }, { season }, t] = await Promise.all([params, searchParams, getT()]);
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
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cfg.logo} alt={cfg.name} width={40} height={40} className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-2xl font-semibold text-ink">{cfg.name} · {t("basketball.statsTitle")}</h1>
              <p className="mt-0.5 text-sm text-ink-3">{seasonLabel}</p>
            </div>
          </div>
          <SeasonToggle seasons={EURO_SEASONS} current={seasonLabel} />
        </div>

        <EuroExplorer comp={cfg.key} standings={standings} leaderboard={leaderboard} games={games} season={seasonLabel} />
      </div>
    </section>
  );
}
