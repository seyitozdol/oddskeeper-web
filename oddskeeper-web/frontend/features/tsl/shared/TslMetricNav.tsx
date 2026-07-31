"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { TslMetricOption } from "../types";

export default function TslMetricNav({
  catalog,
  metricKey,
  accent = "accent",
}: {
  catalog: TslMetricOption[];
  metricKey: string;
  accent?: "accent" | "pos";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; sort: number; items: TslMetricOption[] }>();
    for (const c of catalog) {
      if (!map.has(c.categoryKey)) {
        map.set(c.categoryKey, { label: c.categoryLabel, sort: c.categorySort, items: [] });
      }
      map.get(c.categoryKey)!.items.push(c);
    }
    return [...map.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.sort - b.sort);
  }, [catalog]);

  const activeCategory =
    catalog.find((c) => c.metricKey === metricKey)?.categoryKey ?? groups[0]?.key;
  const activeItems = groups.find((g) => g.key === activeCategory)?.items ?? [];

  const push = (mk: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("metric", mk);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const activeChip =
    accent === "pos"
      ? "bg-pos/15 text-pos border-pos/40"
      : "bg-accent-soft text-accent-ink border-accent/40";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {groups.map((g) => {
          const on = g.key === activeCategory;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => push(g.items[0]?.metricKey)}
              className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium transition ${
                on ? activeChip : "border-line bg-veil text-ink-3 hover:text-ink-2"
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {activeItems.map((m) => {
          const on = m.metricKey === metricKey;
          return (
            <button
              key={m.metricKey}
              type="button"
              onClick={() => push(m.metricKey)}
              className={`rounded-md border px-2.5 py-1 text-[12px] transition ${
                on
                  ? "border-line-strong bg-card-2 font-semibold text-ink"
                  : "border-line bg-card text-ink-2 hover:border-line-strong hover:text-ink"
              }`}
            >
              {m.metricLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
