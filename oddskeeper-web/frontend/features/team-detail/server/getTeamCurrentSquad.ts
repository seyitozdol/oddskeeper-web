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

  const rawRows = data ?? [];

  // TEK-PROFIL: ham kadro view'i apifootball slug'i tasir (a-nubel--af399);
  // oyuncunun gercek veri profili opta/ss slug'inda olabilir. Kopru view'i
  // (team_current_squad_profile_v1: player_mapping + DOB'lu af->sofa->opta
  // zinciri) af id -> profil slug'ini cozer; linkler o slug'a gider, cozulemeyen
  // (verisiz yeni transfer) af slug'inda kalir (bio fallback sayfasi).
  const { data: profData } = await supabase
    .schema("analytics")
    .from("team_current_squad_profile_v1")
    .select("af_player_id, player_slug")
    .eq("team_slug", teamSlug);
  const profSlugByAf = new Map<string, string>();
  for (const r of profData ?? []) {
    if (r.af_player_id && r.player_slug) profSlugByAf.set(String(r.af_player_id), String(r.player_slug));
  }
  const rows = rawRows.map((row) => ({
    ...row,
    player_slug: profSlugByAf.get(String(row.player_source_id)) ?? row.player_slug,
  }));

  // Zenginlestirme tablolari (isim/uyruk/deger) af ya da profil slug'iyla
  // yazilmis olabilir; iki slug'la da ara.
  const slugSet = new Set<string>();
  for (const row of rows) if (row.player_slug) slugSet.add(row.player_slug);
  for (const row of rawRows) if (row.player_slug) slugSet.add(row.player_slug);
  const slugs = [...slugSet];

  // Uyruk (bayrak) + TM piyasa degeri zenginlestirmesi; slug uzerinden.
  const [nameMap, natRes, mvRes] = await Promise.all([
    getPlayerDisplayNameMap(slugs),
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

  const lookup = <T,>(m: Map<string, T>, a?: string | null, b?: string | null): T | null => {
    if (a && m.has(a)) return m.get(a) as T;
    if (b && m.has(b)) return m.get(b) as T;
    return null;
  };

  return rows.map((row, i) => ({
    ...row,
    player_name:
      lookup(nameMap, row.player_slug, rawRows[i]?.player_slug) ?? row.player_name,
    nationality: lookup(natBySlug, row.player_slug, rawRows[i]?.player_slug),
    market_value_eur: lookup(mvBySlug, row.player_slug, rawRows[i]?.player_slug),
  }));
}
