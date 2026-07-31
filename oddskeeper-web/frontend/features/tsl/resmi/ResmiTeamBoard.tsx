"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMetric } from "@/features/tsl/lib";
import TeamCrest from "@/features/tsl/shared/TeamCrest";

export type TeamLite = { id: string; name: string; logo: string | null; href: string | null };
export type MetricLite = {
  key: string;
  label: string;
  category: string;
  categoryLabel: string;
  isHigherBetter: boolean;
  format: string;
  leagueAvg: number | null;
  values: Record<string, { total: number | null; perMatch: number | null }>;
};

const CATEGORY_ORDER: Record<string, number> = {
  attacking: 1,
  build_up: 2,
  defending: 3,
  discipline: 4,
};

export default function ResmiTeamBoard({
  teams,
  metrics,
}: {
  teams: TeamLite[];
  metrics: MetricLite[];
}) {
  const { t } = useI18n();

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: MetricLite[] }>();
    for (const m of metrics) {
      if (!map.has(m.category)) map.set(m.category, { label: m.categoryLabel, items: [] });
      map.get(m.category)!.items.push(m);
    }
    return [...map.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => (CATEGORY_ORDER[a.key] ?? 9) - (CATEGORY_ORDER[b.key] ?? 9));
  }, [metrics]);

  const [metricKey, setMetricKey] = useState(
    metrics.find((m) => m.key === "team_goals_for")?.key ?? metrics[0]?.key ?? ""
  );
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];
  const activeCategory = metric?.category;
  const activeItems = groups.find((g) => g.key === activeCategory)?.items ?? [];

  const ranked = useMemo(() => {
    if (!metric) return [];
    const arr = teams
      .map((tm) => ({ tm, v: metric.values[tm.id]?.total ?? null, pm: metric.values[tm.id]?.perMatch ?? null }))
      .filter((x) => x.v != null) as { tm: TeamLite; v: number; pm: number | null }[];
    arr.sort((a, b) => (metric.isHigherBetter ? b.v - a.v : a.v - b.v));
    return arr;
  }, [teams, metric]);

  const maxVal = Math.max(1, ...ranked.map((x) => x.v));
  // Lig ortalamasi gosterilen (toplam) baza gore hesaplanir -> marker ve deger tutarli.
  const avgVal = ranked.length ? ranked.reduce((s, x) => s + x.v, 0) / ranked.length : null;
  const avgPct = avgVal != null ? Math.min(100, (avgVal / maxVal) * 100) : null;

  return (
    <div className="space-y-3">
      {/* Metrik secici */}
      <div className="space-y-2 rounded-2xl border border-line bg-card p-3">
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g) => {
            const on = g.key === activeCategory;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => setMetricKey(g.items[0]?.key)}
                className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium transition ${
                  on ? "border-accent/40 bg-accent-soft text-accent-ink" : "border-line bg-veil text-ink-3 hover:text-ink-2"
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {activeItems.map((m) => {
            const on = m.key === metricKey;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetricKey(m.key)}
                className={`rounded-md border px-2.5 py-1 text-[12px] transition ${
                  on ? "border-line-strong bg-card-2 font-semibold text-ink" : "border-line bg-card text-ink-2 hover:border-line-strong hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lig ort. rozet (gosterilen toplam baza gore) */}
      {avgVal != null ? (
        <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-1.5 text-[12px]">
          <span className="font-semibold text-accent-ink">{t("tsl.ofAvg")}</span>
          <span className="font-mono font-bold tabular-nums text-accent-ink">
            {formatMetric(avgVal, metric?.format ?? "count")}
          </span>
        </div>
      ) : null}

      {/* Siralama */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="divide-y divide-line/60">
          {ranked.map(({ tm, v, pm }, i) => {
            const pct = Math.max(4, Math.round((v / maxVal) * 100));
            const href = tm.href;
            const aboveAvg = avgVal != null && (metric?.isHigherBetter ? v >= avgVal : v <= avgVal);
            return (
              <div key={tm.id} className="flex items-center gap-2.5 px-3 py-2">
                <span className="w-4 text-center text-[12px] font-bold tabular-nums text-ink-3">{i + 1}</span>
                <TeamCrest logo={tm.logo} name={tm.name} size="sm" />
                <div className="w-24 shrink-0 sm:w-28">
                  {href ? (
                    <Link href={href} className="truncate text-[12px] font-medium text-ink transition hover:underline">
                      {tm.name}
                    </Link>
                  ) : (
                    <span className="truncate text-[12px] font-medium text-ink">{tm.name}</span>
                  )}
                </div>
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-veil">
                  <div className={`h-full rounded-full ${aboveAvg ? "bg-accent" : "bg-ink-3/50"}`} style={{ width: `${pct}%` }} />
                  {avgPct != null ? (
                    <div className="absolute top-0 h-full w-px bg-accent-ink" style={{ left: `${avgPct}%` }} />
                  ) : null}
                </div>
                <div className="w-16 shrink-0 text-right">
                  <div className="text-[13px] font-bold tabular-nums text-ink">{formatMetric(v, metric.format)}</div>
                  <div className="text-[9px] tabular-nums text-ink-3">
                    {formatMetric(pm, "decimal")} {t("tsl.perMatchShort")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
