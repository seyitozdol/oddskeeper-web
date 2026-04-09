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

export function getMatchDetailHref(
  sourceMatchId?: string | null,
  tab?: string | null,
  returnTo?: string | null
): string | null {
  if (!sourceMatchId || !sourceMatchId.trim()) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("match", sourceMatchId);

  if (tab && tab.trim()) {
    params.set("tab", tab);
  }

  if (returnTo && returnTo.trim()) {
    params.set("returnTo", returnTo);
  }

  return `/dashboard/stats-analysis/football/match-stats/detail?${params.toString()}`;
}