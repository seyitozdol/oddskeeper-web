import type { TeamStatisticsSplitRow } from "../types";
import { formatDecimal } from "../utils/formatDecimal";

type SplitStatsTableProps = {
  rows: TeamStatisticsSplitRow[];
};

export function SplitStatsTable({ rows }: SplitStatsTableProps) {
  return (
    <div className="rounded-[14px] border border-white/10">
      <div className="border-b border-white/10 bg-white/[0.03] px-3 py-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/42">
          Home / Away Split
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
              <th className="px-3 py-2 font-medium">Split</th>
              <th className="px-3 py-2 font-medium">P</th>
              <th className="px-3 py-2 font-medium">W</th>
              <th className="px-3 py-2 font-medium">D</th>
              <th className="px-3 py-2 font-medium">L</th>
              <th className="px-3 py-2 font-medium">GF</th>
              <th className="px-3 py-2 font-medium">GA</th>
              <th className="px-3 py-2 font-medium">GD</th>
              <th className="px-3 py-2 font-medium">PTS</th>
              <th className="px-3 py-2 font-medium">PPG</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.team_slug}-${row.split_key}`}
                className="border-t border-white/10 text-[13px] text-white/80"
              >
                <td className="px-3 py-2 font-medium text-white">
                  {row.split_label}
                </td>
                <td className="px-3 py-2">{row.played}</td>
                <td className="px-3 py-2">{row.wins}</td>
                <td className="px-3 py-2">{row.draws}</td>
                <td className="px-3 py-2">{row.losses}</td>
                <td className="px-3 py-2">{row.goals_for}</td>
                <td className="px-3 py-2">{row.goals_against}</td>
                <td className="px-3 py-2">{row.goal_difference}</td>
                <td className="px-3 py-2">{row.points}</td>
                <td className="px-3 py-2">{formatDecimal(row.points_per_game)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}