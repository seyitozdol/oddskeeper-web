import type { PlayerMatchLogRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { formatDecimal } from "../utils/formatDecimal";
import { PlayerResultBadge } from "../components/PlayerResultBadge";
import TeamLink from "@/components/links/TeamLink";

type PlayerMatchLogPanelProps = {
  rows: PlayerMatchLogRow[];
};

export function PlayerMatchLogPanel({ rows }: PlayerMatchLogPanelProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        No match log data found for this player.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-white/10">
      <table className="min-w-full border-collapse">
        <thead className="bg-white/[0.03]">
          <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Opponent</th>
            <th className="px-4 py-2 font-medium">H/A</th>
            <th className="px-4 py-2 font-medium">Score</th>
            <th className="px-4 py-2 font-medium">Result</th>
            <th className="px-4 py-2 font-medium">Lineup</th>
            <th className="px-4 py-2 font-medium">Pos</th>
            <th className="px-4 py-2 font-medium">Pts</th>
            <th className="px-4 py-2 font-medium">Min</th>
            <th className="px-4 py-2 font-medium">G</th>
            <th className="px-4 py-2 font-medium">A</th>
            <th className="px-4 py-2 font-medium">xG</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.source_match_id}-${row.player_source_id}`}
              className="border-t border-white/10 text-[13px] text-white/80 transition hover:bg-white/[0.018]"
            >
              <td className="px-4 py-2 whitespace-nowrap">
                {formatDate(row.match_datetime)}
              </td>

              <td className="px-4 py-2 min-w-[220px]">
                <TeamLink
                  teamSlug={row.opponent_team_slug}
                  className="font-medium text-white transition hover:text-white hover:underline"
                  title={row.opponent_name ?? "Opponent"}
                >
                  {row.opponent_name ?? "—"}
                </TeamLink>
              </td>

              <td className="px-4 py-2 whitespace-nowrap">
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-[2px] text-[10px] font-medium text-white/72">
                  {row.is_home ? "Home" : "Away"}
                </span>
              </td>

              <td className="px-4 py-2 whitespace-nowrap font-medium text-white">
                {row.score_display ?? "—"}
              </td>

              <td className="px-4 py-2 whitespace-nowrap">
                <PlayerResultBadge resultCode={row.result_code} />
              </td>

              <td className="px-4 py-2 whitespace-nowrap text-white/70">
                {row.lineup_status ?? "—"}
              </td>

              <td className="px-4 py-2 whitespace-nowrap text-white/70">
                {row.position_code ?? "—"}
              </td>

              <td className="px-4 py-2 whitespace-nowrap">
                {formatDecimal(row.points, 1)}
              </td>

              <td className="px-4 py-2 whitespace-nowrap">
                {row.minutes_played ?? "—"}
              </td>

              <td className="px-4 py-2 whitespace-nowrap">
                {row.goals ?? "—"}
              </td>

              <td className="px-4 py-2 whitespace-nowrap">
                {row.assists ?? "—"}
              </td>

              <td className="px-4 py-2 whitespace-nowrap">
                {formatDecimal(row.expected_goals, 3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}