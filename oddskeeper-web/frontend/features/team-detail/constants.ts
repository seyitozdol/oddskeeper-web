import type { ValidTab } from "./types";

export const TEAM_DETAIL_TABS: { key: ValidTab; label: string }[] = [
  { key: "team-statistics", label: "Team Statistics" },
  { key: "squad", label: "Squad" },
  { key: "fixture", label: "Fixture" },
  { key: "results", label: "Results" },
];