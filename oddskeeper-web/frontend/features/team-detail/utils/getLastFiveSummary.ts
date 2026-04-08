import type { TeamRecentFormRow } from "../types";

export function getLastFiveSummary(rows: TeamRecentFormRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.points += row.result_points ?? 0;
      acc.goalsFor += row.team_score ?? 0;
      acc.goalsAgainst += row.opponent_score ?? 0;
      return acc;
    },
    { points: 0, goalsFor: 0, goalsAgainst: 0 }
  );
}