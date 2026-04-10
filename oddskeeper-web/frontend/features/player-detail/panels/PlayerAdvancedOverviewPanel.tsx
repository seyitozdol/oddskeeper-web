import type { PlayerAdvancedOverviewRow } from "../types";

type Props = {
  overview: PlayerAdvancedOverviewRow | null;
};

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-3 last:border-b-0">
      <span className="text-sm text-white/60">{label}</span>
      <span className="text-sm font-medium text-white">
        {value === null || value === undefined || value === "" ? "-" : value}
      </span>
    </div>
  );
}

function getDisplayValue(
  source: Record<string, unknown>,
  key: string
): string | number | null {
  const value = source[key];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  return String(value);
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

  const data = overview as unknown as Record<string, unknown>;

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
            <MetricRow label="Season" value={getDisplayValue(data, "season_label")} />
            <MetricRow label="Team" value={getDisplayValue(data, "team_name")} />
            <MetricRow label="Role Group" value={getDisplayValue(data, "role_group")} />
            <MetricRow label="Usage Label" value={getDisplayValue(data, "usage_label")} />
            <MetricRow label="Recent Form" value={getDisplayValue(data, "recent_form_label")} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white/80">Primary Strength</h3>
            <MetricRow
              label="Metric"
              value={getDisplayValue(data, "primary_strength_metric_label")}
            />
            <MetricRow
              label="Value"
              value={getDisplayValue(data, "primary_strength_metric_value")}
            />
            <MetricRow
              label="League Rank"
              value={getDisplayValue(data, "primary_strength_league_rank")}
            />
            <MetricRow
              label="Vs League Avg %"
              value={getDisplayValue(data, "primary_strength_vs_league_pct")}
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white/80">Secondary Strength</h3>
          <MetricRow
            label="Metric"
            value={getDisplayValue(data, "secondary_strength_metric_label")}
          />
          <MetricRow
            label="Value"
            value={getDisplayValue(data, "secondary_strength_metric_value")}
          />
        </div>
      </div>
    </section>
  );
}