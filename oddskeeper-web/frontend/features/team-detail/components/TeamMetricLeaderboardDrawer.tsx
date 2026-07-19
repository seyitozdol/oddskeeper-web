"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { TeamMetricLeaderboardRow } from "../types";

type MetricOption = {
  metricKey: string;
  metricLabel: string;
};

type TeamMetricLeaderboardDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  initialMetricKey: string | null;
  initialMetricLabel?: string | null;
  seasonLabel?: string | null;
  competition?: string | null;
  selectedTeamSlug?: string | null;
  metricOptions: MetricOption[];
};

type LeaderboardViewMode = "all" | "top4" | "bottom4" | "around_selected";

type MetricMeta = {
  descKey: string;
  interpKey: string;
};

const METRIC_META: Record<string, MetricMeta> = {
  team_goals_for: {
    descKey: "teamDetail.metricDescGoalsFor",
    interpKey: "teamDetail.interpHigherBetter",
  },
  team_expected_goals: {
    descKey: "teamDetail.metricDescExpectedGoals",
    interpKey: "teamDetail.interpHigherBetter",
  },
  team_shots: {
    descKey: "teamDetail.metricDescShots",
    interpKey: "teamDetail.interpHigherBetter",
  },
  team_shots_on_target: {
    descKey: "teamDetail.metricDescShotsOnTarget",
    interpKey: "teamDetail.interpHigherBetter",
  },
  team_shot_accuracy_pct: {
    descKey: "teamDetail.metricDescShotAccuracy",
    interpKey: "teamDetail.interpHigherBetter",
  },
  team_xg_per_shot: {
    descKey: "teamDetail.metricDescXgPerShot",
    interpKey: "teamDetail.interpHigherBetter",
  },
  team_offsides: {
    descKey: "teamDetail.metricDescOffsides",
    interpKey: "teamDetail.interpLowerGenerallyBetter",
  },
  team_goals_against: {
    descKey: "teamDetail.metricDescGoalsAgainst",
    interpKey: "teamDetail.interpLowerBetter",
  },
  team_shots_against: {
    descKey: "teamDetail.metricDescShotsAgainst",
    interpKey: "teamDetail.interpLowerBetter",
  },
  team_shots_on_target_against: {
    descKey: "teamDetail.metricDescShotsOnTargetAgainst",
    interpKey: "teamDetail.interpLowerBetter",
  },
  team_tackles: {
    descKey: "teamDetail.metricDescTackles",
    interpKey: "teamDetail.interpHigherGenerallyBetter",
  },
  team_interceptions: {
    descKey: "teamDetail.metricDescInterceptions",
    interpKey: "teamDetail.interpHigherGenerallyBetter",
  },
  team_fouls_conceded: {
    descKey: "teamDetail.metricDescFoulsConceded",
    interpKey: "teamDetail.interpLowerBetter",
  },
  team_passes: {
    descKey: "teamDetail.metricDescPasses",
    interpKey: "teamDetail.interpHigherGenerallyBetter",
  },
  team_accurate_pass: {
    descKey: "teamDetail.metricDescAccuratePass",
    interpKey: "teamDetail.interpHigherBetter",
  },
  team_pass_accuracy_pct: {
    descKey: "teamDetail.metricDescPassAccuracy",
    interpKey: "teamDetail.interpHigherBetter",
  },
  team_yellow_cards: {
    descKey: "teamDetail.metricDescYellowCards",
    interpKey: "teamDetail.interpLowerBetter",
  },
  team_red_cards: {
    descKey: "teamDetail.metricDescRedCards",
    interpKey: "teamDetail.interpLowerBetter",
  },
  team_corners_won: {
    descKey: "teamDetail.metricDescCornersWon",
    interpKey: "teamDetail.interpHigherGenerallyBetter",
  },
  team_saves: {
    descKey: "teamDetail.metricDescSaves",
    interpKey: "teamDetail.interpContextDependent",
  },
  team_goal_kicks: {
    descKey: "teamDetail.metricDescGoalKicks",
    interpKey: "teamDetail.interpContextDependent",
  },
  team_total_throws: {
    descKey: "teamDetail.metricDescTotalThrows",
    interpKey: "teamDetail.interpContextDependent",
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

  if (rank >= 15) {
    return "text-rose-300";
  }

  if (rank >= 11) {
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

function getMetricMeta(metricKey: string | null | undefined): MetricMeta {
  if (!metricKey) {
    return {
      descKey: "teamDetail.metricDescNoContext",
      interpKey: "teamDetail.metricInterpNoContext",
    };
  }

  return (
    METRIC_META[metricKey] ?? {
      descKey: "teamDetail.metricDescFallback",
      interpKey: "teamDetail.metricInterpFallback",
    }
  );
}

export function TeamMetricLeaderboardDrawer({
  isOpen,
  onClose,
  initialMetricKey,
  initialMetricLabel,
  seasonLabel,
  competition,
  selectedTeamSlug,
  metricOptions,
}: TeamMetricLeaderboardDrawerProps) {
  const { t } = useI18n();
  const [selectedMetricKey, setSelectedMetricKey] = useState<string | null>(
    initialMetricKey
  );
  const [rows, setRows] = useState<TeamMetricLeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<LeaderboardViewMode>("all");

  useEffect(() => {
    if (isOpen) {
      setSelectedMetricKey(initialMetricKey ?? metricOptions[0]?.metricKey ?? null);
      setViewMode("all");
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
          `/api/team-metric-leaderboard?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load leaderboard");
        }

        const payload = (await response.json()) as {
          rows?: TeamMetricLeaderboardRow[];
        };

        if (!isCancelled) {
          setRows(payload.rows ?? []);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("TeamMetricLeaderboardDrawer load failed", {
            metricKey,
            seasonLabel,
            competition,
            error,
          });
          setRows([]);
          setErrorText(t("teamDetail.errorLoadLeaderboard"));
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
  }, [isOpen, selectedMetricKey, seasonLabel, competition]);

  const selectedMetricLabel = useMemo(() => {
    const fromOptions = metricOptions.find(
      (option) => option.metricKey === selectedMetricKey
    );

    if (fromOptions?.metricLabel) {
      return fromOptions.metricLabel;
    }

    return initialMetricLabel ?? t("teamDetail.colMetric");
  }, [metricOptions, selectedMetricKey, initialMetricLabel, t]);

  const selectedRow = useMemo(() => {
    return rows.find((row) => row.team_slug === selectedTeamSlug) ?? null;
  }, [rows, selectedTeamSlug]);

  const visibleRows = useMemo(() => {
    if (rows.length === 0) {
      return [];
    }

    if (viewMode === "all") {
      return rows;
    }

    if (viewMode === "top4") {
      return rows.slice(0, 4);
    }

    if (viewMode === "bottom4") {
      return rows.slice(Math.max(0, rows.length - 4));
    }

    const selectedIndex = rows.findIndex((row) => row.team_slug === selectedTeamSlug);

    if (selectedIndex === -1) {
      return rows.slice(0, 6);
    }

    const start = Math.max(0, selectedIndex - 2);
    const end = Math.min(rows.length, selectedIndex + 3);
    return rows.slice(start, end);
  }, [rows, viewMode, selectedTeamSlug]);

  const metricMeta = useMemo(() => {
    return getMetricMeta(selectedMetricKey);
  }, [selectedMetricKey]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label={t("teamDetail.closeDrawerAriaLabel")}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />

      <div className="absolute right-0 top-0 h-full w-full max-w-[760px] border-l border-white/10 bg-[linear-gradient(180deg,rgba(7,12,21,0.98),rgba(4,8,15,0.99))] shadow-[-20px_0_60px_rgba(0,0,0,0.45)]">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/36">
                  {t("teamDetail.metricRankingLabel")}
                </div>
                <div className="mt-1 text-xl font-semibold text-white">
                  {selectedMetricLabel}
                </div>
                <div className="mt-1 text-xs text-white/52">
                  {competition ?? "—"} • {seasonLabel ?? "—"}
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
                  {t("teamDetail.metricContextLabel")}
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {selectedMetricLabel}
                </div>
                <div className="mt-1 text-xs leading-5 text-white/60">
                  {t(metricMeta.descKey)}
                </div>
                <div className="mt-2 text-[11px] text-white/48">
                  {t(metricMeta.interpKey)}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/38">
                  {t("teamDetail.selectedTeamLabel")}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="font-semibold text-white">
                    {selectedRow?.team_name ?? "—"}
                  </div>

                  <div className={`${getRankTone(selectedRow?.league_rank)}`}>
                    {t("teamDetail.rankHash", {
                      rank: selectedRow?.league_rank ?? "—",
                    })}
                  </div>

                  <div className="text-white/65">
                    {t("teamDetail.colPerMatch")}{" "}
                    <span className="font-medium text-white">
                      {formatMetricValue(
                        selectedRow?.per_match_value,
                        selectedRow?.value_format
                      )}
                    </span>
                  </div>

                  <div className="text-white/65">
                    {t("teamDetail.colLeagueAvg")}{" "}
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
                    {t("teamDetail.vsAvgLabel")}{" "}
                    <span className="font-medium">
                      {formatMetricValue(selectedRow?.vs_league_avg_pct, "pct_1")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", labelKey: "teamDetail.viewModeFullTable" },
                  {
                    key: "around_selected",
                    labelKey: "teamDetail.viewModeAroundSelected",
                  },
                  { key: "top4", labelKey: "teamDetail.viewModeTop4" },
                  { key: "bottom4", labelKey: "teamDetail.viewModeBottom4" },
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
                  {t("teamDetail.rankingMetricLabel")}
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
                      {option.metricLabel}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoading ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
                {t("teamDetail.loadingLeaderboard")}
              </div>
            ) : errorText ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-4 text-sm text-rose-200">
                {errorText}
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
                {t("teamDetail.noLeaderboardRows")}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-[#0d1624]">
                    <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
                      <th className="px-4 py-2 font-medium">{t("teamDetail.colRank")}</th>
                      <th className="px-4 py-2 font-medium">{t("teamDetail.colTeam")}</th>
                      <th className="px-4 py-2 font-medium">{t("teamDetail.colTotal")}</th>
                      <th className="px-4 py-2 font-medium">{t("teamDetail.colPerMatch")}</th>
                      <th className="px-4 py-2 font-medium">{t("teamDetail.colLeagueAvg")}</th>
                      <th className="px-4 py-2 font-medium">{t("teamDetail.colVsAvgPct")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleRows.map((row) => {
                      const isSelected = row.team_slug === selectedTeamSlug;

                      return (
                        <tr
                          key={`${row.metric_key}-${row.team_slug}`}
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
                                {row.team_name ?? "—"}
                              </span>
                              {isSelected ? (
                                <span className="rounded-md border border-sky-500/20 bg-sky-500/[0.10] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-sky-200">
                                  {t("teamDetail.selectedBadge")}
                                </span>
                              ) : null}
                            </div>
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