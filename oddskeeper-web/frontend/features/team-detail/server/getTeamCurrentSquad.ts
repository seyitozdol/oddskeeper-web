import { createClient } from "../../../lib/supabase/server";
import { getPlayerDisplayNameMap } from "../../../lib/player-display-names";
import type { TeamCurrentSquadRow } from "../types";

export async function getTeamCurrentSquad(
  teamSlug: string
): Promise<TeamCurrentSquadRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("team_current_squad_v1")
    .select(
      `
        team_slug,
        team_source_id,
        team_name,
        player_source_id,
        player_name,
        age,
        shirt_number,
        position,
        position_group,
        position_sort,
        photo_url,
        fetched_at,
        player_slug
      `
    )
    .eq("team_slug", teamSlug)
    .order("position_sort", { ascending: true })
    .order("shirt_number", { ascending: true, nullsFirst: false })
    .returns<TeamCurrentSquadRow[]>();

  if (error) {
    console.error("team current squad fetch error:", {
      teamSlug,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return [];
  }

  const rows = data ?? [];
  const slugs = rows
    .map((row) => row.player_slug)
    .filter((s): s is string => Boolean(s));

  // Uyruk (bayrak) + TM piyasa degeri zenginlestirmesi; slug uzerinden.
  const [nameMap, natRes, mvRes] = await Promise.all([
    getPlayerDisplayNameMap(rows.map((row) => row.player_slug)),
    supabase
      .schema("analytics")
      .from("player_current_info_v1")
      .select("player_slug, nationality")
      .in("player_slug", slugs),
    supabase
      .schema("analytics")
      .from("player_market_value_v1")
      .select("player_slug, market_value_eur")
      .in("player_slug", slugs),
  ]);

  const natBySlug = new Map<string, string | null>();
  for (const r of natRes.data ?? []) {
    if (r.player_slug && !natBySlug.get(r.player_slug)) natBySlug.set(r.player_slug, r.nationality ?? null);
  }
  const mvBySlug = new Map<string, number | null>();
  for (const r of mvRes.data ?? []) {
    if (r.player_slug) mvBySlug.set(r.player_slug, r.market_value_eur == null ? null : Number(r.market_value_eur));
  }

  return rows.map((row) => ({
    ...row,
    player_name:
      (row.player_slug ? nameMap.get(row.player_slug) : null) ??
      row.player_name,
    nationality: row.player_slug ? natBySlug.get(row.player_slug) ?? null : null,
    market_value_eur: row.player_slug ? mvBySlug.get(row.player_slug) ?? null : null,
  }));
}
