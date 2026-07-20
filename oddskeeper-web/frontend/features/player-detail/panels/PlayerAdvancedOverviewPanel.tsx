import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/messages";
import { metricLabel } from "@/lib/i18n/metricLabel";
import type { PlayerAdvancedOverviewRow } from "../types";

type Props = {
  overview: PlayerAdvancedOverviewRow | null;
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

function MetricRow({
  t,
  label,
  value,
}: {
  t: Translator;
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between border-b border-line py-3 last:border-b-0">
      <span className="text-sm text-ink-2">{label}</span>
      <span className="text-sm font-medium text-ink">
        {formatValue(t, value)}
      </span>
    </div>
  );
}

export default async function PlayerAdvancedOverviewPanel({ overview }: Props) {
  const t = await getT();

  if (!overview) {
    return (
      <section className="rounded-2xl border border-line bg-veil p-5">
        <p className="text-sm text-ink-2">
          {t("playerDetail.advancedOverviewUnavailable")}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-line bg-veil p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-ink">
            {t("playerDetail.advancedOverviewHeading")}
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            {t("playerDetail.advancedOverviewSubheading")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-card-2 p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">
              {t("playerDetail.profileLabel")}
            </h3>
            <MetricRow t={t} label={t("common.season")} value={overview.season_label} />
            <MetricRow t={t} label={t("common.team")} value={overview.team_name} />
            <MetricRow
              t={t}
              label={t("playerDetail.roleGroupLabel")}
              value={overview.role_group}
            />
            <MetricRow
              t={t}
              label={t("playerDetail.usageLabelLabel")}
              value={overview.usage_label}
            />
            <MetricRow
              t={t}
              label={t("playerDetail.recentFormLabel")}
              value={overview.recent_form_label}
            />
          </div>

          <div className="rounded-2xl border border-line bg-card-2 p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">
              {t("playerDetail.primaryStrengthLabel")}
            </h3>
            <MetricRow
              t={t}
              label={t("playerDetail.metricLabel")}
              value={metricLabel(
                t,
                overview.primary_strength_metric_key,
                overview.primary_strength_metric_label
              )}
            />
            <MetricRow
              t={t}
              label={t("playerDetail.valueLabel")}
              value={overview.primary_strength_metric_value}
            />
            <MetricRow
              t={t}
              label={t("playerDetail.leagueRankLabel")}
              value={overview.primary_strength_league_rank}
            />
            <MetricRow
              t={t}
              label={t("playerDetail.vsLeagueAvgPctLabel")}
              value={overview.primary_strength_vs_league_pct}
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-card-2 p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">
            {t("playerDetail.secondaryStrengthLabel")}
          </h3>
          <MetricRow
            t={t}
            label={t("playerDetail.metricLabel")}
            value={metricLabel(
              t,
              overview.secondary_strength_metric_key,
              overview.secondary_strength_metric_label
            )}
          />
          <MetricRow
            t={t}
            label={t("playerDetail.valueLabel")}
            value={overview.secondary_strength_metric_value}
          />
          <MetricRow
            t={t}
            label={t("playerDetail.leagueRankLabel")}
            value={overview.secondary_strength_league_rank}
          />
          <MetricRow
            t={t}
            label={t("playerDetail.vsLeagueAvgPctLabel")}
            value={overview.secondary_strength_vs_league_pct}
          />
        </div>
      </div>
    </section>
  );
}
