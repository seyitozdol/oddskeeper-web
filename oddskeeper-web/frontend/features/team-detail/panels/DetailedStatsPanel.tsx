"use client";

import Link from "next/link";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Translator } from "@/lib/i18n/messages";
import { categoryLabel, metricLabel } from "@/lib/i18n/metricLabel";
import type {
  TeamDetailedCategoryKey,
  TeamDetailedMetricRow,
} from "../types";

type DetailedStatsPanelProps = {
  rows?: TeamDetailedMetricRow[];
};

type CategoryFilter = "all" | TeamDetailedCategoryKey;
type SummaryTone = "neutral" | "positive" | "negative" | "accent" | "warning";

type SortKey =
  | "total_value"
  | "per_match_value"
  | "home_value"
  | "away_value"
  | "league_avg"
  | "league_rank"
  | "vs_league_avg_pct";

type SortDirection = "asc" | "desc";

type SortConfig = {
  key: SortKey;
  direction: SortDirection;
} | null;

type DisplayValueColumn =
  | "total"
  | "per_match"
  | "home_per_match"
  | "away_per_match"
  | "league_avg_per_match"
  | "gap";

type MetricDisplayProfile = "count" | "pct" | "xg" | "ratio";

const CATEGORY_ORDER: TeamDetailedCategoryKey[] = [
  "attack",
  "defence",
  "build_up",
  "discipline",
  "set_piece",
  "goal_composition",
];

const CATEGORY_LABEL_KEYS: Record<TeamDetailedCategoryKey, string> = {
  attack: "teamDetail.categoryAttack",
  defence: "teamDetail.categoryDefence",
  build_up: "teamDetail.categoryBuildUp",
  discipline: "teamDetail.categoryDiscipline",
  set_piece: "teamDetail.categorySetPiece",
  goal_composition: "teamDetail.categoryGoalComposition",
};

function formatRawNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatMetricValue(
  value: number | null | undefined,
  valueFormat: string | null | undefined
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  if (valueFormat === "integer") {
    return formatRawNumber(value, 0);
  }

  if (valueFormat === "decimal_1") {
    return formatRawNumber(value, 1);
  }

  if (valueFormat === "decimal_2") {
    return formatRawNumber(value, 2);
  }

  if (valueFormat === "decimal_3") {
    return formatRawNumber(value, 3);
  }

  if (valueFormat === "pct_1") {
    const normalized = Math.abs(value) <= 1 ? value * 100 : value;
    return `${formatRawNumber(normalized, 1)}%`;
  }

  return formatRawNumber(value, 2);
}

function getMetricDisplayProfile(row: TeamDetailedMetricRow): MetricDisplayProfile {
  const metricKey = row.metric_key.toLowerCase();
  const metricLabelText = row.metric_label.toLowerCase();
  const valueFormat = row.value_format;

  if (
    valueFormat === "pct_1" ||
    metricLabelText.includes("%") ||
    metricKey.includes("_pct")
  ) {
    return "pct";
  }

  if (
    valueFormat === "decimal_3" ||
    metricKey.includes("xg_per_shot") ||
    metricKey.includes("per_shot")
  ) {
    return "ratio";
  }

  if (
    valueFormat === "decimal_2" ||
    metricKey.includes("expected_goals") ||
    metricKey.includes("xg_against") ||
    metricKey === "team_xg" ||
    metricKey.startsWith("team_xg")
  ) {
    return "xg";
  }

  return "count";
}

function getColumnValueFormat(
  row: TeamDetailedMetricRow,
  column: DisplayValueColumn
): string {
  const profile = getMetricDisplayProfile(row);

  if (profile === "pct") {
    return "pct_1";
  }

  if (profile === "ratio") {
    return "decimal_3";
  }

  if (profile === "xg") {
    return "decimal_2";
  }

  if (column === "total") {
    return "integer";
  }

  return "decimal_1";
}

function formatMetricCell(
  row: TeamDetailedMetricRow,
  value: number | null | undefined,
  column: DisplayValueColumn
) {
  return formatMetricValue(value, getColumnValueFormat(row, column));
}

function getRankTone(rank: number | null | undefined) {
  if (rank === null || rank === undefined) {
    return "text-ink-2";
  }

  if (rank <= 4) {
    return "text-pos";
  }

  if (rank >= 15) {
    return "text-neg";
  }

  if (rank >= 11) {
    return "text-amber-500";
  }

  return "text-ink";
}

function getDeltaTone(
  value: number | null | undefined,
  isHigherBetter: boolean | null | undefined
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "text-ink-2";
  }

  const isPositive = value > 0;
  const isGood = isHigherBetter ? isPositive : !isPositive;

  if (value === 0) {
    return "text-ink-2";
  }

  return isGood ? "text-pos" : "text-neg";
}

function formatDirectionBadge(
  rankDirection: string | null | undefined,
  isHigherBetter: boolean | null | undefined,
  t: Translator
) {
  if (!rankDirection) {
    return "—";
  }

  if (isHigherBetter === false || rankDirection === "asc") {
    return t("teamDetail.directionLowerBetterBadge");
  }

  return t("teamDetail.directionHigherBetterBadge");
}

function getMetricAdvantage(row: TeamDetailedMetricRow) {
  if (
    row.vs_league_avg_pct === null ||
    row.vs_league_avg_pct === undefined ||
    Number.isNaN(row.vs_league_avg_pct)
  ) {
    return null;
  }

  return row.is_higher_better === false
    ? -row.vs_league_avg_pct
    : row.vs_league_avg_pct;
}

function isMeaningfulSummaryMetric(row: TeamDetailedMetricRow) {
  if (!row.coverage_flag) return false;
  if (row.league_rank === null || row.league_rank === undefined) return false;

  const blockedKeys = new Set([
    "team_red_cards",
    "team_yellow_cards",
    "team_penalty_goals",
    "team_freekick_goals",
    "team_left_foot_goals",
    "team_right_foot_goals",
    "team_headed_goals",
    "team_out_of_box_goals",
    "team_fouls_won",
  ]);

  if (blockedKeys.has(row.metric_key)) {
    return false;
  }

  return true;
}

function getSummaryToneClasses(tone: SummaryTone) {
  if (tone === "positive") {
    return "border-pos/20 bg-card";
  }

  if (tone === "negative") {
    return "border-neg/20 bg-card";
  }

  if (tone === "accent") {
    return "border-accent/20 bg-card";
  }

  if (tone === "warning") {
    return "border-amber-500/20 bg-card";
  }

  return "border-line bg-veil";
}

function SummaryCard({
  label,
  value,
  subvalue,
  tone = "neutral",
}: {
  label: string;
  value: string;
  subvalue?: string;
  tone?: SummaryTone;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${getSummaryToneClasses(tone)}`}
    >
      <div className="text-[9px] uppercase tracking-[0.16em] text-ink-3">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-semibold leading-5 text-ink">
        {value}
      </div>
      {subvalue ? (
        <div className="mt-1 text-[11px] leading-4 text-ink-2">
          {subvalue}
        </div>
      ) : null}
    </div>
  );
}

function InfoTooltip() {
  const { t } = useI18n();

  return (
    <div className="group relative">
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-line bg-veil text-[11px] text-ink-2 transition hover:border-line-strong hover:text-ink"
      >
        i
      </button>

      <div className="pointer-events-none absolute left-0 top-7 z-20 hidden w-[340px] rounded-xl border border-line bg-card px-3 py-2 text-[11px] leading-5 text-ink-2 shadow-lg group-hover:block">
        {t("teamDetail.detailedStatsInfoTooltip")}
      </div>
    </div>
  );
}

function getDefaultSortDirection(key: SortKey): SortDirection {
  if (key === "league_rank") {
    return "asc";
  }

  return "desc";
}

function compareNullableNumbers(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: SortDirection
) {
  const aNull = a === null || a === undefined || Number.isNaN(a);
  const bNull = b === null || b === undefined || Number.isNaN(b);

  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;

  return direction === "asc" ? a - b : b - a;
}

function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
}) {
  const { t } = useI18n();
  const isActive = sortConfig?.key === sortKey;
  const direction = sortConfig?.direction;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 transition hover:text-ink ${
        isActive ? "text-ink" : "text-ink-3"
      }`}
      title={t("teamDetail.sortByTooltip", { label })}
    >
      <span>{label}</span>
      <span className="text-[10px]">
        {isActive ? (direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

export default function DetailedStatsPanel({
  rows = [],
}: DetailedStatsPanelProps) {
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // Sıra hücresi artık metrik sıralama sayfasına gider (drawer kaldırıldı).
  const buildMetricHref = (row: TeamDetailedMetricRow) => {
    const params = new URLSearchParams();
    if (row.team_slug) params.set("team", row.team_slug);
    params.set("metric", row.metric_key);
    if (row.season_label) params.set("season", row.season_label);
    return `/dashboard/stats-analysis/football/team-stats/metric?${params.toString()}`;
  };

  const availableCategories = useMemo(() => {
    const categorySet = new Set<TeamDetailedCategoryKey>();

    rows.forEach((row) => {
      if (CATEGORY_ORDER.includes(row.category_key)) {
        categorySet.add(row.category_key);
      }
    });

    return CATEGORY_ORDER.filter((key) => categorySet.has(key));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const baseRows =
      activeCategory === "all"
        ? rows
        : rows.filter((row) => row.category_key === activeCategory);

    if (!sortConfig) {
      return baseRows;
    }

    const sorted = [...baseRows].sort((a, b) => {
      const comparison = compareNullableNumbers(
        a[sortConfig.key],
        b[sortConfig.key],
        sortConfig.direction
      );

      if (comparison !== 0) {
        return comparison;
      }

      const categoryComparison =
        CATEGORY_ORDER.indexOf(a.category_key) - CATEGORY_ORDER.indexOf(b.category_key);

      if (categoryComparison !== 0) {
        return categoryComparison;
      }

      const priorityA = a.display_priority ?? 9999;
      const priorityB = b.display_priority ?? 9999;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return metricLabel(t, a.metric_key, a.metric_label).localeCompare(
        metricLabel(t, b.metric_key, b.metric_label)
      );
    });

    return sorted;
  }, [rows, activeCategory, sortConfig, t]);

  const metricOptions = useMemo(() => {
    const uniqueMap = new Map<string, string>();

    rows.forEach((row) => {
      if (!uniqueMap.has(row.metric_key)) {
        uniqueMap.set(row.metric_key, row.metric_label);
      }
    });

    return Array.from(uniqueMap.entries()).map(([metricKeyValue, metricLabelValue]) => ({
      metricKey: metricKeyValue,
      metricLabel: metricLabelValue,
    }));
  }, [rows]);

  const summary = useMemo(() => {
    if (rows.length === 0) {
      return {
        strongestEdge: "—",
        strongestEdgeSub: undefined as string | undefined,
        strongestEdgeTone: "neutral" as SummaryTone,

        mainWeakness: "—",
        mainWeaknessSub: undefined as string | undefined,
        mainWeaknessTone: "neutral" as SummaryTone,

        biggestPositiveDelta: "—",
        biggestPositiveDeltaSub: undefined as string | undefined,
        biggestPositiveDeltaTone: "neutral" as SummaryTone,

        biggestSplitGap: "—",
        biggestSplitGapSub: undefined as string | undefined,
        biggestSplitGapTone: "neutral" as SummaryTone,
      };
    }

    const meaningfulRows = rows.filter(isMeaningfulSummaryMetric);

    const strongestCandidates = meaningfulRows.filter((row) => {
      const advantage = getMetricAdvantage(row);
      return (
        advantage !== null &&
        advantage > 0 &&
        row.league_rank !== null &&
        row.league_rank <= 6
      );
    });

    const strongestRow = [...strongestCandidates].sort((a, b) => {
      const aRank = a.league_rank ?? 999;
      const bRank = b.league_rank ?? 999;
      if (aRank !== bRank) return aRank - bRank;

      const aAdvantage = getMetricAdvantage(a) ?? -999;
      const bAdvantage = getMetricAdvantage(b) ?? -999;
      return bAdvantage - aAdvantage;
    })[0];

    const weaknessCandidates = meaningfulRows.filter((row) => {
      const advantage = getMetricAdvantage(row);
      return (
        advantage !== null &&
        advantage < 0 &&
        row.league_rank !== null &&
        row.league_rank >= 13
      );
    });

    const weakestRow = [...weaknessCandidates].sort((a, b) => {
      const aAdvantage = getMetricAdvantage(a) ?? 999;
      const bAdvantage = getMetricAdvantage(b) ?? 999;
      if (aAdvantage !== bAdvantage) return aAdvantage - bAdvantage;

      const aRank = a.league_rank ?? -1;
      const bRank = b.league_rank ?? -1;
      return bRank - aRank;
    })[0];

    const biggestPositiveDeltaRow = [...meaningfulRows]
      .filter((row) => {
        const advantage = getMetricAdvantage(row);
        return (
          advantage !== null &&
          advantage > 0 &&
          row.metric_key !== strongestRow?.metric_key
        );
      })
      .sort((a, b) => {
        const aAdvantage = getMetricAdvantage(a) ?? -999;
        const bAdvantage = getMetricAdvantage(b) ?? -999;
        return bAdvantage - aAdvantage;
      })[0];

    const biggestGapRow = [...rows]
      .filter(
        (row) =>
          row.home_away_gap_abs !== null && row.home_away_gap_abs !== undefined
      )
      .sort(
        (a, b) => (b.home_away_gap_abs ?? -1) - (a.home_away_gap_abs ?? -1)
      )[0];

    return {
      strongestEdge: strongestRow
        ? `${metricLabel(t, strongestRow.metric_key, strongestRow.metric_label)} (#${strongestRow.league_rank})`
        : t("teamDetail.strongestEdgeDefaultNoEdge"),
      strongestEdgeSub: strongestRow
        ? t("teamDetail.categoryVsAvgSub", {
            category: categoryLabel(t, strongestRow.category_key, strongestRow.category_label),
            pct: formatMetricValue(strongestRow.vs_league_avg_pct, "pct_1"),
          })
        : t("teamDetail.strongestEdgeDefaultSub"),
      strongestEdgeTone: strongestRow
        ? ("positive" as SummaryTone)
        : ("neutral" as SummaryTone),

      mainWeakness: weakestRow
        ? `${metricLabel(t, weakestRow.metric_key, weakestRow.metric_label)} (#${weakestRow.league_rank})`
        : t("teamDetail.mainWeaknessDefaultNoWeakness"),
      mainWeaknessSub: weakestRow
        ? t("teamDetail.categoryVsAvgSub", {
            category: categoryLabel(t, weakestRow.category_key, weakestRow.category_label),
            pct: formatMetricValue(weakestRow.vs_league_avg_pct, "pct_1"),
          })
        : t("teamDetail.mainWeaknessDefaultSub"),
      mainWeaknessTone: weakestRow
        ? ("negative" as SummaryTone)
        : ("neutral" as SummaryTone),

      biggestPositiveDelta: biggestPositiveDeltaRow
        ? `${metricLabel(t, biggestPositiveDeltaRow.metric_key, biggestPositiveDeltaRow.metric_label)} (${formatMetricValue(
            biggestPositiveDeltaRow.vs_league_avg_pct,
            "pct_1"
          )})`
        : "—",
      biggestPositiveDeltaSub: biggestPositiveDeltaRow
        ? t("teamDetail.categoryRankSub", {
            category: categoryLabel(
              t,
              biggestPositiveDeltaRow.category_key,
              biggestPositiveDeltaRow.category_label
            ),
            rank: biggestPositiveDeltaRow.league_rank ?? "—",
          })
        : undefined,
      biggestPositiveDeltaTone: biggestPositiveDeltaRow
        ? ("accent" as SummaryTone)
        : ("neutral" as SummaryTone),

      biggestSplitGap: biggestGapRow
        ? `${metricLabel(t, biggestGapRow.metric_key, biggestGapRow.metric_label)} • ${formatMetricCell(
            biggestGapRow,
            biggestGapRow.home_away_gap_abs,
            "gap"
          )}`
        : "—",
      biggestSplitGapSub: biggestGapRow
        ? t("teamDetail.homeAwayPmSub", {
            home: formatMetricCell(
              biggestGapRow,
              biggestGapRow.home_value,
              "home_per_match"
            ),
            away: formatMetricCell(
              biggestGapRow,
              biggestGapRow.away_value,
              "away_per_match"
            ),
          })
        : undefined,
      biggestSplitGapTone: biggestGapRow
        ? ("warning" as SummaryTone)
        : ("neutral" as SummaryTone),
    };
  }, [rows, t]);

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return {
          key,
          direction: getDefaultSortDirection(key),
        };
      }

      return {
        key,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-veil px-4 py-3 text-sm text-ink-2">
        {t("teamDetail.noDetailedStatsData")}
      </div>
    );
  }

  const selectedTeam = rows[0];
  const showCategoryColumn = activeCategory === "all";

  return (
    <>
      <div className="space-y-3">
        <div className="rounded-xl border border-line bg-veil px-4 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-2">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3">
                  {t("teamDetail.detailedStatsSectionTitle")}
                </div>
                <InfoTooltip />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCategory("all")}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                    activeCategory === "all"
                      ? "border-line-strong bg-card-2 text-ink"
                      : "border-line bg-veil text-ink-2 hover:bg-card-2"
                  }`}
                >
                  {t("common.all")}
                </button>

                {availableCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                      activeCategory === category
                        ? "border-line-strong bg-card-2 text-ink"
                        : "border-line bg-veil text-ink-2 hover:bg-card-2"
                    }`}
                  >
                    {t(CATEGORY_LABEL_KEYS[category])}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label={t("teamDetail.summaryStrongestEdge")}
                value={summary.strongestEdge}
                subvalue={summary.strongestEdgeSub}
                tone={summary.strongestEdgeTone}
              />
              <SummaryCard
                label={t("teamDetail.summaryMainWeakness")}
                value={summary.mainWeakness}
                subvalue={summary.mainWeaknessSub}
                tone={summary.mainWeaknessTone}
              />
              <SummaryCard
                label={t("teamDetail.summaryBiggestPositiveDelta")}
                value={summary.biggestPositiveDelta}
                subvalue={summary.biggestPositiveDeltaSub}
                tone={summary.biggestPositiveDeltaTone}
              />
              <SummaryCard
                label={t("teamDetail.summaryBiggestSplitGap")}
                value={summary.biggestSplitGap}
                subvalue={summary.biggestSplitGapSub}
                tone={summary.biggestSplitGapTone}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-field">
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
                <th className="px-3 py-2 font-medium">{t("teamDetail.colMetric")}</th>
                {showCategoryColumn ? (
                  <th className="px-3 py-2 font-medium">{t("teamDetail.colCategory")}</th>
                ) : null}
                <th className="px-3 py-2 font-medium">
                  <SortableHeader
                    label={t("teamDetail.colTotal")}
                    sortKey="total_value"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-medium">
                  <SortableHeader
                    label={t("teamDetail.colPerMatch")}
                    sortKey="per_match_value"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-medium">
                  <SortableHeader
                    label={t("teamDetail.colHomePerMatch")}
                    sortKey="home_value"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-medium">
                  <SortableHeader
                    label={t("teamDetail.colAwayPerMatch")}
                    sortKey="away_value"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-medium">
                  <SortableHeader
                    label={t("teamDetail.colLeagueAvgPerMatch")}
                    sortKey="league_avg"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-medium">
                  <SortableHeader
                    label={t("teamDetail.colRank")}
                    sortKey="league_rank"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-medium">
                  <SortableHeader
                    label={t("teamDetail.colVsAvgPct")}
                    sortKey="vs_league_avg_pct"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-3 py-2 font-medium">{t("teamDetail.colDirection")}</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={`${row.metric_key}-${row.team_slug}`}
                  className="border-t border-line text-[13px] text-ink-2 transition hover:bg-veil"
                >
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap text-ink">
                    {metricLabel(t, row.metric_key, row.metric_label)}
                  </td>

                  {showCategoryColumn ? (
                    <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                      {categoryLabel(t, row.category_key, row.category_label)}
                    </td>
                  ) : null}

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {formatMetricCell(row, row.total_value, "total")}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap font-medium text-ink">
                    {formatMetricCell(row, row.per_match_value, "per_match")}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {formatMetricCell(row, row.home_value, "home_per_match")}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {formatMetricCell(row, row.away_value, "away_per_match")}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                    {formatMetricCell(row, row.league_avg, "league_avg_per_match")}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {row.league_rank !== null && row.league_rank !== undefined ? (
                      <Link
                        href={buildMetricHref(row)}
                        title={t("teamDetail.openLeaderboardTooltip")}
                        className={`group inline-flex items-center gap-1 font-semibold transition duration-150 hover:underline cursor-pointer ${getRankTone(
                          row.league_rank
                        )}`}
                      >
                        <span>{row.league_rank}</span>
                        <span className="text-[10px] opacity-60 transition group-hover:opacity-100">
                          ↗
                        </span>
                      </Link>
                    ) : (
                      <span className="text-ink-2">—</span>
                    )}
                  </td>

                  <td
                    className={`px-3 py-1.5 whitespace-nowrap font-medium ${getDeltaTone(
                      row.vs_league_avg_pct,
                      row.is_higher_better
                    )}`}
                  >
                    {formatMetricValue(row.vs_league_avg_pct, "pct_1")}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className="inline-flex rounded-md border border-line bg-veil px-2 py-1 text-[11px] text-ink-2">
                      {formatDirectionBadge(
                        row.rank_direction,
                        row.is_higher_better,
                        t
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </>
  );
}
