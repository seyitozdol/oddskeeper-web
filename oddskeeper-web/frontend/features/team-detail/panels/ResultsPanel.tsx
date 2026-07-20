import type { TeamResultRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { ResultBadge } from "../components/ResultBadge";
import TeamLink from "@/components/links/TeamLink";
import { getT } from "@/lib/i18n/server";


type ResultsPanelProps = {
  rows?: TeamResultRow[];
};

function OpponentName({
  teamSlug,
  name,
}: {
  teamSlug: string | null | undefined;
  name: string | null | undefined;
}) {
  const displayName = name ?? "—";

  if (!teamSlug) {
    return <span>{displayName}</span>;
  }

  return (
    <TeamLink
      teamSlug={teamSlug}
      className="font-medium text-ink transition hover:text-ink hover:underline"
      title={displayName}
    >
      {displayName}
    </TeamLink>
  );
}

export async function ResultsPanel({ rows = [] }: ResultsPanelProps) {
  const t = await getT();

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-veil px-4 py-3 text-sm text-ink-2">
        {t("teamDetail.noResultData")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="min-w-full border-collapse">
        <thead className="bg-veil">
          <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
            <th className="px-3 py-2 font-medium">{t("common.date")}</th>
            <th className="px-3 py-2 font-medium">{t("common.competition")}</th>
            <th className="px-3 py-2 font-medium">{t("teamDetail.colHomeAway")}</th>
            <th className="px-3 py-2 font-medium">{t("common.opponent")}</th>
            <th className="px-3 py-2 font-medium">{t("common.score")}</th>
            <th className="px-3 py-2 font-medium">{t("common.result")}</th>
            <th className="px-3 py-2 font-medium">{t("teamDetail.colVenue")}</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const returnTo = `/dashboard/stats-analysis/football/team-stats/detail?team=${encodeURIComponent(
              row.team_slug
            )}&tab=results`;

            return (
              <tr
                key={`${row.source_match_id}-${row.team_slug}`}
                className="border-t border-line text-[13px] text-ink-2 transition hover:bg-veil"
              >
                <td className="px-3 py-1.5 whitespace-nowrap">
                  {formatDate(row.match_datetime)}
                </td>

                <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                  {row.competition ?? "—"}
                </td>

                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span className="rounded-md border border-line bg-veil px-2 py-[2px] text-[10px] font-medium text-ink-2">
                    {row.is_home ? t("common.home") : t("common.away")}
                  </span>
                </td>

                <td className="px-3 py-1.5 min-w-[210px]">
                  <OpponentName
                    teamSlug={row.opponent_team_slug}
                    name={row.opponent_team_name ?? row.opponent_name}
                  />
                </td>

                <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-ink">
                  {row.score_display ?? "—"}
                </td>

                <td className="px-3 py-1.5 whitespace-nowrap">
                  <ResultBadge resultCode={row.result_code} compact />
                </td>

                <td className="px-3 py-1.5 min-w-[210px] text-ink-2">
                  {row.venue_label ?? row.venue ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}