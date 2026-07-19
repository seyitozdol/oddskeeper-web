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
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        {t("teamDetail.noSeasonHistoryData")}
      </div>
    );
  }

  const currentSeasonLabel = rows[0]?.season_label ?? null;

  return (
    <div className="space-y-3">
      <div className="rounded-[14px] border border-white/10">
        <div className="border-b border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/42">
            {t("teamDetail.seasonHistoryTitle")}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
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
                    className="border-t border-white/10 text-[13px] text-white/80"
                  >
                    <td className="px-3 py-2 font-medium text-white">
                      {row.season_label ?? "—"}
                      {isCurrent ? (
                        <span className="ml-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-sky-300">
                          {t("teamDetail.currentBadge")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{row.played}</td>
                    <td className="px-3 py-2">{row.wins}</td>
                    <td className="px-3 py-2">{row.draws}</td>
                    <td className="px-3 py-2">{row.losses}</td>
                    <td className="px-3 py-2">{row.goals_for}</td>
                    <td className="px-3 py-2">{row.goals_against}</td>
                    <td className="px-3 py-2">{row.goal_difference}</td>
                    <td className="px-3 py-2 font-medium text-white">
                      {row.points}
                    </td>
                    <td className="px-3 py-2">
                      {formatPercentage(row.win_rate_pct)}
                    </td>
                    <td className="px-3 py-2">
                      {formatDecimal(row.points_per_game)}
                    </td>
                    <td className="px-3 py-2">
                      {formatDecimal(row.goals_for_per_game)}
                    </td>
                    <td className="px-3 py-2">
                      {formatDecimal(row.goals_against_per_game)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[12px] text-white/45">
        {t("teamDetail.seasonHistoryFootnote")}
      </div>
    </div>
  );
}
