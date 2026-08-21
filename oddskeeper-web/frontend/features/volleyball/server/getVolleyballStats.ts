// Voleybol veri erisimi — analytics.vb_* view'lari (anon/authenticated SELECT).
// Basketbol kalibi: her fn kendi createClient()'ini acar, hatada loglar ve bos
// dizi/null doner (sayfa her zaman render olsun).

import { createClient } from "@/lib/supabase/server";
import type {
  VbCompetition,
  VbLeaderboardRow,
  VbMatch,
  VbFixture,
  VbPlayerBio,
  VbPlayerMatch,
} from "../types";

// select("*") daraltmasi (C-2 Faz 3): kolon listeleri ../types'taki tiplerle
// birebir ayni tutulur; tipe alan eklenirse buraya da eklenmeli.
const COMPETITION_COLS =
  "competition_id, comp_slug, year, gender, name, short_label, sort_key";
const LEADERBOARD_COLS =
  "competition_id, fivb_id, short_name, full_name, team_code, position, " +
  "shirt_number, nationality, height_cm, birth_date, sofascore_player_id, " +
  "vbw_photo, points, attack_points, block_points, serve_points, scorer_rank, " +
  "atk_total, atk_success, atk_rank, blk_blocks, blk_eff, blk_rank, srv_aces, " +
  "srv_success, srv_rank, set_successful, set_rank, dig_digs, dig_rank, " +
  "rec_successful, rec_success, rec_rank";
const MATCH_COLS =
  "competition_id, match_no, match_date, home_code, away_code, home_name, " +
  "away_name, home_sets, away_sets, set_scores, status";
const FIXTURE_COLS =
  "id, competition_name, stage, match_date, match_time, home_code, away_code, " +
  "home_name, away_name, venue, status";
const PLAYER_BIO_COLS =
  "fivb_id, full_name, short_name, position, birth_date, height_cm, " +
  "nationality, sofascore_player_id, vbw_photo";
const PLAYER_MATCH_COLS =
  "competition_id, fivb_id, match_date, home_team, away_team, category, data";

export async function getVolleyballCompetitions(): Promise<VbCompetition[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("vb_competitions_v1")
    .select(COMPETITION_COLS)
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
    .select(LEADERBOARD_COLS)
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
    .select(MATCH_COLS)
    .eq("competition_id", competitionId)
    .order("match_date", { ascending: false, nullsFirst: false })
    .returns<VbMatch[]>();
  if (error) {
    console.error("getVolleyballMatches error:", error.message);
    return [];
  }
  return data ?? [];
}

// Yaklasan maclar (Fixtures) - turnuva-toggle'dan bagimsiz, tek liste.
export async function getVolleyballFixtures(): Promise<VbFixture[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("vb_fixtures_v1")
    .select(FIXTURE_COLS)
    .order("match_date", { ascending: true, nullsFirst: false })
    .returns<VbFixture[]>();
  if (error) {
    console.error("getVolleyballFixtures error:", error.message);
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
    .select(PLAYER_BIO_COLS)
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
      .select(LEADERBOARD_COLS)
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
    .select(PLAYER_MATCH_COLS)
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
