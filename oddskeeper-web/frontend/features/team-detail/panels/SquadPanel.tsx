"use client";

import { useMemo, useState } from "react";
import type { TeamCurrentSquadRow, TeamSquadRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { formatDecimal } from "../utils/formatDecimal";
import PlayerLink from "@/components/links/PlayerLink";

type SquadPanelProps = {
  rows?: TeamSquadRow[];
  currentSquad?: TeamCurrentSquadRow[];
};

const POSITION_GROUP_LABELS: Record<string, string> = {
  GOALKEEPER: "Goalkeepers",
  DEFENDER: "Defenders",
  MIDFIELDER: "Midfielders",
  FORWARD: "Forwards",
  OTHER: "Other",
};

function CurrentSquadTable({ rows }: { rows: TeamCurrentSquadRow[] }) {
  return (
    <div className="rounded-[14px] border border-white/10">
      <div className="border-b border-white/10 bg-white/[0.03] px-4 py-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/42">
          Current Squad
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Player</th>
              <th className="px-4 py-2 font-medium">Position</th>
              <th className="px-4 py-2 font-medium">Age</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.player_source_id}
                className="border-t border-white/10 text-[13px] text-white/80"
              >
                <td className="px-4 py-2 text-white/55">
                  {row.shirt_number ?? "—"}
                </td>
                <td className="px-4 py-2 font-medium">
                  {row.player_slug ? (
                    <PlayerLink
                      playerSlug={row.player_slug}
                      className="font-medium text-[#8dc8ff] transition hover:text-[#bfe0ff] hover:underline"
                      title={row.player_name}
                    >
                      {row.player_name}
                    </PlayerLink>
                  ) : (
                    <span className="text-white" title="Oyuncu sayfası henüz yok">
                      {row.player_name}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {POSITION_GROUP_LABELS[row.position_group]?.replace(/s$/, "") ??
                    row.position ??
                    "—"}
                </td>
                <td className="px-4 py-2">{row.age ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function getSortIndicator(
  currentKey: SortKey,
  currentDirection: SortDirection,
  key: SortKey
) {
  if (currentKey !== key) return "";
  return currentDirection === "asc" ? " ↑" : " ↓";
}

function PlayerName({
  playerSlug,
  playerName,
}: {
  playerSlug: string | null | undefined;
  playerName: string;
}) {
  if (!playerSlug) {
    return <span>{playerName}</span>;
  }

  return (
    <PlayerLink
      playerSlug={playerSlug}
      className="font-medium text-[#8dc8ff] transition hover:text-[#bfe0ff] hover:underline"
      title={playerName}
    >
      {playerName}
    </PlayerLink>
  );
}

function getMetricSortValue(row: TeamSquadRow, sortKey: SortKey): number {
  if (sortKey === "last_match_datetime") {
    return row.last_match_datetime
      ? new Date(row.last_match_datetime).getTime()
      : 0;
  }

  if (sortKey === "starter_rate_pct") {
    return toNumber(row.starter_rate_pct);
  }

  if (sortKey === "avg_minutes") {
    return toNumber(row.avg_minutes);
  }

  if (sortKey === "appearances") return row.appearances;
  if (sortKey === "starts") return row.starts;
  if (sortKey === "sub_appearances") return row.sub_appearances;
  if (sortKey === "total_minutes") return row.total_minutes;
  if (sortKey === "goals") return row.goals;
  if (sortKey === "assists") return row.assists;

  return 0;
}

export function SquadPanel({ rows = [], currentSquad = [] }: SquadPanelProps) {
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

      const aValue = getMetricSortValue(a, sortKey);
      const bValue = getMetricSortValue(b, sortKey);

      const byMetric = compareNumber(aValue, bValue, sortDirection);
      if (byMetric !== 0) return byMetric;

      return compareText(a.player_name, b.player_name, "asc");
    });

    return cloned;
  }, [rows, sortKey, sortDirection]);

  if (rows.length === 0 && currentSquad.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        No squad data found for this team.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {currentSquad.length > 0 ? (
        <CurrentSquadTable rows={currentSquad} />
      ) : null}

      {rows.length > 0 ? (
        <div className="rounded-[14px] border border-white/10">
          <div className="border-b border-white/10 bg-white/[0.03] px-4 py-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/42">
              Season Match Stats
              {rows[0]?.season_label ? ` — ${rows[0].season_label}` : ""}
            </div>
          </div>

          <div className="overflow-x-auto">
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
                Position
                {getSortIndicator(sortKey, sortDirection, "primary_position_code")}
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
                Starter %
                {getSortIndicator(sortKey, sortDirection, "starter_rate_pct")}
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
                Last Match
                {getSortIndicator(sortKey, sortDirection, "last_match_datetime")}
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
              <td className="px-4 py-2 font-medium whitespace-nowrap text-white">
                <PlayerName
                  playerSlug={row.player_slug}
                  playerName={row.player_name}
                />
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
        </div>
      ) : null}
    </div>
  );
}