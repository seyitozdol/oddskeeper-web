import type { TeamRecentFormRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { ResultBadge } from "./ResultBadge";

type LastFiveMatchesListProps = {
  rows?: TeamRecentFormRow[];
};

export function LastFiveMatchesList({ rows = [] }: LastFiveMatchesListProps) {
  return (
    <div className="rounded-[14px] border border-white/10">
      <div className="border-b border-white/10 bg-white/[0.03] px-3 py-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/42">
          Last 5 Matches
        </div>
      </div>

      <div className="divide-y divide-white/10">
        {(rows ?? []).map((row) => (
          <div
            key={`recent-${row.source_match_id}`}
            className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]"
          >
            <div className="min-w-0">
              <div className="truncate text-white/82">
                {row.opponent_name ?? "—"}
              </div>
              <div className="mt-0.5 text-[11px] text-white/45">
                {formatDate(row.match_datetime)} • {row.is_home ? "Home" : "Away"}
              </div>
            </div>

            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-white font-medium">
                {row.score_display ?? "—"}
              </span>
              <ResultBadge resultCode={row.result_code} compact />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}