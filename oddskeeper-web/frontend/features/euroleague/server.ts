// EuroLeague/EuroCup veri erisimi — analytics.el_* view'lari (anon SELECT).
// competition code (E/U) + season_code (E2025 vb.) ile filtrelenir.

import { createClient } from "@/lib/supabase/server";
import type { EuroTeamRow, EuroLeaderRow, EuroPlayerLogRow, EuroTeamLogRow, EuroGameRow } from "./types";

// P-5 select daraltma: kolon listeleri view + tip alanlariyla dogrulandi (2026-08-21).
const TEAM_SEASON_COLS =
  "competition,season_code,season_label,team_code,team_name,games,wins,losses,win_pct,ppg,oppg,point_diff,rpg,apg,fg_pct,fg3_pct,efg_pct,pace,off_rtg,def_rtg,net_rtg,standings_rank,crest_url,bsl_team_slug,bsl_team_name";
const LEADERBOARD_COLS =
  "competition,season_code,season_label,person_code,player_name,team_code,team_name,bsl_player_slug,bsl_team_name,games,mpg,ppg,rpg,apg,spg,bpg,topg,fg3m_pg,val_pg,fg_pct,fg3_pct,ft_pct,ts_pct,is_qualified,image_url,position,height_cm,role,crest_url,country_code,country_code2";

export async function getEuroStandings(code: "E" | "U", seasonCode: string): Promise<EuroTeamRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_team_season_v1").select(TEAM_SEASON_COLS)
    .eq("competition", code).eq("season_code", seasonCode)
    .order("standings_rank", { ascending: true })
    .returns<EuroTeamRow[]>();
  if (error) { console.error("getEuroStandings", error.message); return []; }
  return data ?? [];
}

export async function getEuroLeaderboard(code: "E" | "U", seasonCode: string): Promise<EuroLeaderRow[]> {
  const supabase = await createClient();
  const rows: EuroLeaderRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .schema("analytics").from("el_player_leaderboard_v1").select(LEADERBOARD_COLS)
      .eq("competition", code).eq("season_code", seasonCode)
      .order("ppg", { ascending: false })
      .range(from, from + 999)
      .returns<EuroLeaderRow[]>();
    if (error) { console.error("getEuroLeaderboard", error.message); return rows; }
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

// Bir BSL takiminin euro (EL/EC) gorunumleri (season_label yil bazli eslesir).
export async function getEuroTeamsForBslSlug(bslTeamSlug: string, seasonLabel: string): Promise<EuroTeamRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_team_season_v1").select(TEAM_SEASON_COLS)
    .eq("bsl_team_slug", bslTeamSlug).eq("season_label", seasonLabel)
    .returns<EuroTeamRow[]>();
  if (error) { console.error("getEuroTeamsForBslSlug", error.message); return []; }
  return data ?? [];
}

// Turnuvanin tum maclari (oynanmis + program). Component played'e gore Results/Fixtures ayirir.
export async function getEuroGames(code: "E" | "U", seasonCode: string): Promise<EuroGameRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_games_v1").select("competition,competition_name,season_code,season_label,game_code,round,phase_code,phase_name,game_date,played,phase_order,home_team_code,home_team_name,home_crest,home_bsl_slug,away_team_code,away_team_name,away_crest,away_bsl_slug,home_score,away_score")
    .eq("competition", code).eq("season_code", seasonCode)
    .order("game_date", { ascending: true })
    .returns<EuroGameRow[]>();
  if (error) { console.error("getEuroGames", error.message); return []; }
  return data ?? [];
}

export async function getEuroTeam(code: "E" | "U", seasonCode: string, teamCode: string): Promise<EuroTeamRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_team_season_v1").select(TEAM_SEASON_COLS)
    .eq("competition", code).eq("season_code", seasonCode).eq("team_code", teamCode)
    .maybeSingle<EuroTeamRow>();
  if (error) { console.error("getEuroTeam", error.message); return null; }
  return data ?? null;
}

export async function getEuroTeamRoster(code: "E" | "U", seasonCode: string, teamCode: string): Promise<EuroLeaderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_player_leaderboard_v1").select(LEADERBOARD_COLS)
    .eq("competition", code).eq("season_code", seasonCode).eq("team_code", teamCode)
    .order("ppg", { ascending: false })
    .returns<EuroLeaderRow[]>();
  if (error) { console.error("getEuroTeamRoster", error.message); return []; }
  return data ?? [];
}

export async function getEuroTeamLog(code: "E" | "U", seasonCode: string, teamCode: string): Promise<EuroTeamLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_team_game_log_v1").select("competition,season_code,season_label,game_code,round,phase_code,game_date,team_code,team_name,home_away,opponent_code,opponent_name,points,opp_points,result")
    .eq("competition", code).eq("season_code", seasonCode).eq("team_code", teamCode)
    .order("game_date", { ascending: false })
    .returns<EuroTeamLogRow[]>();
  if (error) { console.error("getEuroTeamLog", error.message); return []; }
  return data ?? [];
}

export async function getEuroPlayer(code: "E" | "U", seasonCode: string, personCode: string): Promise<EuroLeaderRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_player_leaderboard_v1").select(LEADERBOARD_COLS)
    .eq("competition", code).eq("season_code", seasonCode).eq("person_code", personCode)
    .maybeSingle<EuroLeaderRow>();
  if (error) { console.error("getEuroPlayer", error.message); return null; }
  return data ?? null;
}

export async function getEuroPlayerLog(code: "E" | "U", seasonCode: string, personCode: string): Promise<EuroPlayerLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_player_game_log_v1").select("competition,competition_name,season_code,season_label,person_code,game_code,identifier,round,phase_code,game_date,team_code,team_name,home_away,opponent_code,opponent_name,minutes,points,fg3m,treb,assists,steals,blocks,valuation,plus_minus,crest_url")
    .eq("competition", code).eq("season_code", seasonCode).eq("person_code", personCode)
    .order("game_date", { ascending: false })
    .returns<EuroPlayerLogRow[]>();
  if (error) { console.error("getEuroPlayerLog", error.message); return []; }
  return data ?? [];
}
