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

  const metaItems = [
    { label: "Founded", value: "—" },
    { label: "Stadium", value: "—" },
    { label: "Head Coach", value: "—" },
    { label: "Website", value: "—" },
    { label: "Capacity", value: "—" },
    { label: "Market Value", value: "—" },
  ];

  return (
    <section className="w-full">
      <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] px-5 py-4 shadow-[0_0_32px_rgba(34,104,189,0.05)]">
        <div className="flex flex-col gap-4 2xl:grid 2xl:grid-cols-[minmax(420px,560px)_minmax(320px,1fr)_auto] 2xl:items-center 2xl:gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-[#08111d] p-3">
                <Image
                  src={team.logoPath}
                  alt={team.name}
                  width={60}
                  height={60}
                  className="h-auto max-h-[60px] w-auto max-w-[60px] object-contain"
                />
              </div>

              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.28em] text-[#7cbcff]">
                  Football Team Stats
                </p>

                <h1 className="truncate text-[34px] font-semibold leading-none text-white lg:text-[40px]">
                  {team.name}
                </h1>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;

                return (
                  <Link
                    key={tab.key}
                    href={`/dashboard/stats-analysis/football/team-stats/detail?team=${team.slug}&tab=${tab.key}`}
                    className={`rounded-xl border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                      isActive
                        ? "border-[#4da2ff]/40 bg-[#10233b] text-white shadow-[0_0_18px_rgba(77,162,255,0.10)]"
                        : "border-white/10 bg-white/[0.03] text-white/72 hover:border-[#4da2ff]/25 hover:bg-[#0e1d30] hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 2xl:px-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {metaItems.map((item, index) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 text-white/55"
                >
                  <span className="font-medium text-white/38">{item.label}:</span>
                  <span className="text-white/82">{item.value}</span>
                  {index < metaItems.length - 1 && (
                    <span className="ml-1 text-white/20">•</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="2xl:justify-self-end">
            <Link
              href="/dashboard/stats-analysis/football/team-stats"
              className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/70 transition hover:border-[#4da2ff]/30 hover:bg-[#0e1d30] hover:text-white"
            >
              ← Back to teams
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}