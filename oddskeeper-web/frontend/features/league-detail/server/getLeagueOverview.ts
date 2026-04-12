import { createClient } from "../../../lib/supabase/server";
import type { LeagueOverviewRow } from "../types";

type LeagueOverviewDbRow = LeagueOverviewRow;

function mapRow(row: LeagueOverviewDbRow): LeagueOverviewRow {
  return {
    competition: row.competition,
    season_label: row.season_label,
    teams_count: row.teams_count,
    completed_matches: row.completed_matches,
    upcoming_fixtures: row.upcoming_fixtures,
    total_goals: row.total_goals,
    goals_per_match: row.goals_per_match,
    home_win_pct: row.home_win_pct,
    draw_pct: row.draw_pct,
    away_win_pct: row.away_win_pct,
    latest_match_datetime: row.latest_match_datetime,
    next_fixture_date: row.next_fixture_date,
    next_fixture_datetime: row.next_fixture_datetime,
  };
}

export async function getLeagueOverview(
  competition: string,
  seasonLabel: string,
): Promise<LeagueOverviewRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("league_overview_v1")
    .select(
      `
        competition,
        season_label,
        teams_count,
        completed_matches,
        upcoming_fixtures,
        total_goals,
        goals_per_match,
        home_win_pct,
        draw_pct,
        away_win_pct,
        latest_match_datetime,
        next_fixture_date,
        next_fixture_datetime
      `,
    )
    .eq("competition", competition)
    .eq("season_label", seasonLabel)
    .limit(1)
    .returns<LeagueOverviewDbRow[]>();

  if (error) {
    console.error("league overview fetch error:", {
      competition,
      seasonLabel,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  const firstRow = data?.[0] ?? null;
  return firstRow ? mapRow(firstRow) : null;
}
