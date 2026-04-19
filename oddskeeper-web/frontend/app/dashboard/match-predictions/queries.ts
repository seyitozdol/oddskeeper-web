"use client";

import { createClient } from "@/lib/supabase/client";

export type MatchPrediction = {
  id: number;
  source_match_id: string;
  fixture_date: string;
  home_team_name: string;
  away_team_name: string;
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
  home_xg: number;
  away_xg: number;
  model_version: string;
};

// Cap extreme probabilities and renormalize
// Prevents 0.976/0.012/0.012 type outputs
function capAndNorm(hw: number, draw: number, aw: number): [number, number, number] {
  const MAX_PROB = 0.85;
  const MIN_PROB = 0.04;
  let h = Math.min(Math.max(hw,   MIN_PROB), MAX_PROB);
  let d = Math.min(Math.max(draw, MIN_PROB), MAX_PROB);
  let a = Math.min(Math.max(aw,   MIN_PROB), MAX_PROB);
  const total = h + d + a;
  return [h / total, d / total, a / total];
}

export async function fetchMatchPredictions(): Promise<MatchPrediction[]> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .schema("prediction")
    .from("dc_predictions")
    .select("id, source_match_id, fixture_date, home_team_name, away_team_name, home_win_prob, draw_prob, away_win_prob, home_xg, away_xg, model_version")
    .eq("model_version", "dc_xg_v3")
    .gte("fixture_date", today)
    .order("fixture_date", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("fetchMatchPredictions error:", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const [hw, draw, aw] = capAndNorm(
      Number(row.home_win_prob),
      Number(row.draw_prob),
      Number(row.away_win_prob)
    );
    return { ...row, home_win_prob: hw, draw_prob: draw, away_win_prob: aw };
  });
}
