import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFootballTeamBySlug } from "../../../../../../lib/football-teams";

type TeamDetailPageProps = {
  searchParams: Promise<{
    team?: string;
  }>;
};

export default async function TeamDetailPage({
  searchParams,
}: TeamDetailPageProps) {
  const resolvedSearchParams = await searchParams;
  const teamSlug = resolvedSearchParams.team;

  if (!teamSlug) {
    notFound();
  }

  const team = await getFootballTeamBySlug(teamSlug);

  if (!team) {
    notFound();
  }

  return (
    <section className="w-full">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] p-8 shadow-[0_0_50px_rgba(34,104,189,0.08)]">
        <Link
          href="/dashboard/stats-analysis/football/team-stats"
          className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 transition hover:border-[#4da2ff]/30 hover:bg-[#0e1d30] hover:text-white"
        >
          ← Back to teams
        </Link>

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex h-32 w-32 items-center justify-center rounded-[30px] border border-white/10 bg-[#08111d] p-5">
            <Image
              src={team.logoPath}
              alt={team.name}
              width={96}
              height={96}
              className="h-auto max-h-[96px] w-auto max-w-[96px] object-contain"
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