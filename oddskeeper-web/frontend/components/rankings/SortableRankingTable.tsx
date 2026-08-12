"use client";

import { useMemo, useState, type ReactNode } from "react";
import { normalizeSearch } from "@/features/tsl/lib";

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
  // Arama kutusu bu metin uzerinde filtreler (searchPlaceholder verildiyse).
  searchText?: string;
};

type SortableRankingTableProps = {
  columns: RankingColumn[];
  rows: RankingRow[];
  initialSortIndex?: number;
  initialSortDir?: "asc" | "desc";
  // Verilirse tablonun ustunde arama kutusu cikar (searchText'e gore filtre).
  searchPlaceholder?: string;
};

// Turkce-toleransli katlama: "Yılmaz" araması "yilmaz" ile de bulunur.
const foldSearch = normalizeSearch;

export default function SortableRankingTable({
  columns,
  rows,
  initialSortIndex = 0,
  initialSortDir = "asc",
  searchPlaceholder,
}: SortableRankingTableProps) {
  const [sortIndex, setSortIndex] = useState(initialSortIndex);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);
  const [query, setQuery] = useState("");

  function handleSort(index: number) {
    if (index === sortIndex) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortIndex(index);
    setSortDir(columns[index]?.defaultDir ?? "desc");
  }

  const filteredRows = useMemo(() => {
    const q = foldSearch(query.trim());
    if (!q) return rows;
    return rows.filter((r) => foldSearch(r.searchText ?? "").includes(q));
  }, [rows, query]);

  const sortedRows = useMemo(() => {
    const cloned = [...filteredRows];

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
  }, [filteredRows, sortIndex, sortDir]);

  return (
    <div className="overflow-x-auto">
      {searchPlaceholder != null && (
        <div className="border-b border-line px-3 py-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full max-w-xs rounded-md border border-line bg-field px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
        </div>
      )}
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
            {columns.map((column, index) => (
              <th
                key={column.id}
                onClick={() => handleSort(index)}
                className="cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium transition hover:text-ink-2"
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
                  className="whitespace-nowrap px-3 py-1.5"
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
