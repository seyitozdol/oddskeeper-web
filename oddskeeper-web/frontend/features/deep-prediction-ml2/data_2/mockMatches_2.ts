export type PredictionMatch_2 = {
  id?: number | string;
  competition?: string | null;
  kickoff?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  homeShots?: number | null;
  awayShots?: number | null;
  totalShots?: number | null;
  edge?: string | null;
  confidence?: "High" | "Medium" | "Low" | string | null;
  confidenceScore?: number | null;
};

export const markets_2 = [
  { key: "shots", label: "Shots", enabled: true },
  { key: "1x2", label: "1X2", enabled: false },
  { key: "btts", label: "BTTS", enabled: false },
  { key: "corners", label: "Corners", enabled: false },
] as const;

export const mockMatches_2: PredictionMatch_2[] = [
  {
    id: 1,
    competition: "Turkish Süper Lig",
    kickoff: "19 Apr 2026 · 19:00",
    homeTeam: "Fenerbahçe",
    awayTeam: "Beşiktaş",
    homeShots: 15.8,
    awayShots: 10.9,
    totalShots: 26.7,
    edge: "+2.4 shots",
    confidence: "High",
    confidenceScore: 82,
  },
  {
    id: 2,
    competition: "Turkish Süper Lig",
    kickoff: "20 Apr 2026 · 20:00",
    homeTeam: "Galatasaray",
    awayTeam: "Trabzonspor",
    homeShots: 17.1,
    awayShots: 9.4,
    totalShots: 26.5,
    edge: "+3.1 shots",
    confidence: "Medium",
    confidenceScore: 71,
  },
  {
    id: 3,
    competition: "Turkish Süper Lig",
    kickoff: "21 Apr 2026 · 18:00",
    homeTeam: "Samsunspor",
    awayTeam: "Başakşehir",
    homeShots: 11.2,
    awayShots: 11.7,
    totalShots: 22.9,
    edge: "Balanced",
    confidence: "Low",
    confidenceScore: 58,
  },
];
