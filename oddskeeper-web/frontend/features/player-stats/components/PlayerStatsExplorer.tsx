"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import PlayerLink from "@/components/links/PlayerLink";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { getTeamDetailHref } from "@/lib/routes";
import type { PlayerStatsListRow } from "../types";

type PlayerStatsExplorerProps = {
  rows: PlayerStatsListRow[];
};

type SortKey =
  | "player_name"
  | "team_name"
  | "position_code"
  | "age"
  | "appearances"
  | "starts"
  | "goals"
  | "assists"
  | "total_minutes"
  | "avg_minutes";

type SortDirection = "asc" | "desc";

const DEFAULT_DIRECTIONS: Record<SortKey, SortDirection> = {
  player_name: "asc",
  team_name: "asc",
  position_code: "asc",
  age: "desc",
  appearances: "desc",
  starts: "desc",
  goals: "desc",
  assists: "desc",
  total_minutes: "desc",
  avg_minutes: "desc",
};

const POSITION_ORDER: Record<string, number> = {
  GK: 1,
  DF: 2,
  MF: 3,
  FW: 4,
};

const POSITION_FILTERS = [
  { value: "ALL", labelKey: "statsHub.allPositions" },
  { value: "GK", labelKey: "common.goalkeepers" },
  { value: "DF", labelKey: "common.defenders" },
  { value: "MF", labelKey: "common.midfielders" },
  { value: "FW", labelKey: "common.forwards" },
];

// Türkçe karakterlere duyarsız arama için sadeleştirme.
function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i");
}

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

function getMetricValue(row: PlayerStatsListRow, key: SortKey): number {
  if (key === "age") return row.age ?? -1;
  if (key === "appearances") return row.appearances;
  if (key === "starts") return row.starts;
  if (key === "goals") return row.goals;
  if (key === "assists") return row.assists;
  if (key === "total_minutes") return row.total_minutes;
  if (key === "avg_minutes") return row.avg_minutes ?? -1;
  return 0;
}

function PlayerAvatar({ row }: { row: PlayerStatsListRow }) {
  if (!row.photo_url) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[11px] font-semibold text-white/45">
        {row.player_name.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      src={row.photo_url}
      alt={row.player_name}
      width={36}
      height={36}
      className="h-9 w-9 shrink-0 rounded-full border border-white/10 bg-white/[0.05] object-cover"
    />
  );
}

export default function PlayerStatsExplorer({
  rows,
}: PlayerStatsExplorerProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("goals");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const teams = useMemo(() => {
    const bySlug = new Map<string, string>();

    for (const row of rows) {
      if (row.in_current_squad && row.team_slug && row.team_name) {
        bySlug.set(row.team_slug, row.team_name);
      }
    }

    return Array.from(bySlug.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(DEFAULT_DIRECTIONS[key]);
  }

  const filteredRows = useMemo(() => {
    const query = normalizeSearchText(search.trim());

    return rows.filter((row) => {
      if (teamFilter !== "all" && row.team_slug !== teamFilter) {
        return false;
      }

      if (positionFilter !== "ALL" && row.position_code !== positionFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = normalizeSearchText(
        [row.player_name, row.full_name, row.team_name]
          .filter(Boolean)
          .join(" ")
      );

      return haystack.includes(query);
    });
  }, [rows, search, teamFilter, positionFilter]);

  const sortedRows = useMemo(() => {
    const cloned = [...filteredRows];

    cloned.sort((a, b) => {
      if (sortKey === "player_name") {
        return compareText(a.player_name, b.player_name, sortDirection);
      }

      if (sortKey === "team_name") {
        const byTeam = compareText(
          a.team_name ?? "",
          b.team_name ?? "",
          sortDirection
        );
        if (byTeam !== 0) return byTeam;
        return compareText(a.player_name, b.player_name, "asc");
      }

      if (sortKey === "position_code") {
        const aOrder = POSITION_ORDER[a.position_code] ?? 999;
        const bOrder = POSITION_ORDER[b.position_code] ?? 999;

        const byPosition = compareNumber(aOrder, bOrder, sortDirection);
        if (byPosition !== 0) return byPosition;

        const byMinutes = compareNumber(
          a.total_minutes,
          b.total_minutes,
          "desc"
        );
        if (byMinutes !== 0) return byMinutes;

        return compareText(a.player_name, b.player_name, "asc");
      }

      const byMetric = compareNumber(
        getMetricValue(a, sortKey),
        getMetricValue(b, sortKey),
        sortDirection
      );
      if (byMetric !== 0) return byMetric;

      const byMinutes = compareNumber(a.total_minutes, b.total_minutes, "desc");
      if (byMinutes !== 0) return byMinutes;

      return compareText(a.player_name, b.player_name, "asc");
    });

    return cloned;
  }, [filteredRows, sortKey, sortDirection]);

  const headerCellClass =
    "cursor-pointer select-none whitespace-nowrap px-4 py-2.5 font-medium transition hover:text-white/75";

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-md">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35">
            <SearchIcon />
          </span>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("statsHub.searchPlaceholder")}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-2.5 pl-11 pr-4 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-[#4da2ff]/40 focus:bg-[#0e1d30]"
          />
        </div>

        <select
          value={teamFilter}
          onChange={(event) => setTeamFilter(event.target.value)}
          className="rounded-2xl border border-white/10 bg-[#0b1626] px-4 py-2.5 text-sm text-white/85 outline-none transition focus:border-[#4da2ff]/40"
        >
          <option value="all">{t("statsHub.allTeams")}</option>
          {teams.map((team) => (
            <option key={team.slug} value={team.slug}>
              {team.name}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-2">
          {POSITION_FILTERS.map((position) => (
            <button
              key={position.value}
              type="button"
              onClick={() => setPositionFilter(position.value)}
              className={`rounded-2xl border px-4 py-2.5 text-xs font-medium transition ${
                positionFilter === position.value
                  ? "border-[#4da2ff]/40 bg-[#10233b] text-white"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:border-[#4da2ff]/25 hover:text-white"
              }`}
            >
              {t(position.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-white/45">
        {sortedRows.length === 1
          ? t("statsHub.playerCountOne")
          : t("statsHub.playersCount", { count: sortedRows.length })}{" "}
        · Süper Lig 2025/2026
      </div>

      <div className="rounded-[18px] border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
                <th
                  className={headerCellClass}
                  onClick={() => handleSort("player_name")}
                >
                  {t("common.player")}
                  {getSortIndicator(sortKey, sortDirection, "player_name")}
                </th>
                <th
                  className={headerCellClass}
                  onClick={() => handleSort("team_name")}
                >
                  {t("common.team")}
                  {getSortIndicator(sortKey, sortDirection, "team_name")}
                </th>
                <th
                  className={headerCellClass}
                  onClick={() => handleSort("position_code")}
                >
                  {t("common.position")}
                  {getSortIndicator(sortKey, sortDirection, "position_code")}
                </th>
                <th className={headerCellClass} onClick={() => handleSort("age")}>
                  {t("common.age")}
                  {getSortIndicator(sortKey, sortDirection, "age")}
                </th>
                <th
                  className={headerCellClass}
                  onClick={() => handleSort("appearances")}
                >
                  {t("common.appearances")}
                  {getSortIndicator(sortKey, sortDirection, "appearances")}
                </th>
                <th
                  className={headerCellClass}
                  onClick={() => handleSort("starts")}
                >
                  {t("common.starts")}
                  {getSortIndicator(sortKey, sortDirection, "starts")}
                </th>
                <th
                  className={headerCellClass}
                  onClick={() => handleSort("goals")}
                >
                  {t("common.goals")}
                  {getSortIndicator(sortKey, sortDirection, "goals")}
                </th>
                <th
                  className={headerCellClass}
                  onClick={() => handleSort("assists")}
                >
                  {t("common.assists")}
                  {getSortIndicator(sortKey, sortDirection, "assists")}
                </th>
                <th
                  className={headerCellClass}
                  onClick={() => handleSort("total_minutes")}
                >
                  {t("common.minutes")}
                  {getSortIndicator(sortKey, sortDirection, "total_minutes")}
                </th>
                <th
                  className={headerCellClass}
                  onClick={() => handleSort("avg_minutes")}
                >
                  {t("common.avgMinutes")}
                  {getSortIndicator(sortKey, sortDirection, "avg_minutes")}
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.length === 0 ? (
                <tr className="border-t border-white/10">
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center text-sm text-white/55"
                  >
                    {t("statsHub.noPlayersMatch")}
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr
                    key={row.player_slug}
                    className="border-t border-white/10 text-[13px] text-white/80 transition hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <PlayerAvatar row={row} />

                        <div className="min-w-0">
                          <PlayerLink
                            playerSlug={row.player_slug}
                            className="font-medium text-[#8dc8ff] transition hover:text-[#bfe0ff] hover:underline"
                            title={row.full_name ?? row.player_name}
                          >
                            {row.player_name}
                          </PlayerLink>

                          <div className="text-[11px] text-white/40">
                            {[
                              row.shirt_number != null
                                ? `#${row.shirt_number}`
                                : null,
                              row.nationality,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <TeamCell row={row} />
                    </td>
                    <td className="px-4 py-2">{row.position_code}</td>
                    <td className="px-4 py-2">{row.age ?? "—"}</td>
                    <td className="px-4 py-2">
                      {row.has_stats ? row.appearances : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {row.has_stats ? row.starts : "—"}
                    </td>
                    <td className="px-4 py-2 font-semibold text-white">
                      {row.has_stats ? row.goals : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {row.has_stats ? row.assists : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {row.has_stats ? row.total_minutes : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {row.has_stats && row.avg_minutes != null
                        ? Math.round(row.avg_minutes)
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TeamCell({ row }: { row: PlayerStatsListRow }) {
  const { t } = useI18n();
  const teamHref = getTeamDetailHref(row.team_slug);

  const teamNode = teamHref ? (
    <Link
      href={teamHref}
      className="text-white/75 transition hover:text-white hover:underline"
    >
      {row.team_name}
    </Link>
  ) : (
    <span>{row.team_name ?? "—"}</span>
  );

  if (row.in_current_squad) {
    return teamNode;
  }

  return (
    <span className="inline-flex items-center gap-2">
      {teamNode}
      <span
        className="rounded-full border border-white/12 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-white/45"
        title={t("common.notInCurrentSquads")}
      >
        {t("common.leftClub")}
      </span>
    </span>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
