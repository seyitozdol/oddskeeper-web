export function getTeamDetailHref(teamSlug?: string | null): string | null {
  if (!teamSlug || !teamSlug.trim()) {
    return null;
  }

  return `/dashboard/stats-analysis/football/team-stats/detail?team=${encodeURIComponent(teamSlug)}`;
}

export function getPlayerDetailHref(playerSlug?: string | null): string | null {
  if (!playerSlug || !playerSlug.trim()) {
    return null;
  }

  return `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(playerSlug)}`;
}