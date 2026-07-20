// Takım metrikleri için açıklama/yorum i18n anahtarları. Hem detay
// panelinde hem metrik sıralama sayfasında kullanılır.
export type MetricMetaKeys = {
  descKey: string;
  interpKey: string;
};

export const TEAM_METRIC_META: Record<string, MetricMetaKeys> = {
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
