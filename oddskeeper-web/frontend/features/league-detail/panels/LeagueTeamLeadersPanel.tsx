"use client";

import { useEffect, useMemo, useState } from "react";
import TeamLink from "@/components/links/TeamLink";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Translator } from "@/lib/i18n/messages";

type LeagueTeamLeaderboardRow = {
  competition?: string | null;
  season_label?: string | null;
  metric_key?: string | null;
  metric_label?: string | null;
  category_key?: string | null;
  category_label?: string | null;
  team_slug?: string | null;
  team_name?: string | null;
  total_value?: number | null;
  per_match_value?: number | null;
  home_value?: number | null;
  away_value?: number | null;
  league_avg?: number | null;
  league_median?: number | null;
  league_rank?: number | null;
  vs_league_avg_pct?: number | null;
  value_format?: string | null;
  rank_direction?: string | null;
  is_higher_better?: boolean | null;
};

type LeagueTeamLeadersPanelProps = {
  rows?: LeagueTeamLeaderboardRow[];
};

type CategoryFilter =
  | "all"
  | "attack"
  | "defence"
  | "build_up"
  | "discipline"
  | "set_piece"
  | "goal_composition";

type ValueBasis = "per_match" | "total";

const CATEGORY_ORDER: Exclude<CategoryFilter, "all">[] = [
  "attack",
  "defence",
  "build_up",
  "discipline",
  "set_piece",
  "goal_composition",
];

const CATEGORY_LABEL_KEYS: Record<CategoryFilter, string> = {
  all: "common.all",
  attack: "leagueDetail.categoryAttack",
  defence: "leagueDetail.categoryDefence",
  build_up: "leagueDetail.categoryBuildUp",
  discipline: "leagueDetail.categoryDiscipline",
  set_piece: "leagueDetail.categorySetPiece",
  goal_composition: "leagueDetail.categoryGoalComposition",
};

function safeNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

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

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${formatRawNumber(value, 1)}%`;
}

function getDeltaTone(
  value: number | null | undefined,
  isHigherBetter: boolean | null | undefined
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "text-white/55";
  }

  if (value === 0) {
    return "text-white/65";
  }

  const isPositive = value > 0;
  const isGood = isHigherBetter === false ? !isPositive : isPositive;
  return isGood ? "text-emerald-300" : "text-rose-300";
}

function getCategoryTone(category: string | null | undefined) {
  if (category === "attack") {
    return "border-[#4da2ff]/20 bg-[#4da2ff]/[0.05] text-[#8fc2ff]";
  }

  if (category === "defence") {
    return "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300";
  }

  if (category === "build_up") {
    return "border-amber-500/20 bg-amber-500/[0.05] text-amber-300";
  }

  if (category === "discipline") {
    return "border-rose-500/20 bg-rose-500/[0.05] text-rose-300";
  }

  return "border-white/10 bg-white/[0.03] text-white/70";
}

function isTotalMeaningful(
  metricKey: string | null | undefined,
  valueFormat: string | null | undefined
) {
  const key = (metricKey ?? "").toLowerCase();

  if (valueFormat === "pct_1") return false;
  if (key.includes("accuracy")) return false;
  if (key.includes("rate")) return false;

  return true;
}

function getMetricDefinition(
  t: Translator,
  row: LeagueTeamLeaderboardRow | undefined,
  basis: ValueBasis
) {
  if (!row) {
    return {
      directionLabel: t("leagueDetail.higherBetter"),
      basisLabel: t("leagueDetail.buttonPerMatch"),
      titleText: t("leagueDetail.defaultSelectedMetric"),
      text: t("leagueDetail.defaultTeamMetricText"),
    };
  }

  const directionLabel =
    row.is_higher_better === false
      ? t("leagueDetail.lowerBetter")
      : t("leagueDetail.higherBetter");

  const basisLabel =
    basis === "total" && isTotalMeaningful(row.metric_key, row.value_format)
      ? t("leagueDetail.basisTotal")
      : t("leagueDetail.buttonPerMatch");

  const key = (row.metric_key ?? "").toLowerCase();
  const label = row.metric_label ?? t("leagueDetail.defaultSelectedMetric");

  let titleText = label;
  let text = t("leagueDetail.defaultTeamMetricText");

  if (key.includes("pass_accuracy")) {
    titleText = t("leagueDetail.teamMetricPassAccuracyTitle");
    text = t("leagueDetail.teamMetricPassAccuracyText");
  } else if (key.includes("accurate_pass")) {
    titleText = t("leagueDetail.metricAccuratePassTitle");
    text = t("leagueDetail.teamMetricAccuratePassText");
  } else if (key.includes("expected_goals")) {
    titleText = t("leagueDetail.teamMetricExpectedGoalsTitle");
    text = t("leagueDetail.teamMetricExpectedGoalsText");
  } else if (key.includes("shots_on_target")) {
    titleText = t("leagueDetail.metricShotsOnTargetTitle");
    text = t("leagueDetail.teamMetricShotsOnTargetText");
  } else if (key.includes("goals_against")) {
    titleText = t("leagueDetail.teamMetricGoalsAgainstTitle");
    text = t("leagueDetail.teamMetricGoalsAgainstText");
  } else if (key.includes("goals_for")) {
    titleText = t("leagueDetail.teamMetricGoalsForTitle");
    text = t("leagueDetail.teamMetricGoalsForText");
  } else if (key.includes("interceptions")) {
    titleText = t("leagueDetail.metricInterceptionTitle");
    text = t("leagueDetail.teamMetricInterceptionsText");
  } else if (key.includes("tackles")) {
    titleText = t("leagueDetail.metricTackleTitle");
    text = t("leagueDetail.teamMetricTacklesText");
  } else if (key.includes("fouls_conceded")) {
    titleText = t("leagueDetail.teamMetricFoulsConcededTitle");
    text = t("leagueDetail.teamMetricFoulsConcededText");
  } else if (key.includes("fouls_won")) {
    titleText = t("leagueDetail.teamMetricFoulsWonTitle");
    text = t("leagueDetail.teamMetricFoulsWonText");
  } else if (key.includes("yellow_cards")) {
    titleText = t("leagueDetail.teamMetricYellowCardsTitle");
    text = t("leagueDetail.teamMetricYellowCardsText");
  } else if (key.includes("red_cards")) {
    titleText = t("leagueDetail.teamMetricRedCardsTitle");
    text = t("leagueDetail.teamMetricRedCardsText");
  } else if (key.includes("passes")) {
    titleText = t("leagueDetail.teamMetricPassesTitle");
    text = t("leagueDetail.teamMetricPassesText");
  } else if (key.includes("shots")) {
    titleText = t("leagueDetail.teamMetricShotsTitle");
    text = t("leagueDetail.teamMetricShotsText");
  }

  return {
    directionLabel,
    basisLabel,
    titleText,
    text,
  };
}

function MetricSummaryCard({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-semibold text-white">{value}</div>
      {subvalue ? (
        <div className="mt-1 text-[11px] leading-4 text-white/58">{subvalue}</div>
      ) : null}
    </div>
  );
}

function getDeltaSemanticText(
  t: Translator,
  value: number | null,
  isHigherBetter: boolean | null | undefined,
  valueFormat: string | null | undefined
) {
  if (value === null || Number.isNaN(value)) {
    return t("leagueDetail.noAverageComparison");
  }

  if (value === 0) {
    return t("leagueDetail.levelWithLeagueAverage");
  }

  const absoluteValue = Math.abs(value);
  const formatted =
    valueFormat === "pct_1"
      ? formatMetricValue(absoluteValue, "pct_1")
      : formatMetricValue(absoluteValue, valueFormat);

  const better = isHigherBetter === false ? value < 0 : value > 0;

  if (better) {
    return t("leagueDetail.betterThanAverage", { value: formatted });
  }

  return t("leagueDetail.behindAverage", { value: formatted });
}

export function LeagueTeamLeadersPanel({
  rows = [],
}: LeagueTeamLeadersPanelProps) {
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [basis, setBasis] = useState<ValueBasis>("per_match");
  const [selectedMetricKey, setSelectedMetricKey] = useState<string>("");

  type SortCol = "rank" | "team" | "value" | "avg" | "vsavg";
  const [sortCol, setSortCol] = useState<SortCol>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleColSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir(col === "team" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span className="ml-1 opacity-25">↕</span>;
    return <span className="ml-1 opacity-90">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const filteredByCategory = useMemo(() => {
    if (activeCategory === "all") return rows;
    return rows.filter((row) => row.category_key === activeCategory);
  }, [rows, activeCategory]);

  const metricOptions = useMemo(() => {
    const unique = new Map<
      string,
      { key: string; label: string; category: string | null | undefined }
    >();

    filteredByCategory.forEach((row) => {
      const key = row.metric_key ?? "";
      if (!key) return;
      if (!unique.has(key)) {
        unique.set(key, {
          key,
          label: row.metric_label ?? key,
          category: row.category_key,
        });
      }
    });

    return Array.from(unique.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [filteredByCategory]);

  useEffect(() => {
    if (!metricOptions.length) {
      setSelectedMetricKey("");
      return;
    }

    const exists = metricOptions.some(
      (option) => option.key === selectedMetricKey
    );
    if (!exists) {
      // Metrik seçilmemişse alfabetik ilk metrik yerine gol ile başla.
      setSelectedMetricKey(
        metricOptions.find((option) => option.key === "team_goals")?.key ??
          metricOptions[0].key
      );
    }
  }, [metricOptions, selectedMetricKey]);

  const metricRows = useMemo(() => {
    const metricKey =
      selectedMetricKey ||
      metricOptions.find((option) => option.key === "team_goals")?.key ||
      metricOptions[0]?.key;
    if (!metricKey) return [];

    return rows
      .filter((row) => {
        if (row.metric_key !== metricKey) return false;
        if (activeCategory === "all") return true;
        return row.category_key === activeCategory;
      })
      .sort((a, b) => {
        const rankA = safeNumber(a.league_rank) ?? 999;
        const rankB = safeNumber(b.league_rank) ?? 999;
        if (rankA !== rankB) return rankA - rankB;
        return (a.team_name ?? "").localeCompare(b.team_name ?? "");
      });
  }, [rows, activeCategory, selectedMetricKey, metricOptions]);

  const selectedMetricRow = metricRows[0] ?? filteredByCategory[0];

  const totalAllowed = isTotalMeaningful(
    selectedMetricRow?.metric_key,
    selectedMetricRow?.value_format
  );

  useEffect(() => {
    if (basis === "total" && !totalAllowed) {
      setBasis("per_match");
    }
  }, [basis, totalAllowed]);

  const visibleBasis: ValueBasis =
    basis === "total" && totalAllowed ? "total" : "per_match";

  const displayRows = useMemo(() => {
    return metricRows.map((row) => {
      const displayValue =
        visibleBasis === "total" && totalAllowed
          ? row.total_value ?? row.per_match_value ?? null
          : row.per_match_value ?? row.total_value ?? null;

      return {
        ...row,
        displayValue,
      };
    });
  }, [metricRows, visibleBasis, totalAllowed]);

  const sortedRows = useMemo(() => {
    if (sortCol === "rank") {
      return sortDir === "asc" ? displayRows : [...displayRows].reverse();
    }
    return [...displayRows].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "team") cmp = (a.team_name ?? "").localeCompare(b.team_name ?? "");
      else if (sortCol === "value") cmp = (a.displayValue ?? -Infinity) - (b.displayValue ?? -Infinity);
      else if (sortCol === "avg") cmp = (safeNumber(a.league_avg) ?? -Infinity) - (safeNumber(b.league_avg) ?? -Infinity);
      else if (sortCol === "vsavg") cmp = (safeNumber(a.vs_league_avg_pct) ?? -Infinity) - (safeNumber(b.vs_league_avg_pct) ?? -Infinity);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [displayRows, sortCol, sortDir]);

  const leaderRow = displayRows[0];
  const runnerUpRow = displayRows[1];

  const leagueAverage =
    visibleBasis === "total" && totalAllowed && selectedMetricRow?.total_value !== null
      ? null
      : safeNumber(selectedMetricRow?.league_avg);

  const leaderGapToAvg =
    leaderRow && leagueAverage !== null && leaderRow.displayValue !== null
      ? leaderRow.displayValue - leagueAverage
      : null;

  const leaderGapToSecond =
    leaderRow &&
    runnerUpRow &&
    leaderRow.displayValue !== null &&
    runnerUpRow.displayValue !== null
      ? leaderRow.displayValue - runnerUpRow.displayValue
      : null;

  const metricDefinition = getMetricDefinition(t, selectedMetricRow, visibleBasis);

  const availableCategories = useMemo(() => {
    const present = new Set<string>();
    rows.forEach((row) => {
      if (row.category_key) {
        present.add(row.category_key);
      }
    });

    return CATEGORY_ORDER.filter((key) => present.has(key));
  }, [rows]);

  const empty = rows.length === 0 || !selectedMetricRow;

  if (empty) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        {t("leagueDetail.noTeamLeaderboardData")}
      </div>
    );
  }

  const leaderGapValue =
    leaderGapToAvg !== null
      ? formatMetricValue(
          Math.abs(leaderGapToAvg),
          selectedMetricRow.value_format === "pct_1"
            ? "pct_1"
            : selectedMetricRow.value_format
        )
      : "—";

  const leaderGapSubvalue =
    leaderGapToSecond !== null
      ? t("leagueDetail.leaderVsSecond", {
          value: formatMetricValue(
            Math.abs(leaderGapToSecond),
            selectedMetricRow.value_format === "pct_1"
              ? "pct_1"
              : selectedMetricRow.value_format
          ),
        })
      : getDeltaSemanticText(
          t,
          leaderGapToAvg,
          selectedMetricRow.is_higher_better,
          selectedMetricRow.value_format
        );

  return (
    <div className="space-y-3">
      <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[860px]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              {t("leagueDetail.teamLeadersTitle")}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-medium ${getCategoryTone(
                  selectedMetricRow.category_key
                )}`}
              >
                {selectedMetricRow.category_label ?? t("leagueDetail.categoryGeneral")}
              </span>
              <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/70">
                {metricDefinition.directionLabel}
              </span>
              <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/70">
                {metricDefinition.basisLabel}
              </span>
            </div>
            <div className="mt-2 text-[15px] font-semibold text-white">
              {metricDefinition.titleText}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => setBasis("per_match")}
                className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                  visibleBasis === "per_match"
                    ? "border border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                    : "text-white/72 hover:bg-white/[0.04]"
                }`}
              >
                {t("leagueDetail.buttonPerMatch")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (totalAllowed) setBasis("total");
                }}
                disabled={!totalAllowed}
                className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                  visibleBasis === "total" && totalAllowed
                    ? "border border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                    : totalAllowed
                    ? "text-white/72 hover:bg-white/[0.04]"
                    : "cursor-not-allowed text-white/25"
                }`}
                title={
                  totalAllowed
                    ? t("leagueDetail.totalBasisEnabledTitle")
                    : t("leagueDetail.totalBasisDisabledTitle")
                }
              >
                {t("leagueDetail.basisTotal")}
              </button>
            </div>

            <select
              value={selectedMetricKey}
              onChange={(event) => setSelectedMetricKey(event.target.value)}
              className="min-w-[220px] rounded-lg border border-white/10 bg-[#0d1624] px-3 py-2 text-[13px] text-white outline-none transition focus:border-[#4da2ff]/40"
            >
              {metricOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
              activeCategory === "all"
                ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
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
                  ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
              }`}
            >
              {t(CATEGORY_LABEL_KEYS[category])}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricSummaryCard
            label={t("leagueDetail.selectedMetricLabel")}
            value={selectedMetricRow.metric_label ?? "—"}
            subvalue={selectedMetricRow.category_label ?? "—"}
          />
          <MetricSummaryCard
            label={t("leagueDetail.leagueLeaderLabel")}
            value={leaderRow?.team_name ?? "—"}
            subvalue={
              leaderRow
                ? t("leagueDetail.leaderBestMark", {
                    value: formatMetricValue(
                      leaderRow.displayValue,
                      visibleBasis === "total" && totalAllowed
                        ? "integer"
                        : selectedMetricRow.value_format
                    ),
                  })
                : undefined
            }
          />
          <MetricSummaryCard
            label={t("leagueDetail.leagueAverageLabel")}
            value={formatMetricValue(leagueAverage, selectedMetricRow.value_format)}
            subvalue={t("leagueDetail.basisBaseline", { basis: metricDefinition.basisLabel })}
          />
          <MetricSummaryCard
            label={t("leagueDetail.leaderGapLabel")}
            value={leaderGapValue}
            subvalue={leaderGapSubvalue}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-white/10">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-[#0d1624]">
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
              <th className="px-4 py-2 font-medium cursor-pointer hover:text-white/70 select-none" onClick={() => handleColSort("rank")}>{t("leagueDetail.colRank")}<SortIcon col="rank" /></th>
              <th className="px-4 py-2 font-medium cursor-pointer hover:text-white/70 select-none" onClick={() => handleColSort("team")}>{t("common.team")}<SortIcon col="team" /></th>
              <th className="px-4 py-2 font-medium cursor-pointer hover:text-white/70 select-none" onClick={() => handleColSort("value")}>
                {visibleBasis === "total" && totalAllowed ? t("leagueDetail.basisTotal") : t("leagueDetail.buttonPerMatch")}<SortIcon col="value" />
              </th>
              <th className="px-4 py-2 font-medium cursor-pointer hover:text-white/70 select-none" onClick={() => handleColSort("avg")}>{t("leagueDetail.colLeagueAvg")}<SortIcon col="avg" /></th>
              <th className="px-4 py-2 font-medium cursor-pointer hover:text-white/70 select-none" onClick={() => handleColSort("vsavg")}>{t("leagueDetail.colVsAvgPct")}<SortIcon col="vsavg" /></th>
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((row) => {
              const deltaText =
                row.vs_league_avg_pct === null ||
                row.vs_league_avg_pct === undefined ||
                Number.isNaN(row.vs_league_avg_pct)
                  ? "—"
                  : row.is_higher_better === false
                  ? row.vs_league_avg_pct < 0
                    ? t("leagueDetail.deltaBetter", { value: formatPct(Math.abs(row.vs_league_avg_pct)) })
                    : t("leagueDetail.deltaWorse", { value: formatPct(Math.abs(row.vs_league_avg_pct)) })
                  : row.vs_league_avg_pct > 0
                  ? t("leagueDetail.deltaBetter", { value: formatPct(Math.abs(row.vs_league_avg_pct)) })
                  : t("leagueDetail.deltaWorse", { value: formatPct(Math.abs(row.vs_league_avg_pct)) });

              return (
                <tr
                  key={`${row.metric_key}-${row.team_slug}-${visibleBasis}`}
                  className="border-t border-white/10 text-[13px] text-white/80 transition hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-2 whitespace-nowrap font-semibold text-white">
                    {row.league_rank ?? "—"}
                  </td>

                  <td className="px-4 py-2 min-w-[220px] font-medium text-white">
                    <TeamLink
                      teamSlug={row.team_slug}
                      className="transition hover:text-white hover:underline"
                      title={row.team_name ?? undefined}
                    >
                      {row.team_name ?? "—"}
                    </TeamLink>
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap font-medium text-white">
                    {formatMetricValue(
                      row.displayValue,
                      visibleBasis === "total" && totalAllowed
                        ? "integer"
                        : row.value_format
                    )}
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap text-white/70">
                    {formatMetricValue(row.league_avg, row.value_format)}
                  </td>

                  <td
                    className={`px-4 py-2 whitespace-nowrap font-medium ${getDeltaTone(
                      row.vs_league_avg_pct,
                      row.is_higher_better
                    )}`}
                  >
                    {deltaText}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
