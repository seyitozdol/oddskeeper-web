"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import PlayerLink from "@/components/links/PlayerLink";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { getTeamDetailHref } from "@/lib/routes";
import {
  canonicalNationality,
  getCountryFlagUrl,
} from "@/lib/country-flags";
import type { PlayerStatsListRow } from "../types";

type PlayerStatsExplorerProps = {
  rows: PlayerStatsListRow[];
  teamLogos?: Record<string, string>;
};

type SortKey =
  | "player_name"
  | "team_name"
  | "position_code"
  | "age"
  | "market_value_eur"
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
  market_value_eur: "desc",
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
  if (key === "market_value_eur") return row.market_value_eur ?? -1;
  if (key === "appearances") return row.appearances;
  if (key === "starts") return row.starts;
  if (key === "goals") return row.goals;
  if (key === "assists") return row.assists;
  if (key === "total_minutes") return row.total_minutes;
  if (key === "avg_minutes") return row.avg_minutes ?? -1;
  return 0;
}

function formatMarketValue(value: number | null): string {
  if (value === null) {
    return "—";
  }

  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `€${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }

  return `€${Math.round(value / 1_000)}K`;
}

function getDisplayName(row: PlayerStatsListRow) {
  return row.full_name ?? row.player_name;
}

function PlayerAvatar({ row }: { row: PlayerStatsListRow }) {
  if (!row.photo_url) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-veil text-[11px] font-semibold text-ink-3">
        {getDisplayName(row).slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      src={row.photo_url}
      alt={getDisplayName(row)}
      width={36}
      height={36}
      className="h-9 w-9 shrink-0 rounded-full border border-line bg-veil object-cover"
    />
  );
}

export default function PlayerStatsExplorer({
  rows,
  teamLogos = {},
}: PlayerStatsExplorerProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [nationalityFilter, setNationalityFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [hideDeparted, setHideDeparted] = useState(false);
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

  const nationalities = useMemo(() => {
    const unique = new Set<string>();

    for (const row of rows) {
      const canonical = canonicalNationality(row.nationality);
      if (canonical) {
        unique.add(canonical);
      }
    }

    return Array.from(unique).sort((a, b) => a.localeCompare(b, "tr"));
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
    // Kelime bazlı arama: "victor osimhen" gibi sorgular, veride
    // "Victor James Osimhen" yazsa bile her kelime ayrı eşleşerek bulunur.
    const queryTokens = normalizeSearchText(search)
      .split(/\s+/)
      .filter(Boolean);

    return rows.filter((row) => {
      if (hideDeparted && !row.in_current_squad) {
        return false;
      }

      if (teamFilter !== "all" && row.team_slug !== teamFilter) {
        return false;
      }

      if (
        nationalityFilter !== "all" &&
        canonicalNationality(row.nationality) !== nationalityFilter
      ) {
        return false;
      }

      if (positionFilter !== "ALL" && row.position_code !== positionFilter) {
        return false;
      }

      if (queryTokens.length === 0) {
        return true;
      }

      const haystack = normalizeSearchText(
        [row.player_name, row.full_name, row.team_name]
          .filter(Boolean)
          .join(" ")
      );

      return queryTokens.every((token) => haystack.includes(token));
    });
  }, [rows, search, teamFilter, nationalityFilter, positionFilter, hideDeparted]);

  const sortedRows = useMemo(() => {
    const cloned = [...filteredRows];

    cloned.sort((a, b) => {
      if (sortKey === "player_name") {
        return compareText(getDisplayName(a), getDisplayName(b), sortDirection);
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
    "cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium transition hover:text-ink-2";

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-md">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">
            <SearchIcon />
          </span>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("statsHub.searchPlaceholder")}
            className="w-full rounded-2xl border border-line bg-veil py-2.5 pl-11 pr-4 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-line-strong focus:bg-card-2"
          />
        </div>

        <select
          value={teamFilter}
          onChange={(event) => setTeamFilter(event.target.value)}
          className="rounded-2xl border border-line bg-field px-4 py-2.5 text-sm text-ink outline-none transition focus:border-line-strong"
        >
          <option value="all">{t("statsHub.allTeams")}</option>
          {teams.map((team) => (
            <option key={team.slug} value={team.slug}>
              {team.name}
            </option>
          ))}
        </select>

        <select
          value={nationalityFilter}
          onChange={(event) => setNationalityFilter(event.target.value)}
          className="rounded-2xl border border-line bg-field px-4 py-2.5 text-sm text-ink outline-none transition focus:border-line-strong"
        >
          <option value="all">{t("statsHub.allNationalities")}</option>
          {nationalities.map((nationality) => (
            <option key={nationality} value={nationality}>
              {nationality}
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
                  ? "border-line-strong bg-card-2 text-ink"
                  : "border-line bg-veil text-ink-2 hover:border-line-strong hover:text-ink"
              }`}
            >
              {t(position.labelKey)}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setHideDeparted((prev) => !prev)}
            className={`rounded-2xl border px-4 py-2.5 text-xs font-medium transition ${
              hideDeparted
                ? "border-line-strong bg-card-2 text-ink"
                : "border-line bg-veil text-ink-2 hover:border-line-strong hover:text-ink"
            }`}
          >
            {t("statsHub.hideDeparted")}
          </button>
        </div>
      </div>

      <div className="text-xs text-ink-3">
        {sortedRows.length === 1
          ? t("statsHub.playerCountOne")
          : t("statsHub.playersCount", { count: sortedRows.length })}{" "}
        · Süper Lig 2025/2026
      </div>

      <div className="rounded-lg border border-line">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
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
                  onClick={() => handleSort("market_value_eur")}
                >
                  {t("common.marketValueShort")}
                  {getSortIndicator(sortKey, sortDirection, "market_value_eur")}
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
                <tr className="border-t border-line">
                  <td
                    colSpan={11}
                    className="px-4 py-8 text-center text-sm text-ink-2"
                  >
                    {t("statsHub.noPlayersMatch")}
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr
                    key={row.player_slug}
                    className="border-t border-line text-[13px] text-ink transition hover:bg-veil"
                  >
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-3">
                        <PlayerAvatar row={row} />

                        <div className="min-w-0">
                          <PlayerLink
                            playerSlug={row.player_slug}
                            className="font-medium text-accent-ink transition hover:text-accent hover:underline"
                            title={getDisplayName(row)}
                          >
                            {getDisplayName(row)}
                          </PlayerLink>

                          <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
                            {row.shirt_number != null ? (
                              <span>#{row.shirt_number}</span>
                            ) : null}
                            <NationalityBadge nationality={row.nationality} />
                            {row.shirt_number == null && !row.nationality ? (
                              <span>—</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <TeamCell row={row} teamLogos={teamLogos} />
                    </td>
                    <td className="px-3 py-1.5">{row.position_code}</td>
                    <td className="px-3 py-1.5">{row.age ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      {formatMarketValue(row.market_value_eur)}
                    </td>
                    <td className="px-3 py-1.5">
                      {row.has_stats ? row.appearances : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      {row.has_stats ? row.starts : "—"}
                    </td>
                    <td className="px-3 py-1.5 font-semibold text-ink">
                      {row.has_stats ? row.goals : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      {row.has_stats ? row.assists : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      {row.has_stats ? row.total_minutes : "—"}
                    </td>
                    <td className="px-3 py-1.5">
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

function TeamCell({
  row,
  teamLogos,
}: {
  row: PlayerStatsListRow;
  teamLogos: Record<string, string>;
}) {
  const { t } = useI18n();
  const teamHref = getTeamDetailHref(row.team_slug);
  const logoPath = row.team_slug ? teamLogos[row.team_slug] : undefined;

  const teamContent = (
    <span className="inline-flex items-center gap-2">
      {logoPath ? (
        <Image
          src={logoPath}
          alt={row.team_name ?? ""}
          width={18}
          height={18}
          className="h-[18px] w-[18px] shrink-0 object-contain"
        />
      ) : null}
      <span>{row.team_name ?? "—"}</span>
    </span>
  );

  const teamNode = teamHref ? (
    <Link
      href={teamHref}
      className="text-ink-2 transition hover:text-ink hover:underline"
    >
      {teamContent}
    </Link>
  ) : (
    teamContent
  );

  if (row.in_current_squad) {
    return teamNode;
  }

  return (
    <span className="inline-flex items-center gap-2">
      {teamNode}
      <span
        className="rounded-full border border-line bg-veil px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3"
        title={t("common.notInCurrentSquads")}
      >
        {t("common.leftClub")}
      </span>
    </span>
  );
}

function NationalityBadge({ nationality }: { nationality: string | null }) {
  if (!nationality) {
    return null;
  }

  const flagUrl = getCountryFlagUrl(nationality);
  const label = canonicalNationality(nationality) ?? nationality;

  return (
    <span className="inline-flex items-center gap-1.5">
      {flagUrl ? (
        <Image
          src={flagUrl}
          alt={label}
          width={16}
          height={12}
          className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
        />
      ) : null}
      <span>{label}</span>
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
