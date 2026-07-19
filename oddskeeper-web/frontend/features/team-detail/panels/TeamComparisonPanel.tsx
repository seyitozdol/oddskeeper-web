"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Translator } from "@/lib/i18n/messages";
import type {
  TeamComparisonResult,
  TeamComparisonSide,
  LeagueAvg,
} from "../server/getTeamComparison";

type Props = {
  initialData: TeamComparisonResult;
  currentTeamSlug: string;
  availableTeams: { slug: string; name: string }[];
};

type SplitKey = "overall" | "home" | "away";

type MetricDef = {
  labelKey: string;
  key: keyof TeamComparisonSide;
  format: "int" | "dec" | "pct";
  lowerBetter?: boolean;
};

const METRIC_GROUPS: { labelKey: string; metrics: MetricDef[] }[] = [
  {
    labelKey: "teamDetail.comparisonGroupGeneral",
    metrics: [
      { labelKey: "teamDetail.comparisonMetricPlayed", key: "played", format: "int" },
      { labelKey: "teamDetail.statPoints", key: "points", format: "int" },
      {
        labelKey: "teamDetail.comparisonMetricPointsPerGame",
        key: "points_per_game",
        format: "dec",
      },
      {
        labelKey: "teamDetail.comparisonMetricWinRate",
        key: "win_rate_pct",
        format: "pct",
      },
      { labelKey: "teamDetail.comparisonMetricWins", key: "wins", format: "int" },
      { labelKey: "teamDetail.comparisonMetricDraws", key: "draws", format: "int" },
      {
        labelKey: "teamDetail.comparisonMetricLosses",
        key: "losses",
        format: "int",
        lowerBetter: true,
      },
    ],
  },
  {
    labelKey: "common.goals",
    metrics: [
      {
        labelKey: "teamDetail.comparisonMetricGoalsFor",
        key: "goals_for",
        format: "int",
      },
      {
        labelKey: "teamDetail.comparisonMetricGoalsAgainst",
        key: "goals_against",
        format: "int",
        lowerBetter: true,
      },
      {
        labelKey: "teamDetail.comparisonMetricGoalDifference",
        key: "goal_difference",
        format: "int",
      },
      {
        labelKey: "teamDetail.comparisonMetricGoalsForPerGame",
        key: "goals_for_per_game",
        format: "dec",
      },
      {
        labelKey: "teamDetail.comparisonMetricGoalsAgainstPerGame",
        key: "goals_against_per_game",
        format: "dec",
        lowerBetter: true,
      },
    ],
  },
];

function fmt(value: number, format: "int" | "dec" | "pct"): string {
  if (format === "int") return Math.round(value).toString();
  if (format === "pct") return value.toFixed(1) + "%";
  return value.toFixed(2);
}

function MetricRow({
  metric,
  teamA,
  teamB,
  leagueAvg,
  t,
}: {
  metric: MetricDef;
  teamA: TeamComparisonSide;
  teamB: TeamComparisonSide;
  leagueAvg: LeagueAvg;
  t: Translator;
}) {
  const valA = teamA[metric.key] as number;
  const valB = teamB[metric.key] as number;
  const avg = leagueAvg[metric.key as keyof LeagueAvg] as number;

  const max = Math.max(valA, valB, avg) * 1.15 || 1;
  const wA = Math.round((valA / max) * 100);
  const wB = Math.round((valB / max) * 100);

  const aWins = metric.lowerBetter ? valA < valB : valA > valB;
  const bWins = metric.lowerBetter ? valB < valA : valB > valA;

  return (
    <div className="grid grid-cols-[1fr_120px_1fr] items-center gap-3 py-2 border-b border-white/5 last:border-0">
      {/* Sol — Takım A */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${wA}%` }}
          />
        </div>
        <span
          className={`text-sm font-medium min-w-[36px] text-right ${
            aWins ? "text-white" : "text-white/50"
          }`}
        >
          {fmt(valA, metric.format)}
        </span>
      </div>

      {/* Orta — metrik adı + lig ort */}
      <div className="text-center">
        <div className="text-[11px] text-white/40 leading-tight">
          {t(metric.labelKey)}
        </div>
        <div className="text-[10px] text-white/25 mt-0.5">
          {t("teamDetail.comparisonLeagueAvgPrefix")} {fmt(avg, metric.format)}
        </div>
      </div>

      {/* Sağ — Takım B */}
      <div className="flex items-center gap-2 flex-row-reverse">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-orange-500 ml-auto"
            style={{ width: `${wB}%`, marginLeft: "auto" }}
          />
        </div>
        <span
          className={`text-sm font-medium min-w-[36px] text-left ${
            bWins ? "text-white" : "text-white/50"
          }`}
        >
          {fmt(valB, metric.format)}
        </span>
      </div>
    </div>
  );
}

export default function TeamComparisonPanel({
  initialData,
  currentTeamSlug,
  availableTeams,
}: Props) {
  const { t } = useI18n();
  const [data, setData] = useState<TeamComparisonResult>(initialData);
  const [splitKey, setSplitKey] = useState<SplitKey>("overall");
  const [opponentSlug, setOpponentSlug] = useState<string>(
    initialData.team_b.team_slug
  );
  const [loading, setLoading] = useState(false);

  async function fetchComparison(newOpponent: string, newSplit: SplitKey) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/team-comparison?a=${currentTeamSlug}&b=${newOpponent}&split=${newSplit}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleOpponentChange(slug: string) {
    setOpponentSlug(slug);
    fetchComparison(slug, splitKey);
  }

  function handleSplitChange(split: SplitKey) {
    setSplitKey(split);
    fetchComparison(opponentSlug, split);
  }

  const { team_a, team_b, league_avg } = data;

  return (
    <div className="space-y-4">
      {/* Kontroller */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={opponentSlug}
          onChange={(e) => handleOpponentChange(e.target.value)}
          className="text-sm bg-[#1a2030] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none"
          style={{ colorScheme: "dark" }}
        >
          {availableTeams
            .filter((team) => team.slug !== currentTeamSlug)
            .map((team) => (
              <option key={team.slug} value={team.slug}>
                {team.name}
              </option>
            ))}
        </select>

        <div className="flex gap-1">
          {(["overall", "home", "away"] as SplitKey[]).map((s) => (
            <button
              key={s}
              onClick={() => handleSplitChange(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                splitKey === s
                  ? "bg-white/10 border-white/20 text-white"
                  : "border-white/10 text-white/40 hover:text-white/70"
              }`}
            >
              {s === "overall"
                ? t("common.all")
                : s === "home"
                  ? t("common.home")
                  : t("common.away")}
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_120px_1fr] items-center gap-3 pb-3 border-b border-white/10">
        <div className="text-sm font-medium text-white">{team_a.team_name}</div>
        <div className="text-center text-xs text-white/30">
          {data.season_label}
        </div>
        <div className="text-sm font-medium text-white text-right">
          {team_b.team_name}
        </div>
      </div>

      {/* Metrik grupları */}
      {loading ? (
        <div className="text-sm text-white/30 py-8 text-center">
          {t("common.loading")}
        </div>
      ) : (
        METRIC_GROUPS.map((group) => (
          <div key={group.labelKey}>
            <div className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">
              {t(group.labelKey)}
            </div>
            <div>
              {group.metrics.map((metric) => (
                <MetricRow
                  key={metric.key}
                  metric={metric}
                  teamA={team_a}
                  teamB={team_b}
                  leagueAvg={league_avg}
                  t={t}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}