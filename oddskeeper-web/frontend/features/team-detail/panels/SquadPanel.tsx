"use client";

import { useMemo, useState } from "react";
import type { TeamSquadRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { formatDecimal } from "../utils/formatDecimal";
import PlayerLink from "@/components/links/PlayerLink";

type SquadPanelProps = {
  rows: TeamSquadRow[];
};

type SortKey =
  | "player_name"
  | "primary_position_code"
  | "appearances"
  | "starts"
  | "sub_appearances"
  | "starter_rate_pct"
  | "total_minutes"
  | "avg_minutes"
  | "goals"
  | "assists"
  | "last_match_datetime";

type SortDirection = "asc" | "desc";

const DEFAULT_DIRECTIONS: Record<SortKey, SortDirection> = {
  player_name: "asc",
  primary_position_code: "asc",
  appearances: "desc",
  starts: "desc",
  sub_appearances: "desc",
  starter_rate_pct: "desc",
  total_minutes: "desc",
  avg_minutes: "desc",
  goals: "desc",
  assists: "desc",
  last_match_datetime: "desc",
};

const POSITION_ORDER: Record<string, number> = {
  GK: 1,
  DF: 2,
  MF: 3,
  FW: 4,
  SUB: 5,
  OTHER: 6,
};

function compareText(a: string, b: string, direction: SortDirection) {
  return direction === "asc" ? a.localeCompare(b) : b.localeCompare(a);
}

function compareNumber(a: number, b: number, direction: SortDirection) {
  return direction === "asc" ? a - b : b - a;
}

function getSortIndicator(
  currentKey: SortKey,
  currentDirection: SortDirection,
  key: SortKey
) {
  if (currentKey !== key) return "";
  return currentDirection === "asc" ? " ↑" : " ↓";
}

export function SquadPanel({ rows }: SquadPanelProps) {
  const [sortKey, setSortKey] = useState<SortKey>("primary_position_code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(DEFAULT_DIRECTIONS[key]);
  }

  const sortedRows = useMemo(() => {
    const cloned = [...rows];

    cloned.sort((a, b) => {
      if (sortKey === "primary_position_code") {
        const aOrder = POSITION_ORDER[a.primary_position_code] ?? 999;
        const bOrder = POSITION_ORDER[b.primary_position_code] ?? 999;

        const byPosition = compareNumber(aOrder, bOrder, sortDirection);
        if (byPosition !== 0) return byPosition;

        const byStarts = compareNumber(a.starts, b.starts, "desc");
        if (byStarts !== 0) return byStarts;

        const byApps = compareNumber(a.appearances, b.appearances, "desc");
        if (byApps !== 0) return byApps;

        return compareText(a.player_name, b.player_name, "asc");
      }

      if (sortKey === "player_name") {
        return compareText(a.player_name, b.player_name, sortDirection);
      }

      if (sortKey === "last_match_datetime") {
        const aTime = a.last_match_datetime
          ? new Date(a.last_match_datetime).getTime()
          : 0;
        const bTime = b.last_match_datetime
          ? new Date(b.last_match_datetime).getTime()
          : 0;
        return compareNumber(aTime, bTime, sortDirection);
      }

      const aValue = Number(a[sortKey] ?? 0);
      const bValue = Number(b[sortKey] ?? 0);
      const byMetric = compareNumber(aValue, bValue, sortDirection);
      if (byMetric !== 0) return byMetric;

      return compareText(a.player_name, b.player_name, "asc");
    });

    return cloned;
  }, [rows, sortKey, sortDirection]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        No squad data found for this team.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-white/10">
      <table className="min-w-full border-collapse">
        <thead className="bg-white/[0.03]">
          <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("player_name")}
                className="cursor-pointer select-none"
              >
                Player{getSortIndicator(sortKey, sortDirection, "player_name")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("primary_position_code")}
                className="cursor-pointer select-none"
              >
                Position{getSortIndicator(sortKey, sortDirection, "primary_position_code")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("appearances")}
                className="cursor-pointer select-none"
              >
                Apps{getSortIndicator(sortKey, sortDirection, "appearances")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("starts")}
                className="cursor-pointer select-none"
              >
                Starts{getSortIndicator(sortKey, sortDirection, "starts")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("sub_appearances")}
                className="cursor-pointer select-none"
              >
                Sub{getSortIndicator(sortKey, sortDirection, "sub_appearances")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("starter_rate_pct")}
                className="cursor-pointer select-none"
              >
                Starter %{getSortIndicator(sortKey, sortDirection, "starter_rate_pct")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("total_minutes")}
                className="cursor-pointer select-none"
              >
                Minutes{getSortIndicator(sortKey, sortDirection, "total_minutes")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("avg_minutes")}
                className="cursor-pointer select-none"
              >
                Avg Min{getSortIndicator(sortKey, sortDirection, "avg_minutes")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("goals")}
                className="cursor-pointer select-none"
              >
                Goals{getSortIndicator(sortKey, sortDirection, "goals")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("assists")}
                className="cursor-pointer select-none"
              >
                Assists{getSortIndicator(sortKey, sortDirection, "assists")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("last_match_datetime")}
                className="cursor-pointer select-none"
              >
                Last Match{getSortIndicator(sortKey, sortDirection, "last_match_datetime")}
              </button>
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={row.player_source_id}
              className="border-t border-white/10 text-[13px] text-white/80 transition hover:bg-white/[0.018]"
            >
              <td className="px-4 py-2 font-medium text-white whitespace-nowrap">
                <PlayerLink
                  playerSlug={row.player_slug}
                  className="font-medium text-white transition hover:text-white hover:underline"
                  title={row.player_name}
                >
                  {row.player_name}
                </PlayerLink>
              </td>

              <td className="px-4 py-2 whitespace-nowrap text-white/70">
                {row.primary_position_code}
              </td>

              <td className="px-4 py-2 whitespace-nowrap">{row.appearances}</td>
              <td className="px-4 py-2 whitespace-nowrap">{row.starts}</td>
              <td className="px-4 py-2 whitespace-nowrap">{row.sub_appearances}</td>

              <td className="px-4 py-2 whitespace-nowrap">
                {formatDecimal(row.starter_rate_pct)}%
              </td>

              <td className="px-4 py-2 whitespace-nowrap">{row.total_minutes}</td>

              <td className="px-4 py-2 whitespace-nowrap">
                {formatDecimal(row.avg_minutes)}
              </td>

              <td className="px-4 py-2 whitespace-nowrap">{row.goals}</td>
              <td className="px-4 py-2 whitespace-nowrap">{row.assists}</td>

              <td className="px-4 py-2 whitespace-nowrap text-white/60">
                {formatDate(row.last_match_datetime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}