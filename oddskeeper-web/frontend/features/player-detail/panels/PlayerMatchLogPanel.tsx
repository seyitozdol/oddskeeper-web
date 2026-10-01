"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlayerMatchLogRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { formatDecimal } from "../utils/formatDecimal";
import { PlayerResultBadge } from "../components/PlayerResultBadge";
import TeamLink from "@/components/links/TeamLink";
import MatchLink from "@/components/links/MatchLink";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { CUP_INFO, competitionLabel } from "../competitions";
import {
  EMPTY_SCOPE,
  ScopeFilter,
  matchesScope,
  type ScopeSelection,
} from "../components/ScopeFilter";

type PlayerMatchLogPanelProps = {
  rows?: PlayerMatchLogRow[];
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

// Rekabet rozetleri, mac detay rotalari ve chip sirasi: ../competitions.ts
// (Detailed Stats ile ortak).

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

function OpponentName({
  teamSlug,
  name,
}: {
  teamSlug: string | null | undefined;
  name: string | null | undefined;
}) {
  const displayName = name ?? "—";

  if (!teamSlug) {
    return <span>{displayName}</span>;
  }

  return (
    <TeamLink
      teamSlug={teamSlug}
      className="font-medium text-ink transition hover:text-ink hover:underline"
      title={displayName}
    >
      {displayName}
    </TeamLink>
  );
}

function getSortValue(row: PlayerMatchLogRow, sortKey: SortKey) {
  if (sortKey === "match_datetime") {
    return row.match_datetime ? new Date(row.match_datetime).getTime() : 0;
  }

  if (sortKey === "minutes_played") {
    return row.minutes_played ?? 0;
  }

  if (sortKey === "goals") {
    return row.goals ?? 0;
  }

  if (sortKey === "assists") {
    return row.assists ?? 0;
  }

  return toNumber(row.expected_goals);
}

export function PlayerMatchLogPanel({ rows = [] }: PlayerMatchLogPanelProps) {
  const { t } = useI18n();
  const [lineupFilter, setLineupFilter] = useState<LineupFilter>("all");
  // Tek profil tum rekabetleri listeler; rekabet + sezon chip'leriyle suzulur
  // (ikisi de coklu secim; varsayilan tumu).
  const [scope, setScope] = useState<ScopeSelection>(EMPTY_SCOPE);
  const [sortKey, setSortKey] = useState<SortKey>("match_datetime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const scopeItems = useMemo(
    () => rows.map((r) => ({ competition: r.competition, season: r.season_label })),
    [rows]
  );

  const compRows = useMemo(
    () =>
      rows.filter((r) =>
        matchesScope({ competition: r.competition, season: r.season_label }, scope)
      ),
    [rows, scope]
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("desc");
  }

  const starterCount = useMemo(
    () =>
      compRows.filter(
        (row) => normalizeLineupStatus(row.lineup_status) === "starter"
      ).length,
    [compRows]
  );

  const substituteCount = useMemo(
    () =>
      compRows.filter(
        (row) => normalizeLineupStatus(row.lineup_status) === "substitute"
      ).length,
    [compRows]
  );

  const filteredRows = useMemo(() => {
    if (lineupFilter === "all") return compRows;

    return compRows.filter(
      (row) => normalizeLineupStatus(row.lineup_status) === lineupFilter
    );
  }, [compRows, lineupFilter]);

  const sortedRows = useMemo(() => {
    const cloned = [...filteredRows];

    cloned.sort((a, b) => {
      const aValue = getSortValue(a, sortKey);
      const bValue = getSortValue(b, sortKey);

      let comparison = aValue - bValue;

      if (comparison === 0) {
        const aFallback = a.match_datetime
          ? new Date(a.match_datetime).getTime()
          : 0;
        const bFallback = b.match_datetime
          ? new Date(b.match_datetime).getTime()
          : 0;
        comparison = bFallback - aFallback;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return cloned;
  }, [filteredRows, sortKey, sortDirection]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-veil px-4 py-4 text-sm text-ink-2">
        {t("playerDetail.noMatchLogData")}
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
      <ScopeFilter items={scopeItems} value={scope} onChange={setScope} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setLineupFilter("all")}
          className={`rounded-xl border px-3 py-2 text-sm transition ${
            lineupFilter === "all"
              ? "border-line-strong bg-card-2 text-ink"
              : "border-line bg-veil text-ink-2 hover:bg-veil"
          }`}
        >
          {t("playerDetail.allWithCount", { count: compRows.length })}
        </button>

        <button
          type="button"
          onClick={() => setLineupFilter("starter")}
          className={`rounded-xl border px-3 py-2 text-sm transition ${
            lineupFilter === "starter"
              ? "border-line-strong bg-card-2 text-ink"
              : "border-line bg-veil text-ink-2 hover:bg-veil"
          }`}
        >
          {t("playerDetail.startersWithCount", { count: starterCount })}
        </button>

        <button
          type="button"
          onClick={() => setLineupFilter("substitute")}
          className={`rounded-xl border px-3 py-2 text-sm transition ${
            lineupFilter === "substitute"
              ? "border-line-strong bg-card-2 text-ink"
              : "border-line bg-veil text-ink-2 hover:bg-veil"
          }`}
        >
          {t("playerDetail.substitutesWithCount", { count: substituteCount })}
        </button>
      </div>

      {sortedRows.length === 0 ? (
        <div className="rounded-xl border border-line bg-veil px-4 py-4 text-sm text-ink-2">
          {t("playerDetail.noRowsForFilter")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full border-collapse">
            <thead className="bg-veil">
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
                <th className="px-3 py-1.5 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort("match_datetime")}
                    className="cursor-pointer select-none"
                  >
                    {t("common.date")}
                    {getSortIndicator(sortKey, sortDirection, "match_datetime")}
                  </button>
                </th>

                <th className="px-3 py-1.5 font-medium">{t("common.opponent")}</th>
                <th className="px-3 py-1.5 font-medium">{t("playerDetail.homeAwayColumn")}</th>
                <th className="px-3 py-1.5 font-medium">{t("common.score")}</th>
                <th className="px-3 py-1.5 font-medium">{t("common.result")}</th>
                <th className="px-3 py-1.5 font-medium">{t("playerDetail.lineupColumn")}</th>
                <th className="px-3 py-1.5 font-medium">{t("common.position")}</th>

                <th className="px-3 py-1.5 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort("minutes_played")}
                    className="cursor-pointer select-none"
                  >
                    {t("common.minutes")}
                    {getSortIndicator(sortKey, sortDirection, "minutes_played")}
                  </button>
                </th>

                <th className="px-3 py-1.5 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort("goals")}
                    className="cursor-pointer select-none"
                  >
                    {t("playerDetail.goalsAbbr")}
                    {getSortIndicator(sortKey, sortDirection, "goals")}
                  </button>
                </th>

                <th className="px-3 py-1.5 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort("assists")}
                    className="cursor-pointer select-none"
                  >
                    {t("playerDetail.assistsAbbr")}
                    {getSortIndicator(sortKey, sortDirection, "assists")}
                  </button>
                </th>

                <th className="px-3 py-1.5 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort("expected_goals")}
                    className="cursor-pointer select-none"
                  >
                    {t("playerDetail.xgColumn")}
                    {getSortIndicator(sortKey, sortDirection, "expected_goals")}
                  </button>
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((row) => {
                const cup = row.competition ? CUP_INFO[row.competition] : undefined;
                const cupHref = cup
                  ? `${cup.matchBase}/${encodeURIComponent(row.source_match_id)}?returnTo=${encodeURIComponent(baseReturnTo)}`
                  : null;
                return (
                <tr
                  key={`${row.source_match_id}-${row.player_source_id}`}
                  className="border-t border-line text-[13px] text-ink transition hover:bg-veil"
                >
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {cupHref ? (
                      <Link
                        href={cupHref}
                        className="transition hover:text-ink hover:underline"
                        title={t("playerDetail.openMatchDetailTitle")}
                      >
                        {formatDate(row.match_datetime)}
                      </Link>
                    ) : (
                      <MatchLink
                        sourceMatchId={row.source_match_id}
                        returnTo={baseReturnTo}
                        className="transition hover:text-ink hover:underline"
                        title={t("playerDetail.openMatchDetailTitle")}
                      >
                        {formatDate(row.match_datetime)}
                      </MatchLink>
                    )}
                  </td>

                  <td className="px-3 py-1.5 min-w-[220px]">
                    <span className="inline-flex items-center gap-1.5">
                      <OpponentName
                        teamSlug={row.opponent_team_slug}
                        name={row.opponent_name}
                      />
                      {cup ? (
                        <span
                          className="shrink-0 rounded bg-accent-soft px-1 py-0.5 text-[9px] font-semibold text-accent-ink"
                          title={row.competition ? competitionLabel(t, row.competition) : undefined}
                        >
                          {t(cup.shortKey)}
                        </span>
                      ) : null}
                    </span>
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className="rounded-md border border-line bg-veil px-2 py-[2px] text-[10px] font-medium text-ink-2">
                      {row.is_home ? t("common.home") : t("common.away")}
                    </span>
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap font-medium text-ink">
                    {cupHref ? (
                      <Link
                        href={cupHref}
                        className="font-medium text-ink transition hover:text-ink hover:underline"
                        title={t("playerDetail.openMatchDetailTitle")}
                      >
                        {row.score_display ?? "—"}
                      </Link>
                    ) : (
                      <MatchLink
                        sourceMatchId={row.source_match_id}
                        returnTo={baseReturnTo}
                        className="font-medium text-ink transition hover:text-ink hover:underline"
                        title={t("playerDetail.openMatchDetailTitle")}
                      >
                        {row.score_display ?? "—"}
                      </MatchLink>
                    )}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <PlayerResultBadge resultCode={row.result_code} />
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                    {normalizeLineupStatus(row.lineup_status) === "starter"
                      ? t("playerDetail.starterRoleLabel")
                      : normalizeLineupStatus(row.lineup_status) === "substitute"
                        ? t("playerDetail.subRoleLabel")
                        : row.lineup_status ?? "—"}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                    {row.position_code ?? "—"}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {row.minutes_played ?? "—"}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {row.goals ?? "—"}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {row.assists ?? "—"}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {formatDecimal(row.expected_goals, 3)}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
