import { createClient } from "./supabase/server";

type NameRow = {
  player_slug: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

// Opta'nın kısaltılmış isimleri ("K. Karataş") yerine bio'daki uzun isimleri
// ("Kazımcan Karataş") döndürür. Güncel kadrolarda olmayan oyuncular için
// kayıt bulunmaz; çağıran taraf kısa isme düşer.
export async function getPlayerDisplayNameMap(
  slugs: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const unique = Array.from(
    new Set(slugs.filter((slug): slug is string => Boolean(slug)))
  );
  const map = new Map<string, string>();

  if (unique.length === 0) {
    return map;
  }

  const supabase = await createClient();

  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500);

    const { data, error } = await supabase
      .schema("analytics")
      .from("player_current_info_v1")
      .select("player_slug, full_name, first_name, last_name")
      .in("player_slug", chunk)
      .returns<NameRow[]>();

    if (error) {
      console.error("player display names fetch error:", {
        message: error.message,
        code: error.code,
      });
      continue;
    }

    for (const row of data ?? []) {
      const name =
        [row.first_name, row.last_name].filter(Boolean).join(" ") ||
        row.full_name;

      if (name) {
        map.set(row.player_slug, name);
      }
    }
  }

  return map;
}
