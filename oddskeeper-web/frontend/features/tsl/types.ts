// TSL veri katmani tipleri.

export type TslTeamMeta = {
  teamId: string;
  name: string;
  logo: string | null;
};

export type FormResult = "W" | "D" | "L";

export type TslStandingRow = {
  rank: number;
  teamId: string;
  teamName: string;
  logo: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  ppg: number;
  form: FormResult[]; // kronolojik, sonuncusu en yeni
  // Zengin profil (tsl_ss_team_overview_advanced_mat)
  attackLabel: string | null;
  defenceLabel: string | null;
  formLabel: string | null;
  strongestLabel: string | null;
  strongestPct: number | null;
  weakestLabel: string | null;
  weakestPct: number | null;
};

export type TslSummary = {
  teams: number;
  matchesPlayed: number;
  totalGoals: number;
  goalsPerMatch: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
};

export type TslMatch = {
  matchId: string;
  datetime: string | null;
  homeId: string;
  awayId: string;
  homeName: string;
  awayName: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number;
  awayScore: number;
};

export type MetricFormat = "count" | "pct" | "decimal" | string;

export type TslMetricOption = {
  categoryKey: string;
  categoryLabel: string;
  categorySort: number;
  metricKey: string;
  metricLabel: string;
  valueFormat: MetricFormat;
  isHigherBetter: boolean;
  defaultBasis: string;
};

export type TslLeaderRow = {
  rank: number;
  playerId: string;
  playerName: string;
  teamName: string | null;
  positionCode: string | null;
  metricKey: string;
  metricLabel: string;
  total: number | null;
  perMatch: number | null;
  per90: number | null;
  leagueAvg: number | null;
  vsAvgPct: number | null;
  valueFormat: MetricFormat;
  isHigherBetter: boolean;
};

export type TslPlayerOverview = {
  playerId: string;
  playerName: string;
  teamName: string | null;
  positionCode: string | null;
  appearances: number | null;
  starts: number | null;
  minutes: number | null;
  avgMinutes: number | null;
  usageLabel: string | null;
  formLabel: string | null;
  primaryLabel: string | null;
  primaryPct: number | null;
  primaryValue: number | null;
  secondaryLabel: string | null;
  secondaryPct: number | null;
};

export type TslTeamLeaderRow = {
  rank: number;
  teamId: string | null;
  teamName: string | null;
  metricKey: string;
  metricLabel: string;
  categoryKey: string | null;
  categoryLabel: string | null;
  total: number | null;
  perMatch: number | null;
  leagueAvg: number | null;
  vsAvgPct: number | null;
  valueFormat: MetricFormat;
  isHigherBetter: boolean;
};

export type TslTeamMetric = {
  teamId: string;
  teamName: string;
  metricKey: string;
  metricLabel: string;
  categoryKey: string | null;
  total: number | null;
  perMatch: number | null;
  leaguePct: number | null;
  leagueRank: number | null;
  valueFormat: MetricFormat;
  isHigherBetter: boolean;
};
