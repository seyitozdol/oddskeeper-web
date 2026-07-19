import { getT } from "@/lib/i18n/server";
import type { TeamRecentFormRow } from "../types";
import { reverseRecentForm } from "../utils/reverseRecentForm";
import { ResultBadge } from "./ResultBadge";

type RecentFormStripProps = {
  rows: TeamRecentFormRow[];
};

export async function RecentFormStrip({ rows }: RecentFormStripProps) {
  const t = await getT();
  const displayRows = reverseRecentForm(rows);

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {displayRows.map((row) => (
        <span
          key={`form-${row.source_match_id}`}
          title={`${row.opponent_name ?? t("teamDetail.unknownOpponent")} • ${
            row.score_display ?? "—"
          }`}
        >
          <ResultBadge resultCode={row.result_code} />
        </span>
      ))}
    </div>
  );
}