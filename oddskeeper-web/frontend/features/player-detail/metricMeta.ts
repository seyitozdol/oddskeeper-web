// Oyuncu metrikleri için açıklama/yorum i18n anahtarları. Hem detay
// panelinde hem metrik sıralama sayfasında kullanılır.
export type PlayerMetricMetaKeys = {
  shortDescriptionKey: string;
  interpretationKey: string;
};

export const PLAYER_METRIC_META: Record<string, PlayerMetricMetaKeys> = {
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
  shots_total: {
    shortDescriptionKey: "playerDetail.metricDescShotsTotal",
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
