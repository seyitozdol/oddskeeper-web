export const VALID_TABS = [
  "team-statistics",
  "squad",
  "fixture",
  "results",
] as const;

export const TEAM_DETAIL_TABS: {
  key: (typeof VALID_TABS)[number];
  label: string;
}[] = [
  { key: "team-statistics", label: "Team Statistics" },
  { key: "squad", label: "Squad" },
  { key: "fixture", label: "Fixture" },
  { key: "results", label: "Results" },
];