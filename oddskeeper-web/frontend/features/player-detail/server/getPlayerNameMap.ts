import { createClient } from "../../../lib/supabase/server";
import { knownDisplayName } from "../../../lib/player-name";
import { fetchAllPaged } from "../../../lib/supabase/paginate";

export type PlayerNameEntry = {
  slug: string | null;
  fullName: string | null;
};

// Opta player_source_id -> { slug, uzun isim }. Sıralama tablolarında kısa
// Opta isimleri yerine tam isim + oyuncu sayfası linki göstermek için.
export async function getPlayerNameMap(): Promise<
  Record<string, PlayerNameEntry>
> {
  const supabase = await createClient();

  const [profileRows, infoRows] = await Promise.all([
    fetchAllPaged<{ player_source_id: string; player_slug: string }>((from, to) =>
      supabase
        .schema("analytics")
        .from("player_profile_v1")
        .select("player_source_id, player_slug")
        .order("player_slug", { ascending: true })
        .range(from, to)
        .returns<{ player_source_id: string; player_slug: string }[]>()
    ),

    fetchAllPaged<{
      opta_player_id: string | null;
      player_slug: string;
      player_name: string | null;
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
    }>((from, to) =>
      supabase
        .schema("analytics")
        .from("player_current_info_v1")
        .select(
          "opta_player_id, player_slug, player_name, full_name, first_name, last_name"
        )
        .order("player_slug", { ascending: true })
        .range(from, to)
        .returns<
          {
            opta_player_id: string | null;
            player_slug: string;
            player_name: string | null;
            full_name: string | null;
            first_name: string | null;
            last_name: string | null;
          }[]
        >()
    ),
  ]);

  const map: Record<string, PlayerNameEntry> = {};

  for (const row of profileRows) {
    if (row.player_source_id) {
      map[row.player_source_id] = { slug: row.player_slug, fullName: null };
    }
  }

  for (const row of infoRows) {
    if (!row.opta_player_id) {
      continue;
    }

    const fullName =
      knownDisplayName(row.player_name, row.first_name) ||
      row.full_name ||
      row.player_name;

    map[row.opta_player_id] = {
      slug: map[row.opta_player_id]?.slug ?? row.player_slug,
      fullName: fullName || null,
    };
  }

  return map;
}
