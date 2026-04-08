import type { TeamRecentFormRow } from "../types";
import { reverseRecentForm } from "../utils/reverseRecentForm";
import { ResultBadge } from "./ResultBadge";

type RecentFormStripProps = {
  rows: TeamRecentFormRow[];
};

export function RecentFormStrip({ rows }: RecentFormStripProps) {
  const displayRows = reverseRecentForm(rows);

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {displayRows.map((row) => (
        <span
          key={`form-${row.source_match_id}`}
          title={`${row.opponent_name ?? "Unknown"} • ${row.score_display ?? "—"}`}
        >
          <ResultBadge resultCode={row.result_code} />
        </span>
      ))}
    </div>
  );
}