export const VALID_PLAYER_TABS = [
  "overview",
  "advanced",
  "benchmarks",
  "match-log",
] as const;

export type ValidPlayerTab = (typeof VALID_PLAYER_TABS)[number];

export const PLAYER_TAB_LABELS: Record<ValidPlayerTab, string> = {
  overview: "Overview",
  advanced: "Advanced",
  benchmarks: "Benchmarks",
  "match-log": "Match Log",
};
