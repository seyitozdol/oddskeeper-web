import type { TeamResultRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { ResultBadge } from "../components/ResultBadge";
import TeamLink from "@/components/links/TeamLink";


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
      className="font-medium text-white transition hover:text-white hover:underline"
      title={displayName}
    >
      {displayName}
    </TeamLink>
  );
}

export function ResultsPanel({ rows = [] }: ResultsPanelProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        No result data found for this team.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-white/10">
      <table className="min-w-full border-collapse">
        <thead className="bg-white/[0.03]">
          <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Competition</th>
            <th className="px-4 py-2 font-medium">H/A</th>
            <th className="px-4 py-2 font-medium">Opponent</th>
            <th className="px-4 py-2 font-medium">Score</th>
            <th className="px-4 py-2 font-medium">Result</th>
            <th className="px-4 py-2 font-medium">Venue</th>
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
                className="border-t border-white/10 text-[13px] text-white/80 transition hover:bg-white/[0.018]"
              >
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatDate(row.match_datetime)}
                </td>

                <td className="px-4 py-2 whitespace-nowrap text-white/60">
                  {row.competition ?? "—"}
                </td>

                <td className="px-4 py-2 whitespace-nowrap">
                  <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-[2px] text-[10px] font-medium text-white/72">
                    {row.is_home ? "Home" : "Away"}
                  </span>
                </td>

                <td className="px-4 py-2 min-w-[210px]">
                  <OpponentName
                    teamSlug={row.opponent_team_slug}
                    name={row.opponent_team_name ?? row.opponent_name}
                  />
                </td>

                <td className="px-4 py-2 whitespace-nowrap font-semibold text-white">
                  {row.score_display ?? "—"}
                </td>

                <td className="px-4 py-2 whitespace-nowrap">
                  <ResultBadge resultCode={row.result_code} compact />
                </td>

                <td className="px-4 py-2 min-w-[210px] text-white/60">
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