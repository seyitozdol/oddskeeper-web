import type { TeamRecentFormRow } from "../types";

export function reverseRecentForm(rows: TeamRecentFormRow[] = []) {
  return [...(rows ?? [])].sort(
    (a, b) => (b.recent_rank ?? 0) - (a.recent_rank ?? 0)
  );
}