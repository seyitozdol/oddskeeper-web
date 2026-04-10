"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [selectedMetricKey, setSelectedMetricKey] = useState<string | null>(
    initialMetricKey
  );
  const [rows, setRows] = useState<TeamMetricLeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedMetricKey(initialMetricKey);
    }
  }, [isOpen, initialMetricKey]);

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
          setErrorText("Could not load metric leaderboard.");
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

    return initialMetricLabel ?? "Metric";
  }, [metricOptions, selectedMetricKey, initialMetricLabel]);

  const selectedRow = useMemo(() => {
    return rows.find((row) => row.team_slug === selectedTeamSlug) ?? null;
  }, [rows, selectedTeamSlug]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Close leaderboard drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />

      <div className="absolute right-0 top-0 h-full w-full max-w-[760px] border-l border-white/10 bg-[linear-gradient(180deg,rgba(7,12,21,0.98),rgba(4,8,15,0.99))] shadow-[-20px_0_60px_rgba(0,0,0,0.45)]">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/36">
                  Metric Ranking
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
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/38">
                  Selected Team
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="font-semibold text-white">
                    {selectedRow?.team_name ?? "—"}
                  </div>
                  <div className={`${getRankTone(selectedRow?.league_rank)}`}>
                    Rank #{selectedRow?.league_rank ?? "—"}
                  </div>
                  <div className="text-white/65">
                    Per Match{" "}
                    <span className="font-medium text-white">
                      {formatMetricValue(
                        selectedRow?.per_match_value,
                        selectedRow?.value_format
                      )}
                    </span>
                  </div>
                  <div className="text-white/65">
                    League Avg{" "}
                    <span className="font-medium text-white">
                      {formatMetricValue(
                        selectedRow?.league_avg,
                        selectedRow?.value_format
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-[0.14em] text-white/38">
                  Ranking Metric
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
                Loading leaderboard...
              </div>
            ) : errorText ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-4 text-sm text-rose-200">
                {errorText}
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
                No leaderboard rows found for this metric.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-[#0d1624]">
                    <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
                      <th className="px-4 py-2 font-medium">Rank</th>
                      <th className="px-4 py-2 font-medium">Team</th>
                      <th className="px-4 py-2 font-medium">Total</th>
                      <th className="px-4 py-2 font-medium">Per Match</th>
                      <th className="px-4 py-2 font-medium">League Avg</th>
                      <th className="px-4 py-2 font-medium">Vs Avg %</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => {
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
                                  Selected
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