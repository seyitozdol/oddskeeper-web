export const VALID_PLAYER_TABS = ["overview", "match-log"] as const;

export const PLAYER_TAB_LABELS: Record<(typeof VALID_PLAYER_TABS)[number], string> = {
  overview: "Overview",
  "match-log": "Match Log",
};