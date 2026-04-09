export const VALID_MATCH_TABS = [
  "overview",
  "incidents",
  "lineups",
  "team-stats",
] as const;

export const MATCH_TAB_LABELS: Record<
  (typeof VALID_MATCH_TABS)[number],
  string
> = {
  overview: "Overview",
  incidents: "Incidents",
  lineups: "Lineups",
  "team-stats": "Team Stats",
};