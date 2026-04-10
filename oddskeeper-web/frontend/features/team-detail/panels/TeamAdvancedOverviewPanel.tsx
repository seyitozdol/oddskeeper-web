import type { TeamAdvancedOverviewRow } from "../types";

type Props = {
  overview: TeamAdvancedOverviewRow | null;
};

function formatValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-3 last:border-b-0">
      <span className="text-sm text-white/60">{label}</span>
      <span className="text-sm font-medium text-white">{formatValue(value)}</span>
    </div>
  );
}

export default function TeamAdvancedOverviewPanel({ overview }: Props) {
  if (!overview) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/70">
          Advanced overview data is not available for this team yet.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Advanced Overview</h2>
          <p className="mt-1 text-sm text-white/60">
            Premium summary layer built from benchmark-aware team metrics.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white/80">Profile</h3>
            <MetricRow label="Season" value={overview.season_label} />
            <MetricRow label="Team" value={overview.team_name} />
            <MetricRow label="Attack Profile" value={overview.attack_profile_label} />
            <MetricRow label="Defence Profile" value={overview.defence_profile_label} />
            <MetricRow label="Recent Form" value={overview.recent_form_label} />
            <MetricRow label="Form Shift Last 5" value={overview.form_shift_last5_flag} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white/80">Strength / Weakness</h3>
            <MetricRow label="Strongest Metric" value={overview.strongest_metric_label} />
            <MetricRow label="Strongest Rank" value={overview.strongest_metric_rank} />
            <MetricRow
              label="Strongest Vs League Avg %"
              value={overview.strongest_metric_vs_league_pct}
            />
            <MetricRow label="Weakest Metric" value={overview.weakest_metric_label} />
            <MetricRow label="Weakest Rank" value={overview.weakest_metric_rank} />
            <MetricRow
              label="Weakest Vs League Avg %"
              value={overview.weakest_metric_vs_league_pct}
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white/80">Splits</h3>
          <MetricRow
            label="Home / Away Gap Metric"
            value={overview.home_away_gap_metric_label}
          />
          <MetricRow
            label="Home Value"
            value={overview.home_away_gap_home_value}
          />
          <MetricRow
            label="Away Value"
            value={overview.home_away_gap_away_value}
          />
          <MetricRow
            label="Absolute Gap"
            value={overview.home_away_gap_abs}
          />
        </div>
      </div>
    </section>
  );
}