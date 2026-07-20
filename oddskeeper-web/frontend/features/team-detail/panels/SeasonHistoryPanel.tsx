import { getT } from "@/lib/i18n/server";
import type { TeamStatisticsSummaryRow } from "../types";
import { formatDecimal } from "../utils/formatDecimal";
import { formatPercentage } from "../utils/formatPercentage";

type SeasonHistoryPanelProps = {
  rows?: TeamStatisticsSummaryRow[];
};

export async function SeasonHistoryPanel({
  rows = [],
}: SeasonHistoryPanelProps) {
  const t = await getT();

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-veil px-4 py-3 text-sm text-ink-2">
        {t("teamDetail.noSeasonHistoryData")}
      </div>
    );
  }

  const currentSeasonLabel = rows[0]?.season_label ?? null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line">
        <div className="border-b border-line bg-veil px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">
            {t("teamDetail.seasonHistoryTitle")}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
                <th className="px-3 py-2 font-medium">{t("teamDetail.colSeason")}</th>
                <th className="px-3 py-2 font-medium">{t("teamDetail.colP")}</th>
                <th className="px-3 py-2 font-medium">{t("teamDetail.colW")}</th>
                <th className="px-3 py-2 font-medium">{t("teamDetail.colD")}</th>
                <th className="px-3 py-2 font-medium">{t("teamDetail.colL")}</th>
                <th className="px-3 py-2 font-medium">{t("teamDetail.colGf")}</th>
                <th className="px-3 py-2 font-medium">{t("teamDetail.colGa")}</th>
                <th className="px-3 py-2 font-medium">{t("teamDetail.colGd")}</th>
                <th className="px-3 py-2 font-medium">{t("teamDetail.colPts")}</th>
                <th className="px-3 py-2 font-medium">{t("teamDetail.colWinPct")}</th>
                <th className="px-3 py-2 font-medium">{t("teamDetail.colPpg")}</th>
                <th className="px-3 py-2 font-medium">{t("teamDetail.colGfPerGame")}</th>
                <th className="px-3 py-2 font-medium">{t("teamDetail.colGaPerGame")}</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const isCurrent = row.season_label === currentSeasonLabel;

                return (
                  <tr
                    key={`${row.team_slug}-${row.season_label}`}
                    className="border-t border-line text-[13px] text-ink-2"
                  >
                    <td className="px-3 py-1.5 font-medium text-ink">
                      {row.season_label ?? "—"}
                      {isCurrent ? (
                        <span className="ml-2 rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-accent-ink">
                          {t("teamDetail.currentBadge")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5">{row.played}</td>
                    <td className="px-3 py-1.5">{row.wins}</td>
                    <td className="px-3 py-1.5">{row.draws}</td>
                    <td className="px-3 py-1.5">{row.losses}</td>
                    <td className="px-3 py-1.5">{row.goals_for}</td>
                    <td className="px-3 py-1.5">{row.goals_against}</td>
                    <td className="px-3 py-1.5">{row.goal_difference}</td>
                    <td className="px-3 py-1.5 font-medium text-ink">
                      {row.points}
                    </td>
                    <td className="px-3 py-1.5">
                      {formatPercentage(row.win_rate_pct)}
                    </td>
                    <td className="px-3 py-1.5">
                      {formatDecimal(row.points_per_game)}
                    </td>
                    <td className="px-3 py-1.5">
                      {formatDecimal(row.goals_for_per_game)}
                    </td>
                    <td className="px-3 py-1.5">
                      {formatDecimal(row.goals_against_per_game)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-veil px-4 py-3 text-[12px] text-ink-3">
        {t("teamDetail.seasonHistoryFootnote")}
      </div>
    </div>
  );
}
