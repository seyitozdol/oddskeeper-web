// Sezon kadrosu (basketball.team_rosters) okuma katmanı: takım profili kadro listesi ve
// henüz ligde maçı olmayan oyuncunun profil başlığı buradan beslenir. İstatistik view'ları
// üyeliği maç satırlarından türettiği için sezon başında boş kalır; kadro tablosu boşluğu kapatır.

import { createClient } from "@/lib/supabase/server";
import type { BktPlayerSeasonRow } from "../types";

export type BktRosterMemberRow = {
  season_label: string;
  team_slug: string;
  player_slug: string;
  player_name: string;
  position: string | null;
  games_current: number;
  role: string;
  sofascore_player_id: number | null;
  country_code: string | null;
};

export async function getBasketballSeasonRoster(teamSlug: string, season: string): Promise<BktRosterMemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_role_roster_v1")
    .select("season_label,team_slug,player_slug,player_name,position,games_current,role,sofascore_player_id,country_code")
    .eq("season_label", season)
    .eq("team_slug", teamSlug)
    .order("player_name", { ascending: true })
    .limit(100)
    .returns<BktRosterMemberRow[]>();
  if (error) {
    console.error("getBasketballSeasonRoster error:", error.message);
    return [];
  }
  return data ?? [];
}

// Kadro üyelerini sezon istatistiğiyle birleştirir: istatistiği olan oyuncu kendi satırıyla,
// henüz maça çıkmamış üye sıfır maçla (rol = geçmiş maçlardan: İlk 5 / Rotasyon / Yeni ...) gelir.
// Kadro yoksa (geçmiş sezon) istatistik listesi aynen döner.
export function mergeRosterWithStats(members: BktRosterMemberRow[], stats: BktPlayerSeasonRow[]): BktPlayerSeasonRow[] {
  if (members.length === 0) return stats;
  const bySlug = new Map(stats.map((s) => [s.player_slug, s]));
  const rows = members.map((m) => {
    const s = bySlug.get(m.player_slug);
    if (s) return s;
    return {
      season_label: m.season_label, competition: null, player_slug: m.player_slug, player_name: m.player_name,
      team_slug: m.team_slug, team_name: null, jersey_no: null, games: 0, mpg: null, ppg: null, rpg: null, apg: null,
      position: m.position, role: m.role, sofascore_player_id: m.sofascore_player_id, country_code: m.country_code,
    } as unknown as BktPlayerSeasonRow;
  });
  // istatistikte olup kadroda olmayan (sezon içinde ayrılan) oyuncular da listede kalsın
  const memberSlugs = new Set(members.map((m) => m.player_slug));
  rows.push(...stats.filter((s) => !memberSlugs.has(s.player_slug)));
  return rows.sort((a, b) => (b.ppg ?? -1) - (a.ppg ?? -1) || a.player_name.localeCompare(b.player_name, "tr"));
}

export type BktRosterIdentity = {
  player_name: string;
  team_slug: string | null;
  team_name: string | null;
  jersey_no: string | null;
  position: string | null;
  height_cm: number | null;
  country_code: string | null;
  country_code2?: string | null;   // yalnız istatistik satırında (diğer lig ülkesi); kadro kimliğinde yok
  sofascore_player_id: number | null;
};

// Hiç istatistiği olmayan (yeni) oyuncunun kimliği: en yeni sezon kadrosundan.
export async function getBasketballRosterIdentity(playerSlug: string): Promise<BktRosterIdentity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_roster_v1")
    .select("player_name,team_slug,team_name,jersey_no,position,height_cm,country_code,sofascore_player_id,season_label")
    .eq("player_slug", playerSlug)
    .order("season_label", { ascending: false })
    .limit(1)
    .maybeSingle<BktRosterIdentity>();
  if (error) {
    console.error("getBasketballRosterIdentity error:", error.message);
    return null;
  }
  return data ?? null;
}
