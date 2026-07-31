"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMetric } from "@/features/tsl/lib";
import type { TslTeamLeaderRow, TslTeamMeta } from "@/features/tsl/types";
import TeamCrest from "@/features/tsl/shared/TeamCrest";

const CATEGORY_ORDER: Record<string, number> = {
  attacking: 1,
  build_up: 2,
  defending: 3,
  discipline: 4,
};

export default function SahneTeamTable({
  rows,
  meta,
}: {
  rows: TslTeamLeaderRow[];
  meta: Record<string, TslTeamMeta>;
}) {
  const { t } = useI18n();

  const { metrics, groups } = useMemo(() => {
    const metricMap = new Map<
      string,
      { key: string; label: string; category: string; categoryLabel: string }
    >();
    for (const r of rows) {
      if (!metricMap.has(r.metricKey)) {
        metricMap.set(r.metricKey, {
          key: r.metricKey,
          label: r.metricLabel,
          category: r.categoryKey ?? "",
          categoryLabel: r.categoryLabel ?? "",
        });
      }
    }
    const metrics = [...metricMap.values()];
    const groupMap = new Map<string, { label: string; items: typeof metrics }>();
    for (const m of metrics) {
      if (!groupMap.has(m.category)) groupMap.set(m.category, { label: m.categoryLabel, items: [] });
      groupMap.get(m.category)!.items.push(m);
    }
    const groups = [...groupMap.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => (CATEGORY_ORDER[a.key] ?? 9) - (CATEGORY_ORDER[b.key] ?? 9));
    return { metrics, groups };
  }, [rows]);

  const [metricKey, setMetricKey] = useState(
    metrics.find((m) => m.key === "team_goals_for")?.key ?? metrics[0]?.key ?? ""
  );

  const activeCategory =
    metrics.find((m) => m.key === metricKey)?.category ?? groups[0]?.key;
  const activeItems = groups.find((g) => g.key === activeCategory)?.items ?? [];

  const ranked = useMemo(() => {
    const list = rows.filter((r) => r.metricKey === metricKey);
    const higher = list[0]?.isHigherBetter ?? true;
    const withV = list.map((r) => ({ r, v: r.total ?? 0 }));
    withV.sort((a, b) => (higher ? b.v - a.v : a.v - b.v));
    return withV;
  }, [rows, metricKey]);

  const maxVal = Math.max(1, ...ranked.map((x) => x.v));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {groups.map((g) => {
            const on = g.key === activeCategory;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => setMetricKey(g.items[0]?.key)}
                className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium transition ${
                  on
                    ? "border-accent/40 bg-accent-soft text-accent-ink"
                    : "border-line bg-veil text-ink-3 hover:text-ink-2"
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
                  on
                    ? "border-line-strong bg-card-2 font-semibold text-ink"
                    : "border-line bg-card text-ink-2 hover:border-line-strong hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="divide-y divide-line/60">
          {ranked.map(({ r, v }, i) => {
            const id = r.teamId ?? "";
            const logo = meta[id]?.logo ?? null;
            const pct = Math.max(4, Math.round((v / maxVal) * 100));
            return (
              <div key={id || r.teamName || i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-5 text-center text-[13px] font-bold tabular-nums text-ink-3">{i + 1}</span>
                <TeamCrest logo={logo} name={r.teamName} size="sm" />
                <span className="w-32 shrink-0 truncate text-[13px] font-medium text-ink sm:w-40">
                  {r.teamName}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-veil">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-[14px] font-bold tabular-nums text-ink">
                  {formatMetric(v, r.valueFormat)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-ink-3">{t("tsl.dataNote")}</p>
    </div>
  );
}
