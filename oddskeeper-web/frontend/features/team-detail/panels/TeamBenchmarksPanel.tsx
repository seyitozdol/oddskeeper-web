import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/messages";
import type { TeamMetricBenchmarkRow } from "../types";

type Props = {
  benchmarks?: TeamMetricBenchmarkRow[];
};

function formatValue(
  value: string | number | boolean | null | undefined,
  t: Translator
) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean")
    return value ? t("teamDetail.yesLabel") : t("teamDetail.noLabel");
  return String(value);
}

export default async function TeamBenchmarksPanel({ benchmarks = [] }: Props) {
  const t = await getT();

  if (benchmarks.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/70">
          {t("teamDetail.benchmarksNoData")}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">
          {t("teamDetail.benchmarksTitle")}
        </h2>
        <p className="mt-1 text-sm text-white/60">
          {t("teamDetail.benchmarksDescription")}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/60">
              <th className="px-3 py-2 font-medium">{t("teamDetail.colCategory")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colMetric")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colValue")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colLeagueRank")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colLeagueAvg")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colVsAvgPct")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colRankDir")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colAboveAvg")}</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((row, index) => (
              <tr
                key={`${row.metric_key}-${index}`}
                className="border-b border-white/5 text-white/85 last:border-b-0"
              >
                <td className="px-3 py-2">{formatValue(row.category, t)}</td>
                <td className="px-3 py-2">
                  {formatValue(row.metric_label ?? row.display_label, t)}
                </td>
                <td className="px-3 py-2">{formatValue(row.metric_value, t)}</td>
                <td className="px-3 py-2">{formatValue(row.league_rank, t)}</td>
                <td className="px-3 py-2">{formatValue(row.league_avg, t)}</td>
                <td className="px-3 py-2">
                  {formatValue(row.vs_league_avg_pct, t)}
                </td>
                <td className="px-3 py-2">{formatValue(row.rank_direction, t)}</td>
                <td className="px-3 py-2">
                  {formatValue(row.above_league_avg_flag, t)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}