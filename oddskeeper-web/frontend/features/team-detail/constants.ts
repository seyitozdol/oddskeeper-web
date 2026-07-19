export const VALID_TABS = [
  "team-statistics",
  "detailed-stats",
  "advanced",
  "season-history",
  "results",
  "squad",
  "fixture",
  "comparison",
] as const;

export type ValidTab = (typeof VALID_TABS)[number];

export const TAB_LABEL_KEYS: Record<ValidTab, string> = {
  "team-statistics": "teamDetail.tabTeamStatistics",
  "detailed-stats": "teamDetail.tabDetailedStats",
  advanced: "teamDetail.tabAdvanced",
  "season-history": "teamDetail.tabSeasonHistory",
  results: "teamDetail.tabResults",
  squad: "teamDetail.tabSquad",
  fixture: "teamDetail.tabFixture",
  comparison: "teamDetail.tabComparison",
};

export const TEAM_DETAIL_TABS = VALID_TABS.map((key) => ({
  key,
  labelKey: TAB_LABEL_KEYS[key],
}));
