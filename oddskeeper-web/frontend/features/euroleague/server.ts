// EuroLeague/EuroCup veri erisimi — analytics.el_* view'lari (anon SELECT).
// competition code (E/U) + season_code (E2025 vb.) ile filtrelenir.

import { createClient } from "@/lib/supabase/server";
import type { EuroTeamRow, EuroLeaderRow, EuroPlayerLogRow, EuroTeamLogRow } from "./types";

export async function getEuroStandings(code: "E" | "U", seasonCode: string): Promise<EuroTeamRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_team_season_v1").select("*")
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
      .schema("analytics").from("el_player_leaderboard_v1").select("*")
      .eq("competition", code).eq("season_code", seasonCode)
      .order("ppg", { ascending: false })
      .range(from, from + 999)
      .returns<EuroLeaderRow[]>();
    if (error) { console.error("getEuroLeaderboard", error.message); return rows; }
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function getEuroTeam(code: "E" | "U", seasonCode: string, teamCode: string): Promise<EuroTeamRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_team_season_v1").select("*")
    .eq("competition", code).eq("season_code", seasonCode).eq("team_code", teamCode)
    .maybeSingle<EuroTeamRow>();
  if (error) { console.error("getEuroTeam", error.message); return null; }
  return data ?? null;
}

export async function getEuroTeamRoster(code: "E" | "U", seasonCode: string, teamCode: string): Promise<EuroLeaderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_player_leaderboard_v1").select("*")
    .eq("competition", code).eq("season_code", seasonCode).eq("team_code", teamCode)
    .order("ppg", { ascending: false })
    .returns<EuroLeaderRow[]>();
  if (error) { console.error("getEuroTeamRoster", error.message); return []; }
  return data ?? [];
}

export async function getEuroTeamLog(code: "E" | "U", seasonCode: string, teamCode: string): Promise<EuroTeamLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_team_game_log_v1").select("*")
    .eq("competition", code).eq("season_code", seasonCode).eq("team_code", teamCode)
    .order("game_date", { ascending: false })
    .returns<EuroTeamLogRow[]>();
  if (error) { console.error("getEuroTeamLog", error.message); return []; }
  return data ?? [];
}

export async function getEuroPlayer(code: "E" | "U", seasonCode: string, personCode: string): Promise<EuroLeaderRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_player_leaderboard_v1").select("*")
    .eq("competition", code).eq("season_code", seasonCode).eq("person_code", personCode)
    .maybeSingle<EuroLeaderRow>();
  if (error) { console.error("getEuroPlayer", error.message); return null; }
  return data ?? null;
}

export async function getEuroPlayerLog(code: "E" | "U", seasonCode: string, personCode: string): Promise<EuroPlayerLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_player_game_log_v1").select("*")
    .eq("competition", code).eq("season_code", seasonCode).eq("person_code", personCode)
    .order("game_date", { ascending: false })
    .returns<EuroPlayerLogRow[]>();
  if (error) { console.error("getEuroPlayerLog", error.message); return []; }
  return data ?? [];
}
