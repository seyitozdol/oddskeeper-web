import { createClient } from "../../../lib/supabase/server";
import type { LeagueStandingRow } from "../types";

type LeagueStandingDbRow = LeagueStandingRow;

function mapRow(row: LeagueStandingDbRow): LeagueStandingRow {
  return {
    rank: row.rank,
    competition: row.competition,
    season_label: row.season_label,
    team_source_id: row.team_source_id,
    team_slug: row.team_slug,
    team_name: row.team_name,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goals_for: row.goals_for,
    goals_against: row.goals_against,
    goal_difference: row.goal_difference,
    points: row.points,
    points_per_game: row.points_per_game,
    home_points: row.home_points,
    away_points: row.away_points,
    last5_points: row.last5_points,
    form_last5: row.form_last5,
  };
}

export async function getLeagueStandings(
  competition: string,
  seasonLabel: string,
): Promise<LeagueStandingRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("league_table_v1")
    .select(
      `
        rank,
        competition,
        season_label,
        team_source_id,
        team_slug,
        team_name,
        played,
        wins,
        draws,
        losses,
        goals_for,
        goals_against,
        goal_difference,
        points,
        points_per_game,
        home_points,
        away_points,
        last5_points,
        form_last5
      `,
    )
    .eq("competition", competition)
    .eq("season_label", seasonLabel)
    .order("rank", { ascending: true })
    .returns<LeagueStandingDbRow[]>();

  if (error) {
    console.error("league standings fetch error:", {
      competition,
      seasonLabel,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return [];
  }

  return (data ?? []).map(mapRow);
}
