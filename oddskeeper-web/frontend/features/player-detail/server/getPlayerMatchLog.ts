import { createClient } from "../../../lib/supabase/server";
import type { PlayerMatchLogRow } from "../types";

type PlayerMatchLogDbRow = {
  player_slug: string;
  player_source_id: string | number;
  player_name: string;

  team_slug: string | null;
  team_source_id: string | null;
  team_name: string | null;

  source_match_id: string;
  competition: string | null;
  season_label: string | null;
  match_datetime: string | null;

  is_home: boolean;
  is_away: boolean;

  opponent_name: string | null;
  opponent_team_slug: string | null;

  score_display: string | null;
  result_code: "W" | "D" | "L" | null;

  lineup_status: string | null;
  position_code: string | null;

  points: number | string | null;
  minutes_played: number | null;
  goals: number | null;
  assists: number | null;

  shots_on_target: number | null;
  shots_off_target: number | null;
  shots_blocked: number | null;

  passes: number | string | null;
  crosses: number | string | null;
  tackles: number | null;
  interceptions: number | null;
  fouls_won: number | null;
  fouls_conceded: number | null;
  offsides: number | null;
  cards_yellow: number | null;
  cards_red: number | null;
  penalties_won: number | null;
  saves_total: number | null;
  expected_goals: number | string | null;
  accurate_pass: number | null;
};

function mapResultLabel(resultCode: "W" | "D" | "L" | null): string | null {
  if (resultCode === "W") return "Win";
  if (resultCode === "D") return "Draw";
  if (resultCode === "L") return "Loss";
  return null;
}

function mapRow(row: PlayerMatchLogDbRow): PlayerMatchLogRow {
  return {
    player_slug: row.player_slug,
    player_source_id: row.player_source_id,
    player_name: row.player_name,

    team_slug: row.team_slug,
    team_source_id: row.team_source_id,
    source_team_id: row.team_source_id,
    team_name: row.team_name,

    source_match_id: row.source_match_id,
    competition: row.competition,
    season_label: row.season_label,
    match_datetime: row.match_datetime,

    is_home: row.is_home,
    is_away: row.is_away,

    opponent_name: row.opponent_name,
    opponent_team_name: row.opponent_name,
    opponent_team_slug: row.opponent_team_slug,

    score_display: row.score_display,
    result_code: row.result_code,
    result_label: mapResultLabel(row.result_code),

    lineup_status: row.lineup_status,
    position_code: row.position_code,

    points: row.points,
    minutes_played: row.minutes_played,
    goals: row.goals,
    assists: row.assists,

    shots_on_target: row.shots_on_target,
    shots_off_target: row.shots_off_target,
    shots_blocked: row.shots_blocked,

    passes: row.passes,
    crosses: row.crosses,
    tackles: row.tackles,
    interceptions: row.interceptions,
    fouls_won: row.fouls_won,
    fouls_conceded: row.fouls_conceded,
    offsides: row.offsides,
    cards_yellow: row.cards_yellow,
    cards_red: row.cards_red,
    penalties_won: row.penalties_won,
    saves_total: row.saves_total,
    expected_goals: row.expected_goals,
    accurate_pass: row.accurate_pass,
  };
}

export async function getPlayerMatchLog(
  playerSlug: string
): Promise<PlayerMatchLogRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_match_log_v1")
    .select(
      `
        player_slug,
        player_source_id,
        player_name,
        team_slug,
        team_source_id,
        team_name,
        source_match_id,
        competition,
        season_label,
        match_datetime,
        is_home,
        is_away,
        opponent_name,
        opponent_team_slug,
        score_display,
        result_code,
        lineup_status,
        position_code,
        points,
        minutes_played,
        goals,
        assists,
        shots_on_target,
        shots_off_target,
        shots_blocked,
        passes,
        crosses,
        tackles,
        interceptions,
        fouls_won,
        fouls_conceded,
        offsides,
        cards_yellow,
        cards_red,
        penalties_won,
        saves_total,
        expected_goals,
        accurate_pass
      `
    )
    .eq("player_slug", playerSlug)
    .order("match_datetime", { ascending: false })
    .returns<PlayerMatchLogDbRow[]>();

  if (error) {
    console.error("player match log fetch error:", {
      playerSlug,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return [];
  }

  return (data ?? []).map(mapRow);
}