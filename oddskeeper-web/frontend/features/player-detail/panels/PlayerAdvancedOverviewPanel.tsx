import type { PlayerAdvancedOverviewRow } from "../types";

type Props = {
  overview: PlayerAdvancedOverviewRow | null;
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

export default function PlayerAdvancedOverviewPanel({ overview }: Props) {
  if (!overview) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/70">
          Advanced overview data is not available for this player yet.
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
            Condensed benchmark-driven player summary.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white/80">Profile</h3>
            <MetricRow label="Season" value={overview.season_label} />
            <MetricRow label="Team" value={overview.team_name} />
            <MetricRow label="Role Group" value={overview.role_group} />
            <MetricRow label="Usage Label" value={overview.usage_label} />
            <MetricRow label="Recent Form" value={overview.recent_form_label} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white/80">Primary Strength</h3>
            <MetricRow
              label="Metric"
              value={overview.primary_strength_metric_label}
            />
            <MetricRow
              label="Value"
              value={overview.primary_strength_metric_value}
            />
            <MetricRow
              label="League Rank"
              value={overview.primary_strength_league_rank}
            />
            <MetricRow
              label="Vs League Avg %"
              value={overview.primary_strength_vs_league_pct}
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white/80">Secondary Strength</h3>
          <MetricRow
            label="Metric"
            value={overview.secondary_strength_metric_label}
          />
          <MetricRow
            label="Value"
            value={overview.secondary_strength_metric_value}
          />
          <MetricRow
            label="League Rank"
            value={overview.secondary_strength_league_rank}
          />
          <MetricRow
            label="Vs League Avg %"
            value={overview.secondary_strength_vs_league_pct}
          />
        </div>
      </div>
    </section>
  );
}