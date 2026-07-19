import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/messages";
import type { PlayerMetricBenchmarkRow } from "../types";

type Props = {
  benchmarks?: PlayerMetricBenchmarkRow[];
};

function formatValue(
  t: Translator,
  value: string | number | boolean | null | undefined
) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean")
    return value ? t("playerDetail.yes") : t("playerDetail.no");
  return String(value);
}

export default async function PlayerBenchmarksPanel({
  benchmarks = [],
}: Props) {
  const t = await getT();

  if (benchmarks.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/70">
          {t("playerDetail.benchmarksUnavailable")}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">
          {t("playerDetail.benchmarksHeading")}
        </h2>
        <p className="mt-1 text-sm text-white/60">
          {t("playerDetail.benchmarksSubheading")}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/60">
              <th className="px-3 py-2 font-medium">
                {t("playerDetail.categoryColumn")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("playerDetail.metricLabel")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("playerDetail.valueLabel")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("playerDetail.leagueRankLabel")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("playerDetail.leagueAvgLabel")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("playerDetail.vsAvgPctLabel")}
              </th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((row, index) => (
              <tr
                key={`${row.metric_key}-${index}`}
                className="border-b border-white/5 text-white/85 last:border-b-0"
              >
                <td className="px-3 py-2">{formatValue(t, row.category)}</td>
                <td className="px-3 py-2">
                  {formatValue(t, row.metric_label ?? row.display_label)}
                </td>
                <td className="px-3 py-2">{formatValue(t, row.metric_value)}</td>
                <td className="px-3 py-2">{formatValue(t, row.league_rank)}</td>
                <td className="px-3 py-2">{formatValue(t, row.league_avg)}</td>
                <td className="px-3 py-2">
                  {formatValue(t, row.vs_league_avg_pct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
