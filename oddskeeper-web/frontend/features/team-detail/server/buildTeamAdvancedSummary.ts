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
  "team_offsides",
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

      const lowSignal = LOW_SIGNAL_STRENGTH_RE.test(
        `${row.metric_key} ${row.metric_label}`
      );

      const clearsMateriality = lowSignal
        ? score >= LOW_SIGNAL_STRENGTH_MIN_SCORE &&
          (delta >= LOW_SIGNAL_STRENGTH_MIN_EDGE || (rank !== null && rank <= 2))
        : score >= MATERIAL_STRENGTH_MIN_SCORE &&
          (delta >= MATERIAL_STRENGTH_MIN_EDGE || (rank !== null && rank <= 3));

      const profileBoost =
        !lowSignal &&
        (profileLevel === "elite" || profileLevel === "strong") &&
        rank !== null &&
        rank <= 3 &&
        score >= 72;

      return {
        row,
        rule,
        score,
        delta,
        rank,
        lowSignal,
        material: clearsMateriality || profileBoost,
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
        lowSignal: boolean;
        material: boolean;
      } => item !== null
    );

  const materialCandidates = [...candidates]
    .filter((item) => item.material)
    .sort((a, b) => {
      if (a.lowSignal !== b.lowSignal) {
        return a.lowSignal ? 1 : -1;
      }
      if (a.rule.priority_strength !== b.rule.priority_strength) {
        return a.rule.priority_strength - b.rule.priority_strength;
      }
      if ((a.rank ?? 999) !== (b.rank ?? 999)) {
        return (a.rank ?? 999) - (b.rank ?? 999);
      }
      if (b.score !== a.score) return b.score - a.score;
      return b.delta - a.delta;
    });

  if (materialCandidates.length > 0) {
    const selected = materialCandidates[0];
    const prefix =
      profileLevel === "elite" || profileLevel === "strong"
        ? "Flagship strength"
        : "Primary strength";

    return {
      label: selected.row.metric_label,
      reason: `${prefix} • Rank #${selected.row.league_rank ?? "—"} • ${formatPct(
        selected.row.vs_league_avg_pct
      )} vs avg`,
      metric_key: selected.row.metric_key,
      metric_label: selected.row.metric_label,
      rank: selected.rank,
      vs_avg_pct: safeNumber(selected.row.vs_league_avg_pct),
      tone: "positive",
    };
  }

  return {
    label: "No material strength",
    reason:
      "Low-signal defensive activity metrics were suppressed and no positive edge cleared the strength filter.",
    metric_key: null,
    metric_label: null,
    rank: null,
    vs_avg_pct: null,
    tone: "warning",
  };
}

function pickPrimaryRisk(
  rows: TeamDetailedMetricRow[],
  catalog: TeamAdvancedRuleCatalogRow[],
  leagueSize: number,
  profileLevel: "elite" | "strong" | "mixed" | "weak",
  attackScore: number | null,
  defenceScore: number | null,
  buildUpScore: number | null
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

  const compositeDimensions = [
    attackScore !== null
      ? { key: "composite_attack", label: "Attack", score: attackScore }
      : null,
    defenceScore !== null
      ? { key: "composite_defence", label: "Defence", score: defenceScore }
      : null,
    buildUpScore !== null
      ? { key: "composite_build_up", label: "Build-up", score: buildUpScore }
      : null,
  ].filter(
    (
      item
    ): item is { key: string; label: string; score: number } => item !== null
  );

  const worstCompositeDimension = [...compositeDimensions].sort(
    (a, b) => a.score - b.score
  )[0];

  const weakCompositeTier =
    profileLevel === "weak" || (worstCompositeDimension?.score ?? 100) <= 45;

  const identityIsNegativeHeuristic =
    (worstCompositeDimension?.score ?? 100) <= 48 &&
    profileLevel !== "strong" &&
    profileLevel !== "elite";

  const shouldForceRisk =
    !!worstCompositeDimension &&
    (weakCompositeTier ||
      identityIsNegativeHeuristic ||
      worstCompositeDimension.score <= FORCED_RISK_MAX_COMPOSITE);

  if (shouldForceRisk && worstCompositeDimension) {
    const severityText =
      worstCompositeDimension.score <= 45
        ? "materially below a safe level"
        : "the clearest structural downside";

    return {
      label: `${worstCompositeDimension.label} risk`,
      reason: `${worstCompositeDimension.label} is the weakest composite dimension and remains ${severityText}.`,
      metric_key: worstCompositeDimension.key,
      metric_label: worstCompositeDimension.label,
      rank: null,
      vs_avg_pct: null,
      tone: "negative",
    };
  }

  return {
    label: "No material risk",
    reason: "No downside signal cleared the risk filter.",
    metric_key: null,
    metric_label: null,
    rank: null,
    vs_avg_pct: null,
    tone: "accent",
  };
}

function pickSplitSignal(
  rows: TeamDetailedMetricRow[],
  catalog: TeamAdvancedRuleCatalogRow[]
): TeamAdvancedMetricCard {
  const absoluteGapFloor = (metricKey: string): number => {
    switch (metricKey) {
      case "team_expected_goals":
        return 0.35;
      case "team_shots_on_target":
        return 1;
      case "team_shots":
        return 2;
      case "team_pass_accuracy_pct":
        return 4;
      case "team_passes":
        return 40;
      case "team_score_against":
        return 0.4;
      case "team_offsides":
        return 0.6;
      default:
        return 1;
    }
  };

  const candidates = rows
    .map((row) => {
      const rule = catalog.find((item) => item.metric_key === row.metric_key);
      if (!rule || !rule.include_in_split || !rule.is_active) return null;

      const home = safeNumber(row.home_value);
      const away = safeNumber(row.away_value);
      if (home === null || away === null) return null;

      const gap = Math.abs(home - away);
      const base = Math.max((Math.abs(home) + Math.abs(away)) / 2, 1);
      const relativeGapPct = (gap / base) * 100;
      const splitPriority = priorityIndex(row.metric_key, SPLIT_PRIORITY);
      const minGap = absoluteGapFloor(row.metric_key);

      const material =
        ((relativeGapPct >= 20 && splitPriority <= 2) ||
          (relativeGapPct >= 22 && splitPriority <= 4) ||
          (relativeGapPct >= 28 && splitPriority <= 6) ||
          (row.metric_key === "team_passes" && gap >= 40) ||
          (row.metric_key === "team_pass_accuracy_pct" && gap >= 4)) &&
        gap >= minGap &&
        gap >= MATERIAL_SPLIT_MIN_MAGNITUDE / 10;

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

type LooseTakeawayCandidate = Record<string, unknown>;

const LOW_SIGNAL_STRENGTH_RE =
  /(tackles?|interceptions?|recoveries?|ball recoveries?|clearances?|blocks?|duels?|aerials?)/i;

const MATERIAL_STRENGTH_MIN_SCORE = 68;
const MATERIAL_STRENGTH_MIN_EDGE = 8;

const LOW_SIGNAL_STRENGTH_MIN_SCORE = 78;
const LOW_SIGNAL_STRENGTH_MIN_EDGE = 14;

const MATERIAL_SPLIT_MIN_MAGNITUDE = 10;
const FORCED_RISK_MAX_COMPOSITE = 57;

function readNumberFromCandidate(
  candidate: LooseTakeawayCandidate | null | undefined,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = candidate?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function readTextFromCandidate(
  candidate: LooseTakeawayCandidate | null | undefined,
  keys: string[],
): string {
  for (const key of keys) {
    const value = candidate?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function getCandidateScore(
  candidate: LooseTakeawayCandidate | null | undefined,
): number {
  return (
    readNumberFromCandidate(candidate, [
      "score",
      "signalScore",
      "strengthScore",
      "riskScore",
      "splitScore",
      "sortScore",
      "priority",
    ]) ?? 0
  );
}

function getCandidateEdge(
  candidate: LooseTakeawayCandidate | null | undefined,
): number {
  return Math.abs(
    readNumberFromCandidate(candidate, [
      "edge",
      "delta",
      "gap",
      "difference",
      "diff",
      "valueGap",
      "homeAwayGap",
      "absoluteDiff",
      "zScore",
      "pctDiff",
    ]) ??
      readNumberFromCandidate(candidate, [
        "score",
        "signalScore",
        "strengthScore",
        "riskScore",
        "splitScore",
        "sortScore",
      ]) ??
      0,
  );
}

function isLowSignalStrengthCandidate(
  candidate: LooseTakeawayCandidate | null | undefined,
): boolean {
  const haystack = [
    readTextFromCandidate(candidate, ["metricKey", "key"]),
    readTextFromCandidate(candidate, [
      "metricLabel",
      "label",
      "title",
      "headline",
      "name",
    ]),
    readTextFromCandidate(candidate, ["description", "body", "reason"]),
  ]
    .join(" ")
    .trim();

  return LOW_SIGNAL_STRENGTH_RE.test(haystack);
}

function pickMaterialStrengthCandidate<T extends LooseTakeawayCandidate>(
  candidates: T[],
): T | null {
  return (
    [...candidates]
      .sort(
        (a, b) =>
          getCandidateScore(b) +
          getCandidateEdge(b) -
          (getCandidateScore(a) + getCandidateEdge(a)),
      )
      .find((candidate) => {
        const lowSignal = isLowSignalStrengthCandidate(candidate);
        const minScore = lowSignal
          ? LOW_SIGNAL_STRENGTH_MIN_SCORE
          : MATERIAL_STRENGTH_MIN_SCORE;
        const minEdge = lowSignal
          ? LOW_SIGNAL_STRENGTH_MIN_EDGE
          : MATERIAL_STRENGTH_MIN_EDGE;

        return (
          getCandidateScore(candidate) >= minScore &&
          getCandidateEdge(candidate) >= minEdge
        );
      }) ?? null
  );
}

function pickMaterialSplitCandidate<T extends LooseTakeawayCandidate>(
  candidates: T[],
): T | null {
  return (
    [...candidates]
      .sort((a, b) => getCandidateEdge(b) - getCandidateEdge(a))
      .find(
        (candidate) =>
          getCandidateEdge(candidate) >= MATERIAL_SPLIT_MIN_MAGNITUDE,
      ) ?? null
  );
}

function makeNeutralTakeawayCard(
  seed: LooseTakeawayCandidate | null | undefined,
  title: string,
  description: string,
): any {
  return {
    ...(seed ?? {}),
    title,
    headline: title,
    label: title,
    description,
    body: description,
    reason: description,
    tone: "neutral",
    sentiment: "neutral",
    variant: "neutral",
    metricKey: null,
    metricLabel: null,
    forced: false,
  };
}

function buildForcedCompositeRiskCard(
  seed: LooseTakeawayCandidate | null | undefined,
  dimension: { key: string; label: string; score: number },
  profileLevel: string,
): any {
  const title = `${dimension.label} risk`;

  const description =
    dimension.score <= 45
      ? `${dimension.label} is the weakest composite area and is materially below a safe level.`
      : `${dimension.label} is the weakest composite area and should be treated as the main downside risk.`;

  return {
    ...(seed ?? {}),
    title,
    headline: title,
    label: title,
    description,
    body: description,
    reason: description,
    tone: "negative",
    sentiment: "negative",
    variant: "negative",
    metricKey: dimension.key,
    metricLabel: dimension.label,
    score: dimension.score,
    forced: true,
    profileLevel,
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
  const risk = pickPrimaryRisk(
    rows,
    catalog,
    leagueSize,
    profileLevel,
    attackScore,
    defenceScore,
    buildUpScore
  );
  const split = pickSplitSignal(rows, catalog);
  const trend = buildTrendCard(input.form);

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