import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { getPlayerDetailHref } from "@/lib/routes";

// Tek-profil birlestirme (Faz 3): eski kupa oyuncu URL'leri
// (/dashboard/euro-cups/{cl,el,conf}/player/[id]) artik ayri sayfa render etmez;
// sofascore id -> football profil slug'i cozulur ve TEK slug-keyed football
// player-detail'e yonlendirilir. Slug cozulemezse (haritada olmayan id,
// FS-fallback kimligi vb.) ilgili kupanin Players listesine duser — 404 yok.
export async function redirectCupPlayerToProfile(
  playerId: string,
  fallback: string
): Promise<never> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema("analytics")
    .from("sofascore_football_player_link_v1")
    .select("player_slug")
    .eq("sofascore_player_id", playerId)
    .limit(1);
  const slug = (data?.[0]?.player_slug as string | undefined) ?? null;
  redirect(getPlayerDetailHref(slug) ?? fallback);
}

// SofaScore takim id -> football takim profil slug'i. team_mapping Turk-ligi
// merkezli oldugundan yalniz Super Lig gecmisi olan (dual) takimlar eslesir;
// yabanci kupa takimi null doner (onlarin tek profili birlesik kupa takim sayfasi).
export const getFootballTeamSlugMap = cache(
  async (): Promise<Record<string, string>> => {
    const supabase = await createClient();
    const out: Record<string, string> = {};
    const { data, error } = await supabase
      .schema("analytics")
      .from("sofascore_football_team_link_v1")
      .select("sofascore_team_id, team_slug")
      .limit(1000);
    if (error) {
      console.error("football team slug map fetch error:", error.message);
      return out;
    }
    for (const r of data ?? [])
      if (r.team_slug) out[String(r.sofascore_team_id)] = String(r.team_slug);
    return out;
  }
);

export async function getFootballTeamSlug(
  sofascoreTeamId: string
): Promise<string | null> {
  const map = await getFootballTeamSlugMap();
  return map[sofascoreTeamId] ?? null;
}
