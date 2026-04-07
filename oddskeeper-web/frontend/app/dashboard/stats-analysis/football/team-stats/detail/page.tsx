import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFootballTeamBySlug } from "../../../../../../lib/football-teams";

type TeamDetailPageProps = {
  searchParams: Promise<{
    team?: string;
    tab?: string;
  }>;
};

const VALID_TABS = ["team-statistics", "squad", "fixture", "results"] as const;

type ValidTab = (typeof VALID_TABS)[number];

function getValidTab(tab?: string): ValidTab {
  if (tab && VALID_TABS.includes(tab as ValidTab)) {
    return tab as ValidTab;
  }

  return "team-statistics";
}

export default async function TeamDetailPage({
  searchParams,
}: TeamDetailPageProps) {
  const resolvedSearchParams = await searchParams;
  const teamSlug = resolvedSearchParams.team;
  const activeTab = getValidTab(resolvedSearchParams.tab);

  if (!teamSlug) {
    notFound();
  }

  const team = await getFootballTeamBySlug(teamSlug);

  if (!team) {
    notFound();
  }

  const tabs: { key: ValidTab; label: string }[] = [
    { key: "team-statistics", label: "Team Statistics" },
    { key: "squad", label: "Squad" },
    { key: "fixture", label: "Fixture" },
    { key: "results", label: "Results" },
  ];

  return (
    <section className="w-full">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] p-8 shadow-[0_0_50px_rgba(34,104,189,0.08)]">
        <Link
          href="/dashboard/stats-analysis/football/team-stats"
          className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 transition hover:border-[#4da2ff]/30 hover:bg-[#0e1d30] hover:text-white"
        >
          ← Back to teams
        </Link>

        <div className="mt-8 max-w-[1120px]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[30px] border border-white/10 bg-[#08111d] p-5">
              <Image
                src={team.logoPath}
                alt={team.name}
                width={96}
                height={96}
                className="h-auto max-h-[96px] w-auto max-w-[96px] object-contain"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-10">
                <div className="min-w-0 xl:w-[420px]">
                  <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-[#7cbcff]">
                    Football Team Stats
                  </p>

                  <h1 className="text-3xl font-semibold text-white lg:text-5xl">
                    {team.name}
                  </h1>

                  <div className="mt-8 flex flex-wrap gap-3">
                    {tabs.map((tab) => {
                      const isActive = activeTab === tab.key;

                      return (
                        <Link
                          key={tab.key}
                          href={`/dashboard/stats-analysis/football/team-stats/detail?team=${team.slug}&tab=${tab.key}`}
                          className={`rounded-2xl border px-5 py-2.5 text-sm font-medium transition ${
                            isActive
                              ? "border-[#4da2ff]/40 bg-[#10233b] text-white shadow-[0_0_25px_rgba(77,162,255,0.12)]"
                              : "border-white/10 bg-white/[0.03] text-white/72 hover:border-[#4da2ff]/25 hover:bg-[#0e1d30] hover:text-white"
                          }`}
                        >
                          {tab.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="w-full rounded-[24px] border border-white/10 bg-white/[0.03] p-5 xl:w-[520px] xl:shrink-0">
                  <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
                    Team Overview
                  </div>

                  <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-white/35">
                        Founded
                      </div>
                      <div className="mt-1 text-sm font-medium text-white">
                        —
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-white/35">
                        Stadium
                      </div>
                      <div className="mt-1 text-sm font-medium text-white">
                        —
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-white/35">
                        Website
                      </div>
                      <div className="mt-1 break-all text-sm font-medium text-white">
                        —
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-white/35">
                        Capacity
                      </div>
                      <div className="mt-1 text-sm font-medium text-white">
                        —
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-white/35">
                        Head Coach
                      </div>
                      <div className="mt-1 text-sm font-medium text-white">
                        —
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-white/35">
                        Market Value
                      </div>
                      <div className="mt-1 text-sm font-medium text-white">
                        —
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>
    </section>
  );
}