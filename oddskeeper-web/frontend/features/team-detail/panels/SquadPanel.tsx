"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Translator } from "@/lib/i18n/messages";
import type { TeamCurrentSquadRow, TeamSquadRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { formatDecimal } from "../utils/formatDecimal";
import PlayerLink from "@/components/links/PlayerLink";

type SquadPanelProps = {
  rows?: TeamSquadRow[];
  currentSquad?: TeamCurrentSquadRow[];
};

const POSITION_GROUP_KEYS: Record<string, string> = {
  GOALKEEPER: "common.goalkeeper",
  DEFENDER: "common.defender",
  MIDFIELDER: "common.midfielder",
  FORWARD: "common.forward",
  OTHER: "common.other",
};

function getPositionGroupLabel(
  positionGroup: string,
  position: string | null,
  t: Translator
) {
  const key = POSITION_GROUP_KEYS[positionGroup];
  return key ? t(key) : position ?? "—";
}

function CurrentSquadTable({ rows }: { rows: TeamCurrentSquadRow[] }) {
  const { t } = useI18n();

  return (
    <div className="rounded-[14px] border border-white/10">
      <div className="border-b border-white/10 bg-white/[0.03] px-4 py-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/42">
          {t("teamDetail.currentSquadTitle")}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
              <th className="px-4 py-2 font-medium">{t("teamDetail.colShirtNumber")}</th>
              <th className="px-4 py-2 font-medium">{t("common.player")}</th>
              <th className="px-4 py-2 font-medium">{t("teamDetail.colPosition")}</th>
              <th className="px-4 py-2 font-medium">{t("common.age")}</th>
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
                    <span
                      className="text-white"
                      title={t("teamDetail.playerPageNotYetAvailable")}
                    >
                      {row.player_name}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {getPositionGroupLabel(row.position_group, row.position, t)}
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

function PlayerStatusBadge({ row }: { row: TeamSquadRow }) {
  const { t } = useI18n();

  if (row.current_team_slug === row.team_slug) {
    return null;
  }

  if (row.current_team_slug) {
    const currentTeam = row.current_team_name ?? row.current_team_slug;

    return (
      <span
        className="ml-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-amber-300/90"
        title={t("teamDetail.nowPlaysForTooltip", { team: currentTeam })}
      >
        {t("common.nowAt", { team: currentTeam })}
      </span>
    );
  }

  return (
    <span
      className="ml-2 rounded-full border border-white/12 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-white/45"
      title={t("common.notInCurrentSquads")}
    >
      {t("common.leftClub")}
    </span>
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
  const { t } = useI18n();
  const [sortKey, setSortKey] = useState<SortKey>("primary_position_code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Rozetler güncel kadro verisi olan takımlarda anlamlı; ligden düşen
  // takımlarda her satır "left club" olacağından gösterme.
  const showStatusBadges = currentSquad.length > 0;

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
        {t("teamDetail.noSquadData")}
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
              {t("teamDetail.seasonMatchStatsTitle")}
              {rows[0]?.season_label ? ` · ${rows[0].season_label}` : ""}
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
                {t("common.player")}
                {getSortIndicator(sortKey, sortDirection, "player_name")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("primary_position_code")}
                className="cursor-pointer select-none"
              >
                {t("teamDetail.colPosition")}
                {getSortIndicator(sortKey, sortDirection, "primary_position_code")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("appearances")}
                className="cursor-pointer select-none"
              >
                {t("common.appearances")}
                {getSortIndicator(sortKey, sortDirection, "appearances")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("starts")}
                className="cursor-pointer select-none"
              >
                {t("common.starts")}
                {getSortIndicator(sortKey, sortDirection, "starts")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("sub_appearances")}
                className="cursor-pointer select-none"
              >
                {t("teamDetail.colSub")}
                {getSortIndicator(sortKey, sortDirection, "sub_appearances")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("starter_rate_pct")}
                className="cursor-pointer select-none"
              >
                {t("teamDetail.colStarterPct")}
                {getSortIndicator(sortKey, sortDirection, "starter_rate_pct")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("total_minutes")}
                className="cursor-pointer select-none"
              >
                {t("teamDetail.colMinutesFull")}
                {getSortIndicator(sortKey, sortDirection, "total_minutes")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("avg_minutes")}
                className="cursor-pointer select-none"
              >
                {t("common.avgMinutes")}
                {getSortIndicator(sortKey, sortDirection, "avg_minutes")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("goals")}
                className="cursor-pointer select-none"
              >
                {t("common.goals")}
                {getSortIndicator(sortKey, sortDirection, "goals")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("assists")}
                className="cursor-pointer select-none"
              >
                {t("common.assists")}
                {getSortIndicator(sortKey, sortDirection, "assists")}
              </button>
            </th>

            <th className="px-4 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("last_match_datetime")}
                className="cursor-pointer select-none"
              >
                {t("teamDetail.colLastMatch")}
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
                {showStatusBadges ? <PlayerStatusBadge row={row} /> : null}
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