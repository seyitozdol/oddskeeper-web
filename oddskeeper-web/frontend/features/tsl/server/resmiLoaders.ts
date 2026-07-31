import { getFootballTeams } from "../../../lib/football-teams";
import { slugFromLogo } from "../lib";
import type { TslMatch, TslStandingRow, TslTeamMeta, TslTeamMetric } from "../types";
import { getTslStandings, getTslTeamMetrics } from "./queries";
import {
  clusterRounds,
  getPlayerAssets,
  getResmiLeaders,
  getResmiTransfers,
  getResmiUpcoming,
  getTeamAggression,
  getTslMatches,
  getTslTeamMeta,
  type MatchRound,
  type ResmiLeaderRow,
  type ResmiTransfer,
  type TeamAggression,
} from "./resmi";

// Gecerli takim slug seti + isim->slug (yerel logodan tureyip football teams ile dogrulanir).
async function buildSlugMaps(standings: TslStandingRow[]) {
  const valid = new Set((await getFootballTeams()).map((t) => t.slug));
  const byName: Record<string, string> = {};
  const byId: Record<string, string> = {};
  for (const s of standings) {
    const slug = slugFromLogo(s.logo);
    if (slug && valid.has(slug)) {
      byName[s.teamName] = slug;
      byId[s.teamId] = slug;
    }
  }
  return { valid, byName, byId };
}

export type ResmiLigBundle = {
  season: string;
  standings: TslStandingRow[];
  leaderMetric: string;
  leaders: ResmiLeaderRow[];
  lastRound: MatchRound | null;
  upcoming: TslMatch[];
  teamSlugById: Record<string, string>;
};

export async function loadResmiLig(
  season: string,
  leaderMetric: string
): Promise<ResmiLigBundle> {
  const meta = await getTslTeamMeta(season);
  const matches = await getTslMatches(season, meta);
  const [standings, assets] = await Promise.all([
    getTslStandings(season, meta, matches),
    getPlayerAssets(),
  ]);
  const { byName, byId } = await buildSlugMaps(standings);
  const [leaders, upcoming] = await Promise.all([
    getResmiLeaders(season, leaderMetric, assets, byName),
    getResmiUpcoming(season, meta),
  ]);
  const rounds = clusterRounds(matches);
  return {
    season,
    standings,
    leaderMetric,
    leaders,
    lastRound: rounds.length ? rounds[rounds.length - 1] : null,
    upcoming,
    teamSlugById: byId,
  };
}

export type ResmiRankingBundle = {
  season: string;
  standings: TslStandingRow[];
  rounds: MatchRound[];
  teamSlugById: Record<string, string>;
};

export async function loadResmiRanking(season: string): Promise<ResmiRankingBundle> {
  const meta = await getTslTeamMeta(season);
  const matches = await getTslMatches(season, meta);
  const standings = await getTslStandings(season, meta, matches);
  const { byId } = await buildSlugMaps(standings);
  const rounds = clusterRounds(matches).reverse(); // en son hafta ustte
  return { season, standings, rounds, teamSlugById: byId };
}

export type ResmiTeamsBundle = {
  season: string;
  standings: TslStandingRow[];
  meta: Record<string, TslTeamMeta>;
  teamMetrics: TslTeamMetric[];
  aggression: Record<string, TeamAggression>;
  transfers: ResmiTransfer[];
  teamSlugById: Record<string, string>;
};

export async function loadResmiTeams(season: string): Promise<ResmiTeamsBundle> {
  const meta = await getTslTeamMeta(season);
  const matches = await getTslMatches(season, meta);
  const [standings, teamMetrics, aggression, transfers] = await Promise.all([
    getTslStandings(season, meta, matches),
    getTslTeamMetrics(season, meta),
    getTeamAggression(season),
    getResmiTransfers(season),
  ]);
  const { byId } = await buildSlugMaps(standings);
  return { season, standings, meta, teamMetrics, aggression, transfers, teamSlugById: byId };
}
