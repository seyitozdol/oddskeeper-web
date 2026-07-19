import { createClient } from "../../../lib/supabase/server";

// Transfermarkt piyasa değeri (EUR); kayıt yoksa null.
export async function getPlayerMarketValue(
  playerSlug: string
): Promise<number | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("player_market_value_v1")
    .select("market_value_eur")
    .eq("player_slug", playerSlug)
    .limit(1)
    .returns<{ market_value_eur: number | null }[]>();

  if (error) {
    console.error("player market value fetch error:", {
      playerSlug,
      message: error.message,
      code: error.code,
    });
    return null;
  }

  return data?.[0]?.market_value_eur ?? null;
}
