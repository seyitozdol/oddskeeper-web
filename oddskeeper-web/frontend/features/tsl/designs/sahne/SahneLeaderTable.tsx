"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMetric, normalizeSearch, pickBasis, positionShort } from "@/features/tsl/lib";
import type { TslLeaderRow } from "@/features/tsl/types";

type Basis = "total" | "per90" | "per_match";

export default function SahneLeaderTable({
  rows,
  defaultBasis,
}: {
  rows: TslLeaderRow[];
  defaultBasis: string;
}) {
  const { t } = useI18n();
  const [basis, setBasis] = useState<Basis>(
    defaultBasis === "per90" || defaultBasis === "per_match" ? (defaultBasis as Basis) : "total"
  );
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const q = normalizeSearch(query.trim());
    const filtered = q
      ? rows.filter(
          (r) =>
            normalizeSearch(r.playerName).includes(q) ||
            normalizeSearch(r.teamName ?? "").includes(q)
        )
      : rows;
    const withVal = filtered.map((r) => ({ r, v: pickBasis(r, basis) }));
    withVal.sort((a, b) => {
      const av = a.v ?? -Infinity;
      const bv = b.v ?? -Infinity;
      return bv - av;
    });
    return withVal;
  }, [rows, basis, query]);

  const maxVal = useMemo(
    () => Math.max(1, ...sorted.map((x) => x.v ?? 0)),
    [sorted]
  );

  const bases: { key: Basis; label: string }[] = [
    { key: "total", label: t("tsl.basisTotal") },
    { key: "per90", label: t("tsl.basisPer90") },
    { key: "per_match", label: t("tsl.basisPerMatch") },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-veil p-0.5">
          {bases.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBasis(b.key)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition ${
                basis === b.key ? "bg-card-2 text-ink" : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("tsl.searchPlaceholder")}
          className="w-full max-w-[220px] rounded-lg border border-line bg-field px-3 py-1.5 text-[13px] text-ink outline-none transition focus:border-line-strong"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-[0.08em] text-ink-3">
              <th className="w-10 py-2 pl-4 text-left font-medium">{t("tsl.rank")}</th>
              <th className="px-2 py-2 text-left font-medium">{t("tsl.player")}</th>
              <th className="px-2 py-2 text-left font-medium">{t("tsl.team")}</th>
              <th className="px-2 py-2 text-right font-medium">{t("tsl.value")}</th>
              <th className="hidden px-4 py-2 text-left font-medium sm:table-cell">{t("tsl.vsAvg")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ r, v }, i) => {
              const pct = Math.max(4, Math.round(((v ?? 0) / maxVal) * 100));
              const vs = r.vsAvgPct;
              return (
                <tr key={r.playerId} className={`${i % 2 ? "bg-veil/40" : ""} border-b border-line/50 last:border-0`}>
                  <td className="py-2 pl-4 text-[12px] font-bold tabular-nums text-ink-3">{i + 1}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink">{r.playerName}</span>
                      {r.positionCode ? (
                        <span className="rounded bg-veil px-1 text-[9px] font-semibold text-ink-3">
                          {positionShort(r.positionCode)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2 truncate text-[12px] text-ink-2">{r.teamName}</td>
                  <td className="px-2 py-2 text-right text-[14px] font-bold tabular-nums text-ink">
                    {formatMetric(v, r.valueFormat)}
                  </td>
                  <td className="hidden px-4 py-2 sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-veil">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                      {vs != null ? (
                        <span className={`text-[11px] tabular-nums ${vs >= 0 ? "text-pos" : "text-neg"}`}>
                          {vs >= 0 ? "+" : ""}
                          {Math.round(vs)}%
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-3">{t("tsl.noData")}</p>
        ) : null}
      </div>
    </div>
  );
}
