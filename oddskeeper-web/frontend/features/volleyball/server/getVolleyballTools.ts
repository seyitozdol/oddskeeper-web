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

// PostgREST varsayilan 1000 satir kapatir; view'lar bunun ustunde -> sayfalama sart.
const PAGE = 1000;
async function fetchAll<T>(view: string, orderCol: string): Promise<T[]> {
  const supabase = await createClient();
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      // select-yildiz: bilincli genis okuma (dinamik view: 3 farkli vb_pm_* view'i
      // ortak kolon setine sahip degil; ayrica VolleyballTools satirlari Record'a
      // cast edip market base'lerini dinamik anahtarla okuyor)
      .schema("analytics").from(view).select("*")
      .order(orderCol, { ascending: false, nullsFirst: false })
      .range(from, from + PAGE - 1)
      .returns<T[]>();
    if (error) { console.error(`fetchAll ${view}`, error.message); break; }
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function getVbTeamMatches(): Promise<VbTeamMatch[]> {
  return fetchAll<VbTeamMatch>("vb_pm_team_match_v1", "match_date");
}

export async function getVbPlayerMatches(): Promise<VbPlayerMatch[]> {
  return fetchAll<VbPlayerMatch>("vb_pm_player_match_v1", "match_date");
}

export async function getVbTeams(): Promise<VbTeam[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("vb_pm_teams_v1")
    .select("team_code, team_name")
    .order("team_name", { ascending: true })
    .returns<VbTeam[]>();
  if (error) { console.error("getVbTeams", error.message); return []; }
  return data ?? [];
}

export async function getVbToolsPlayers(): Promise<VbToolsPlayer[]> {
  return fetchAll<VbToolsPlayer>("vb_pm_player_list_v1", "games");
}
