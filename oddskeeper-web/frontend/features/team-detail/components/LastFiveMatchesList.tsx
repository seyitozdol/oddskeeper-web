import { getT } from "@/lib/i18n/server";
import type { TeamRecentFormRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { ResultBadge } from "./ResultBadge";

type LastFiveMatchesListProps = {
  rows?: TeamRecentFormRow[];
};

export async function LastFiveMatchesList({
  rows = [],
}: LastFiveMatchesListProps) {
  const t = await getT();

  return (
    <div className="rounded-xl border border-line">
      <div className="border-b border-line bg-veil px-3 py-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">
          {t("teamDetail.last5MatchesTitle")}
        </div>
      </div>

      <div className="divide-y divide-line">
        {(rows ?? []).map((row) => (
          <div
            key={`recent-${row.source_match_id}`}
            className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]"
          >
            <div className="min-w-0">
              <div className="truncate text-ink-2">
                {row.opponent_name ?? "—"}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-3">
                {formatDate(row.match_datetime)} •{" "}
                {row.is_home ? t("common.home") : t("common.away")}
              </div>
            </div>

            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-ink font-medium">
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