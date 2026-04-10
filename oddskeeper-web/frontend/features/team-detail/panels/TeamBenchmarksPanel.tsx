import type { TeamMetricBenchmarkRow } from "../types";

type Props = {
  benchmarks?: TeamMetricBenchmarkRow[];
};

function formatValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default function TeamBenchmarksPanel({ benchmarks = [] }: Props) {
  if (benchmarks.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/70">
          Benchmark data is not available for this team yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">Benchmarks</h2>
        <p className="mt-1 text-sm text-white/60">
          League-context view for the team&apos;s tracked advanced metrics.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/60">
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Metric</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-3 py-2 font-medium">League Rank</th>
              <th className="px-3 py-2 font-medium">League Avg</th>
              <th className="px-3 py-2 font-medium">Vs Avg %</th>
              <th className="px-3 py-2 font-medium">Rank Dir</th>
              <th className="px-3 py-2 font-medium">Above Avg</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((row, index) => (
              <tr
                key={`${row.metric_key}-${index}`}
                className="border-b border-white/5 text-white/85 last:border-b-0"
              >
                <td className="px-3 py-2">{formatValue(row.category)}</td>
                <td className="px-3 py-2">
                  {formatValue(row.metric_label ?? row.display_label)}
                </td>
                <td className="px-3 py-2">{formatValue(row.metric_value)}</td>
                <td className="px-3 py-2">{formatValue(row.league_rank)}</td>
                <td className="px-3 py-2">{formatValue(row.league_avg)}</td>
                <td className="px-3 py-2">
                  {formatValue(row.vs_league_avg_pct)}
                </td>
                <td className="px-3 py-2">{formatValue(row.rank_direction)}</td>
                <td className="px-3 py-2">
                  {formatValue(row.above_league_avg_flag)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}