import {
  getVolleyballCompetitions,
  getVolleyballLeaderboard,
  getVolleyballMatches,
  getVolleyballFixtures,
} from "@/features/volleyball/server/getVolleyballStats";
import VolleyballExplorer from "@/features/volleyball/components/VolleyballExplorer";
import CompetitionToggle from "@/features/volleyball/components/CompetitionToggle";
import { getT } from "@/lib/i18n/server";

export default async function VolleyballPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; comp?: string }>;
}) {
  const { tab, comp } = await searchParams;
  const [competitions, t] = await Promise.all([
    getVolleyballCompetitions(),
    getT(),
  ]);

  // Secili turnuva: ?comp= gecerliyse o, degilse en yeni (sort_key desc ilk).
  const compId = Number(comp);
  const selected =
    competitions.find((c) => c.competition_id === compId) ?? competitions[0];
  const selectedId = selected?.competition_id ?? 0;

  const [leaderboard, matches, fixtures] = await Promise.all([
    selectedId ? getVolleyballLeaderboard(selectedId) : Promise.resolve([]),
    selectedId ? getVolleyballMatches(selectedId) : Promise.resolve([]),
    getVolleyballFixtures(),
  ]);

  const initialTab =
    tab === "results" || tab === "fixtures" || tab === "tools" || tab === "players"
      ? (tab as "results" | "fixtures" | "tools" | "players")
      : "players";

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Logo yerine Türkiye bayrağı (kadın milli takım). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/flags/tr.png"
              alt="Türkiye"
              width={40}
              height={28}
              className="h-7 w-10 rounded-[3px] object-cover"
            />
            <div>
              <h1 className="text-2xl font-semibold text-ink">
                {t("volleyball.title")}
              </h1>
              <p className="mt-0.5 text-sm text-ink-3">
                {t("volleyball.subtitle")}
                {selected ? ` · ${selected.short_label}` : ""}
              </p>
            </div>
          </div>
          {competitions.length > 0 ? (
            <CompetitionToggle competitions={competitions} current={selectedId} />
          ) : null}
        </div>

        <VolleyballExplorer
          competitionId={selectedId}
          leaderboard={leaderboard}
          matches={matches}
          fixtures={fixtures}
          initialTab={initialTab}
        />
      </div>
    </section>
  );
}
