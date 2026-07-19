import { getT } from "@/lib/i18n/server";
import type { TeamStatisticsSplitRow } from "../types";
import { formatDecimal } from "../utils/formatDecimal";

type SplitStatsTableProps = {
  rows?: TeamStatisticsSplitRow[];
};

export async function SplitStatsTable({ rows = [] }: SplitStatsTableProps) {
  const t = await getT();

  return (
    <div className="rounded-[14px] border border-white/10">
      <div className="border-b border-white/10 bg-white/[0.03] px-3 py-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/42">
          {t("teamDetail.homeAwaySplitTitle")}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
              <th className="px-3 py-2 font-medium">{t("teamDetail.colSplit")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colP")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colW")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colD")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colL")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colGf")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colGa")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colGd")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colPts")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colPpg")}</th>
            </tr>
          </thead>

          <tbody>
            {(rows ?? []).map((row) => (
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
                <td className="px-3 py-2">
                  {formatDecimal(row.points_per_game)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}