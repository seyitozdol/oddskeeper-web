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
  if (rank <= 4) return "text-emerald-300";
  if (rank >= 16) return "text-rose-300";
  if (rank >= 13) return "text-amber-300";
  return "text-white/84";
}

function getFormBadgeClass(code: string) {
  if (code === "W") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  if (code === "L") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-300";
  }

  return "border-amber-500/25 bg-amber-500/10 text-amber-300";
}

function FormBadges({ value }: { value: string }) {
  if (!value || !value.trim()) {
    return <span className="text-white/45">—</span>;
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
      className={`inline-flex items-center gap-1 transition hover:text-white ${
        isActive ? "text-white" : "text-white/38"
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
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        {t("leagueDetail.noStandingsData")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-white/10">
      <table className="min-w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-[#0d1624]">
          <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
            <th className="px-4 py-2 font-medium">
              <SortableHeader label="#" sortKey="rank" sortConfig={sortConfig} onSort={handleSort} t={t} />
            </th>
            <th className="px-4 py-2 font-medium">
              <SortableHeader label={t("common.team")} sortKey="team_name" sortConfig={sortConfig} onSort={handleSort} t={t} />
            </th>
            <th className="px-4 py-2 font-medium"><SortableHeader label={t("leagueDetail.colPlayed")} sortKey="played" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-4 py-2 font-medium"><SortableHeader label={t("common.win")} sortKey="wins" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-4 py-2 font-medium"><SortableHeader label={t("common.draw")} sortKey="draws" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-4 py-2 font-medium"><SortableHeader label={t("common.loss")} sortKey="losses" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-4 py-2 font-medium"><SortableHeader label={t("leagueDetail.colGoalsFor")} sortKey="goals_for" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-4 py-2 font-medium"><SortableHeader label={t("leagueDetail.colGoalsAgainst")} sortKey="goals_against" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-4 py-2 font-medium"><SortableHeader label={t("leagueDetail.colGoalDiff")} sortKey="goal_difference" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-4 py-2 font-medium"><SortableHeader label={t("leagueDetail.colPoints")} sortKey="points" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-4 py-2 font-medium"><SortableHeader label={t("leagueDetail.colPointsPerGame")} sortKey="points_per_game" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-4 py-2 font-medium"><SortableHeader label={t("leagueDetail.colHomePoints")} sortKey="home_points" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-4 py-2 font-medium"><SortableHeader label={t("leagueDetail.colAwayPoints")} sortKey="away_points" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
            <th className="px-4 py-2 font-medium"><SortableHeader label={t("leagueDetail.colLast5")} sortKey="last5_points" sortConfig={sortConfig} onSort={handleSort} t={t} /></th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={`${row.team_source_id}-${row.rank}`}
              className="border-t border-white/10 text-[13px] text-white/80 transition hover:bg-white/[0.02]"
            >
              <td className={`px-4 py-2 whitespace-nowrap font-semibold ${getRankTone(row.rank)}`}>
                {row.rank}
              </td>
              <td className="min-w-[220px] px-4 py-2 font-medium text-white">
                {row.team_slug ? (
                  <TeamLink
                    teamSlug={row.team_slug}
                    className="transition hover:text-white hover:underline"
                    title={row.team_name}
                  >
                    {row.team_name}
                  </TeamLink>
                ) : (
                  row.team_name
                )}
              </td>
              <td className="px-4 py-2 whitespace-nowrap">{row.played}</td>
              <td className="px-4 py-2 whitespace-nowrap">{row.wins}</td>
              <td className="px-4 py-2 whitespace-nowrap">{row.draws}</td>
              <td className="px-4 py-2 whitespace-nowrap">{row.losses}</td>
              <td className="px-4 py-2 whitespace-nowrap">{row.goals_for}</td>
              <td className="px-4 py-2 whitespace-nowrap">{row.goals_against}</td>
              <td className="px-4 py-2 whitespace-nowrap font-medium text-white">
                {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
              </td>
              <td className="px-4 py-2 whitespace-nowrap font-semibold text-white">{row.points}</td>
              <td className="px-4 py-2 whitespace-nowrap text-white/72">
                {formatDecimal(row.points_per_game, 2)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-white/72">{row.home_points}</td>
              <td className="px-4 py-2 whitespace-nowrap text-white/72">{row.away_points}</td>
              <td className="px-4 py-2 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <FormBadges value={row.form_last5} />
                  <span className="text-[11px] text-white/45">
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
