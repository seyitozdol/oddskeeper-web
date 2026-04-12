import type {
  TeamAdvancedFormSnapshot,
  TeamAdvancedMetricCard,
  TeamAdvancedRuleCatalogRow,
  TeamAdvancedSummary,
  TeamDetailedMetricRow,
} from "../types";

type MetricMap = Map<string, TeamDetailedMetricRow>;

const SPLIT_PRIORITY = [
  "team_expected_goals",
  "team_shots_on_target",
  "team_shots",
  "team_pass_accuracy_pct",
  "team_passes",
  "team_score_against",
];

function safeNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatPct(value: number | null | undefined): string {
  const n = safeNumber(value);
  if (n === null) return "—";
  return `${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n)}%`;
}

function formatNumber(value: number | null | undefined): string {
  const n = safeNumber(value);
  if (n === null) return "—";
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);
}

function inferLeagueSize(rows: TeamDetailedMetricRow[]): number {
  const ranks = rows
    .map((row) => safeNumber(row.league_rank))
    .filter((value): value is number => value !== null);

  if (!ranks.length) return 18;
  return Math.max(18, ...ranks);
}

function normalizedScore(
  row: TeamDetailedMetricRow | undefined,
  leagueSize: number
): number | null {
  if (!row) return null;
  const rank = safeNumber(row.league_rank);
  if (rank === null) return null;

  const denominator = Math.max(leagueSize - 1, 1);
  return ((leagueSize - rank) / denominator) * 100;
}

function getTier(score: number | null): TeamAdvancedSummary["positioning"]["attack"]["tier"] {
  if (score === null) return "Weak";
  if (score >= 80) return "Elite";
  if (score >= 65) return "Upper Tier";
  if (score >= 50) return "Mid Tier";
  if (score >= 35) return "Below Average";
  return "Weak";
}

function buildMetricMap(rows: TeamDetailedMetricRow[]): MetricMap {
  return new Map(rows.map((row) => [row.metric_key, row]));
}

function getCompositeScore(
  metricMap: MetricMap,
  catalog: TeamAdvancedRuleCatalogRow[],
  group: "attack" | "defence" | "build_up",
  leagueSize: number
): number | null {
  const weighted = catalog
    .filter((rule) => {
      if (!rule.is_active) return false;
      if (group === "attack") return rule.weight_attack > 0;
      if (group === "defence") return rule.weight_defence > 0;
      return rule.weight_build_up > 0;
    })
    .map((rule) => {
      const row = metricMap.get(rule.metric_key);
      const score = normalizedScore(row, leagueSize);
      const weight =
        group === "attack"
          ? rule.weight_attack
          : group === "defence"
          ? rule.weight_defence
          : rule.weight_build_up;

      if (score === null || weight <= 0) return null;

      return { score, weight };
    })
    .filter((item): item is { score: number; weight: number } => item !== null);

  if (!weighted.length) return null;

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return null;

  const weightedScore = weighted.reduce(
    (sum, item) => sum + item.score * item.weight,
    0
  );

  return weightedScore / totalWeight;
}

function buildMetricCard(
  row: TeamDetailedMetricRow | undefined,
  tone: TeamAdvancedMetricCard["tone"],
  fallbackLabel: string,
  fallbackReason: string
): TeamAdvancedMetricCard {
  if (!row) {
    return {
      label: fallbackLabel,
      reason: fallbackReason,
      metric_key: null,
      metric_label: null,
      rank: null,
      vs_avg_pct: null,
      tone,
    };
  }

  return {
    label: row.metric_label,
    reason: `Rank #${row.league_rank ?? "—"} • ${formatPct(
      row.vs_league_avg_pct
    )} vs avg`,
    metric_key: row.metric_key,
    metric_label: row.metric_label,
    rank: safeNumber(row.league_rank),
    vs_avg_pct: safeNumber(row.vs_league_avg_pct),
    tone,
  };
}


function priorityIndex(key: string, order: string[]): number {
  const idx = order.indexOf(key);
  return idx === -1 ? 999 : idx;
}

function isDiscipline(rule: TeamAdvancedRuleCatalogRow) {
  return rule.display_group === "discipline";
}

function isLowSignalStrengthMetricKey(metricKey: string | null | undefined): boolean {
  return /team_(tackles|interceptions|recoveries|clearances|blocks|duels|aerials)/i.test(
    metricKey ?? ""
  );
}

function isLowEdgeDefensiveStrengthMetricKey(
  metricKey: string | null | undefined
): boolean {
  return /team_(score_against|shots_against|shots_on_target_against)/i.test(
    metricKey ?? ""
  );
}

function getMinSplitGap(metricKey: string): number {
  switch (metricKey) {
    case "team_shots_on_target":
      return 2.5;
    case "team_shots":
      return 4.0;
    case "team_expected_goals":
      return 0.8;
    case "team_pass_accuracy_pct":
      return 4.5;
    case "team_passes":
      return 35;
    case "team_score_against":
      return 0.6;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

function getMinSplitRelativeGapPct(metricKey: string): number {
  switch (metricKey) {
    case "team_shots_on_target":
      return 40;
    case "team_shots":
      return 30;
    case "team_expected_goals":
      return 45;
    case "team_pass_accuracy_pct":
      return 0;
    case "team_passes":
      return 10;
    case "team_score_against":
      return 40;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

function isSuppressedSplitMetric(metricKey: string | null | undefined): boolean {
  return metricKey === "team_offsides";
}

function getWeakProfileSplitGapOverride(metricKey: string): number {
  switch (metricKey) {
    case "team_expected_goals":
      return 0.9;
    case "team_shots_on_target":
      return 3.0;
    case "team_shots":
      return 5.0;
    default:
      return 0;
  }
}

function getWeakProfileSplitRelativeOverride(metricKey: string): number {
  switch (metricKey) {
    case "team_expected_goals":
      return 50;
    case "team_shots_on_target":
      return 45;
    case "team_shots":
      return 35;
    default:
      return 0;
  }
}

function buildForcedCompositeRiskCard(
  dimension: { key: string; label: string; score: number }
): TeamAdvancedMetricCard {
  const severityText =
    dimension.score <= 45
      ? "remains materially below a safe level."
      : "is the weakest composite dimension and should be treated as the main downside risk.";

  return {
    label: `${dimension.label} risk`,
    reason: `${dimension.label} is the weakest composite dimension and ${severityText}`,
    metric_key: dimension.key,
    metric_label: dimension.label,
    rank: null,
    vs_avg_pct: null,
    tone: "negative",
  };
}

function pickPrimaryStrength(
  rows: TeamDetailedMetricRow[],
  catalog: TeamAdvancedRuleCatalogRow[],
  leagueSize: number,
  profileLevel: "elite" | "strong" | "mixed" | "weak"
): TeamAdvancedMetricCard {
  const candidates = rows
    .map((row) => {
      const rule = catalog.find((item) => item.metric_key === row.metric_key);
      if (!rule || !rule.is_active) return null;
      if (rule.priority_strength >= 900) return null;
      if (isDiscipline(rule)) return null;

      const score = normalizedScore(row, leagueSize);
      const delta = Math.abs(safeNumber(row.vs_league_avg_pct) ?? 0);
      const rank = safeNumber(row.league_rank);

      if (score === null) return null;

      const lowSignalMetric = isLowSignalStrengthMetricKey(row.metric_key);
      const lowEdgeDefensiveMetric = isLowEdgeDefensiveStrengthMetricKey(row.metric_key);

      let strict =
        !lowSignalMetric &&
        ((score >= 74 && delta >= 4) ||
          (rank !== null && rank <= 2 && delta >= 3 && rule.priority_strength <= 6));

      let fallback =
        !lowSignalMetric &&
        ((score >= 80 && delta >= 3.5 && rule.priority_strength <= 8) ||
          (rank !== null && rank <= 3 && delta >= 3.5 && rule.priority_strength <= 5));

      if (lowEdgeDefensiveMetric && delta < 3) {
        strict = false;
        fallback = false;
      }

      if (profileLevel === "weak" && delta < 4.5) {
        strict = false;
        fallback = false;
      }

      return {
        row,
        rule,
        score,
        delta,
        rank,
        strict,
        fallback,
      };
    })
    .filter(
      (
        item
      ): item is {
        row: TeamDetailedMetricRow;
        rule: TeamAdvancedRuleCatalogRow;
        score: number;
        delta: number;
        rank: number | null;
        strict: boolean;
        fallback: boolean;
      } => item !== null
    );

  const strictCandidates = [...candidates]
    .filter((item) => item.strict)
    .sort((a, b) => {
      if (a.rule.priority_strength !== b.rule.priority_strength) {
        return a.rule.priority_strength - b.rule.priority_strength;
      }
      if ((a.rank ?? 999) !== (b.rank ?? 999)) {
        return (a.rank ?? 999) - (b.rank ?? 999);
      }
      if (b.delta !== a.delta) return b.delta - a.delta;
      return b.score - a.score;
    });

  if (strictCandidates.length > 0) {
    const selected = strictCandidates[0];
    return {
      label: selected.row.metric_label,
      reason: `Material strength • Rank #${selected.row.league_rank ?? "—"} • ${formatPct(
        selected.row.vs_league_avg_pct
      )} vs avg`,
      metric_key: selected.row.metric_key,
      metric_label: selected.row.metric_label,
      rank: selected.rank,
      vs_avg_pct: safeNumber(selected.row.vs_league_avg_pct),
      tone: "positive",
    };
  }

  const fallbackCandidates = [...candidates]
    .filter((item) => item.fallback)
    .sort((a, b) => {
      if (a.rule.priority_strength !== b.rule.priority_strength) {
        return a.rule.priority_strength - b.rule.priority_strength;
      }
      if ((a.rank ?? 999) !== (b.rank ?? 999)) {
        return (a.rank ?? 999) - (b.rank ?? 999);
      }
      return b.delta - a.delta;
    });

  if (fallbackCandidates.length > 0) {
    const selected = fallbackCandidates[0];
    return {
      label: selected.row.metric_label,
      reason: `Best material edge • Rank #${selected.row.league_rank ?? "—"} • ${formatPct(
        selected.row.vs_league_avg_pct
      )} vs avg`,
      metric_key: selected.row.metric_key,
      metric_label: selected.row.metric_label,
      rank: selected.rank,
      vs_avg_pct: safeNumber(selected.row.vs_league_avg_pct),
      tone: "positive",
    };
  }

  return buildMetricCard(
    undefined,
    "positive",
    "No material strength",
    "Low-signal and low-edge positive metrics were suppressed because no metric cleared the strength filter."
  );
}

function pickPrimaryRisk(
  rows: TeamDetailedMetricRow[],
  catalog: TeamAdvancedRuleCatalogRow[],
  leagueSize: number,
  profileLevel: "elite" | "strong" | "mixed" | "weak"
): TeamAdvancedMetricCard {
  const candidates = rows
    .map((row) => {
      const rule = catalog.find((item) => item.metric_key === row.metric_key);
      if (!rule || !rule.is_active) return null;
      if (rule.priority_risk >= 900) return null;

      const score = normalizedScore(row, leagueSize);
      const delta = Math.abs(safeNumber(row.vs_league_avg_pct) ?? 0);
      const rank = safeNumber(row.league_rank);
      if (score === null) return null;

      const disciplineMetric = isDiscipline(rule);

      const strict =
        !disciplineMetric
          ? (score <= 28 && delta >= 2) ||
            (rank !== null && rank >= Math.max(12, leagueSize - 5) && delta >= 2)
          : (rank !== null && rank >= Math.max(12, leagueSize - 5) && delta >= 8);

      const fallback =
        !disciplineMetric &&
        ((score <= 40 && delta >= 2) ||
          (rank !== null && rank >= Math.max(10, leagueSize - 7) && delta >= 1.5));

      return {
        row,
        rule,
        score,
        delta,
        rank,
        strict,
        fallback,
      };
    })
    .filter(
      (
        item
      ): item is {
        row: TeamDetailedMetricRow;
        rule: TeamAdvancedRuleCatalogRow;
        score: number;
        delta: number;
        rank: number | null;
        strict: boolean;
        fallback: boolean;
      } => item !== null
    );

  const strictCandidates = [...candidates]
    .filter((item) => item.strict)
    .sort((a, b) => {
      if (a.rule.priority_risk !== b.rule.priority_risk) {
        return a.rule.priority_risk - b.rule.priority_risk;
      }
      if ((b.rank ?? 0) !== (a.rank ?? 0)) {
        return (b.rank ?? 0) - (a.rank ?? 0);
      }
      if (a.score !== b.score) return a.score - b.score;
      return b.delta - a.delta;
    });

  if (strictCandidates.length > 0) {
    const selected = strictCandidates[0];
    return {
      label: selected.row.metric_label,
      reason: `Primary exposure • Rank #${selected.row.league_rank ?? "—"} • ${formatPct(
        selected.row.vs_league_avg_pct
      )} vs avg`,
      metric_key: selected.row.metric_key,
      metric_label: selected.row.metric_label,
      rank: selected.rank,
      vs_avg_pct: safeNumber(selected.row.vs_league_avg_pct),
      tone: "negative",
    };
  }

  const fallbackCandidates = [...candidates]
    .filter((item) => item.fallback)
    .sort((a, b) => {
      if (a.rule.priority_risk !== b.rule.priority_risk) {
        return a.rule.priority_risk - b.rule.priority_risk;
      }
      if ((b.rank ?? 0) !== (a.rank ?? 0)) {
        return (b.rank ?? 0) - (a.rank ?? 0);
      }
      return a.score - b.score;
    });

  if (fallbackCandidates.length > 0) {
    const selected = fallbackCandidates[0];
    return {
      label: selected.row.metric_label,
      reason: `Most exposed phase • Rank #${selected.row.league_rank ?? "—"} • ${formatPct(
        selected.row.vs_league_avg_pct
      )} vs avg`,
      metric_key: selected.row.metric_key,
      metric_label: selected.row.metric_label,
      rank: selected.rank,
      vs_avg_pct: safeNumber(selected.row.vs_league_avg_pct),
      tone: "negative",
    };
  }

  return buildMetricCard(
    undefined,
    "negative",
    "No major risk",
    profileLevel === "elite" || profileLevel === "strong"
      ? "No material structural weakness was detected."
      : "No single bottom-tier structural weakness dominates the profile."
  );
}

function pickSplitSignal(
  rows: TeamDetailedMetricRow[],
  catalog: TeamAdvancedRuleCatalogRow[],
  profileLevel: "elite" | "strong" | "mixed" | "weak"
): TeamAdvancedMetricCard {
  const candidates = rows
    .map((row) => {
      const rule = catalog.find((item) => item.metric_key === row.metric_key);
      if (!rule || !rule.include_in_split || !rule.is_active) return null;
      if (isSuppressedSplitMetric(row.metric_key)) return null;

      const home = safeNumber(row.home_value);
      const away = safeNumber(row.away_value);
      if (home === null || away === null) return null;

      const gap = Math.abs(home - away);
      const base = Math.max((Math.abs(home) + Math.abs(away)) / 2, 1);
      const relativeGapPct = (gap / base) * 100;
      const splitPriority = priorityIndex(row.metric_key, SPLIT_PRIORITY);

      const baseMinGap = getMinSplitGap(row.metric_key);
      const baseMinRelativeGapPct = getMinSplitRelativeGapPct(row.metric_key);

      const weakProfileMinGap =
        profileLevel === "weak"
          ? Math.max(baseMinGap, getWeakProfileSplitGapOverride(row.metric_key))
          : baseMinGap;

      const weakProfileMinRelativeGapPct =
        profileLevel === "weak"
          ? Math.max(
              baseMinRelativeGapPct,
              getWeakProfileSplitRelativeOverride(row.metric_key)
            )
          : baseMinRelativeGapPct;

      const material =
        splitPriority <= 5 &&
        gap >= weakProfileMinGap &&
        relativeGapPct >= weakProfileMinRelativeGapPct;

      return {
        row,
        home,
        away,
        gap,
        relativeGapPct,
        splitPriority,
        material,
      };
    })
    .filter(
      (
        item
      ): item is {
        row: TeamDetailedMetricRow;
        home: number;
        away: number;
        gap: number;
        relativeGapPct: number;
        splitPriority: number;
        material: boolean;
      } => item !== null
    );

  const materialCandidates = [...candidates]
    .filter((item) => item.material)
    .sort((a, b) => {
      if (a.splitPriority !== b.splitPriority) {
        return a.splitPriority - b.splitPriority;
      }
      if (b.gap !== a.gap) {
        return b.gap - a.gap;
      }
      return b.relativeGapPct - a.relativeGapPct;
    });

  const selected = materialCandidates[0];
  if (!selected) {
    return {
      label: "No material split signal",
      reason:
        "Home and away differences were too small to qualify as a meaningful split signal.",
      metric_key: null,
      metric_label: null,
      rank: null,
      vs_avg_pct: null,
      tone: "warning",
    };
  }

  return {
    label: selected.row.metric_label,
    reason: `Home ${formatNumber(selected.home)} • Away ${formatNumber(
      selected.away
    )} • Gap ${formatNumber(selected.gap)}`,
    metric_key: selected.row.metric_key,
    metric_label: selected.row.metric_label,
    rank: safeNumber(selected.row.league_rank),
    vs_avg_pct: safeNumber(selected.row.vs_league_avg_pct),
    tone: "warning",
  };
}

function buildAttackIdentity(
  metricMap: MetricMap,
  attackScore: number | null,
  leagueSize: number
) {
  const shots = normalizedScore(metricMap.get("team_shots"), leagueSize);
  const sot = normalizedScore(metricMap.get("team_shots_on_target"), leagueSize);
  const xg = normalizedScore(metricMap.get("team_expected_goals"), leagueSize);
  const goals = normalizedScore(metricMap.get("team_goals"), leagueSize);
  const shotAccuracy = normalizedScore(metricMap.get("team_shot_accuracy_pct"), leagueSize);
  const xgPerShot = normalizedScore(metricMap.get("team_xg_per_shot"), leagueSize);

  const highVolumeCount = [shots, sot, xg, goals].filter(
    (value) => value !== null && value >= 70
  ).length;

  if (highVolumeCount >= 3) {
    return {
      label: "High-volume chance creator",
      reason: "Driven by strong shot volume, on-target output and xG profile.",
    };
  }

  if (
    (shotAccuracy ?? 0) >= 70 &&
    (xgPerShot ?? 0) >= 70 &&
    (goals ?? 0) >= 65
  ) {
    return {
      label: "Efficient finisher",
      reason: "Finishing quality is stronger than raw chance volume alone.",
    };
  }

  if ((shots ?? 0) >= 70 && ((shotAccuracy ?? 100) < 50 || (xgPerShot ?? 100) < 50)) {
    return {
      label: "Volume over efficiency",
      reason: "The team gets attempts, but shot quality or execution trails.",
    };
  }

  if ((shots ?? 100) < 45 && (sot ?? 100) < 45 && (xg ?? 100) < 45) {
    return {
      label: "Blunt attack",
      reason: "Chance creation and final-third threat both sit below league pace.",
    };
  }

  return {
    label:
      (attackScore ?? 0) >= 65
        ? "Upper-tier attack"
        : (attackScore ?? 0) >= 50
        ? "Mid-tier attack"
        : "Below-average attack",
    reason: "Built from goals, xG, shots and shot-efficiency signals.",
  };
}

function buildDefenceIdentity(
  metricMap: MetricMap,
  defenceScore: number | null,
  leagueSize: number
) {
  const ga = normalizedScore(metricMap.get("team_score_against"), leagueSize);
  const shotsAgainst = normalizedScore(metricMap.get("team_shots_against"), leagueSize);
  const sotAgainst = normalizedScore(metricMap.get("team_shots_on_target_against"), leagueSize);
  const tackles = normalizedScore(metricMap.get("team_tackles"), leagueSize);
  const interceptions = normalizedScore(metricMap.get("team_interceptions"), leagueSize);

  if ((ga ?? 0) >= 65 && (shotsAgainst ?? 0) >= 60 && (sotAgainst ?? 0) >= 60) {
    return {
      label: "Stable defence",
      reason: "Concession profile stays consistently above league average.",
    };
  }

  if ((tackles ?? 0) >= 65 && (interceptions ?? 0) >= 65 && (ga ?? 0) < 65) {
    return {
      label: "Active but imperfect defence",
      reason: "Defensive activity is strong, but outcome control is not fully elite.",
    };
  }

  if ((ga ?? 100) < 40 && (shotsAgainst ?? 100) < 40 && (sotAgainst ?? 100) < 40) {
    return {
      label: "Fragile defence",
      reason: "The team allows too much shot value and too many clear concessions.",
    };
  }

  return {
    label:
      (defenceScore ?? 0) >= 65
        ? "Upper-tier defence"
        : (defenceScore ?? 0) >= 50
        ? "Mid-tier defence"
        : "Below-average defence",
    reason: "Built from concession metrics plus defensive action signals.",
  };
}

function buildBuildUpIdentity(
  metricMap: MetricMap,
  buildUpScore: number | null,
  leagueSize: number
) {
  const passes = normalizedScore(metricMap.get("team_passes"), leagueSize);
  const accuratePasses = normalizedScore(metricMap.get("team_accurate_pass"), leagueSize);
  const passAccuracy = normalizedScore(metricMap.get("team_pass_accuracy_pct"), leagueSize);

  if ((passes ?? 0) >= 65 && (accuratePasses ?? 0) >= 65 && (passAccuracy ?? 0) >= 65) {
    return {
      label: "Controlled circulation",
      reason: "Passing volume and completion both profile above league average.",
    };
  }

  if ((passes ?? 0) >= 70 && (passAccuracy ?? 100) < 60) {
    return {
      label: "High-volume build-up",
      reason: "The team circulates heavily, but accuracy is less dominant.",
    };
  }

  if ((passAccuracy ?? 100) < 45 && (accuratePasses ?? 100) < 45) {
    return {
      label: "Low-control progression",
      reason: "Ball circulation quality and control both trail the league.",
    };
  }

  return {
    label:
      (buildUpScore ?? 0) >= 65
        ? "Upper-tier build-up"
        : (buildUpScore ?? 0) >= 50
        ? "Mid-tier build-up"
        : "Below-average build-up",
    reason: "Driven by passes, accurate passes and pass-accuracy profile.",
  };
}

function buildFormIdentity(form?: TeamAdvancedFormSnapshot) {
  if (!form) {
    return {
      label: "Form context unavailable",
      reason: "Recent-form snapshot is not wired yet.",
    };
  }

  const seasonPPG = safeNumber(form.season_points_per_game);
  const last5PPG = safeNumber(form.last5_points_per_game);
  const seasonGF = safeNumber(form.season_goals_for_per_game);
  const last5GF = safeNumber(form.last5_goals_for_per_game);
  const seasonGA = safeNumber(form.season_goals_against_per_game);
  const last5GA = safeNumber(form.last5_goals_against_per_game);

  const ppgDelta = seasonPPG !== null && last5PPG !== null ? last5PPG - seasonPPG : null;
  const gfDeltaPct =
    seasonGF !== null && last5GF !== null && seasonGF !== 0
      ? ((last5GF - seasonGF) / seasonGF) * 100
      : null;
  const gaDeltaPct =
    seasonGA !== null && last5GA !== null && seasonGA !== 0
      ? ((last5GA - seasonGA) / seasonGA) * 100
      : null;

  if ((ppgDelta ?? 0) > 0.2 || (gfDeltaPct ?? 0) >= 10) {
    return {
      label: "Improving",
      reason: "Recent output and points pace are running above season baseline.",
    };
  }

  if ((ppgDelta ?? 0) < -0.2 || (gaDeltaPct ?? 0) >= 10) {
    return {
      label: "Negative shift",
      reason: "Recent points pace or goals-against trend has softened vs season baseline.",
    };
  }

  return {
    label: "Stable",
    reason: "Recent form is broadly aligned with season pace.",
  };
}

function buildTrendCard(form?: TeamAdvancedFormSnapshot): TeamAdvancedMetricCard {
  if (!form) {
    return {
      label: "No material trend",
      reason: "Recent form snapshot is not available yet.",
      metric_key: null,
      metric_label: null,
      rank: null,
      vs_avg_pct: null,
      tone: "accent",
    };
  }

  const seasonPPG = safeNumber(form.season_points_per_game);
  const last5PPG = safeNumber(form.last5_points_per_game);
  const seasonGF = safeNumber(form.season_goals_for_per_game);
  const last5GF = safeNumber(form.last5_goals_for_per_game);
  const seasonGA = safeNumber(form.season_goals_against_per_game);
  const last5GA = safeNumber(form.last5_goals_against_per_game);

  const candidates = [
    seasonPPG !== null && last5PPG !== null && seasonPPG !== 0
      ? {
          label: "Points pace",
          deltaPct: ((last5PPG - seasonPPG) / seasonPPG) * 100,
          reason: `Last 5 PPG ${formatNumber(last5PPG)} vs season ${formatNumber(seasonPPG)}`,
          positive: ((last5PPG - seasonPPG) / seasonPPG) * 100 > 0,
        }
      : null,
    seasonGF !== null && last5GF !== null && seasonGF !== 0
      ? {
          label: "Scoring output",
          deltaPct: ((last5GF - seasonGF) / seasonGF) * 100,
          reason: `Last 5 GF ${formatNumber(last5GF)} vs season ${formatNumber(seasonGF)}`,
          positive: ((last5GF - seasonGF) / seasonGF) * 100 > 0,
        }
      : null,
    seasonGA !== null && last5GA !== null && seasonGA !== 0
      ? {
          label: "Defensive control",
          deltaPct: ((seasonGA - last5GA) / seasonGA) * 100,
          reason: `Last 5 GA ${formatNumber(last5GA)} vs season ${formatNumber(seasonGA)}`,
          positive: ((seasonGA - last5GA) / seasonGA) * 100 > 0,
        }
      : null,
  ].filter(
    (
      item
    ): item is {
      label: string;
      deltaPct: number;
      reason: string;
      positive: boolean;
    } => item !== null
  );

  if (!candidates.length) {
    return {
      label: "No material trend",
      reason: "Recent form snapshot is not available yet.",
      metric_key: null,
      metric_label: null,
      rank: null,
      vs_avg_pct: null,
      tone: "accent",
    };
  }

  const selected = [...candidates].sort(
    (a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct)
  )[0];

  if (Math.abs(selected.deltaPct) < 5) {
    return {
      label: "No material trend",
      reason: "Last 5 performance is broadly aligned with the season baseline.",
      metric_key: null,
      metric_label: null,
      rank: null,
      vs_avg_pct: null,
      tone: "accent",
    };
  }

  const tone: TeamAdvancedMetricCard["tone"] = selected.positive
    ? "accent"
    : "negative";

  const wording = selected.positive
    ? "Meaningful improvement"
    : "Meaningful drop-off";

  return {
    label: selected.label,
    reason: `${selected.reason} • ${wording} of ${formatPct(Math.abs(selected.deltaPct))}`,
    metric_key: null,
    metric_label: selected.label,
    rank: null,
    vs_avg_pct: selected.deltaPct,
    tone,
  };
}

function buildTierItem(
  label: string,
  score: number | null
): TeamAdvancedSummary["positioning"]["attack"] {
  const tier = getTier(score);

  const reason =
    tier === "Elite"
      ? "Top-tier league profile."
      : tier === "Upper Tier"
      ? "Clearly above league average."
      : tier === "Mid Tier"
      ? "Competitive but not dominant."
      : tier === "Below Average"
      ? "Below league average profile."
      : "Bottom-tier profile right now.";

  return {
    label,
    score,
    tier,
    reason,
  };
}

function buildTakeaways(input: {
  strength: TeamAdvancedMetricCard;
  risk: TeamAdvancedMetricCard;
  split: TeamAdvancedMetricCard;
  trend: TeamAdvancedMetricCard;
  identities: TeamAdvancedSummary["identity"];
  positioning: TeamAdvancedSummary["positioning"];
}) {
  const { strength, risk, split, trend, identities, positioning } = input;

  const attackScore = positioning.attack.score ?? 0;
  const defenceScore = positioning.defence.score ?? 0;
  const buildUpScore = positioning.build_up.score ?? 0;

  const isEliteProfile =
    attackScore >= 80 && defenceScore >= 80 && buildUpScore >= 80;

  const isStrongProfile =
    attackScore >= 65 && defenceScore >= 65 && buildUpScore >= 60;

  const isWeakProfile =
    attackScore < 40 || defenceScore < 40 || buildUpScore < 40;

  const noMajorRisk = risk.metric_key === null;
  const hasNegativeTrend =
    trend.tone === "negative" ||
    identities.form.label.toLowerCase().includes("negative");

  const splitText = split.metric_label
    ? `${split.metric_label} shows the clearest venue split`
    : "Venue effects are limited";

  let coaching = "The team should focus on strengthening its weakest recurring phase.";
  let opponentPrep = `${splitText}, so opponent prep should adapt accordingly.`;
  let recruitment =
    "Recruitment should target the weakest structural phase in the current profile.";

  if (isEliteProfile) {
    if (hasNegativeTrend) {
      coaching =
        "Core team structure remains elite, but recent regression should be corrected before it starts eroding results.";
    } else {
      coaching =
        "The main coaching priority is preserving elite balance rather than forcing unnecessary structural change.";
    }

    if (split.metric_label) {
      opponentPrep = `${split.metric_label} shows the clearest venue split, so match planning should adjust more aggressively by location.`;
    } else {
      opponentPrep =
        "Opponent prep should focus less on weaknesses and more on disrupting the team’s strongest repeatable patterns.";
    }

    if (noMajorRisk) {
      recruitment =
        "No urgent structural weakness stands out; squad decisions should protect the team’s current balance rather than chase unnecessary change.";
    } else if (risk.metric_key === "team_offsides") {
      recruitment =
        "Front-line profiles with cleaner timing and movement could reduce waste without changing the team’s attacking identity.";
    } else if (risk.metric_key === "team_score_against") {
      recruitment =
        "Even strong profiles benefit from preserving defensive control, so support pieces that protect the back line remain valuable.";
    }

    return {
      coaching,
      opponent_prep: opponentPrep,
      recruitment,
    };
  }

  if (isStrongProfile) {
    if (risk.metric_key === "team_offsides") {
      coaching =
        "Chance creation is already strong, but final-third timing needs tightening because offside frequency is wasting attacking possessions.";
    } else if (risk.metric_key === "team_score_against") {
      coaching =
        "The team profile is strong overall, but defensive control needs attention before concession softness starts dragging results.";
    } else if (hasNegativeTrend) {
      coaching =
        "The underlying profile is serviceable, but recent momentum has softened and should be corrected before it deepens.";
    } else {
      coaching =
        "The priority is turning a strong baseline into a more complete profile by sharpening the weakest non-elite phase.";
    }

    if (split.metric_label) {
      opponentPrep = `${split.metric_label} shows the clearest venue split, so location-specific planning should be part of match prep.`;
    } else {
      opponentPrep =
        "Opponent prep should focus on disrupting the team’s best-performing phase rather than chasing marginal weaknesses.";
    }

    if (risk.metric_key === "team_offsides") {
      recruitment =
        "Cleaner attacking timing and movement profiles could convert existing chance volume into more efficient final-third output.";
    } else if (risk.metric_key === "team_pass_accuracy_pct") {
      recruitment =
        "Build-up can become more resilient with profiles that increase control, retention and cleaner circulation under pressure.";
    } else if (risk.metric_key === "team_score_against") {
      recruitment =
        "The strongest improvement path is protecting defensive control with better shielding or more stable defensive support.";
    } else {
      recruitment =
        "Recruitment should target the weakest structural phase without disrupting the team’s existing strengths.";
    }

    return {
      coaching,
      opponent_prep: opponentPrep,
      recruitment,
    };
  }

  if (isWeakProfile) {
    if (
      identities.attack.label === "Blunt attack" &&
      identities.build_up.label === "Low-control progression"
    ) {
      coaching =
        "Chance creation is weak and build-up quality is also below league pace, so possessions are breaking before the final third.";
    } else if (risk.metric_key === "team_score_against") {
      coaching =
        "The defensive floor is too low right now, so stabilising concession control should come before more ambitious upgrades.";
    } else if (risk.metric_key === "team_offsides") {
      coaching =
        "Attacking possessions are already limited, so wasted final-third timing becomes even more damaging in a weak overall profile.";
    } else {
      coaching =
        "The team needs to raise its weakest structural phase first, because isolated strengths are not strong enough to carry the overall profile.";
    }

    if (split.metric_label) {
      opponentPrep = `${split.metric_label} shows the clearest venue split, so match planning should lean harder into the better-context version of the team.`;
    } else {
      opponentPrep =
        "Opponent prep should be pragmatic, because the team currently lacks a strong enough profile to force its identity everywhere.";
    }

    if (identities.build_up.label === "Low-control progression") {
      recruitment =
        "Build-up quality can be improved with profiles that increase control, retention and cleaner progression.";
    } else if (identities.defence.label.toLowerCase().includes("fragile")) {
      recruitment =
        "The clearest squad need is defensive protection, because the current structure concedes too much value.";
    } else {
      recruitment =
        "Recruitment should prioritise the phase where the team is currently falling furthest below league pace.";
    }

    return {
      coaching,
      opponent_prep: opponentPrep,
      recruitment,
    };
  }

  if (risk.metric_key === "team_offsides") {
    coaching =
      "Final-third timing needs tightening because offside frequency is wasting attacking possessions.";
  } else if (risk.metric_key === "team_score_against") {
    coaching =
      "Defensive control is the main coaching priority because concession management is limiting the team’s ceiling.";
  } else if (strength.metric_key === "team_shots_on_target") {
    coaching =
      "Shot creation is the clearest positive edge, so game plans should keep feeding the existing chance-generation structure.";
  } else if (hasNegativeTrend) {
    coaching =
      "The underlying profile is serviceable, but recent momentum has softened and should be corrected before it deepens.";
  } else {
    coaching =
      "The next step is turning a mixed profile into a clearer identity by upgrading the weakest recurring phase.";
  }

  if (split.metric_label) {
    opponentPrep = `${split.metric_label} shows the clearest venue split, so match planning should be adjusted by location.`;
  } else {
    opponentPrep =
      "Venue effects look limited, so opponent prep should focus more on baseline style than context changes.";
  }

  if (identities.build_up.label === "Low-control progression") {
    recruitment =
      "Build-up quality can be improved with profiles that increase control and cleaner progression.";
  } else if (risk.metric_key === "team_offsides") {
    recruitment =
      "Front-line profiles with cleaner timing and movement could reduce waste in attacking possessions.";
  } else if (risk.metric_key === "team_score_against") {
    recruitment =
      "The profile would benefit from stronger defensive support to raise the team’s floor.";
  }

  return {
    coaching,
    opponent_prep: opponentPrep,
    recruitment,
  };
}


export function buildTeamAdvancedSummary(input: {
  rows: TeamDetailedMetricRow[];
  catalog: TeamAdvancedRuleCatalogRow[];
  form?: TeamAdvancedFormSnapshot;
}): TeamAdvancedSummary {
  const rows = input.rows ?? [];
  const catalog = input.catalog.filter((item) => item.is_active);

  const metricMap = buildMetricMap(rows);
  const leagueSize = inferLeagueSize(rows);

  const attackScore = getCompositeScore(metricMap, catalog, "attack", leagueSize);
  const defenceScore = getCompositeScore(metricMap, catalog, "defence", leagueSize);
  const buildUpScore = getCompositeScore(metricMap, catalog, "build_up", leagueSize);

  const positioning = {
    attack: buildTierItem("Attack Tier", attackScore),
    defence: buildTierItem("Defence Tier", defenceScore),
    build_up: buildTierItem("Build-up Tier", buildUpScore),
  };

  const attackScoreForProfile = attackScore ?? 0;
  const defenceScoreForProfile = defenceScore ?? 0;
  const buildUpScoreForProfile = buildUpScore ?? 0;

  const profileLevel: "elite" | "strong" | "mixed" | "weak" =
    attackScoreForProfile >= 80 &&
    defenceScoreForProfile >= 80 &&
    buildUpScoreForProfile >= 80
      ? "elite"
      : attackScoreForProfile >= 65 &&
        defenceScoreForProfile >= 65 &&
        buildUpScoreForProfile >= 60
      ? "strong"
      : attackScoreForProfile < 40 ||
        defenceScoreForProfile < 40 ||
        buildUpScoreForProfile < 40
      ? "weak"
      : "mixed";

  const attackIdentity = buildAttackIdentity(metricMap, attackScore, leagueSize);
  const defenceIdentity = buildDefenceIdentity(metricMap, defenceScore, leagueSize);
  const buildUpIdentity = buildBuildUpIdentity(metricMap, buildUpScore, leagueSize);
  const formIdentity = buildFormIdentity(input.form);

  const strength = pickPrimaryStrength(rows, catalog, leagueSize, profileLevel);
  const baseRisk = pickPrimaryRisk(rows, catalog, leagueSize, profileLevel);
  const split = pickSplitSignal(rows, catalog, profileLevel);
  const trend = buildTrendCard(input.form);

  const compositeDimensions = [
    {
      key: "attack",
      label: "Attack",
      score: attackScoreForProfile,
    },
    {
      key: "defence",
      label: "Defence",
      score: defenceScoreForProfile,
    },
    {
      key: "build_up",
      label: "Build-up",
      score: buildUpScoreForProfile,
    },
  ];

  const worstCompositeDimension = [...compositeDimensions].sort(
    (a, b) => a.score - b.score
  )[0];

  const identityIsNegativeHeuristic =
    attackIdentity.label === "Blunt attack" ||
    defenceIdentity.label === "Fragile defence" ||
    buildUpIdentity.label === "Low-control progression";

  const shouldForceRisk =
    baseRisk.metric_key === null &&
    (profileLevel === "weak" ||
      identityIsNegativeHeuristic ||
      worstCompositeDimension.score <= 57);

  const risk =
    shouldForceRisk && worstCompositeDimension
      ? buildForcedCompositeRiskCard(worstCompositeDimension)
      : baseRisk;

  const takeaways = buildTakeaways({
    strength,
    risk,
    split,
    trend,
    identities: {
      attack: attackIdentity,
      defence: defenceIdentity,
      build_up: buildUpIdentity,
      form: formIdentity,
    },
    positioning,
  });

  return {
    identity: {
      attack: attackIdentity,
      defence: defenceIdentity,
      build_up: buildUpIdentity,
      form: formIdentity,
    },
    highlights: {
      strength,
      risk,
      trend,
      split,
    },
    positioning,
    takeaways,
  };
}
