"use client";

import { useMemo, useState, type ReactNode } from "react";

// Sunucu sayfaları hücreleri render edip (ReactNode) sıralama değerlerini
// ayrıca verir; tıklanabilir başlıklarla istemci tarafında sıralanır.
export type RankingColumn = {
  id: string;
  label: ReactNode;
  defaultDir?: "asc" | "desc";
};

export type RankingRow = {
  id: string;
  highlighted?: boolean;
  cells: ReactNode[];
  sortValues: (number | string | null)[];
};

type SortableRankingTableProps = {
  columns: RankingColumn[];
  rows: RankingRow[];
  initialSortIndex?: number;
  initialSortDir?: "asc" | "desc";
};

export default function SortableRankingTable({
  columns,
  rows,
  initialSortIndex = 0,
  initialSortDir = "asc",
}: SortableRankingTableProps) {
  const [sortIndex, setSortIndex] = useState(initialSortIndex);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);

  function handleSort(index: number) {
    if (index === sortIndex) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortIndex(index);
    setSortDir(columns[index]?.defaultDir ?? "desc");
  }

  const sortedRows = useMemo(() => {
    const cloned = [...rows];

    cloned.sort((a, b) => {
      const av = a.sortValues[sortIndex];
      const bv = b.sortValues[sortIndex];

      // null'lar her zaman sona
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;

      let cmp: number;
      if (typeof av === "string" || typeof bv === "string") {
        cmp = String(av).localeCompare(String(bv), "tr");
      } else {
        cmp = av - bv;
      }

      return sortDir === "asc" ? cmp : -cmp;
    });

    return cloned;
  }, [rows, sortIndex, sortDir]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
            {columns.map((column, index) => (
              <th
                key={column.id}
                onClick={() => handleSort(index)}
                className="cursor-pointer select-none whitespace-nowrap px-4 py-2.5 font-medium transition hover:text-ink-2"
              >
                {column.label}
                {index === sortIndex ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={row.id}
              className={`border-t text-[13px] transition ${
                row.highlighted
                  ? "border-line-strong bg-card-2 text-ink"
                  : "border-line text-ink hover:bg-veil"
              }`}
            >
              {row.cells.map((cell, cellIndex) => (
                <td
                  key={columns[cellIndex]?.id ?? cellIndex}
                  className="whitespace-nowrap px-4 py-2"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
