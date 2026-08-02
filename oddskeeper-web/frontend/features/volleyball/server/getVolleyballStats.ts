// Voleybol veri erisimi — analytics.vb_* view'lari (anon/authenticated SELECT).
// Basketbol kalibi: her fn kendi createClient()'ini acar, hatada loglar ve bos
// dizi/null doner (sayfa her zaman render olsun).

import { createClient } from "@/lib/supabase/server";
import type {
  VbCompetition,
  VbLeaderboardRow,
  VbMatch,
  VbPlayerBio,
  VbPlayerMatch,
} from "../types";

export async function getVolleyballCompetitions(): Promise<VbCompetition[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("vb_competitions_v1")
    .select("*")
    .order("sort_key", { ascending: false })
    .returns<VbCompetition[]>();
  if (error) {
    console.error("getVolleyballCompetitions error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getVolleyballLeaderboard(
  competitionId: number
): Promise<VbLeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("vb_player_leaderboard_v1")
    .select("*")
    .eq("competition_id", competitionId)
    .order("points", { ascending: false, nullsFirst: false })
    .returns<VbLeaderboardRow[]>();
  if (error) {
    console.error("getVolleyballLeaderboard error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getVolleyballMatches(
  competitionId: number
): Promise<VbMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("vb_matches_v1")
    .select("*")
    .eq("competition_id", competitionId)
    .order("match_date", { ascending: false, nullsFirst: false })
    .returns<VbMatch[]>();
  if (error) {
    console.error("getVolleyballMatches error:", error.message);
    return [];
  }
  return data ?? [];
}

// --- Oyuncu profili ---------------------------------------------------------

export async function getVolleyballPlayer(
  fivbId: number
): Promise<VbPlayerBio | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("vb_player_v1")
    .select("*")
    .eq("fivb_id", fivbId)
    .maybeSingle<VbPlayerBio>();
  if (error) {
    console.error("getVolleyballPlayer error:", error.message);
    return null;
  }
  return data ?? null;
}

// Oyuncunun stat kaydi olan turnuvalari (leaderboard satirlari); profil ust bilgisi
// ve turnuva secici icin. Turnuva adi/etiketi ile birlestirilir.
export async function getVolleyballPlayerCompetitions(
  fivbId: number
): Promise<(VbLeaderboardRow & { short_label: string; sort_key: number })[]> {
  const supabase = await createClient();
  const [rows, comps] = await Promise.all([
    supabase
      .schema("analytics")
      .from("vb_player_leaderboard_v1")
      .select("*")
      .eq("fivb_id", fivbId)
      .returns<VbLeaderboardRow[]>(),
    getVolleyballCompetitions(),
  ]);
  if (rows.error) {
    console.error("getVolleyballPlayerCompetitions error:", rows.error.message);
    return [];
  }
  const byId = new Map(comps.map((c) => [c.competition_id, c]));
  return (rows.data ?? [])
    .map((r) => {
      const c = byId.get(r.competition_id);
      return { ...r, short_label: c?.short_label ?? "", sort_key: c?.sort_key ?? 0 };
    })
    .sort((a, b) => b.sort_key - a.sort_key);
}

export async function getVolleyballPlayerMatches(
  fivbId: number,
  competitionId: number
): Promise<VbPlayerMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("vb_player_match_v1")
    .select("*")
    .eq("fivb_id", fivbId)
    .eq("competition_id", competitionId)
    .order("match_date", { ascending: false, nullsFirst: false })
    .returns<VbPlayerMatch[]>();
  if (error) {
    console.error("getVolleyballPlayerMatches error:", error.message);
    return [];
  }
  return data ?? [];
}
