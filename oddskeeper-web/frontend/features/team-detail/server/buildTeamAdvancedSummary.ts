import type {
  TeamAdvancedFormSnapshot,
  TeamAdvancedMetricCard,
  TeamAdvancedRuleCatalogRow,
  TeamAdvancedSummary,
} from "../types";
import type { TeamDetailedMetricRow } from "../types";

type MetricMap = Map<string, TeamDetailedMetricRow>;
type CatalogMap = Map<string, TeamAdvancedRuleCatalogRow>;

function safeNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return Number(value);
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

  if (ranks.length === 0) return 18;
  return Math.max(...ranks, 18);
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

function buildCatalogMap(catalog: TeamAdvancedRuleCatalogRow[]): CatalogMap {
  return new Map(catalog.map((row) => [row.metric_key, row]));
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

      if (score === null || weight <= 0) {
        return null;
      }

      return { score, weight };
    })
    .filter((item): item is { score: number; weight: number } => item !== null);

  if (weighted.length === 0) return null;

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
    reason: `Rank #${row.league_rank ?? "—"} • ${formatPct(row.vs_league_avg_pct)} vs avg`,
    metric_key: row.metric_key,
    metric_label: row.metric_label,
    rank: row.league_rank ?? null,
    vs_avg_pct: row.vs_league_avg_pct ?? null,
    tone,
  };
}

function pickPrimaryStrength(
  rows: TeamDetailedMetricRow[],
  catalog: TeamAdvancedRuleCatalogRow[],
  leagueSize: number
): TeamAdvancedMetricCard {
  const candidates = rows
    .map((row) => {
      const rule = catalog.find((item) => item.metric_key === row.metric_key);
      const score = normalizedScore(row, leagueSize);
      const delta = Math.abs(safeNumber(row.vs_league_avg_pct) ?? 0);

      if (!rule || !rule.include_in_strength_risk || rule.priority_strength >= 999) {
        return null;
      }

      if (score === null || score < 70 || delta < 5) {
        return null;
      }

      return { row, rule, score, delta };
    })
    .filter(
      (item): item is {
        row: TeamDetailedMetricRow;
        rule: TeamAdvancedRuleCatalogRow;
        score: number;
        delta: number;
      } => item !== null
    )
    .sort((a, b) => {
      if (a.rule.priority_strength !== b.rule.priority_strength) {
        return a.rule.priority_strength - b.rule.priority_strength;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.delta - a.delta;
    });

  const selected = candidates[0]?.row;
  return buildMetricCard(
    selected,
    "positive",
    "No clear strength",
    "No metric cleared the strength threshold."
  );
}

function pickPrimaryRisk(
  rows: TeamDetailedMetricRow[],
  catalog: TeamAdvancedRuleCatalogRow[],
  leagueSize: number
): TeamAdvancedMetricCard {
  const candidates = rows
    .map((row) => {
      const rule = catalog.find((item) => item.metric_key === row.metric_key);
      const score = normalizedScore(row, leagueSize);
      const delta = Math.abs(safeNumber(row.vs_league_avg_pct) ?? 0);
      const rank = safeNumber(row.league_rank);

      if (!rule || !rule.include_in_strength_risk || rule.priority_risk >= 999) {
        return null;
      }

      if (score === null || score > 30 || delta < 5) {
        return null;
      }

      if (rank !== null && rank <= 4) {
        return null;
      }

      return { row, rule, score, delta };
    })
    .filter(
      (item): item is {
        row: TeamDetailedMetricRow;
        rule: TeamAdvancedRuleCatalogRow;
        score: number;
        delta: number;
      } => item !== null
    )
    .sort((a, b) => {
      if (a.rule.priority_risk !== b.rule.priority_risk) {
        return a.rule.priority_risk - b.rule.priority_risk;
      }
      if (a.score !== b.score) {
        return a.score - b.score;
      }
      return b.delta - a.delta;
    });

  const selected = candidates[0]?.row;
  return buildMetricCard(
    selected,
    "negative",
    "No major risk",
    "No metric crossed the risk threshold."
  );
}

function pickSplitSignal(
  rows: TeamDetailedMetricRow[],
  catalog: TeamAdvancedRuleCatalogRow[]
): TeamAdvancedMetricCard {
  const candidates = rows
    .map((row) => {
      const rule = catalog.find((item) => item.metric_key === row.metric_key);
      if (!rule || !rule.include_in_split) {
        return null;
      }

      const home = safeNumber(row.home_value);
      const away = safeNumber(row.away_value);

      if (home === null || away === null) {
        return null;
      }

      return {
        row,
        gap: Math.abs(home - away),
        home,
        away,
      };
    })
    .filter(
      (item): item is { row: TeamDetailedMetricRow; gap: number; home: number; away: number } =>
        item !== null
    )
    .sort((a, b) => b.gap - a.gap);

  const selected = candidates[0];

  if (!selected) {
    return buildMetricCard(
      undefined,
      "warning",
      "No strong split",
      "No split metric cleared the signal threshold."
    );
  }

  return {
    label: selected.row.metric_label,
    reason: `Home ${formatNumber(selected.home)} • Away ${formatNumber(
      selected.away
    )} • Gap ${formatNumber(selected.gap)}`,
    metric_key: selected.row.metric_key,
    metric_label: selected.row.metric_label,
    rank: selected.row.league_rank ?? null,
    vs_avg_pct: selected.row.vs_league_avg_pct ?? null,
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
      reason: "Finishing profile is stronger than raw chance volume alone.",
    };
  }

  if ((shots ?? 0) >= 70 && ((shotAccuracy ?? 100) < 50 || (xgPerShot ?? 100) < 50)) {
    return {
      label: "Volume over efficiency",
      reason: "Creates plenty of attempts, but shot quality or execution trails.",
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
    reason: "Built from goals, xG, shots and shot efficiency signals.",
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
    reason: "Driven by passes, accurate passes and pass accuracy profile.",
  };
}

function buildFormIdentity(form?: TeamAdvancedFormSnapshot) {
  if (!form) {
    return {
      label: "Form context unavailable",
      reason: "Recent-form snapshot is not wired yet.",
    };
  }

  const ppgDelta =
    safeNumber(form.last5_points_per_game) !== null &&
    safeNumber(form.season_points_per_game) !== null
      ? (form.last5_points_per_game ?? 0) - (form.season_points_per_game ?? 0)
      : null;

  const gfDeltaPct =
    safeNumber(form.last5_goals_for_per_game) !== null &&
    safeNumber(form.season_goals_for_per_game) !== null &&
    (form.season_goals_for_per_game ?? 0) !== 0
      ? (((form.last5_goals_for_per_game ?? 0) - (form.season_goals_for_per_game ?? 0)) /
          (form.season_goals_for_per_game ?? 1)) *
        100
      : null;

  const gaDeltaPct =
    safeNumber(form.last5_goals_against_per_game) !== null &&
    safeNumber(form.season_goals_against_per_game) !== null &&
    (form.season_goals_against_per_game ?? 0) !== 0
      ? (((form.last5_goals_against_per_game ?? 0) - (form.season_goals_against_per_game ?? 0)) /
          (form.season_goals_against_per_game ?? 1)) *
        100
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
      label: "No trend data",
      reason: "Recent form snapshot is not available yet.",
      metric_key: null,
      metric_label: null,
      rank: null,
      vs_avg_pct: null,
      tone: "accent",
    };
  }

  const candidates = [
    {
      label: "Points",
      delta:
        safeNumber(form.last5_points_per_game) !== null &&
        safeNumber(form.season_points_per_game) !== null
          ? (form.last5_points_per_game ?? 0) - (form.season_points_per_game ?? 0)
          : null,
      reason: `Last 5 PPG ${formatNumber(form.last5_points_per_game)} vs season ${formatNumber(
        form.season_points_per_game
      )}`,
    },
    {
      label: "Goals For",
      delta:
        safeNumber(form.last5_goals_for_per_game) !== null &&
        safeNumber(form.season_goals_for_per_game) !== null
          ? (form.last5_goals_for_per_game ?? 0) - (form.season_goals_for_per_game ?? 0)
          : null,
      reason: `Last 5 GF ${formatNumber(form.last5_goals_for_per_game)} vs season ${formatNumber(
        form.season_goals_for_per_game
      )}`,
    },
  ].filter((item) => item.delta !== null) as {
    label: string;
    delta: number;
    reason: string;
  }[];

  if (candidates.length === 0) {
    return {
      label: "No trend data",
      reason: "Recent form snapshot is not available yet.",
      metric_key: null,
      metric_label: null,
      rank: null,
      vs_avg_pct: null,
      tone: "accent",
    };
  }

  const selected = [...candidates].sort((a, b) => b.delta - a.delta)[0];

  return {
    label: selected.label,
    reason: selected.reason,
    metric_key: null,
    metric_label: selected.label,
    rank: null,
    vs_avg_pct: null,
    tone: "accent",
  };
}

function buildTakeaways(
  strength: TeamAdvancedMetricCard,
  risk: TeamAdvancedMetricCard,
  split: TeamAdvancedMetricCard,
  identities: TeamAdvancedSummary["identity"]
) {
  let coaching =
    "The side should reinforce its best-performing identity while protecting its weakest recurring phase.";
  let opponentPrep =
    "Opponent preparation should focus on the team’s strongest repeatable edge and biggest venue split.";
  let recruitment =
    "Recruitment implication should be derived from the weakest recurring metric cluster.";

  if (strength.metric_key === "team_shots_on_target") {
    coaching =
      "Chance creation is strong; the next layer is turning that volume into more decisive finishing outcomes.";
  } else if (risk.metric_key === "team_offsides") {
    coaching =
      "Final-third timing needs tightening, because attacking output is being wasted by offside frequency.";
  } else if (risk.metric_key === "team_score_against") {
    coaching =
      "Defensive floor is the main coaching priority, because concession control is dragging the profile down.";
  }

  if (split.metric_label) {
    opponentPrep = `${split.metric_label} shows the strongest venue split, so opponent prep should adapt by location.`;
  }

  if (identities.defence.label.toLowerCase().includes("fragile")) {
    recruitment =
      "A stronger ball-winning or protective defensive profile could raise the team’s defensive floor.";
  } else if (identities.build_up.label.toLowerCase().includes("low-control")) {
    recruitment =
      "Build-up quality can be improved with profiles that increase control and clean progression.";
  } else if (risk.metric_key === "team_offsides") {
    recruitment =
      "Front-line profiles with cleaner timing and movement could reduce waste in attacking possessions.";
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
  const catalogMap = buildCatalogMap(catalog);
  void catalogMap;

  const leagueSize = inferLeagueSize(rows);

  const attackScore = getCompositeScore(metricMap, catalog, "attack", leagueSize);
  const defenceScore = getCompositeScore(metricMap, catalog, "defence", leagueSize);
  const buildUpScore = getCompositeScore(metricMap, catalog, "build_up", leagueSize);

  const attackIdentity = buildAttackIdentity(metricMap, attackScore, leagueSize);
  const defenceIdentity = buildDefenceIdentity(metricMap, defenceScore, leagueSize);
  const buildUpIdentity = buildBuildUpIdentity(metricMap, buildUpScore, leagueSize);
  const formIdentity = buildFormIdentity(input.form);

  const strength = pickPrimaryStrength(rows, catalog, leagueSize);
  const risk = pickPrimaryRisk(rows, catalog, leagueSize);
  const split = pickSplitSignal(rows, catalog);
  const trend = buildTrendCard(input.form);

  const takeaways = buildTakeaways(
    strength,
    risk,
    split,
    {
      attack: attackIdentity,
      defence: defenceIdentity,
      build_up: buildUpIdentity,
      form: formIdentity,
    }
  );

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
    positioning: {
      attack: {
        label: "Attack Tier",
        score: attackScore,
        tier: getTier(attackScore),
      },
      defence: {
        label: "Defence Tier",
        score: defenceScore,
        tier: getTier(defenceScore),
      },
      build_up: {
        label: "Build-up Tier",
        score: buildUpScore,
        tier: getTier(buildUpScore),
      },
    },
    takeaways,
  };
}