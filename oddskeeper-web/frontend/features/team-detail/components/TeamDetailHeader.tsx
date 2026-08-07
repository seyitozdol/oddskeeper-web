import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { TEAM_DETAIL_TABS } from "../constants";
import type { ValidTab } from "../types";
import type { TeamNote } from "@/lib/team-notes";
import { TeamNotes } from "./TeamNotes";

type TeamDetailHeaderProps = {
  logoPath: string;
  teamName: string;
  teamSlug: string;
  activeTab: ValidTab;
  resultsCount?: number;
  initialNotes?: TeamNote[];
};

export async function TeamDetailHeader({
  logoPath,
  teamName,
  teamSlug,
  activeTab,
  resultsCount = 0,
  initialNotes = [],
}: TeamDetailHeaderProps) {
  const t = await getT();

  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3">
      <TeamNotes
        teamSlug={teamSlug}
        teamName={teamName}
        logoPath={logoPath}
        initialNotes={initialNotes}
      >
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
      </TeamNotes>
    </div>
  );
}
