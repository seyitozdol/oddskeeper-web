import Image from "next/image";
import Link from "next/link";
import { getFootballTeams } from "../../../../../lib/football-teams";
import { getT } from "@/lib/i18n/server";

export default async function FootballTeamStatsPage() {
  const [teams, t] = await Promise.all([getFootballTeams(), getT()]);

  return (
    <section className="w-full">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] p-8 shadow-[0_0_50px_rgba(34,104,189,0.08)]">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-[#7cbcff]">
            {t("statsHub.teamStatsKicker")}
          </p>

          <h1 className="text-3xl font-semibold text-white lg:text-5xl">
            {t("statsHub.teamStatsTitle")}
          </h1>
        </div>

        {teams.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/70">
            {t("statsHub.teamLogosMissing")}
            <div className="mt-2 font-mono text-xs text-[#8dc8ff]">
              public/images/football_logos
            </div>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
            {teams.map((team) => (
              <Link
                key={team.slug}
                href={`/dashboard/stats-analysis/football/team-stats/detail?team=${team.slug}`}
                className="group rounded-[26px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(35,90,180,0.10),rgba(9,17,31,0.96)_62%)] p-6 transition duration-200 hover:-translate-y-1 hover:border-[#4da2ff]/30 hover:bg-[radial-gradient(circle_at_top,rgba(45,110,210,0.16),rgba(10,18,32,0.98)_62%)] hover:shadow-[0_0_28px_rgba(77,162,255,0.10)]"
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

                  <div className="mt-6 text-center text-base font-semibold text-white transition group-hover:text-[#9fd3ff]">
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