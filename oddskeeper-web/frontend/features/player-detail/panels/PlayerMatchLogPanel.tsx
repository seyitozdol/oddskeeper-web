"use client";

import { useMemo, useState } from "react";
import type { PlayerMatchLogRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { formatDecimal } from "../utils/formatDecimal";
import { PlayerResultBadge } from "../components/PlayerResultBadge";
import TeamLink from "@/components/links/TeamLink";
import MatchLink from "@/components/links/MatchLink";

type PlayerMatchLogPanelProps = {
  rows: PlayerMatchLogRow[];
};

type LineupFilter = "all" | "starter" | "substitute";

type SortKey =
  | "match_datetime"
  | "minutes_played"
  | "goals"
  | "assists"
  | "expected_goals";

type SortDirection = "asc" | "desc";

function normalizeLineupStatus(value?: string | null) {
  const normalized = (value ?? "").toLowerCase();

  if (normalized === "starter") return "starter";
  if (normalized === "substitute") return "substitute";
  return "other";
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

export function PlayerMatchLogPanel({ rows }: PlayerMatchLogPanelProps) {
  const [lineupFilter, setLineupFilter] = useState<LineupFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("match_datetime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("desc");
  }

  const starterCount = useMemo(
    () => rows.filter((row) => normalizeLineupStatus(row.lineup_status) === "starter").length,
    [rows]
  );

  const substituteCount = useMemo(
    () => rows.filter((row) => normalizeLineupStatus(row.lineup_status) === "substitute").length,
    [rows]
  );

  const filteredRows = useMemo(() => {
    if (lineupFilter === "all") return rows;

    return rows.filter(
      (row) => normalizeLineupStatus(row.lineup_status) === lineupFilter
    );
  }, [rows, lineupFilter]);

  const sortedRows = useMemo(() => {
    const cloned = [...filteredRows];

    cloned.sort((a, b) => {
      let comparison = 0;

      if (sortKey === "match_datetime") {
        const aValue = a.match_datetime ? new Date(a.match_datetime).getTime() : 0;
        const bValue = b.match_datetime ? new Date(b.match_datetime).getTime() : 0;
        comparison = aValue - bValue;
      }

      if (sortKey === "minutes_played") {
        comparison = (a.minutes_played ?? 0) - (b.minutes_played ?? 0);
      }

      if (sortKey === "goals") {
        comparison = (a.goals ?? 0) - (b.goals ?? 0);
      }

      if (sortKey === "assists") {
        comparison = (a.assists ?? 0) - (b.assists ?? 0);
      }

      if (sortKey === "expected_goals") {
        comparison = toNumber(a.expected_goals) - toNumber(b.expected_goals);
      }

      if (comparison === 0) {
        const aFallback = a.match_datetime ? new Date(a.match_datetime).getTime() : 0;
        const bFallback = b.match_datetime ? new Date(b.match_datetime).getTime() : 0;
        comparison = bFallback - aFallback;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return cloned;
  }, [filteredRows, sortKey, sortDirection]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        No match log data found for this player.
      </div>
    );
  }

  const baseReturnTo =
    rows[0]?.player_slug
      ? `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(
          rows[0].player_slug
        )}&tab=match-log`
      : "/dashboard/stats-analysis/football/player-stats";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setLineupFilter("all")}
          className={`rounded-xl border px-3 py-2 text-sm transition ${
            lineupFilter === "all"
              ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
              : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
          }`}
        >
          All ({rows.length})
        </button>

        <button
          type="button"
          onClick={() => setLineupFilter("starter")}
          className={`rounded-xl border px-3 py-2 text-sm transition ${
            lineupFilter === "starter"
              ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
              : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
          }`}
        >
          Starters ({starterCount})
        </button>

        <button
          type="button"
          onClick={() => setLineupFilter("substitute")}
          className={`rounded-xl border px-3 py-2 text-sm transition ${
            lineupFilter === "substitute"
              ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
              : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
          }`}
        >
          Substitutes ({substituteCount})
        </button>
      </div>

      {sortedRows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
          No rows found for this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-white/10">
          <table className="min-w-full border-collapse">
            <thead className="bg-white/[0.03]">
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
                <th className="px-4 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort("match_datetime")}
                    className="cursor-pointer select-none"
                  >
                    Date{getSortIndicator(sortKey, sortDirection, "match_datetime")}
                  </button>
                </th>

                <th className="px-4 py-2 font-medium">Opponent</th>
                <th className="px-4 py-2 font-medium">H/A</th>
                <th className="px-4 py-2 font-medium">Score</th>
                <th className="px-4 py-2 font-medium">Result</th>
                <th className="px-4 py-2 font-medium">Lineup</th>
                <th className="px-4 py-2 font-medium">Pos</th>

                <th className="px-4 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort("minutes_played")}
                    className="cursor-pointer select-none"
                  >
                    Min{getSortIndicator(sortKey, sortDirection, "minutes_played")}
                  </button>
                </th>

                <th className="px-4 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort("goals")}
                    className="cursor-pointer select-none"
                  >
                    G{getSortIndicator(sortKey, sortDirection, "goals")}
                  </button>
                </th>

                <th className="px-4 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort("assists")}
                    className="cursor-pointer select-none"
                  >
                    A{getSortIndicator(sortKey, sortDirection, "assists")}
                  </button>
                </th>

                <th className="px-4 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort("expected_goals")}
                    className="cursor-pointer select-none"
                  >
                    xG{getSortIndicator(sortKey, sortDirection, "expected_goals")}
                  </button>
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((row) => (
                <tr
                  key={`${row.source_match_id}-${row.player_source_id}`}
                  className="border-t border-white/10 text-[13px] text-white/80 transition hover:bg-white/[0.018]"
                >
                  <td className="px-4 py-2 whitespace-nowrap">
                    <MatchLink
                      sourceMatchId={row.source_match_id}
                      returnTo={baseReturnTo}
                      className="transition hover:text-white hover:underline"
                      title="Open match detail"
                    >
                      {formatDate(row.match_datetime)}
                    </MatchLink>
                  </td>

                  <td className="px-4 py-2 min-w-[220px]">
                    <TeamLink
                      teamSlug={row.opponent_team_slug}
                      className="font-medium text-white transition hover:text-white hover:underline"
                      title={row.opponent_name ?? "Opponent"}
                    >
                      {row.opponent_name ?? "—"}
                    </TeamLink>
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-[2px] text-[10px] font-medium text-white/72">
                      {row.is_home ? "Home" : "Away"}
                    </span>
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap font-medium text-white">
                    <MatchLink
                      sourceMatchId={row.source_match_id}
                      returnTo={baseReturnTo}
                      className="font-medium text-white transition hover:text-white hover:underline"
                      title="Open match detail"
                    >
                      {row.score_display ?? "—"}
                    </MatchLink>
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap">
                    <PlayerResultBadge resultCode={row.result_code} />
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap text-white/70">
                    {row.lineup_status ?? "—"}
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap text-white/70">
                    {row.position_code ?? "—"}
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap">
                    {row.minutes_played ?? "—"}
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap">
                    {row.goals ?? "—"}
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap">
                    {row.assists ?? "—"}
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap">
                    {formatDecimal(row.expected_goals, 3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}