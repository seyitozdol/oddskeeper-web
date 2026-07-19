"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import TeamLink from "@/components/links/TeamLink";
import PlayerLink from "@/components/links/PlayerLink";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Translator } from "@/lib/i18n/messages";
import { categoryLabel, metricLabel } from "@/lib/i18n/metricLabel";
import type {
  LeaguePlayerLeaderboardRow,
  LeaguePlayerMetricOption,
} from "../server/getLeaguePlayerLeaderboard";

type ValueBasis = "per90" | "per_match" | "total";
type RoleFilter = "all" | "starter_core" | "starters" | "substitutes";

type PreparedRow = LeaguePlayerLeaderboardRow & {
  displayValue: number | null;
  displayRank: number;
  derivedLeagueAvg: number | null;
  derivedVsAvgPct: number | null;
};

type LeaguePlayerLeadersPanelProps = {
  rows?: LeaguePlayerLeaderboardRow[];
  metricOptions?: LeaguePlayerMetricOption[];
  competition: string;
  season: string;
  currentMetricKey: string | null;
  currentCategory: string;
  currentRole: RoleFilter;
  currentTeam: string;
  currentMinApps: number;
  currentBasis: ValueBasis;
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

  if (valueFormat === "integer") return formatRawNumber(value, 0);
  if (valueFormat === "decimal_1") return formatRawNumber(value, 1);
  if (valueFormat === "decimal_2") return formatRawNumber(value, 2);
  if (valueFormat === "decimal_3") return formatRawNumber(value, 3);

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

  return `${formatRawNumber(Math.abs(value), 1)}%`;
}

function getBasisValueFormat(
  valueFormat: string | null | undefined,
  basis: ValueBasis,
  kind: "value" | "average" | "gap" = "value"
) {
  if (valueFormat === "pct_1") {
    return "pct_1";
  }

  if (valueFormat === "integer") {
    if (basis === "total" && kind === "value") {
      return "integer";
    }

    return "decimal_2";
  }

  return valueFormat;
}

function compareDisplayValues(
  a: number | null | undefined,
  b: number | null | undefined,
  isHigherBetter: boolean
) {
  const aNull = a === null || a === undefined || Number.isNaN(a);
  const bNull = b === null || b === undefined || Number.isNaN(b);

  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;

  return isHigherBetter ? b - a : a - b;
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

function getDeltaText(
  t: Translator,
  value: number | null | undefined,
  isHigherBetter: boolean | null | undefined
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  if (value === 0) {
    return t("leagueDetail.levelText");
  }

  const absolute = formatPct(value);

  if (isHigherBetter === false) {
    return value < 0
      ? t("leagueDetail.deltaBetter", { value: absolute })
      : t("leagueDetail.deltaWorse", { value: absolute });
  }

  return value > 0
    ? t("leagueDetail.deltaBetter", { value: absolute })
    : t("leagueDetail.deltaWorse", { value: absolute });
}

function isTotalMeaningful(
  metricKey: string | null | undefined,
  valueFormat: string | null | undefined
) {
  const key = (metricKey ?? "").toLowerCase();
  if (valueFormat === "pct_1") return false;
  if (key.includes("accuracy")) return false;
  if (key.includes("rate")) return false;
  if (key.includes("per90")) return false;
  return true;
}

function isPer90Meaningful(metricKey: string | null | undefined) {
  const key = (metricKey ?? "").toLowerCase();
  if (key.includes("accuracy")) return false;
  if (key.includes("pct")) return false;
  if (key.includes("rate")) return false;
  if (key.includes("appearance")) return false;
  return true;
}

function getCategoryTone(category: string | null | undefined) {
  const key = (category ?? "").toLowerCase();

  if (key === "attacking" || key === "attack" || key === "shooting") {
    return "border-[#4da2ff]/20 bg-[#4da2ff]/[0.05] text-[#8fc2ff]";
  }

  if (key === "defending" || key === "defence" || key === "defense") {
    return "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300";
  }

  if (key === "passing" || key === "build_up") {
    return "border-amber-500/20 bg-amber-500/[0.05] text-amber-300";
  }

  if (key === "discipline") {
    return "border-rose-500/20 bg-rose-500/[0.05] text-rose-300";
  }

  if (key === "goalkeeper") {
    return "border-cyan-500/20 bg-cyan-500/[0.05] text-cyan-300";
  }

  if (key === "usage") {
    return "border-white/10 bg-white/[0.03] text-white/70";
  }

  return "border-white/10 bg-white/[0.03] text-white/70";
}

function getMetricDefinition(
  t: Translator,
  row: LeaguePlayerLeaderboardRow | undefined,
  basis: ValueBasis
) {
  if (!row) {
    return {
      directionLabel: t("leagueDetail.higherBetter"),
      basisLabel: t("leagueDetail.basisPer90"),
      titleText: t("leagueDetail.defaultSelectedMetric"),
      text: t("leagueDetail.defaultMetricDescription"),
    };
  }

  const directionLabel =
    row.is_higher_better === false
      ? t("leagueDetail.lowerBetter")
      : t("leagueDetail.higherBetter");

  const basisLabel =
    basis === "total"
      ? t("leagueDetail.basisTotal")
      : basis === "per_match"
      ? t("leagueDetail.basisPerMatchLower")
      : t("leagueDetail.basisPer90");

  const key = (row.metric_key ?? "").toLowerCase();
  const label = metricLabel(t, row.metric_key, row.metric_label) || t("leagueDetail.defaultSelectedMetric");

  let titleText = label;
  let text = t("leagueDetail.defaultMetricDescription");

  if (key.includes("goals")) {
    titleText = t("leagueDetail.metricGoalsTitle");
    text = t("leagueDetail.metricGoalsText");
  } else if (key.includes("assist")) {
    titleText = t("leagueDetail.metricAssistTitle");
    text = t("leagueDetail.metricAssistText");
  } else if (key.includes("expected_goals")) {
    titleText = t("leagueDetail.metricExpectedGoalsTitle");
    text = t("leagueDetail.metricExpectedGoalsText");
  } else if (key.includes("shots_on_target")) {
    titleText = t("leagueDetail.metricShotsOnTargetTitle");
    text = t("leagueDetail.metricShotsOnTargetText");
  } else if (key.includes("shots")) {
    titleText = t("leagueDetail.metricShotsTitle");
    text = t("leagueDetail.metricShotsText");
  } else if (key.includes("accurate_pass")) {
    titleText = t("leagueDetail.metricAccuratePassTitle");
    text = t("leagueDetail.metricAccuratePassText");
  } else if (key.includes("pass_accuracy")) {
    titleText = t("leagueDetail.metricPassAccuracyTitle");
    text = t("leagueDetail.metricPassAccuracyText");
  } else if (key.includes("interception")) {
    titleText = t("leagueDetail.metricInterceptionTitle");
    text = t("leagueDetail.metricInterceptionText");
  } else if (key.includes("tackle")) {
    titleText = t("leagueDetail.metricTackleTitle");
    text = t("leagueDetail.metricTackleText");
  } else if (key.includes("save")) {
    titleText = t("leagueDetail.metricSaveTitle");
    text = t("leagueDetail.metricSaveText");
  } else if (key.includes("appearance")) {
    titleText = t("leagueDetail.metricAppearanceTitle");
    text = t("leagueDetail.metricAppearanceText");
  }

  return { directionLabel, basisLabel, titleText, text };
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

export function LeaguePlayerLeadersPanel({
  rows = [],
  metricOptions = [],
  competition,
  season,
  currentMetricKey,
  currentCategory,
  currentRole,
  currentTeam,
  currentMinApps,
  currentBasis,
}: LeaguePlayerLeadersPanelProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  type SortCol = "rank" | "player" | "team" | "role" | "value" | "avg" | "vsavg" | "apps";
  const [sortCol, setSortCol] = useState<SortCol>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleColSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir(col === "player" || col === "team" || col === "role" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span className="ml-1 opacity-25">↕</span>;
    return <span className="ml-1 opacity-90">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const availableCategories = useMemo(() => {
    const unique = new Map<string, string>();

    metricOptions.forEach((row) => {
      const key = (row.category_key ?? "").trim();
      const label = categoryLabel(t, row.category_key, row.category_label).trim();
      if (key && !unique.has(key)) {
        unique.set(key, label || key);
      }
    });

    return Array.from(unique.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [metricOptions, t]);

  const categoryScopedMetricOptions = useMemo(() => {
    const scoped =
      currentCategory === "all"
        ? metricOptions
        : metricOptions.filter((row) => row.category_key === currentCategory);

    // Menü kategori + metrik adına göre sıralı olsun; karışık sıra okunmuyor.
    return [...scoped].sort((a, b) => {
      const byCategory = categoryLabel(t, a.category_key, a.category_label).localeCompare(
        categoryLabel(t, b.category_key, b.category_label)
      );
      if (byCategory !== 0) return byCategory;
      return metricLabel(t, a.metric_key, a.metric_label).localeCompare(
        metricLabel(t, b.metric_key, b.metric_label)
      );
    });
  }, [metricOptions, currentCategory, t]);

  const availableTeams = useMemo(() => {
    const unique = new Map<string, string>();

    rows.forEach((row) => {
      const slug = (row.team_slug ?? "").trim();
      const name = (row.team_name ?? "").trim();
      if (slug && !unique.has(slug)) {
        unique.set(slug, name || slug);
      }
    });

    return Array.from(unique.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const selectedMetricRow = rows[0] ?? undefined;

  const totalAllowed = isTotalMeaningful(
    selectedMetricRow?.metric_key,
    selectedMetricRow?.value_format
  );

  const per90Allowed = isPer90Meaningful(selectedMetricRow?.metric_key);

  const visibleBasis: ValueBasis =
    currentBasis === "total" && totalAllowed
      ? "total"
      : currentBasis === "per90" && per90Allowed
      ? "per90"
      : "per_match";

  const filteredRows = useMemo(() => {
    const deduped = new Map<string, LeaguePlayerLeaderboardRow>();

    rows.forEach((row) => {
      const apps = safeNumber(row.sample_matches) ?? 0;
      if (apps < currentMinApps) return;

      const role = (row.role_group ?? "").toUpperCase();
      const positionCode = (row.position_code ?? "").toUpperCase();

      if (currentRole === "starter_core") {
        if (role === "SUBSTITUTE" || positionCode === "SUB") return;
      }

      if (currentRole === "starters") {
        if (role === "SUBSTITUTE" || positionCode === "SUB") return;
      }

      if (currentRole === "substitutes") {
        if (!(role === "SUBSTITUTE" || positionCode === "SUB")) return;
      }

      if (currentTeam !== "all" && row.team_slug !== currentTeam) {
        return;
      }

      const dedupeKey = [
        row.metric_key ?? "",
        row.player_source_id ?? "",
        row.team_slug ?? "",
      ].join("|");

      if (!deduped.has(dedupeKey)) {
        deduped.set(dedupeKey, row);
      }
    });

    const preparedBase = Array.from(deduped.values()).map((row) => {
      const displayValue =
        visibleBasis === "total"
          ? row.total_value ?? row.per_match_value ?? row.per90_value ?? null
          : visibleBasis === "per90"
          ? row.per90_value ?? row.per_match_value ?? row.total_value ?? null
          : row.per_match_value ?? row.per90_value ?? row.total_value ?? null;

      return {
        ...row,
        displayValue,
      };
    });

    const validValues = preparedBase
      .map((row) => row.displayValue)
      .filter((value): value is number => value !== null && !Number.isNaN(value));

    const derivedLeagueAvg =
      validValues.length > 0
        ? validValues.reduce((sum, value) => sum + value, 0) / validValues.length
        : null;

    const isHigherBetter = selectedMetricRow?.is_higher_better !== false;

    const sorted = [...preparedBase].sort((a, b) => {
      const comparison = compareDisplayValues(
        a.displayValue,
        b.displayValue,
        isHigherBetter
      );

      if (comparison !== 0) {
        return comparison;
      }

      return (a.player_name ?? "").localeCompare(b.player_name ?? "");
    });

    return sorted.map((row, index) => {
      let derivedVsAvgPct: number | null = null;

      if (
        row.displayValue !== null &&
        derivedLeagueAvg !== null &&
        !Number.isNaN(row.displayValue) &&
        !Number.isNaN(derivedLeagueAvg)
      ) {
        if (derivedLeagueAvg !== 0) {
          derivedVsAvgPct =
            ((row.displayValue - derivedLeagueAvg) / Math.abs(derivedLeagueAvg)) *
            100;
        } else if (row.displayValue === 0) {
          derivedVsAvgPct = 0;
        }
      }

      return {
        ...row,
        displayRank: index + 1,
        derivedLeagueAvg,
        derivedVsAvgPct,
      };
    });
  }, [
    rows,
    currentMinApps,
    currentRole,
    currentTeam,
    visibleBasis,
    selectedMetricRow?.is_higher_better,
  ]);

  const sortedRows = useMemo(() => {
    if (sortCol === "rank") {
      return sortDir === "asc" ? filteredRows : [...filteredRows].reverse();
    }
    return [...filteredRows].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "player") cmp = (a.player_name ?? "").localeCompare(b.player_name ?? "");
      else if (sortCol === "team") cmp = (a.team_name ?? "").localeCompare(b.team_name ?? "");
      else if (sortCol === "role") cmp = (a.role_group ?? "").localeCompare(b.role_group ?? "");
      else if (sortCol === "value") cmp = (a.displayValue ?? -Infinity) - (b.displayValue ?? -Infinity);
      else if (sortCol === "avg") cmp = (a.derivedLeagueAvg ?? -Infinity) - (b.derivedLeagueAvg ?? -Infinity);
      else if (sortCol === "vsavg") cmp = (a.derivedVsAvgPct ?? -Infinity) - (b.derivedVsAvgPct ?? -Infinity);
      else if (sortCol === "apps") cmp = (safeNumber(a.sample_matches) ?? -Infinity) - (safeNumber(b.sample_matches) ?? -Infinity);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortCol, sortDir]);

  const leaderRow = filteredRows[0];
  const runnerUpRow = filteredRows[1];
  const leagueAverage = filteredRows[0]?.derivedLeagueAvg ?? null;

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

  function replaceParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("competition", competition);
    params.set("season", season);
    params.set("tab", "player_leaders");

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleCategoryChange(nextCategory: string) {
    const scoped =
      nextCategory === "all"
        ? metricOptions
        : metricOptions.filter((item) => item.category_key === nextCategory);

    const nextMetricKey =
      scoped.find((item) => item.metric_key === currentMetricKey)?.metric_key ??
      scoped[0]?.metric_key ??
      currentMetricKey ??
      "";

    replaceParams({
      category: nextCategory === "all" ? null : nextCategory,
      metric: nextMetricKey || null,
      team: null,
    });
  }

  function handleMetricChange(nextMetricKey: string) {
    const nextMetric = metricOptions.find((item) => item.metric_key === nextMetricKey);

    replaceParams({
      metric: nextMetricKey,
      category:
        nextMetric?.category_key && nextMetric.category_key !== "all"
          ? nextMetric.category_key
          : currentCategory === "all"
          ? null
          : currentCategory,
      team: null,
    });
  }

  const empty = metricOptions.length === 0 || !selectedMetricRow;

  if (empty) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        {t("leagueDetail.noPlayerLeaderboardData")}
      </div>
    );
  }

  const leaderGapValue =
    leaderGapToAvg !== null
      ? formatMetricValue(
          Math.abs(leaderGapToAvg),
          getBasisValueFormat(selectedMetricRow.value_format, visibleBasis, "gap")
        )
      : "—";

  const leaderGapSubvalue =
    leaderGapToSecond !== null
      ? t("leagueDetail.leaderVsSecond", {
          value: formatMetricValue(
            Math.abs(leaderGapToSecond),
            getBasisValueFormat(selectedMetricRow.value_format, visibleBasis, "gap")
          ),
        })
      : t("leagueDetail.leaderVsAverage");

  return (
    <div className="space-y-3">
      <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[900px]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              {t("leagueDetail.playerLeadersTitle")}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-medium ${getCategoryTone(
                  selectedMetricRow.category_key
                )}`}
              >
                {categoryLabel(t, selectedMetricRow.category_key, selectedMetricRow.category_label) ||
                  t("leagueDetail.categoryGeneral")}
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

          <div className="flex flex-col gap-2 xl:items-end">
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => replaceParams({ basis: "per90" })}
                  disabled={!per90Allowed}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                    visibleBasis === "per90"
                      ? "border border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                      : per90Allowed
                      ? "text-white/72 hover:bg-white/[0.04]"
                      : "cursor-not-allowed text-white/25"
                  }`}
                >
                  {t("leagueDetail.basisPer90")}
                </button>

                <button
                  type="button"
                  onClick={() => replaceParams({ basis: "per_match" })}
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
                  onClick={() => replaceParams({ basis: "total" })}
                  disabled={!totalAllowed}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                    visibleBasis === "total"
                      ? "border border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                      : totalAllowed
                      ? "text-white/72 hover:bg-white/[0.04]"
                      : "cursor-not-allowed text-white/25"
                  }`}
                >
                  {t("leagueDetail.basisTotal")}
                </button>
              </div>

              <select
                value={currentMetricKey ?? ""}
                onChange={(event) => handleMetricChange(event.target.value)}
                className="min-w-[220px] rounded-lg border border-white/10 bg-[#0d1624] px-3 py-2 text-[13px] text-white outline-none transition focus:border-[#4da2ff]/40"
              >
                {Object.entries(
                  categoryScopedMetricOptions.reduce<
                    Record<string, typeof categoryScopedMetricOptions>
                  >((groups, option) => {
                    const groupLabel = categoryLabel(
                      t,
                      option.category_key,
                      option.category_label
                    );
                    (groups[groupLabel] ??= []).push(option);
                    return groups;
                  }, {})
                ).map(([groupLabel, options]) => (
                  <optgroup key={groupLabel} label={groupLabel}>
                    {options.map((option) => (
                      <option key={option.metric_key} value={option.metric_key}>
                        {metricLabel(t, option.metric_key, option.metric_label)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={currentRole}
                onChange={(event) =>
                  replaceParams({
                    role:
                      event.target.value === "starter_core" ? null : event.target.value,
                  })
                }
                className="min-w-[160px] rounded-lg border border-white/10 bg-[#0d1624] px-3 py-2 text-[12px] text-white outline-none transition focus:border-[#4da2ff]/40"
              >
                <option value="starter_core">{t("leagueDetail.roleStarterCore")}</option>
                <option value="all">{t("leagueDetail.roleAll")}</option>
                <option value="starters">{t("leagueDetail.roleStarters")}</option>
                <option value="substitutes">{t("leagueDetail.roleSubstitutes")}</option>
              </select>

              <select
                value={currentTeam}
                onChange={(event) =>
                  replaceParams({
                    team: event.target.value === "all" ? null : event.target.value,
                  })
                }
                className="min-w-[180px] rounded-lg border border-white/10 bg-[#0d1624] px-3 py-2 text-[12px] text-white outline-none transition focus:border-[#4da2ff]/40"
              >
                <option value="all">{t("leagueDetail.allTeamsOption")}</option>
                {availableTeams.map((team) => (
                  <option key={team.slug} value={team.slug}>
                    {team.name}
                  </option>
                ))}
              </select>

              <select
                value={String(currentMinApps)}
                onChange={(event) => replaceParams({ minApps: event.target.value })}
                className="min-w-[140px] rounded-lg border border-white/10 bg-[#0d1624] px-3 py-2 text-[12px] text-white outline-none transition focus:border-[#4da2ff]/40"
              >
                <option value="1">{t("leagueDetail.minAppsOption", { count: 1 })}</option>
                <option value="3">{t("leagueDetail.minAppsOption", { count: 3 })}</option>
                <option value="5">{t("leagueDetail.minAppsOption", { count: 5 })}</option>
                <option value="8">{t("leagueDetail.minAppsOption", { count: 8 })}</option>
                <option value="10">{t("leagueDetail.minAppsOption", { count: 10 })}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleCategoryChange("all")}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
              currentCategory === "all"
                ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
            }`}
          >
            {t("common.all")}
          </button>

          {availableCategories.map((category) => (
            <button
              key={category.key}
              type="button"
              onClick={() => handleCategoryChange(category.key)}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                currentCategory === category.key
                  ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricSummaryCard
            label={t("leagueDetail.selectedMetricLabel")}
            value={metricLabel(t, selectedMetricRow.metric_key, selectedMetricRow.metric_label)}
            subvalue={categoryLabel(t, selectedMetricRow.category_key, selectedMetricRow.category_label)}
          />
          <MetricSummaryCard
            label={t("leagueDetail.leagueLeaderLabel")}
            value={leaderRow?.player_name ?? "—"}
            subvalue={
              leaderRow
                ? t("leagueDetail.leaderSummary", {
                    rank: leaderRow.displayRank,
                    value: formatMetricValue(
                      leaderRow.displayValue,
                      getBasisValueFormat(
                        selectedMetricRow.value_format,
                        visibleBasis,
                        "value"
                      )
                    ),
                    team: leaderRow.team_name ?? "—",
                  })
                : undefined
            }
          />
          <MetricSummaryCard
            label={t("leagueDetail.leagueAverageLabel")}
            value={formatMetricValue(
              leagueAverage,
              getBasisValueFormat(
                selectedMetricRow.value_format,
                visibleBasis,
                "average"
              )
            )}
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
              <th className="px-4 py-2 font-medium cursor-pointer hover:text-white/70 select-none" onClick={() => handleColSort("player")}>{t("common.player")}<SortIcon col="player" /></th>
              <th className="px-4 py-2 font-medium cursor-pointer hover:text-white/70 select-none" onClick={() => handleColSort("team")}>{t("common.team")}<SortIcon col="team" /></th>
              <th className="px-4 py-2 font-medium cursor-pointer hover:text-white/70 select-none" onClick={() => handleColSort("role")}>{t("leagueDetail.colRole")}<SortIcon col="role" /></th>
              <th className="px-4 py-2 font-medium cursor-pointer hover:text-white/70 select-none" onClick={() => handleColSort("value")}>
                {visibleBasis === "per90"
                  ? t("leagueDetail.basisPer90")
                  : visibleBasis === "total"
                  ? t("leagueDetail.basisTotal")
                  : t("leagueDetail.buttonPerMatch")}<SortIcon col="value" />
              </th>
              <th className="px-4 py-2 font-medium cursor-pointer hover:text-white/70 select-none" onClick={() => handleColSort("avg")}>{t("leagueDetail.colLeagueAvg")}<SortIcon col="avg" /></th>
              <th className="px-4 py-2 font-medium cursor-pointer hover:text-white/70 select-none" onClick={() => handleColSort("vsavg")}>{t("leagueDetail.colVsAvgPct")}<SortIcon col="vsavg" /></th>
              <th className="px-4 py-2 font-medium cursor-pointer hover:text-white/70 select-none" onClick={() => handleColSort("apps")}>{t("common.appearances")}<SortIcon col="apps" /></th>
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((row, index) => (
              <tr
                key={`${row.metric_key}-${row.player_source_id ?? "na"}-${row.team_slug ?? "na"}-${row.role_group ?? "na"}-${row.displayRank}-${visibleBasis}-${index}`}
                className="border-t border-white/10 text-[13px] text-white/80 transition hover:bg-white/[0.02]"
              >
                <td className="px-4 py-2 whitespace-nowrap font-semibold text-white">
                  {row.displayRank}
                </td>

                <td className="px-4 py-2 min-w-[220px] font-medium text-white">
                  <PlayerLink
                    playerSlug={row.player_slug}
                    className="transition hover:text-white hover:underline"
                    title={row.player_name ?? undefined}
                  >
                    {row.player_name ?? "—"}
                  </PlayerLink>
                </td>

                <td className="px-4 py-2 min-w-[180px] font-medium text-white">
                  {row.team_slug ? (
                    <TeamLink
                      teamSlug={row.team_slug}
                      className="transition hover:text-white hover:underline"
                      title={row.team_name ?? undefined}
                    >
                      {row.team_name ?? "—"}
                    </TeamLink>
                  ) : (
                    <span>{row.team_name ?? "—"}</span>
                  )}
                </td>

                <td className="px-4 py-2 whitespace-nowrap text-white/70">
                  {row.role_group ?? row.position_code ?? "—"}
                </td>

                <td className="px-4 py-2 whitespace-nowrap font-medium text-white">
                  {formatMetricValue(
                    row.displayValue,
                    getBasisValueFormat(row.value_format, visibleBasis, "value")
                  )}
                </td>

                <td className="px-4 py-2 whitespace-nowrap text-white/70">
                  {formatMetricValue(
                    row.derivedLeagueAvg,
                    getBasisValueFormat(row.value_format, visibleBasis, "average")
                  )}
                </td>

                <td
                  className={`px-4 py-2 whitespace-nowrap font-medium ${getDeltaTone(
                    row.derivedVsAvgPct,
                    row.is_higher_better
                  )}`}
                >
                  {getDeltaText(t, row.derivedVsAvgPct, row.is_higher_better)}
                </td>

                <td className="px-4 py-2 whitespace-nowrap text-white/70">
                  {row.sample_matches ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}