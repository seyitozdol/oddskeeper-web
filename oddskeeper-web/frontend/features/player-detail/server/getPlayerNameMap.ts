import { createClient } from "../../../lib/supabase/server";

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

  const [profileResult, infoResult] = await Promise.all([
    supabase
      .schema("analytics")
      .from("player_profile_v1")
      .select("player_source_id, player_slug")
      .limit(2000)
      .returns<{ player_source_id: string; player_slug: string }[]>(),

    supabase
      .schema("analytics")
      .from("player_current_info_v1")
      .select("opta_player_id, player_slug, full_name, first_name, last_name")
      .limit(2000)
      .returns<
        {
          opta_player_id: string | null;
          player_slug: string;
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
        }[]
      >(),
  ]);

  const map: Record<string, PlayerNameEntry> = {};

  for (const row of profileResult.data ?? []) {
    if (row.player_source_id) {
      map[row.player_source_id] = { slug: row.player_slug, fullName: null };
    }
  }

  for (const row of infoResult.data ?? []) {
    if (!row.opta_player_id) {
      continue;
    }

    const fullName =
      [row.first_name, row.last_name].filter(Boolean).join(" ") ||
      row.full_name;

    map[row.opta_player_id] = {
      slug: map[row.opta_player_id]?.slug ?? row.player_slug,
      fullName: fullName || null,
    };
  }

  return map;
}
