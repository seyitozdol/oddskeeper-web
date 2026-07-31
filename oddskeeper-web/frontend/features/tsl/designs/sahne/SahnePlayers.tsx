import { getT } from "@/lib/i18n/server";
import type { PlayersBundle } from "@/features/tsl/server/loaders";
import { preferredBasis } from "@/features/tsl/lib";
import TslMetricNav from "@/features/tsl/shared/TslMetricNav";
import SahneLeaderTable from "./SahneLeaderTable";

export default async function SahnePlayers({ data }: { data: PlayersBundle }) {
  const t = await getT();
  const { catalog, metricKey, metric, rows } = data;

  if (!catalog.length) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-3">
              {metric?.categoryLabel}
            </p>
            <h2 className="text-[18px] font-semibold text-ink">{metric?.metricLabel}</h2>
          </div>
          <span className="text-[12px] text-ink-3">{t("tsl.leaderboard")}</span>
        </div>
        <TslMetricNav catalog={catalog} metricKey={metricKey} />
      </div>

      <SahneLeaderTable rows={rows} defaultBasis={metric ? preferredBasis(metric) : "total"} />
      <p className="text-[11px] text-ink-3">{t("tsl.dataNote")}</p>
    </div>
  );
}
