export const VALID_MATCH_TABS = [
  "overview",
  "incidents",
  "lineups",
  "team-stats",
] as const;

export const MATCH_TAB_LABEL_KEYS: Record<
  (typeof VALID_MATCH_TABS)[number],
  string
> = {
  overview: "matchDetail.tabOverview",
  incidents: "matchDetail.tabIncidents",
  lineups: "matchDetail.tabLineups",
  "team-stats": "matchDetail.tabTeamStats",
};