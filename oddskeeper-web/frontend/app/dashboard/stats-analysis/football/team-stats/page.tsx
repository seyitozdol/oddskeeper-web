import Image from "next/image";
import Link from "next/link";
import { getFootballTeams } from "../../../../../lib/football-teams";
import { getT } from "@/lib/i18n/server";

export default async function FootballTeamStatsPage() {
  const [teams, t] = await Promise.all([getFootballTeams(), getT()]);

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-accent-ink">
            {t("statsHub.teamStatsKicker")}
          </p>

          <h1 className="text-3xl font-semibold text-ink lg:text-5xl">
            {t("statsHub.teamStatsTitle")}
          </h1>
        </div>

        {teams.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-line bg-veil p-6 text-sm text-ink-2">
            {t("statsHub.teamLogosMissing")}
            <div className="mt-2 font-mono text-xs text-accent-ink">
              public/images/football_logos
            </div>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
            {teams.map((team) => (
              <Link
                key={team.slug}
                href={`/dashboard/stats-analysis/football/team-stats/detail?team=${team.slug}`}
                className="group rounded-xl border border-line bg-veil p-6 transition duration-200 hover:-translate-y-1 hover:border-line-strong hover:bg-card-2"
              >
                <div className="flex min-h-[200px] flex-col items-center justify-center">
                  <div className="flex h-[120px] items-center justify-center">
                    <Image
                      src={team.logoPath}
                      alt={team.name}
                      width={110}
                      height={110}
                      className="h-auto max-h-[110px] w-auto max-w-[110px] object-contain transition duration-200 group-hover:scale-105"
                    />
                  </div>

                  <div className="mt-6 text-center text-base font-semibold text-ink transition group-hover:text-accent-ink">
                    {team.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}