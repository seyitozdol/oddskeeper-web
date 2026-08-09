import { cache } from "react";
import { createClient } from "../../../lib/supabase/server";

type TeamResultDateRow = {
  match_datetime: string | null;
};

// Ligde oynanmış son maçın tarihi. Sezon arası algısı için kullanılır:
// oyuncunun son maçı eskiyse ama lig de o tarihten beri oynamıyorsa durum
// "inaktif" değil "sezon arası"dır.
export const getLeagueLastMatchDate = cache(
  async (competition: string | null): Promise<string | null> => {
    const supabase = await createClient();

    let query = supabase
      .schema("analytics")
      .from("team_results_v1")
      .select("match_datetime")
      .lte("match_datetime", new Date().toISOString())
      .order("match_datetime", { ascending: false })
      .limit(1);

    if (competition) {
      query = query.eq("competition", competition);
    }

    const { data, error } = await query.returns<TeamResultDateRow[]>();

    if (error) {
      console.error("league last match date fetch error:", {
        competition,
        message: error.message,
        code: error.code,
      });
      return null;
    }

    return data?.[0]?.match_datetime ?? null;
  }
);
