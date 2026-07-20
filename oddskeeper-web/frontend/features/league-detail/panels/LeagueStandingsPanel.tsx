"use client";

import { useMemo, useState } from "react";
import TeamLink from "@/components/links/TeamLink";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Translator } from "@/lib/i18n/messages";
import type { LeagueStandingRow } from "../types";

type LeagueStandingsPanelProps = {
  rows?: LeagueStandingRow[];
};

type SortKey =
  | "rank"
  | "team_name"
  | "played"
  | "wins"
  | "draws"
  | "losses"
  | "goals_for"
  | "goals_against"
  | "goal_difference"
  | "points"
  | "points_per_game"
  | "home_points"
  | "away_points"
  | "last5_points";

type SortDirection = "asc" | "desc";

type SortConfig = {
  key: SortKey;
  direction: SortDirection;
};

function formatDecimal(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function getRankTone(rank: number) {
  if (rank <= 4) return "text-pos";
  if (rank >= 16) return "text-neg";
  if (rank >= 13) return "text-amber-500";
  return "text-ink";
}

function getFormBadgeClass(code: string) {
  if (code === "W") {
    return "border-pos/25 bg-pos/10 text-pos";
  }

  if (code === "L") {
    return "border-neg/25 bg-neg/10 text-neg";
  }

  return "border-amber-500/25 bg-amber-400/15 text-amber-500";
}

function FormBadges({ value }: { value: string }) {
  if (!value || !value.trim()) {
    return <span className="text-ink-3">—</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {value
        .split("")
        .slice(0, 5)
        .map((item, index) => (
          <span
            key={`${item}-${index}`}
            className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border text-[10px] font-semibold ${getFormBadgeClass(
              item,
            )}`}
          >
            {item}
          </span>
        ))}
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
  t,
}: {
  label: string;
  sortKey: SortKey;
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
  t: Translator;
}) {
  const isActive = sortConfig.key === sortKey;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 transition hover:text-ink ${
        isActive ? "text-ink" : "text-ink-3"
      }`}
      title={t("leagueDetail.sortByLabel", { label })}
    >
      <span>{label}</span>
      <span className="text-[10px]">
        {isActive ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

function compareNullableNumbers(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: SortDirection,
) {
  const aNull = a === null || a === undefined || Number.isNaN(a);
  const bNull = b === null || b === undefined || Number.isNaN(b);

  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;

  return direction === "asc" ? a - b : b - a;
}

export function LeagueStandingsPanel({ rows = [] }: LeagueStandingsPanelProps) {
  const { t } = useI18n();
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "rank",
    direction: "asc",
  });

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      if (sortConfig.key === "team_name") {
        const comparison = a.team_name.localeCompare(b.team_name);
        if (comparison !== 0) {
          return sortConfig.direction === "asc" ? comparison : -comparison;
        }
      } else {
        const comparison = compareNullableNumbers(
          a[sortConfig.key],
          b[sortConfig.key],
          sortConfig.direction,
        );

        if (comparison !== 0) {
          return comparison;
        }
      }

      return a.rank - b.rank;
    });

    return sorted;
  }, [rows, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: key === "team_name" || key === "rank" ? "asc" : "desc",
      };
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-veil px-3 py-3 text-sm text-ink-2">
        {t("leagueDetail.noStandingsData")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="min-w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-field">
          <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
            <th className="px-3 py-2 font-medium">
              <SortableHeader label="#" sortKey="rank" sortConfig={sortConfig} onSort={handleSort} t={t} />
            </th>
            <th className="px-3 py-2 font-medium">
              <SortableHeader label={t("common.team")} sortKey="team_name" sortConfig={sortConfig} onSort={handleSort} t={t} />
            </th>
            <th className="px-3 py-2 font-medium"><SortableHeader label={t("leagueDetail.colPlayed")} sortKey="played" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-3 py-2 font-medium"><SortableHeader label={t("common.win")} sortKey="wins" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-3 py-2 font-medium"><SortableHeader label={t("common.draw")} sortKey="draws" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-3 py-2 font-medium"><SortableHeader label={t("common.loss")} sortKey="losses" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-3 py-2 font-medium"><SortableHeader label={t("leagueDetail.colGoalsFor")} sortKey="goals_for" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-3 py-2 font-medium"><SortableHeader label={t("leagueDetail.colGoalsAgainst")} sortKey="goals_against" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-3 py-2 font-medium"><SortableHeader label={t("leagueDetail.colGoalDiff")} sortKey="goal_difference" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-3 py-2 font-medium"><SortableHeader label={t("leagueDetail.colPoints")} sortKey="points" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-3 py-2 font-medium"><SortableHeader label={t("leagueDetail.colPointsPerGame")} sortKey="points_per_game" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-3 py-2 font-medium"><SortableHeader label={t("leagueDetail.colHomePoints")} sortKey="home_points" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-3 py-2 font-medium"><SortableHeader label={t("leagueDetail.colAwayPoints")} sortKey="away_points" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-3 py-2 font-medium"><SortableHeader label={t("leagueDetail.colLast5")} sortKey="last5_points" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={`${row.team_source_id}-${row.rank}`}
              className="border-t border-line text-[13px] text-ink transition hover:bg-veil"
            >
              <td className={`px-3 py-1.5 whitespace-nowrap font-semibold ${getRankTone(row.rank)}`}>
                {row.rank}
              </td>
              <td className="min-w-[220px] px-3 py-1.5 font-medium text-ink">
                {row.team_slug ? (
                  <TeamLink
                    teamSlug={row.team_slug}
                    className="transition hover:text-ink hover:underline"
                    title={row.team_name}
                  >
                    {row.team_name}
                  </TeamLink>
                ) : (
                  row.team_name
                )}
              </td>
              <td className="px-3 py-1.5 whitespace-nowrap">{row.played}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{row.wins}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{row.draws}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{row.losses}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{row.goals_for}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{row.goals_against}</td>
              <td className="px-3 py-1.5 whitespace-nowrap font-medium text-ink">
                {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
              </td>
              <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-ink">{row.points}</td>
              <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                {formatDecimal(row.points_per_game, 2)}
              </td>
              <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">{row.home_points}</td>
              <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">{row.away_points}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <FormBadges value={row.form_last5} />
                  <span className="text-[11px] text-ink-3">
                    {t("leagueDetail.ptsSuffix", { count: row.last5_points })}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
