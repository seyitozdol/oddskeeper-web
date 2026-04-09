export function getTeamLogoPath(teamSlug?: string | null) {
  if (!teamSlug) {
    return "";
  }

  return `/images/football_logos/${teamSlug}.png`;
}