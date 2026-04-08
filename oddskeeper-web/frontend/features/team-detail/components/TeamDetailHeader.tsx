import Image from "next/image";
import Link from "next/link";
import { TEAM_DETAIL_TABS } from "../constants";
import type { ValidTab } from "../types";

type TeamDetailHeaderProps = {
  logoPath: string;
  teamName: string;
  teamSlug: string;
  activeTab: ValidTab;
  resultsCount?: number;
};

export function TeamDetailHeader({
  logoPath,
  teamName,
  teamSlug,
  activeTab,
  resultsCount = 0,
}: TeamDetailHeaderProps) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] px-4 py-3 shadow-[0_0_22px_rgba(34,104,189,0.04)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-[#08111d] p-2">
              <Image
                src={logoPath}
                alt={teamName}
                width={48}
                height={48}
                className="h-auto max-h-[48px] w-auto max-w-[48px] object-contain"
              />
            </div>

            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-[#7cbcff]">
                Football Team Stats
              </p>

              <h1 className="truncate text-[28px] font-semibold leading-none text-white lg:text-[32px]">
                {teamName}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {TEAM_DETAIL_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const showResultsCount =
              tab.key === "results" &&
              activeTab === "results" &&
              resultsCount > 0;

            return (
              <Link
                key={tab.key}
                href={`/dashboard/stats-analysis/football/team-stats/detail?team=${teamSlug}&tab=${tab.key}`}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                  isActive
                    ? "border-[#4da2ff]/40 bg-[#10233b] text-white shadow-[0_0_14px_rgba(77,162,255,0.08)]"
                    : "border-white/10 bg-white/[0.03] text-white/72 hover:border-[#4da2ff]/25 hover:bg-[#0e1d30] hover:text-white"
                }`}
              >
                <span>{tab.label}</span>

                {showResultsCount && (
                  <span className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[11px] leading-none text-white/80">
                    {resultsCount}
                  </span>
                )}
              </Link>
            );
          })}

          <Link
            href="/dashboard/stats-analysis/football/team-stats"
            className="ml-0 inline-flex rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/70 transition hover:border-[#4da2ff]/30 hover:bg-[#0e1d30] hover:text-white xl:ml-3"
          >
            ← Back to teams
          </Link>
        </div>
      </div>
    </div>
  );
}