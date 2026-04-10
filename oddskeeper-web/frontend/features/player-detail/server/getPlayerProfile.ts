import { createClient } from "../../../lib/supabase/server";
import type { PlayerProfileRow } from "../types";

type PlayerProfileDbRow = {
  team_slug: string;
  team_source_id: string;
  team_name: string;

  competition: string | null;
  season_label: string | null;

  player_source_id: string;
  player_name: string;
  player_slug: string;

  primary_position_code: string;
  position_group: string;

  appearances: number;
  starts: number;
  sub_appearances: number;
  starter_rate_pct: number | string | null;

  total_minutes: number;
  avg_minutes: number | string | null;

  goals: number;
  assists: number;

  first_match_datetime: string | null;
  last_match_datetime: string | null;
};

function mapRow(row: PlayerProfileDbRow): PlayerProfileRow {
  return {
    team_slug: row.team_slug,
    team_source_id: row.team_source_id,
    source_team_id: row.team_source_id,
    team_name: row.team_name,

    competition: row.competition,
    season_label: row.season_label,

    player_source_id: row.player_source_id,
    player_name: row.player_name,
    player_slug: row.player_slug,

    primary_position_code: row.primary_position_code,
    position_group: row.position_group,

    appearances: row.appearances,
    starts: row.starts,
    sub_appearances: row.sub_appearances,
    starter_rate_pct: row.starter_rate_pct,

    total_minutes: row.total_minutes,
    avg_minutes: row.avg_minutes,

    goals: row.goals,
    assists: row.assists,

    first_match_datetime: row.first_match_datetime,
    last_match_datetime: row.last_match_datetime,
  };
}

export async function getPlayerProfile(
  playerSlug: string
): Promise<PlayerProfileRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_profile_v1")
    .select(
      `
        team_slug,
        team_source_id,
        team_name,
        competition,
        season_label,
        player_source_id,
        player_name,
        player_slug,
        primary_position_code,
        position_group,
        appearances,
        starts,
        sub_appearances,
        starter_rate_pct,
        total_minutes,
        avg_minutes,
        goals,
        assists,
        first_match_datetime,
        last_match_datetime
      `
    )
    .eq("player_slug", playerSlug)
    .limit(1)
    .returns<PlayerProfileDbRow[]>();

  if (error) {
    console.error("player profile fetch error:", {
      playerSlug,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  const row = data?.[0] ?? null;
  return row ? mapRow(row) : null;
}