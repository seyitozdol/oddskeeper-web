"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TeamCrest from "@/features/tsl/shared/TeamCrest";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type {
  ResmiTeamsTableBundle,
  TableWindow,
  TeamMainCell,
  TeamOtherCell,
} from "@/features/tsl/server/resmiLoaders";

type Mode = "perMatch" | "total";
type SortCol = "rank" | "team" | "avg" | "l5" | "l10" | "ly";

function fmt(v: number | null): string {
  if (v == null) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// Bars yerine tablo: ana marketler (MSM) L5/L10/LY tam; diger metrikler Avg/LY
// (mac-basi log yok -> L5/L10 '—'). Sag ustte Total / Mac-basi toggle. Metrik
// ana-market butonlariyla + diger metrikler dropdown'la secilir.
export default function ResmiTeamsTable({ data }: { data: ResmiTeamsTableBundle }) {
  const { locale } = useI18n();
  const tr = locale === "tr";
  const { teams, mainMarkets, otherMetrics, mainData, otherData } = data;

  const mainKeySet = useMemo(() => new Set(mainMarkets.map((m) => m.key)), [mainMarkets]);
  const [metric, setMetric] = useState<string>(
    mainMarkets[0]?.key ?? otherMetrics[0]?.key ?? ""
  );
  const [mode, setMode] = useState<Mode>("perMatch");
  const [sortCol, setSortCol] = useState<SortCol>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const isMain = mainKeySet.has(metric);
  const higherBetter = isMain
    ? mainMarkets.find((m) => m.key === metric)?.higherBetter ?? true
    : otherMetrics.find((m) => m.key === metric)?.higherBetter ?? true;
  const metricLabel = isMain
    ? metric
    : otherMetrics.find((m) => m.key === metric)?.label ?? metric;

  const rows = useMemo(() => {
    const pickW = (w: TableWindow | null) =>
      w ? (mode === "total" ? w.total : w.mean) : null;
    return teams.map((tm) => {
      let avg: number | null = null;
      let l5: number | null = null;
      let l10: number | null = null;
      let ly: number | null = null;
      if (isMain) {
        const c: TeamMainCell | undefined = mainData[metric]?.[tm.id];
        avg = c ? (mode === "total" ? c.seasonTotal : c.seasonMean) : null;
        l5 = pickW(c?.l5 ?? null);
        l10 = pickW(c?.l10 ?? null);
        ly = pickW(c?.ly ?? null);
      } else {
        const o: TeamOtherCell | undefined = otherData[metric]?.[tm.id];
        avg = o ? (mode === "total" ? o.total : o.perMatch) : null;
        ly = o ? (mode === "total" ? o.lyTotal : o.lyPerMatch) : null;
      }
      return { ...tm, avg, l5, l10, ly };
    });
  }, [teams, metric, mode, isMain, mainData, otherData]);

  // Ranking: guncel sezon Avg'sine gore (yon-duyarli), yalniz degeri olanlar.
  const rankById = useMemo(() => {
    const withAvg = rows.filter((r) => r.avg != null);
    withAvg.sort((a, b) => (higherBetter ? b.avg! - a.avg! : a.avg! - b.avg!));
    const m = new Map<string, number>();
    withAvg.forEach((r, i) => m.set(r.id, i + 1));
    return m;
  }, [rows, higherBetter]);

  const sorted = useMemo(() => {
    const num = (v: number | null) => (v == null ? (higherBetter ? -Infinity : Infinity) : v);
    const arr = [...rows];
    arr.sort((a, b) => {
      let cmp: number;
      if (sortCol === "team") cmp = a.name.localeCompare(b.name, "tr");
      else if (sortCol === "rank")
        cmp = (rankById.get(a.id) ?? Infinity) - (rankById.get(b.id) ?? Infinity);
      else cmp = num(a[sortCol]) - num(b[sortCol]);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortCol, sortDir, rankById, higherBetter]);

  // Lig ortalamasi: gorunen kolonlarin (Avg/L5/L10/LY) takimlar arasi ortalamasi
  // (yalniz degeri olan takimlar sayilir).
  const leagueAvg = useMemo(() => {
    const mean = (pick: (r: (typeof rows)[number]) => number | null) => {
      const vals = rows.map(pick).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    return {
      avg: mean((r) => r.avg),
      l5: mean((r) => r.l5),
      l10: mean((r) => r.l10),
      ly: mean((r) => r.ly),
    };
  }, [rows]);

  const onSort = (c: SortCol) => {
    if (c === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(c);
      setSortDir(c === "team" || c === "rank" ? "asc" : "desc");
    }
  };

  const groupedOther = useMemo(() => {
    const g = new Map<string, typeof otherMetrics>();
    for (const m of otherMetrics) {
      const k = m.categoryLabel || m.category;
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(m);
    }
    return [...g.entries()];
  }, [otherMetrics]);

  const th = (c: SortCol, label: string, cls = "") => (
    <th
      className={`cursor-pointer select-none px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3 hover:text-ink ${cls}`}
      onClick={() => onSort(c)}
    >
      {label}
      {sortCol === c ? <span className="ml-0.5 opacity-60">{sortDir === "asc" ? "↑" : "↓"}</span> : null}
    </th>
  );

  const L = {
    total: tr ? "Toplam" : "Total",
    perMatch: tr ? "Maç başına" : "Per match",
    other: tr ? "Diğer metrikler…" : "Other metrics…",
    rank: tr ? "Sıra" : "Rank",
    team: tr ? "Takım" : "Team",
    avg: "Avg",
    l5: "Last 5",
    l10: "Last 10",
    ly: "LY",
    leagueAvg: tr ? "Lig ortalaması" : "League avg",
  };

  return (
    <div className="space-y-3">
      {/* Ana marketler (butonlar) + diger metrikler (dropdown) + toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {mainMarkets.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold transition ${
                metric === m.key
                  ? "bg-accent text-white"
                  : "bg-veil text-ink-2 hover:text-ink"
              }`}
            >
              {m.key}
            </button>
          ))}
        </div>
        {otherMetrics.length ? (
          <select
            value={isMain ? "" : metric}
            onChange={(e) => e.target.value && setMetric(e.target.value)}
            className="min-w-[180px] rounded-lg border border-line bg-field px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-line-strong"
          >
            <option value="">{L.other}</option>
            {groupedOther.map(([cat, list]) => (
              <optgroup key={cat} label={cat}>
                {list.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : null}

        {/* Total / Mac-basi toggle (sag) */}
        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-line text-[12px]">
          {(["perMatch", "total"] as Mode[]).map((mo) => (
            <button
              key={mo}
              type="button"
              onClick={() => setMode(mo)}
              className={`px-2.5 py-1 font-semibold transition ${
                mode === mo ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:text-ink"
              }`}
            >
              {mo === "total" ? L.total : L.perMatch}
            </button>
          ))}
        </div>
      </div>

      {/* Secili metrik basligi */}
      <div className="text-[12px] font-semibold text-ink-2">{metricLabel}</div>

      {/* Tablo */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[520px] text-left">
          <thead className="border-b border-line bg-card-2">
            <tr>
              {th("rank", L.rank, "w-12 text-center")}
              {th("team", L.team)}
              {th("avg", L.avg, "text-right")}
              {th("l5", L.l5, "text-right")}
              {th("l10", L.l10, "text-right")}
              {th("ly", L.ly, "text-right")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-t border-line/60 hover:bg-veil">
                <td className="px-2 py-1.5 text-center text-[12px] font-semibold tabular-nums text-ink-2">
                  {rankById.get(r.id) ?? "—"}
                </td>
                <td className="px-2 py-1.5">
                  <span className="flex items-center gap-2">
                    <TeamCrest logo={r.logo} name={r.name} size="xs" />
                    {r.href ? (
                      <Link
                        href={r.href}
                        className="truncate text-[13px] font-medium text-accent-ink hover:text-accent"
                      >
                        {r.name}
                      </Link>
                    ) : (
                      <span className="truncate text-[13px] font-medium text-ink">{r.name}</span>
                    )}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right text-[13px] font-semibold tabular-nums text-ink">
                  {fmt(r.avg)}
                </td>
                <td className="px-2 py-1.5 text-right text-[13px] tabular-nums text-ink-2">
                  {fmt(r.l5)}
                </td>
                <td className="px-2 py-1.5 text-right text-[13px] tabular-nums text-ink-2">
                  {fmt(r.l10)}
                </td>
                <td className="px-2 py-1.5 text-right text-[13px] tabular-nums text-ink-2">
                  {fmt(r.ly)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line bg-card-2">
              <td className="px-2 py-2 text-center text-[12px] text-ink-3" />
              <td className="px-2 py-2 text-[12px] font-semibold uppercase tracking-wide text-ink-2">
                {L.leagueAvg}
              </td>
              <td className="px-2 py-2 text-right text-[13px] font-bold tabular-nums text-ink">
                {fmt(leagueAvg.avg)}
              </td>
              <td className="px-2 py-2 text-right text-[13px] font-semibold tabular-nums text-ink-2">
                {fmt(leagueAvg.l5)}
              </td>
              <td className="px-2 py-2 text-right text-[13px] font-semibold tabular-nums text-ink-2">
                {fmt(leagueAvg.l10)}
              </td>
              <td className="px-2 py-2 text-right text-[13px] font-semibold tabular-nums text-ink-2">
                {fmt(leagueAvg.ly)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
