import Image from "next/image";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { TEAM_DETAIL_TABS } from "../constants";
import type { ValidTab } from "../types";

type TeamDetailHeaderProps = {
  logoPath: string;
  teamName: string;
  teamSlug: string;
  activeTab: ValidTab;
  resultsCount?: number;
};

export async function TeamDetailHeader({
  logoPath,
  teamName,
  teamSlug,
  activeTab,
  resultsCount = 0,
}: TeamDetailHeaderProps) {
  const t = await getT();

  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-card-2 p-2">
              <Image
                src={logoPath}
                alt={teamName}
                width={36}
                height={36}
                className="h-auto max-h-9 w-auto max-w-9 object-contain"
              />
            </div>

            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-accent-ink">
                {t("teamDetail.headerKicker")}
              </p>

              <h1 className="truncate text-xl font-semibold leading-none text-ink lg:text-2xl">
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
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                  isActive
                    ? "border-line-strong bg-card-2 text-ink"
                    : "border-line bg-veil text-ink-2 hover:border-line-strong hover:bg-card-2 hover:text-ink"
                }`}
              >
                <span>{t(tab.labelKey)}</span>

                {showResultsCount && (
                  <span className="rounded-md border border-line bg-veil px-1.5 py-0.5 text-[11px] leading-none text-ink-2">
                    {resultsCount}
                  </span>
                )}
              </Link>
            );
          })}

          <Link
            href="/dashboard/stats-analysis/football/team-stats"
            className="ml-0 inline-flex rounded-lg border border-line bg-veil px-3 py-1.5 text-sm text-ink-2 transition hover:border-line-strong hover:bg-card-2 hover:text-ink xl:ml-3"
          >
            {t("teamDetail.backToTeams")}
          </Link>
        </div>
      </div>
    </div>
  );
}