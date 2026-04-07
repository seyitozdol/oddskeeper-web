import Image from "next/image";
import Link from "next/link";
import { getFootballTeams } from "../../../../../lib/football-teams";

export default async function FootballTeamStatsPage() {
  const teams = await getFootballTeams();

  return (
    <section className="w-full">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,40,0.96),rgba(7,14,24,0.96))] p-8 shadow-[0_0_60px_rgba(34,104,189,0.12)]">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-[#7cbcff]">
            Football Team Stats
          </p>

          <h1 className="text-3xl font-semibold text-white lg:text-5xl">
            Türkiye Super League Teams
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 lg:text-base">
            Bir takım seç. Seçilen takımın kendi detay sayfası açılacak.
          </p>
        </div>

        {teams.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/70">
            Team logos bulunamadı. Şu klasörü kontrol et:
            <div className="mt-2 font-mono text-xs text-[#8dc8ff]">
              public/images/football_logos
            </div>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {teams.map((team) => (
              <Link
                key={team.slug}
                href={`/dashboard/stats-analysis/football/team-stats/${team.slug}`}
                className="group rounded-[24px] border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#4da2ff]/35 hover:bg-[#0e1d30] hover:shadow-[0_0_30px_rgba(77,162,255,0.10)]"
              >
                <div className="flex min-h-[170px] flex-col items-center justify-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-[22px] border border-white/10 bg-[#0a1320] p-4">
                    <Image
                      src={team.logoPath}
                      alt={team.name}
                      width={72}
                      height={72}
                      className="h-auto max-h-[72px] w-auto max-w-[72px] object-contain"
                    />
                  </div>

                  <div className="mt-5 text-center text-sm font-semibold text-white transition group-hover:text-[#9fd3ff]">
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