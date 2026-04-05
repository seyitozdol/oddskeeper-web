import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { footballTeams } from "@/lib/footballTeams";

type TeamPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function FootballTeamPage({ params }: TeamPageProps) {
  const { slug } = await params;

  const team = footballTeams.find((item) => item.slug === slug);

  if (!team) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <AppHeader
          title={team.name}
          subtitle="Team statistics page"
        />

        <div className="mb-6">
          <Link
            href="/football"
            className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            ← Back to Football
          </Link>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-40 w-40 items-center justify-center bg-white">
              <Image
                src={team.logo}
                alt={team.name}
                width={140}
                height={140}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <h2 className="mt-6 text-3xl font-bold text-slate-900">
              {team.name}
            </h2>

            <p className="mt-3 text-slate-600">
              Team-specific statistics will appear here.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}