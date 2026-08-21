import { createClient } from "../../../lib/supabase/server";
import type { TslAdvancedRow } from "../types";

const PAGE_SIZE = 1000; // PostgREST tek istekte en fazla 1000 satir doner

// select("*") daraltmasi (C-2 Faz 3): TslAdvancedDbRow alanlariyla birebir ayni
// tutulur; tipe alan eklenirse buraya da eklenmeli.
const ADVANCED_COLS =
  "season_label, opta_player_id, appearances, minutes, xgot, xa, key_passes, " +
  "long_balls, accurate_long_balls, duels_won, duels_lost, aerials_won, " +
  "aerials_lost, dribbles_won, dribbles_attempted, clearances, ball_recoveries, " +
  "big_chances_created, big_chances_missed, errors_leading_to_shot, " +
  "errors_leading_to_goal, km_covered, sprints, top_speed, carry_distance_m, " +
  "progressive_carry_distance_m";

type TslAdvancedDbRow = {
  season_label: string;
  opta_player_id: string;
  appearances: number | string | null;
  minutes: number | string | null;
  xgot: number | string | null;
  xa: number | string | null;
  key_passes: number | string | null;
  long_balls: number | string | null;
  accurate_long_balls: number | string | null;
  duels_won: number | string | null;
  duels_lost: number | string | null;
  aerials_won: number | string | null;
  aerials_lost: number | string | null;
  dribbles_won: number | string | null;
  dribbles_attempted: number | string | null;
  clearances: number | string | null;
  ball_recoveries: number | string | null;
  big_chances_created: number | string | null;
  big_chances_missed: number | string | null;
  errors_leading_to_shot: number | string | null;
  errors_leading_to_goal: number | string | null;
  km_covered: number | string | null;
  sprints: number | string | null;
  top_speed: number | string | null;
  carry_distance_m: number | string | null;
  progressive_carry_distance_m: number | string | null;
};

function toNumberOrNull(value: number | string | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRow(row: TslAdvancedDbRow): TslAdvancedRow {
  return {
    season_label: row.season_label,
    opta_player_id: row.opta_player_id,
    appearances: toNumberOrNull(row.appearances),
    minutes: toNumberOrNull(row.minutes),
    xgot: toNumberOrNull(row.xgot),
    xa: toNumberOrNull(row.xa),
    key_passes: toNumberOrNull(row.key_passes),
    long_balls: toNumberOrNull(row.long_balls),
    accurate_long_balls: toNumberOrNull(row.accurate_long_balls),
    duels_won: toNumberOrNull(row.duels_won),
    duels_lost: toNumberOrNull(row.duels_lost),
    aerials_won: toNumberOrNull(row.aerials_won),
    aerials_lost: toNumberOrNull(row.aerials_lost),
    dribbles_won: toNumberOrNull(row.dribbles_won),
    dribbles_attempted: toNumberOrNull(row.dribbles_attempted),
    clearances: toNumberOrNull(row.clearances),
    ball_recoveries: toNumberOrNull(row.ball_recoveries),
    big_chances_created: toNumberOrNull(row.big_chances_created),
    big_chances_missed: toNumberOrNull(row.big_chances_missed),
    errors_leading_to_shot: toNumberOrNull(row.errors_leading_to_shot),
    errors_leading_to_goal: toNumberOrNull(row.errors_leading_to_goal),
    km_covered: toNumberOrNull(row.km_covered),
    sprints: toNumberOrNull(row.sprints),
    top_speed: toNumberOrNull(row.top_speed),
    carry_distance_m: toNumberOrNull(row.carry_distance_m),
    progressive_carry_distance_m: toNumberOrNull(row.progressive_carry_distance_m),
  };
}

export async function getTslAdvancedStats(): Promise<TslAdvancedRow[]> {
  const supabase = await createClient();
  const rows: TslAdvancedRow[] = [];

  for (let from = 0; from < 2000; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("tsl_player_advanced_season_mat")
      .select(ADVANCED_COLS)
      .order("season_label", { ascending: true })
      .order("opta_player_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .returns<TslAdvancedDbRow[]>();

    if (error) {
      console.error("getTslAdvancedStats error:", {
        message: error.message,
        details: error.details,
        code: error.code,
      });
      return rows;
    }

    rows.push(...(data ?? []).map(normalizeRow));
    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }

  return rows;
}
