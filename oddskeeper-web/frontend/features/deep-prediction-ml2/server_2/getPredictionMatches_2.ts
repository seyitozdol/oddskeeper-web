import { createClient } from "@/lib/supabase/server";
import {
  mockMatches_2,
  type PredictionMatch_2,
} from "@/features/deep-prediction-ml2/data_2/mockMatches_2";

type DbRow_2 = {
  prediction_key: string;
  competition: string | null;
  match_datetime: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  predicted_home_shots: number | string | null;
  predicted_away_shots: number | string | null;
  predicted_total_shots: number | string | null;
  edge_text: string | null;
  confidence_label: "High" | "Medium" | "Low" | null;
  confidence_score: number | null;
};

function safeNumber_2(value: number | string | null | undefined, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Number(parsed.toFixed(1));
}

function formatKickoff_2(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const datePart = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

  const timePart = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${datePart} · ${timePart}`;
}

export async function getPredictionMatches_2(): Promise<PredictionMatch_2[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .schema("analytics")
      .from("prediction_match_shots_v1")
      .select(
        `
        prediction_key,
        competition,
        match_datetime,
        home_team_name,
        away_team_name,
        predicted_home_shots,
        predicted_away_shots,
        predicted_total_shots,
        edge_text,
        confidence_label,
        confidence_score
      `
      )
      .eq("is_active", true)
      .order("match_datetime", { ascending: true });

    if (error) {
      console.error("prediction_match_shots_v1 read error:", error);
      return mockMatches_2;
    }

    if (!data || data.length === 0) {
      return mockMatches_2;
    }

    return (data as DbRow_2[]).map((row, index) => ({
      id: row.prediction_key ?? index + 1,
      competition: row.competition ?? "Unknown Competition",
      kickoff: formatKickoff_2(row.match_datetime),
      homeTeam: row.home_team_name ?? "-",
      awayTeam: row.away_team_name ?? "-",
      homeShots: safeNumber_2(row.predicted_home_shots),
      awayShots: safeNumber_2(row.predicted_away_shots),
      totalShots: safeNumber_2(row.predicted_total_shots),
      edge: row.edge_text ?? "Balanced",
      confidence: row.confidence_label ?? "Low",
      confidenceScore: row.confidence_score ?? 50,
    }));
  } catch (error) {
    console.error("getPredictionMatches_2 unexpected error:", error);
    return mockMatches_2;
  }
}
