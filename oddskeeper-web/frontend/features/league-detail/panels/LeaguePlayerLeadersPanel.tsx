"use client";

import { useEffect, useMemo, useState } from "react";
import TeamLink from "@/components/links/TeamLink";

export type LeaguePlayerLeaderboardRow = {
  season_label: string | null;
  competition: string | null;

  player_source_id: string | null;
  player_name: string | null;
  position_code: string | null;
  role_group: string | null;

  team_slug: string | null;
  team_name: string | null;

  metric_key: string;
  metric_label: string;
  category_key: string | null;
  category_label: string | null;

  total_value: number | null;
  per_match_value: number | null;
  per90_value: number | null;

  league_avg: number | null;
  league_rank: number | null;
  vs_league_avg_pct: number | null;

  is_higher_better: boolean | null;
  value_format: string | null;

  sample_matches: number | null;
};

type LeaguePlayerLeadersPanelProps = {
  rows?: LeaguePlayerLeaderboardRow[];
};

type ValueBasis = "per90" | "per_match" | "total";
type RoleFilter = "all" | "starter_core" | "starters" | "substitutes";

type PreparedRow = LeaguePlayerLeaderboardRow & {
  displayValue: number | null;
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
  value: number | null | undefined,
  isHigherBetter: boolean | null | undefined
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  if (value === 0) {
    return "Level";
  }

  const absolute = formatPct(value);

  if (isHigherBetter === false) {
    return value < 0 ? `${absolute} better` : `${absolute} worse`;
  }

  return value > 0 ? `${absolute} better` : `${absolute} worse`;
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
  row: LeaguePlayerLeaderboardRow | undefined,
  basis: ValueBasis
) {
  if (!row) {
    return {
      directionLabel: "Higher better",
      basisLabel: "Per 90",
      titleText: "Selected metric",
      text: "League ranking for the selected player metric.",
    };
  }

  const directionLabel =
    row.is_higher_better === false ? "Lower better" : "Higher better";

  const basisLabel =
    basis === "total" ? "Total" : basis === "per_match" ? "Per match" : "Per 90";

  const key = (row.metric_key ?? "").toLowerCase();
  const label = row.metric_label ?? "Selected metric";

  let titleText = label;
  let text = "League ranking for the selected player metric.";

  if (key.includes("goals")) {
    titleText = "Scoring output";
    text = "Goal contribution through direct scoring volume.";
  } else if (key.includes("assist")) {
    titleText = "Chance conversion support";
    text = "Assists capture direct final-pass output.";
  } else if (key.includes("expected_goals")) {
    titleText = "Chance quality";
    text = "Expected goals estimate the quality of chances taken by the player.";
  } else if (key.includes("shots_on_target")) {
    titleText = "On-target threat";
    text = "Shots on target reflect cleaner attacking execution.";
  } else if (key.includes("shots")) {
    titleText = "Shot volume";
    text = "Shot generation volume by the player.";
  } else if (key.includes("accurate_pass")) {
    titleText = "Completed pass volume";
    text = "Successful passing output generated by the player.";
  } else if (key.includes("pass_accuracy")) {
    titleText = "Passing efficiency";
    text = "Share of completed passes. Higher values indicate cleaner circulation.";
  } else if (key.includes("interception")) {
    titleText = "Passing-lane disruption";
    text = "Interceptions capture defensive reading and lane control.";
  } else if (key.includes("tackle")) {
    titleText = "Direct defensive actions";
    text = "Tackles capture direct ball-winning actions.";
  } else if (key.includes("save")) {
    titleText = "Shot stopping";
    text = "Save volume captures goalkeeper intervention output.";
  } else if (key.includes("appearance")) {
    titleText = "Availability";
    text = "Appearance counts reflect presence and selection continuity.";
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

export function LeaguePlayerLeadersPanel({
  rows = [],
}: LeaguePlayerLeadersPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedMetricKey, setSelectedMetricKey] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<RoleFilter>("starter_core");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [minApps, setMinApps] = useState<number>(5);
  const [basis, setBasis] = useState<ValueBasis>("per90");

  const availableCategories = useMemo(() => {
    const unique = new Map<string, string>();

    rows.forEach((row) => {
      const key = (row.category_key ?? "").trim();
      const label = (row.category_label ?? row.category_key ?? "").trim();
      if (key && !unique.has(key)) {
        unique.set(key, label || key);
      }
    });

    return Array.from(unique.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const categoryScopedRows = useMemo(() => {
    if (selectedCategory === "all") return rows;
    return rows.filter((row) => row.category_key === selectedCategory);
  }, [rows, selectedCategory]);

  const metricOptions = useMemo(() => {
    const unique = new Map<string, { key: string; label: string }>();

    categoryScopedRows.forEach((row) => {
      if (!unique.has(row.metric_key)) {
        unique.set(row.metric_key, {
          key: row.metric_key,
          label: row.metric_label ?? row.metric_key,
        });
      }
    });

    return Array.from(unique.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [categoryScopedRows]);

  useEffect(() => {
    if (!metricOptions.length) {
      setSelectedMetricKey("");
      return;
    }

    const exists = metricOptions.some((option) => option.key === selectedMetricKey);
    if (!exists) {
      setSelectedMetricKey(metricOptions[0].key);
    }
  }, [metricOptions, selectedMetricKey]);

  const selectedMetricRows = useMemo(() => {
    const metricKey = selectedMetricKey || metricOptions[0]?.key;
    if (!metricKey) return [];

    return rows.filter((row) => {
      if (row.metric_key !== metricKey) return false;
      if (selectedCategory !== "all" && row.category_key !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [rows, selectedCategory, selectedMetricKey, metricOptions]);

  const availableTeams = useMemo(() => {
    const unique = new Map<string, string>();

    selectedMetricRows.forEach((row) => {
      const slug = (row.team_slug ?? "").trim();
      const name = (row.team_name ?? "").trim();
      if (slug && !unique.has(slug)) {
        unique.set(slug, name || slug);
      }
    });

    return Array.from(unique.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedMetricRows]);

  const selectedMetricRow = selectedMetricRows[0];

  const totalAllowed = isTotalMeaningful(
    selectedMetricRow?.metric_key,
    selectedMetricRow?.value_format
  );

  const per90Allowed = isPer90Meaningful(selectedMetricRow?.metric_key);

  useEffect(() => {
    if (basis === "total" && !totalAllowed) {
      setBasis(per90Allowed ? "per90" : "per_match");
    }

    if (basis === "per90" && !per90Allowed) {
      setBasis("per_match");
    }
  }, [basis, totalAllowed, per90Allowed]);

  const visibleBasis: ValueBasis =
    basis === "total" && totalAllowed
      ? "total"
      : basis === "per90" && per90Allowed
      ? "per90"
      : "per_match";

  const filteredRows = useMemo(() => {
    const prepared: PreparedRow[] = selectedMetricRows
      .filter((row) => {
        const apps = safeNumber(row.sample_matches) ?? 0;
        if (apps < minApps) return false;

        const role = (row.role_group ?? "").toUpperCase();
        const positionCode = (row.position_code ?? "").toUpperCase();

        if (selectedRole === "starter_core") {
          if (role === "SUBSTITUTE" || positionCode === "SUB") return false;
        }

        if (selectedRole === "starters") {
          if (role === "SUBSTITUTE" || positionCode === "SUB") return false;
        }

        if (selectedRole === "substitutes") {
          if (!(role === "SUBSTITUTE" || positionCode === "SUB")) return false;
        }

        if (selectedTeam !== "all" && row.team_slug !== selectedTeam) {
          return false;
        }

        return true;
      })
      .map((row) => {
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
      })
      .sort((a, b) => {
        const rankA = safeNumber(a.league_rank) ?? 999999;
        const rankB = safeNumber(b.league_rank) ?? 999999;
        if (rankA !== rankB) return rankA - rankB;
        return (a.player_name ?? "").localeCompare(b.player_name ?? "");
      });

    const deduped = new Map<string, PreparedRow>();

    prepared.forEach((row) => {
      const dedupeKey = [
        row.metric_key ?? "",
        row.player_source_id ?? "",
        row.team_slug ?? "",
      ].join("|");

      if (!deduped.has(dedupeKey)) {
        deduped.set(dedupeKey, row);
      }
    });

    return Array.from(deduped.values());
  }, [selectedMetricRows, minApps, selectedRole, selectedTeam, visibleBasis]);

  const leaderRow = filteredRows[0];
  const runnerUpRow = filteredRows[1];
  const leagueAverage = safeNumber(selectedMetricRow?.league_avg);

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

  const metricDefinition = getMetricDefinition(selectedMetricRow, visibleBasis);

  const empty = rows.length === 0 || !selectedMetricRow;

  if (empty) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        No player leaderboard data found for this competition and season.
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
      ? `Leader vs #2: ${formatMetricValue(
          Math.abs(leaderGapToSecond),
          selectedMetricRow.value_format === "pct_1"
            ? "pct_1"
            : selectedMetricRow.value_format
        )}`
      : "Leader vs average";

  return (
    <div className="space-y-3">
      <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[900px]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              Player Leaders
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-medium ${getCategoryTone(
                  selectedMetricRow.category_key
                )}`}
              >
                {selectedMetricRow.category_label ?? "General"}
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

            <div className="mt-1 text-[12px] leading-5 text-white/58">
              {metricDefinition.text}
            </div>
          </div>

          <div className="flex flex-col gap-2 xl:items-end">
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setBasis("per90")}
                  disabled={!per90Allowed}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                    visibleBasis === "per90"
                      ? "border border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                      : per90Allowed
                      ? "text-white/72 hover:bg-white/[0.04]"
                      : "cursor-not-allowed text-white/25"
                  }`}
                >
                  Per 90
                </button>

                <button
                  type="button"
                  onClick={() => setBasis("per_match")}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                    visibleBasis === "per_match"
                      ? "border border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                      : "text-white/72 hover:bg-white/[0.04]"
                  }`}
                >
                  Per Match
                </button>

                <button
                  type="button"
                  onClick={() => setBasis("total")}
                  disabled={!totalAllowed}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                    visibleBasis === "total"
                      ? "border border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                      : totalAllowed
                      ? "text-white/72 hover:bg-white/[0.04]"
                      : "cursor-not-allowed text-white/25"
                  }`}
                >
                  Total
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

            <div className="flex flex-wrap gap-2">
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as RoleFilter)}
                className="min-w-[160px] rounded-lg border border-white/10 bg-[#0d1624] px-3 py-2 text-[12px] text-white outline-none transition focus:border-[#4da2ff]/40"
              >
                <option value="starter_core">Starter core</option>
                <option value="all">All roles</option>
                <option value="starters">Starters only</option>
                <option value="substitutes">Substitutes only</option>
              </select>

              <select
                value={selectedTeam}
                onChange={(event) => setSelectedTeam(event.target.value)}
                className="min-w-[180px] rounded-lg border border-white/10 bg-[#0d1624] px-3 py-2 text-[12px] text-white outline-none transition focus:border-[#4da2ff]/40"
              >
                <option value="all">All teams</option>
                {availableTeams.map((team) => (
                  <option key={team.slug} value={team.slug}>
                    {team.name}
                  </option>
                ))}
              </select>

              <select
                value={String(minApps)}
                onChange={(event) => setMinApps(Number(event.target.value))}
                className="min-w-[140px] rounded-lg border border-white/10 bg-[#0d1624] px-3 py-2 text-[12px] text-white outline-none transition focus:border-[#4da2ff]/40"
              >
                <option value="1">Min apps: 1</option>
                <option value="3">Min apps: 3</option>
                <option value="5">Min apps: 5</option>
                <option value="8">Min apps: 8</option>
                <option value="10">Min apps: 10</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
              selectedCategory === "all"
                ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
            }`}
          >
            All
          </button>

          {availableCategories.map((category) => (
            <button
              key={category.key}
              type="button"
              onClick={() => setSelectedCategory(category.key)}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                selectedCategory === category.key
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
            label="Selected Metric"
            value={selectedMetricRow.metric_label ?? "—"}
            subvalue={selectedMetricRow.category_label ?? "—"}
          />

          <MetricSummaryCard
            label="League Leader"
            value={leaderRow?.player_name ?? "—"}
            subvalue={
              leaderRow
                ? `${formatMetricValue(
                    leaderRow.displayValue,
                    visibleBasis === "total" ? "integer" : selectedMetricRow.value_format
                  )} • ${leaderRow.team_name ?? "—"}`
                : undefined
            }
          />

          <MetricSummaryCard
            label="League Average"
            value={formatMetricValue(leagueAverage, selectedMetricRow.value_format)}
            subvalue={`${metricDefinition.basisLabel} baseline`}
          />

          <MetricSummaryCard
            label="Leader Gap"
            value={leaderGapValue}
            subvalue={leaderGapSubvalue}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-white/10">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-[#0d1624]">
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
              <th className="px-4 py-2 font-medium">Rank</th>
              <th className="px-4 py-2 font-medium">Player</th>
              <th className="px-4 py-2 font-medium">Team</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">
                {visibleBasis === "per90"
                  ? "Per 90"
                  : visibleBasis === "total"
                  ? "Total"
                  : "Per Match"}
              </th>
              <th className="px-4 py-2 font-medium">League Avg</th>
              <th className="px-4 py-2 font-medium">Vs Avg %</th>
              <th className="px-4 py-2 font-medium">Apps</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row, index) => (
              <tr
                key={`${row.metric_key}-${row.player_source_id ?? "na"}-${row.team_slug ?? "na"}-${row.role_group ?? "na"}-${row.league_rank ?? "na"}-${visibleBasis}-${index}`}
                className="border-t border-white/10 text-[13px] text-white/80 transition hover:bg-white/[0.02]"
              >
                <td className="px-4 py-2 whitespace-nowrap font-semibold text-white">
                  {row.league_rank ?? "—"}
                </td>

                <td className="px-4 py-2 min-w-[220px] font-medium text-white">
                  {row.player_name ?? "—"}
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
                    visibleBasis === "total" ? "integer" : row.value_format
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
                  {getDeltaText(row.vs_league_avg_pct, row.is_higher_better)}
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
