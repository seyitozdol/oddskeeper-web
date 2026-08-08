"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type {
  RefereeRow,
  RefereeAverages,
  ResmiRefereesBundle,
} from "@/features/tsl/server/resmiLoaders";

type ColKey =
  | "referee" | "apps" | "foulsPg" | "foulsPerTackle" | "penPg"
  | "yelPg" | "yelTotal" | "redPg" | "redTotal" | "cardsPg";

type Col = { key: ColKey; label: string; num: boolean; title?: string };

const fmt = (v: number | null, d = 2) => (v == null ? "—" : v.toFixed(d));

export default function ResmiReferees({ data }: { data: ResmiRefereesBundle }) {
  const { t } = useI18n();
  const { season, rows, averages } = data;

  const columns: Col[] = [
    { key: "referee", label: t("tsl.refName"), num: false },
    { key: "apps", label: "Apps", num: true },
    { key: "foulsPg", label: "Fouls pg", num: true },
    { key: "foulsPerTackle", label: "Fouls/Tackles", num: true },
    { key: "penPg", label: "Pen pg", num: true },
    { key: "yelPg", label: "Yel pg", num: true },
    { key: "yelTotal", label: "Yel (tot)", num: true },
    { key: "redPg", label: "Red pg", num: true },
    { key: "redTotal", label: "Red (tot)", num: true },
    { key: "cardsPg", label: "Cards pg", num: true, title: t("tsl.refCardsFormula") },
  ];

  const [sortKey, setSortKey] = useState<ColKey>("apps");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  function onSort(k: ColKey) {
    if (k === sortKey) setDir((p) => (p === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setDir(k === "referee" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "string" || typeof bv === "string"
          ? String(av).localeCompare(String(bv), "tr")
          : (av as number) - (bv as number);
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, dir]);

  const cell = (r: RefereeRow, k: ColKey) => {
    switch (k) {
      case "referee": return r.referee;
      case "apps": return String(r.apps);
      case "foulsPg": return fmt(r.foulsPg);
      case "foulsPerTackle": return fmt(r.foulsPerTackle);
      case "penPg": return fmt(r.penPg);
      case "yelPg": return fmt(r.yelPg);
      case "yelTotal": return String(r.yelTotal);
      case "redPg": return fmt(r.redPg);
      case "redTotal": return String(r.redTotal);
      case "cardsPg": return fmt(r.cardsPg);
    }
  };

  const avgCell = (a: RefereeAverages, k: ColKey) => {
    switch (k) {
      case "referee": return t("tsl.refAverages");
      case "apps": return String(a.apps);
      case "foulsPg": return fmt(a.foulsPg);
      case "foulsPerTackle": return fmt(a.foulsPerTackle);
      case "penPg": return fmt(a.penPg);
      case "yelPg": return fmt(a.yelPg);
      case "yelTotal": return "";
      case "redPg": return fmt(a.redPg);
      case "redTotal": return "";
      case "cardsPg": return fmt(a.cardsPg);
    }
  };

  return (
    <section className="space-y-3">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">
          {t("tsl.sectionReferees")} · {season}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{t("tsl.sectionReferees")}</h1>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card px-5 py-16 text-center text-sm text-ink-3">
          {t("tsl.refNoData")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => onSort(c.key)}
                    title={c.title}
                    className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium transition hover:text-ink-2 ${
                      c.num ? "text-right" : "text-left"
                    }`}
                  >
                    {c.label}
                    {c.key === sortKey ? (dir === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={`${r.referee}-${i}`} className="border-t border-line text-[13px] text-ink hover:bg-veil">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-3 py-1.5 ${
                        c.num ? "text-right tabular-nums" : "font-medium"
                      } ${c.key === "cardsPg" ? "font-semibold" : ""}`}
                    >
                      {cell(r, c.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {averages ? (
              <tfoot>
                <tr className="border-t-2 border-line-strong bg-card-2 text-[13px] font-semibold text-ink">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-3 py-2 ${c.num ? "text-right tabular-nums" : ""}`}
                    >
                      {avgCell(averages, c.key)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </section>
  );
}
