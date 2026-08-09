import { cache } from "react";
import { createClient } from "../../../lib/supabase/server";
import type { TeamAliasMap } from "@/lib/team-alias";

type TeamAliasDbRow = {
  team_slug: string;
  short_name: string | null;
  code: string | null;
};

// Tüm takım alias kayıtlarını (21 satır) tek seferde çeker; istek başına
// cache'lenir. Alias'ı olmayan takımlar frontend'de sonek kırpma ile çözülür.
export const getTeamAliases = cache(async (): Promise<TeamAliasMap> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("ref")
    .from("team_profiles")
    .select("team_slug, short_name, code")
    .returns<TeamAliasDbRow[]>();

  if (error) {
    console.error("team aliases fetch error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return {};
  }

  const map: TeamAliasMap = {};
  for (const row of data ?? []) {
    map[row.team_slug] = { short_name: row.short_name, code: row.code };
  }
  return map;
});
