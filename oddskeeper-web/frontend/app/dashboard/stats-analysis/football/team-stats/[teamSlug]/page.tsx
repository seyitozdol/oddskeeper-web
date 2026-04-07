import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFootballTeamBySlug } from "../../../../../../lib/football-teams";

type TeamDetailPageProps = {
  params: {
    teamSlug: string;
  };
};

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  const team = await getFootballTeamBySlug(params.teamSlug);

  if (!team) {
    notFound();
  }

  return (
    <section className="w-full">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,40,0.96),rgba(7,14,24,0.96))] p-8 shadow-[0_0_60px_rgba(34,104,189,0.12)]">
        <Link
          href="/dashboard/stats-analysis/football/team-stats"
          className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 transition hover:border-[#4da2ff]/30 hover:bg-[#0e1d30] hover:text-white"
        >
          ← Back to teams
        </Link>

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-[28px] border border-white/10 bg-[#0a1320] p-5">
            <Image
              src={team.logoPath}
              alt={team.name}
              width={88}
              height={88}
              className="h-auto max-h-[88px] w-auto max-w-[88px] object-contain"
            />
          </div>

          <div>
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-[#7cbcff]">
              Football Team Stats
            </p>

            <h1 className="text-3xl font-semibold text-white lg:text-5xl">
              {team.name}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 lg:text-base">
              Bu takımın detay sayfası açıldı. Buraya sonraki adımda gerçek takım
              istatistik bloklarını bağlayacağız.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-sm font-medium text-white/55">Section</div>
            <div className="mt-2 text-lg font-semibold text-white">
              Team Overview
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-sm font-medium text-white/55">Section</div>
            <div className="mt-2 text-lg font-semibold text-white">
              Match Performance
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-sm font-medium text-white/55">Section</div>
            <div className="mt-2 text-lg font-semibold text-white">
              Advanced Metrics
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}