export const VALID_PLAYER_TABS = [
  "overview",
  "detailed-stats",
  "advanced",
  "match-log",
] as const;

export type ValidPlayerTab = (typeof VALID_PLAYER_TABS)[number];

export const PLAYER_TAB_LABELS: Record<ValidPlayerTab, string> = {
  overview: "Overview",
  "detailed-stats": "Detailed Stats",
  advanced: "Advanced",
  "match-log": "Match Log",
};