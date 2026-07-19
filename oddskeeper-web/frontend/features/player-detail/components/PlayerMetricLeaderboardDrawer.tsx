"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Translator } from "@/lib/i18n/messages";
import { metricLabel } from "@/lib/i18n/metricLabel";
import type { PlayerMetricLeaderboardRow } from "../types";

type MetricOption = {
  metricKey: string;
  metricLabel: string;
};

type PlayerMetricLeaderboardDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  initialMetricKey: string | null;
  initialMetricLabel?: string | null;
  seasonLabel?: string | null;
  competition?: string | null;
  selectedPlayerSourceId?: string | number | null;
  metricOptions: MetricOption[];
};

type LeaderboardViewMode =
  | "qualified"
  | "all"
  | "top4"
  | "bottom4"
  | "around_selected";

type MetricMeta = {
  shortDescription: string;
  interpretation: string;
};

type MetricMetaKeys = {
  shortDescriptionKey: string;
  interpretationKey: string;
};

// Metrik başına kısa açıklama ve yön yorumu: gerçek metinler render sırasında
// t() ile çözülür (bkz. PlayerStatsExplorer.tsx içindeki labelKey deseni).
const METRIC_META_KEYS: Record<string, MetricMetaKeys> = {
  goals_total: {
    shortDescriptionKey: "playerDetail.metricDescGoalsTotal",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  assists_total: {
    shortDescriptionKey: "playerDetail.metricDescAssistsTotal",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  expected_goals_total: {
    shortDescriptionKey: "playerDetail.metricDescExpectedGoalsTotal",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  shots_on_target_total: {
    shortDescriptionKey: "playerDetail.metricDescShotsOnTargetTotal",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  attempts_ibox_total: {
    shortDescriptionKey: "playerDetail.metricDescAttemptsIboxTotal",
    interpretationKey: "playerDetail.higherGenerallyBetter",
  },
  attempts_obox_total: {
    shortDescriptionKey: "playerDetail.metricDescAttemptsOboxTotal",
    interpretationKey: "playerDetail.contextDependent",
  },
  shot_accuracy_pct: {
    shortDescriptionKey: "playerDetail.metricDescShotAccuracyPct",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  xg_per90: {
    shortDescriptionKey: "playerDetail.metricDescXgPer90",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  passes_total: {
    shortDescriptionKey: "playerDetail.metricDescPassesTotal",
    interpretationKey: "playerDetail.higherGenerallyBetter",
  },
  accurate_pass_total: {
    shortDescriptionKey: "playerDetail.metricDescAccuratePassTotal",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  pass_accuracy_pct: {
    shortDescriptionKey: "playerDetail.metricDescPassAccuracyPct",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  tackles_total: {
    shortDescriptionKey: "playerDetail.metricDescTacklesTotal",
    interpretationKey: "playerDetail.higherGenerallyBetter",
  },
  interceptions_total: {
    shortDescriptionKey: "playerDetail.metricDescInterceptionsTotal",
    interpretationKey: "playerDetail.higherGenerallyBetter",
  },
  fouls_conceded_total: {
    shortDescriptionKey: "playerDetail.metricDescFoulsConcededTotal",
    interpretationKey: "playerDetail.lowerIsBetter",
  },
  fouls_won_total: {
    shortDescriptionKey: "playerDetail.metricDescFoulsWonTotal",
    interpretationKey: "playerDetail.higherGenerallyBetter",
  },
  cards_yellow_total: {
    shortDescriptionKey: "playerDetail.metricDescCardsYellowTotal",
    interpretationKey: "playerDetail.lowerIsBetter",
  },
  cards_red_total: {
    shortDescriptionKey: "playerDetail.metricDescCardsRedTotal",
    interpretationKey: "playerDetail.lowerIsBetter",
  },
  appearances: {
    shortDescriptionKey: "playerDetail.metricDescAppearances",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  starts: {
    shortDescriptionKey: "playerDetail.metricDescStarts",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  starter_rate_pct: {
    shortDescriptionKey: "playerDetail.metricDescStarterRatePct",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  total_minutes: {
    shortDescriptionKey: "playerDetail.metricDescTotalMinutes",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  avg_minutes: {
    shortDescriptionKey: "playerDetail.metricDescAvgMinutes",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  saves_total_total: {
    shortDescriptionKey: "playerDetail.metricDescSavesTotalTotal",
    interpretationKey: "playerDetail.higherGenerallyBetter",
  },
  goals_conceded_total: {
    shortDescriptionKey: "playerDetail.metricDescGoalsConcededTotal",
    interpretationKey: "playerDetail.lowerIsBetter",
  },
  penalties_saved_total: {
    shortDescriptionKey: "playerDetail.metricDescPenaltiesSavedTotal",
    interpretationKey: "playerDetail.higherIsBetter",
  },
  offsides_total: {
    shortDescriptionKey: "playerDetail.metricDescOffsidesTotal",
    interpretationKey: "playerDetail.lowerGenerallyBetter",
  },
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

function getRankTone(rank: number | null | undefined) {
  if (rank === null || rank === undefined) {
    return "text-white/55";
  }

  if (rank <= 4) {
    return "text-emerald-300";
  }

  if (rank >= 40) {
    return "text-rose-300";
  }

  if (rank >= 25) {
    return "text-amber-300";
  }

  return "text-white/80";
}

function getDeltaTone(
  value: number | null | undefined,
  isHigherBetter: boolean | null | undefined
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "text-white/55";
  }

  const isPositive = value > 0;
  const isGood = isHigherBetter ? isPositive : !isPositive;

  if (value === 0) {
    return "text-white/65";
  }

  return isGood ? "text-emerald-300" : "text-rose-300";
}

function getMetricMeta(
  t: Translator,
  metricKey: string | null | undefined
): MetricMeta {
  if (!metricKey) {
    return {
      shortDescription: t("playerDetail.metricMetaUnknownDesc"),
      interpretation: t("playerDetail.metricMetaUnknownInterp"),
    };
  }

  const keys = METRIC_META_KEYS[metricKey];

  if (!keys) {
    return {
      shortDescription: t("playerDetail.metricMetaFallbackDesc"),
      interpretation: t("playerDetail.metricMetaFallbackInterp"),
    };
  }

  return {
    shortDescription: t(keys.shortDescriptionKey),
    interpretation: t(keys.interpretationKey),
  };
}

function buildLeaderboardRowKey(row: PlayerMetricLeaderboardRow) {
  return [
    row.metric_key ?? "metric",
    row.player_source_id ?? "player",
    row.team_slug ?? "team",
    row.team_name ?? "team_name",
    row.league_rank ?? "rank",
    row.total_value ?? "total",
    row.per90_value ?? "per90",
  ].join("__");
}

export function PlayerMetricLeaderboardDrawer({
  isOpen,
  onClose,
  initialMetricKey,
  initialMetricLabel,
  seasonLabel,
  competition,
  selectedPlayerSourceId,
  metricOptions,
}: PlayerMetricLeaderboardDrawerProps) {
  const { t } = useI18n();
  const [selectedMetricKey, setSelectedMetricKey] = useState<string | null>(
    initialMetricKey
  );
  const [rows, setRows] = useState<PlayerMetricLeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<LeaderboardViewMode>("qualified");

  useEffect(() => {
    if (isOpen) {
      setSelectedMetricKey(initialMetricKey ?? metricOptions[0]?.metricKey ?? null);
      setViewMode("qualified");
    }
  }, [isOpen, initialMetricKey, metricOptions]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedMetricKey) {
      return;
    }

    const metricKey = selectedMetricKey;
    let isCancelled = false;

    async function loadLeaderboard() {
      setIsLoading(true);
      setErrorText(null);

      try {
        const params = new URLSearchParams();
        params.set("metricKey", metricKey);

        if (seasonLabel) {
          params.set("seasonLabel", seasonLabel);
        }

        if (competition) {
          params.set("competition", competition);
        }

        const response = await fetch(
          `/api/player-metric-leaderboard?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load leaderboard");
        }

        const payload = (await response.json()) as {
          rows?: PlayerMetricLeaderboardRow[];
        };

        if (!isCancelled) {
          setRows(payload.rows ?? []);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("PlayerMetricLeaderboardDrawer load failed", {
            metricKey,
            seasonLabel,
            competition,
            error,
          });
          setRows([]);
          setErrorText(t("playerDetail.leaderboardLoadError"));
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLeaderboard();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, selectedMetricKey, seasonLabel, competition, t]);

  const selectedMetricLabel = useMemo(() => {
    const fromOptions = metricOptions.find(
      (option) => option.metricKey === selectedMetricKey
    );

    const fallbackLabel = fromOptions?.metricLabel ?? initialMetricLabel;
    const label = metricLabel(t, selectedMetricKey, fallbackLabel);
    return label || t("playerDetail.metricLabel");
  }, [metricOptions, selectedMetricKey, initialMetricLabel, t]);

  const normalizedRows = useMemo(() => {
    const uniqueMap = new Map<string, PlayerMetricLeaderboardRow>();

    rows.forEach((row) => {
      const key = buildLeaderboardRowKey(row);

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, row);
      }
    });

    return Array.from(uniqueMap.values());
  }, [rows]);

  const qualifiedRows = useMemo(() => {
    return normalizedRows.filter((row) => row.is_qualified === true);
  }, [normalizedRows]);

  const activeRows = useMemo(() => {
    return viewMode === "qualified" ? qualifiedRows : normalizedRows;
  }, [viewMode, qualifiedRows, normalizedRows]);

  const selectedRow = useMemo(() => {
    return (
      activeRows.find(
        (row) =>
          String(row.player_source_id ?? "") === String(selectedPlayerSourceId ?? "")
      ) ?? null
    );
  }, [activeRows, selectedPlayerSourceId]);

  const selectedRowAny = useMemo(() => {
    return (
      normalizedRows.find(
        (row) =>
          String(row.player_source_id ?? "") === String(selectedPlayerSourceId ?? "")
      ) ?? null
    );
  }, [normalizedRows, selectedPlayerSourceId]);

  const visibleRows = useMemo(() => {
    if (activeRows.length === 0) {
      return [];
    }

    if (viewMode === "qualified" || viewMode === "all") {
      return activeRows;
    }

    if (viewMode === "top4") {
      return qualifiedRows.slice(0, 4);
    }

    if (viewMode === "bottom4") {
      return qualifiedRows.slice(Math.max(0, qualifiedRows.length - 4));
    }

    const aroundPool = normalizedRows;
    const selectedIndex = aroundPool.findIndex(
      (row) =>
        String(row.player_source_id ?? "") === String(selectedPlayerSourceId ?? "")
    );

    if (selectedIndex === -1) {
      return aroundPool.slice(0, 6);
    }

    const start = Math.max(0, selectedIndex - 2);
    const end = Math.min(aroundPool.length, selectedIndex + 3);

    return aroundPool.slice(start, end);
  }, [activeRows, qualifiedRows, normalizedRows, viewMode, selectedPlayerSourceId]);

  const metricMeta = useMemo(() => {
    return getMetricMeta(t, selectedMetricKey);
  }, [t, selectedMetricKey]);

  const qualificationContextText = useMemo(() => {
    const ref = selectedRowAny;

    if (!ref) {
      return t("playerDetail.qualifiedLeaderboardFallback");
    }

    return t("playerDetail.qualifiedLeaderboardContext", {
      minMinutes: ref.qualification_minutes_threshold ?? "—",
      minApps: ref.qualification_apps_threshold ?? "—",
    });
  }, [selectedRowAny, t]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label={t("playerDetail.closeLeaderboardDrawerAriaLabel")}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />

      <div className="absolute right-0 top-0 h-full w-full max-w-[780px] border-l border-white/10 bg-[linear-gradient(180deg,rgba(7,12,21,0.98),rgba(4,8,15,0.99))] shadow-[-20px_0_60px_rgba(0,0,0,0.45)]">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/36">
                  {t("playerDetail.metricRankingKicker")}
                </div>
                <div className="mt-1 text-xl font-semibold text-white">
                  {selectedMetricLabel}
                </div>
                <div className="mt-1 text-xs text-white/52">
                  {competition ?? "—"} • {seasonLabel ?? "—"}
                </div>
                <div className="mt-2 text-[11px] text-white/45">
                  {qualificationContextText}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/75 transition hover:bg-white/[0.06]"
              >
                {t("common.close")}
              </button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/38">
                  {t("playerDetail.metricContextLabel")}
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {selectedMetricLabel}
                </div>
                <div className="mt-1 text-xs leading-5 text-white/60">
                  {metricMeta.shortDescription}
                </div>
                <div className="mt-2 text-[11px] text-white/48">
                  {metricMeta.interpretation}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/38">
                  {t("playerDetail.selectedPlayerLabel")}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="font-semibold text-white">
                    {selectedRowAny?.player_name ?? "—"}
                  </div>

                  <div className="text-white/65">
                    {selectedRowAny?.team_name ?? "—"}
                  </div>

                  <div className={`${getRankTone(selectedRow?.league_rank)}`}>
                    {t("playerDetail.rankValue", {
                      rank: selectedRow?.league_rank ?? "—",
                    })}
                  </div>

                  <div className="text-white/65">
                    {t("playerDetail.per90Label")}{" "}
                    <span className="font-medium text-white">
                      {formatMetricValue(
                        selectedRowAny?.per90_value,
                        selectedRowAny?.value_format
                      )}
                    </span>
                  </div>

                  <div className="text-white/65">
                    {t("playerDetail.leagueAvgLabel")}{" "}
                    <span className="font-medium text-white">
                      {formatMetricValue(
                        selectedRow?.league_avg,
                        selectedRow?.value_format
                      )}
                    </span>
                  </div>

                  <div
                    className={`text-white/65 ${getDeltaTone(
                      selectedRow?.vs_league_avg_pct,
                      selectedRow?.is_higher_better
                    )}`}
                  >
                    {t("playerDetail.vsAvgLabel")}{" "}
                    <span className="font-medium">
                      {formatMetricValue(selectedRow?.vs_league_avg_pct, "pct_1")}
                    </span>
                  </div>

                  {selectedRowAny?.is_qualified === false ? (
                    <div className="text-[11px] text-amber-300">
                      {t("playerDetail.notQualifiedReason", {
                        reason: selectedRowAny.qualification_reason ?? "rule",
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "qualified", labelKey: "playerDetail.viewModeQualified" },
                  { key: "all", labelKey: "playerDetail.viewModeAllPlayers" },
                  {
                    key: "around_selected",
                    labelKey: "playerDetail.viewModeAroundSelected",
                  },
                  { key: "top4", labelKey: "playerDetail.viewModeTop4" },
                  { key: "bottom4", labelKey: "playerDetail.viewModeBottom4" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setViewMode(option.key as LeaderboardViewMode)}
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                      viewMode === option.key
                        ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
                    }`}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>

              <div className="min-w-[220px]">
                <label className="mb-2 block text-[10px] uppercase tracking-[0.14em] text-white/38">
                  {t("playerDetail.rankingMetricLabel")}
                </label>
                <select
                  value={selectedMetricKey ?? ""}
                  onChange={(event) => setSelectedMetricKey(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition focus:border-[#4da2ff]/40"
                >
                  {metricOptions.map((option) => (
                    <option
                      key={option.metricKey}
                      value={option.metricKey}
                      className="bg-[#0b1220] text-white"
                    >
                      {metricLabel(t, option.metricKey, option.metricLabel)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoading ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
                {t("playerDetail.loadingLeaderboard")}
              </div>
            ) : errorText ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-4 text-sm text-rose-200">
                {errorText}
              </div>
            ) : activeRows.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
                {t("playerDetail.noLeaderboardRows")}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-[#0d1624]">
                    <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
                      <th className="px-4 py-2 font-medium">{t("playerDetail.rankColumn")}</th>
                      <th className="px-4 py-2 font-medium">{t("common.player")}</th>
                      <th className="px-4 py-2 font-medium">{t("common.team")}</th>
                      <th className="px-4 py-2 font-medium">{t("playerDetail.totalColumn")}</th>
                      <th className="px-4 py-2 font-medium">{t("playerDetail.perMatchColumn")}</th>
                      <th className="px-4 py-2 font-medium">{t("playerDetail.per90Label")}</th>
                      <th className="px-4 py-2 font-medium">{t("playerDetail.leagueAvgLabel")}</th>
                      <th className="px-4 py-2 font-medium">{t("playerDetail.vsAvgPctLabel")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleRows.map((row) => {
                      const isSelected =
                        String(row.player_source_id ?? "") ===
                        String(selectedPlayerSourceId ?? "");

                      return (
                        <tr
                          key={buildLeaderboardRowKey(row)}
                          className={`border-t border-white/10 text-[13px] text-white/80 ${
                            isSelected ? "bg-[#11335c]/35" : "hover:bg-white/[0.02]"
                          }`}
                        >
                          <td
                            className={`px-4 py-2 font-semibold ${getRankTone(
                              row.league_rank
                            )}`}
                          >
                            {row.league_rank ?? "—"}
                          </td>

                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">
                                {row.player_name ?? "—"}
                              </span>
                              {isSelected ? (
                                <span className="rounded-md border border-sky-500/20 bg-sky-500/[0.10] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-sky-200">
                                  {t("playerDetail.selectedBadge")}
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-4 py-2 text-white/70">
                            {row.team_name ?? "—"}
                          </td>

                          <td className="px-4 py-2 whitespace-nowrap">
                            {formatMetricValue(row.total_value, row.value_format)}
                          </td>

                          <td className="px-4 py-2 whitespace-nowrap font-medium text-white">
                            {formatMetricValue(
                              row.per_match_value,
                              row.value_format
                            )}
                          </td>

                          <td className="px-4 py-2 whitespace-nowrap font-medium text-white">
                            {formatMetricValue(row.per90_value, row.value_format)}
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
                            {formatMetricValue(row.vs_league_avg_pct, "pct_1")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}