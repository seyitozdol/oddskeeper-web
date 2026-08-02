// Voleybol Match-Player Tools veri erisimi (analytics.vb_pm_* view'lari, anon SELECT).

import { createClient } from "@/lib/supabase/server";

export type VbTeamMatch = {
  competition_id: number;
  competition_name: string | null;
  team_code: string | null;
  match_date: string | null;
  side: "H" | "A";
  opponent_code: string | null;
  opponent: string | null;
  home_sets: number | null;
  away_sets: number | null;
  result: "W" | "L" | null;
  points: number | null;
  attack: number | null;
  block: number | null;
  ace: number | null;
  digs: number | null;
  rec_pct: number | null;
};

export type VbPlayerMatch = {
  competition_id: number;
  fivb_id: number;
  team_code: string | null;
  match_date: string | null;
  side: "H" | "A";
  points: number | null;
  attack: number | null;
  block: number | null;
  ace: number | null;
  digs: number | null;
  rec_succ: number | null;
  rec_att: number | null;
};

export type VbTeam = { team_code: string; team_name: string | null };

export type VbToolsPlayer = {
  fivb_id: number;
  full_name: string | null;
  short_name: string | null;
  position: string | null;
  sofascore_player_id: number | null;
  vbw_photo: string | null;
  games: number | null;
};

export async function getVbTeamMatches(): Promise<VbTeamMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("vb_pm_team_match_v1")
    .select("*")
    .order("match_date", { ascending: false, nullsFirst: false })
    .returns<VbTeamMatch[]>();
  if (error) { console.error("getVbTeamMatches", error.message); return []; }
  return data ?? [];
}

export async function getVbPlayerMatches(): Promise<VbPlayerMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("vb_pm_player_match_v1")
    .select("*")
    .returns<VbPlayerMatch[]>();
  if (error) { console.error("getVbPlayerMatches", error.message); return []; }
  return data ?? [];
}

export async function getVbTeams(): Promise<VbTeam[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("vb_pm_teams_v1")
    .select("*")
    .order("team_name", { ascending: true })
    .returns<VbTeam[]>();
  if (error) { console.error("getVbTeams", error.message); return []; }
  return data ?? [];
}

export async function getVbToolsPlayers(): Promise<VbToolsPlayer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("vb_pm_player_list_v1")
    .select("*")
    .order("games", { ascending: false, nullsFirst: false })
    .returns<VbToolsPlayer[]>();
  if (error) { console.error("getVbToolsPlayers", error.message); return []; }
  return data ?? [];
}
