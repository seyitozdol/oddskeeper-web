"use client";

import { useMemo, useState } from "react";
import type {
  TeamDetailedCategoryKey,
  TeamDetailedMetricRow,
} from "../types";

type DetailedStatsPanelProps = {
  rows?: TeamDetailedMetricRow[];
};

type CategoryFilter = "all" | TeamDetailedCategoryKey;

const CATEGORY_ORDER: TeamDetailedCategoryKey[] = [
  "attack",
  "defence",
  "passing",
  "discipline",
  "match_control",
];

const CATEGORY_LABELS: Record<TeamDetailedCategoryKey, string> = {
  attack: "Attack",
  defence: "Defence",
  passing: "Passing",
  discipline: "Discipline",
  match_control: "Match Control",
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
  if (value === null || value === undefined) {
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

function formatDirection(value: string | null | undefined) {
  if (!value) return "—";
  return value === "asc" ? "Lower Better" : "Higher Better";
}

function SummaryCard({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
      {subvalue ? (
        <div className="mt-1 text-xs text-white/52">{subvalue}</div>
      ) : null}
    </div>
  );
}

export default function DetailedStatsPanel({
  rows = [],
}: DetailedStatsPanelProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

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
    if (activeCategory === "all") {
      return rows;
    }

    return rows.filter((row) => row.category_key === activeCategory);
  }, [rows, activeCategory]);

  const summary = useMemo(() => {
    if (rows.length === 0) {
      return {
        bestCategory: "—",
        weakestCategory: "—",
        bestMetric: "—",
        worstMetric: "—",
        biggestGap: "—",
        coverage: "—",
      };
    }

    const categoryScores = CATEGORY_ORDER.map((categoryKey) => {
      const categoryRows = rows.filter((row) => row.category_key === categoryKey);
      const validPercentiles = categoryRows
        .map((row) => row.league_percentile)
        .filter((value): value is number => value !== null && value !== undefined);

      const avgPercentile =
        validPercentiles.length > 0
          ? validPercentiles.reduce((sum, value) => sum + value, 0) /
            validPercentiles.length
          : null;

      return {
        categoryKey,
        avgPercentile,
      };
    }).filter((row) => row.avgPercentile !== null);

    const sortedCategories = [...categoryScores].sort(
      (a, b) => (b.avgPercentile ?? -1) - (a.avgPercentile ?? -1)
    );

    const rankedRows = rows.filter(
      (row) => row.league_rank !== null && row.league_rank !== undefined
    );

    const bestMetricRow = [...rankedRows].sort(
      (a, b) => (a.league_rank ?? 999) - (b.league_rank ?? 999)
    )[0];

    const worstMetricRow = [...rankedRows].sort(
      (a, b) => (b.league_rank ?? -1) - (a.league_rank ?? -1)
    )[0];

    const biggestGapRow = [...rows]
      .filter(
        (row) =>
          row.home_away_gap_abs !== null && row.home_away_gap_abs !== undefined
      )
      .sort(
        (a, b) => (b.home_away_gap_abs ?? -1) - (a.home_away_gap_abs ?? -1)
      )[0];

    const coveredCount = rows.filter((row) => row.coverage_flag).length;
    const coveragePct =
      rows.length > 0 ? (coveredCount / rows.length) * 100 : null;

    return {
      bestCategory:
        sortedCategories[0]?.categoryKey
          ? CATEGORY_LABELS[sortedCategories[0].categoryKey]
          : "—",
      weakestCategory:
        sortedCategories[sortedCategories.length - 1]?.categoryKey
          ? CATEGORY_LABELS[
              sortedCategories[sortedCategories.length - 1].categoryKey
            ]
          : "—",
      bestMetric: bestMetricRow
        ? `${bestMetricRow.metric_label} (#${bestMetricRow.league_rank})`
        : "—",
      worstMetric: worstMetricRow
        ? `${worstMetricRow.metric_label} (#${worstMetricRow.league_rank})`
        : "—",
      biggestGap: biggestGapRow
        ? `${biggestGapRow.metric_label} (${formatMetricValue(
            biggestGapRow.home_away_gap_abs,
            biggestGapRow.value_format
          )})`
        : "—",
      coverage:
        coveragePct === null ? "—" : `${formatRawNumber(coveragePct, 1)}%`,
    };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        No detailed stats data found for this team.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3">
          <div className="text-xs uppercase tracking-[0.22em] text-white/38">
            Detailed Team Stats
          </div>
          <div className="mt-1 text-sm text-white/58">
            Deep metric layer with league context, split values and directional
            interpretation.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              activeCategory === "all"
                ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
            }`}
          >
            All
          </button>

          {availableCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-xl border px-3 py-2 text-sm transition ${
                activeCategory === category
                  ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
              }`}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard label="Best Category" value={summary.bestCategory} />
        <SummaryCard label="Weakest Category" value={summary.weakestCategory} />
        <SummaryCard label="Best Metric" value={summary.bestMetric} />
        <SummaryCard label="Worst Metric" value={summary.worstMetric} />
        <SummaryCard label="Biggest Home / Away Gap" value={summary.biggestGap} />
        <SummaryCard label="Coverage Status" value={summary.coverage} />
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-white/10">
        <table className="min-w-full border-collapse">
          <thead className="bg-white/[0.03]">
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
              <th className="px-4 py-2 font-medium">Metric</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Per Match</th>
              <th className="px-4 py-2 font-medium">Home</th>
              <th className="px-4 py-2 font-medium">Away</th>
              <th className="px-4 py-2 font-medium">League Avg</th>
              <th className="px-4 py-2 font-medium">Rank</th>
              <th className="px-4 py-2 font-medium">Vs Avg %</th>
              <th className="px-4 py-2 font-medium">Direction</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row) => (
              <tr
                key={`${row.metric_key}-${row.team_slug}`}
                className="border-t border-white/10 text-[13px] text-white/80 transition hover:bg-white/[0.018]"
              >
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">
                  {row.metric_label}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-white/60">
                  {row.category_label}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatMetricValue(row.total_value, row.value_format)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatMetricValue(row.per_match_value, row.value_format)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatMetricValue(row.home_value, row.value_format)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatMetricValue(row.away_value, row.value_format)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatMetricValue(row.league_avg, row.value_format)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {row.league_rank ?? "—"}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatMetricValue(row.vs_league_avg_pct, "pct_1")}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-white/60">
                  {formatDirection(row.rank_direction)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}