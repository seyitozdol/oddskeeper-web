import { slugifyTeamName } from "@/lib/football-teams";
import {
  getTslLeaderboard,
  getTslPlayerCatalog,
} from "@/features/tsl/server/queries";
import { getPlayerAssets } from "@/features/tsl/server/resmi";
import type { TslLeaderRow, TslMetricOption } from "@/features/tsl/types";

// Takim detayindaki "Player Stats" sekmesi: secili metrik + sezon icin
// takimin oyuncularini liglik leaderboard'dan suzer (Player Rankings ile
// ayni veri, takim-kapsamli). Sezonlar tsl_ss veri sezonlaridir.

export const TEAM_PLAYER_STATS_SEASONS = ["2026/2027", "2025/2026", "2024/2025"];

// Leaderboard takim adi (SofaScore) -> football slug esleme: ad slug'i ya da
// gitgide kisalan on-ekleri (Amed Sportif Faaliyetler -> amed).
function slugMatches(teamName: string | null, teamSlug: string): boolean {
  if (!teamName) return false;
  const base = slugifyTeamName(teamName);
  if (base === teamSlug) return true;
  const parts = base.split("-").filter(Boolean);
  for (let k = parts.length - 1; k >= 1; k--) {
    if (parts.slice(0, k).join("-") === teamSlug) return true;
  }
  return false;
}

export type TeamPlayerStatRow = TslLeaderRow & {
  photo: string | null;
  nationality: string | null;
  href: string | null;
};

export type TeamPlayerStatsBundle = {
  season: string;
  seasons: string[];
  catalog: TslMetricOption[];
  metricKey: string;
  metric: TslMetricOption | null;
  rows: TeamPlayerStatRow[];
};

export async function getTeamPlayerStats(
  teamSlug: string,
  requestedSeason?: string | null,
  requestedMetric?: string | null
): Promise<TeamPlayerStatsBundle> {
  const seasons = TEAM_PLAYER_STATS_SEASONS;
  let season = seasons.includes(requestedSeason ?? "")
    ? (requestedSeason as string)
    : seasons[0];

  let catalog = await getTslPlayerCatalog(season);
  if (!catalog.length) catalog = await getTslPlayerCatalog("2025/2026");
  const metric =
    catalog.find((c) => c.metricKey === requestedMetric) ??
    catalog.find((c) => c.metricKey === "goals_total") ??
    catalog[0] ??
    null;
  const metricKey = metric?.metricKey ?? "goals_total";

  // includeUnqualified: takim sayfasi kadroyu EKSIKSIZ gostermeli; lig siralamasinin
  // "yeterli dakika" esigi (sezon max dakikasinin %30'u) burada uygulanmaz, yoksa
  // kisa sure oynayan yedekler listeden dusuyor (sezon basinda esik 27 dk idi).
  const load = (s: string) =>
    getTslLeaderboard(s, metricKey, { includeUnqualified: true });

  let teamRows = (await load(season)).filter((r) =>
    slugMatches(r.teamName, teamSlug)
  );
  // Sezon secilmemisse ve guncel sezonda henuz veri yoksa geriye dus.
  if (!teamRows.length && !requestedSeason) {
    for (const s of seasons.slice(1)) {
      const rows = (await load(s)).filter((r) =>
        slugMatches(r.teamName, teamSlug)
      );
      if (rows.length) {
        season = s;
        teamRows = rows;
        break;
      }
    }
  }

  const assets = await getPlayerAssets();
  const rows: TeamPlayerStatRow[] = teamRows.map((r) => {
    const a = assets[r.playerId];
    return {
      ...r,
      photo: a?.photo ?? null,
      nationality: a?.nationality ?? null,
      href: a?.slug
        ? `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(a.slug)}`
        : null,
    };
  });

  return { season, seasons, catalog, metricKey, metric, rows };
}
