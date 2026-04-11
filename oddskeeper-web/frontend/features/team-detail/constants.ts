export const VALID_TABS = [
  "team-statistics",
  "detailed-stats",
  "advanced",
  "results",
  "squad",
  "fixture",
] as const;

export type ValidTab = (typeof VALID_TABS)[number];

export const TAB_LABELS: Record<ValidTab, string> = {
  "team-statistics": "Team Statistics",
  "detailed-stats": "Detailed Stats",
  advanced: "Advanced",
  results: "Results",
  squad: "Squad",
  fixture: "Fixture",
};

export const TEAM_DETAIL_TABS = VALID_TABS.map((key) => ({
  key,
  label: TAB_LABELS[key],
}));