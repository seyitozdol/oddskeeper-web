import type { TeamFixtureRow } from "../types";
import { formatFixtureDate } from "../utils/formatFixtureDate";
import { formatKickoffTime } from "../utils/formatKickoffTime";

type FixturePanelProps = {
  rows: TeamFixtureRow[];
};

function getStatusClass(status: TeamFixtureRow["fixture_status"]) {
  if (status === "scheduled") {
    return "border-sky-500/25 bg-sky-500/10 text-sky-300";
  }

  if (status === "completed") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "postponed") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }

  if (status === "cancelled") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-300";
  }

  return "border-white/10 bg-white/[0.03] text-white/60";
}

export function FixturePanel({ rows }: FixturePanelProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        No fixture data found for this team.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-white/10">
      <table className="min-w-full border-collapse">
        <thead className="bg-white/[0.03]">
          <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Time</th>
            <th className="px-4 py-2 font-medium">H/A</th>
            <th className="px-4 py-2 font-medium">Opponent</th>
            <th className="px-4 py-2 font-medium">Round</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Competition</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.fixture_id}
              className="border-t border-white/10 text-[13px] text-white/80 transition hover:bg-white/[0.018]"
            >
              <td className="px-4 py-2 whitespace-nowrap">
                {formatFixtureDate(row.fixture_date)}
              </td>

              <td className="px-4 py-2 whitespace-nowrap text-white/70">
                {formatKickoffTime(row.kickoff_time_known, row.kickoff_time_text)}
              </td>

              <td className="px-4 py-2 whitespace-nowrap">
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-[2px] text-[10px] font-medium text-white/72">
                  {row.is_home ? "Home" : "Away"}
                </span>
              </td>

              <td className="px-4 py-2 min-w-[210px] font-medium text-white">
                {row.opponent_name ?? "—"}
              </td>

              <td className="px-4 py-2 whitespace-nowrap text-white/70">
                {row.round_number}
              </td>

              <td className="px-4 py-2 whitespace-nowrap">
                <span
                  className={`inline-flex min-w-[64px] items-center justify-center rounded-md border px-2 py-[2px] text-[10px] font-semibold uppercase ${getStatusClass(
                    row.fixture_status
                  )}`}
                >
                  {row.fixture_status}
                </span>
              </td>

              <td className="px-4 py-2 whitespace-nowrap text-white/60">
                {row.competition ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}