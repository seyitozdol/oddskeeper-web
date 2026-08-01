"use client";

import { createClient } from "@/lib/supabase/client";

const LEAGUE = "basketball";

export type PmMarket = {
  market_key: string;
  label: string;
  template_id: string | null;
  std: number | null;
  is_custom: boolean;
  market_type: string;   // static | participant
  in_model: boolean;
  sort_order: number;
};

export type PmFixture = {
  id: number;
  home_team_slug: string;
  away_team_slug: string;
  home_team_name: string | null;
  away_team_name: string | null;
  external_id: string | null;
  match_date: string | null;
  note: string | null;
};

/* ---------------- markets ---------------- */
export async function fetchMarkets(): Promise<PmMarket[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics").from("bb_pm_markets")
    .select("market_key,label,template_id,std,is_custom,market_type,in_model,sort_order")
    .eq("league", LEAGUE)
    .order("sort_order", { ascending: true })
    .returns<PmMarket[]>();
  if (error) { console.error("fetchMarkets", error.message); return []; }
  return data ?? [];
}
export async function upsertMarket(m: Partial<PmMarket> & { market_key: string; label: string }): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.schema("analytics").from("bb_pm_markets").upsert(
    { league: LEAGUE, ...m, updated_at: new Date().toISOString() },
    { onConflict: "league,market_key" }
  );
  if (error) { console.error("upsertMarket", error.message); return false; }
  return true;
}
export async function deleteMarket(market_key: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.schema("analytics").from("bb_pm_markets").delete().eq("league", LEAGUE).eq("market_key", market_key);
  if (error) { console.error("deleteMarket", error.message); return false; }
  return true;
}

/* ---------------- market config (Config sekmesi: line kurallari) ---------------- */
export type PmMarketConfig = {
  market_group: string;   // 'player' | 'team'
  market_key: string;
  label: string | null;
  base_metric: string | null;
  side: string | null;    // 'home'|'away'|'total'|null
  template_id: string | null;
  std: number | null;
  lines: number;
  under_lines: number;
  payback: number | null; // null = grup varsayilani
  round_odds: boolean;
  max_lines: number;
  odds_cap: number;
  skip_after: number;
  skip_step: number;
  in_model: boolean;
  sort_order: number | null;
};

const CFG_COLS = "market_group,market_key,label,base_metric,side,template_id,std,lines,under_lines,payback,round_odds,max_lines,odds_cap,skip_after,skip_step,in_model,sort_order";

export async function fetchMarketConfig(): Promise<PmMarketConfig[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics").from("bb_pm_market_config")
    .select(CFG_COLS).eq("league", LEAGUE)
    .order("sort_order", { ascending: true })
    .returns<PmMarketConfig[]>();
  if (error) { console.error("fetchMarketConfig", error.message); return []; }
  return data ?? [];
}
export async function upsertMarketConfig(rows: (Partial<PmMarketConfig> & { market_group: string; market_key: string })[]): Promise<boolean> {
  if (rows.length === 0) return true;
  const supabase = createClient();
  const payload = rows.map((r) => ({ league: LEAGUE, ...r, updated_at: new Date().toISOString() }));
  const { error } = await supabase.schema("analytics").from("bb_pm_market_config")
    .upsert(payload, { onConflict: "league,market_group,market_key" });
  if (error) { console.error("upsertMarketConfig", error.message); return false; }
  return true;
}
export async function deleteMarketConfig(market_group: string, market_key: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.schema("analytics").from("bb_pm_market_config")
    .delete().eq("league", LEAGUE).eq("market_group", market_group).eq("market_key", market_key);
  if (error) { console.error("deleteMarketConfig", error.message); return false; }
  return true;
}

/* ---------------- fixtures (manual) ---------------- */
export async function fetchPmFixtures(): Promise<PmFixture[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics").from("bb_pm_fixtures")
    .select("id,home_team_slug,away_team_slug,home_team_name,away_team_name,external_id,match_date,note")
    .eq("league", LEAGUE)
    .order("match_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .returns<PmFixture[]>();
  if (error) { console.error("fetchPmFixtures", error.message); return []; }
  return data ?? [];
}
export async function insertFixture(f: Omit<PmFixture, "id">): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.schema("analytics").from("bb_pm_fixtures").insert({ league: LEAGUE, ...f });
  if (error) { console.error("insertFixture", error.message); return false; }
  return true;
}
export async function updateFixture(id: number, patch: Partial<PmFixture>): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.schema("analytics").from("bb_pm_fixtures")
    .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) { console.error("updateFixture", error.message); return false; }
  return true;
}
export async function deleteFixture(id: number): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.schema("analytics").from("bb_pm_fixtures").delete().eq("id", id);
  if (error) { console.error("deleteFixture", error.message); return false; }
  return true;
}

/* ---------------- player merges (mükerrer → kanonik) ---------------- */
export type PmMerge = {
  alias_slug: string;
  canonical_slug: string;
  canonical_name: string | null;
};
export async function fetchPlayerMerges(): Promise<PmMerge[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics").from("bb_pm_player_merges")
    .select("alias_slug,canonical_slug,canonical_name").eq("league", LEAGUE)
    .returns<PmMerge[]>();
  if (error) { console.error("fetchPlayerMerges", error.message); return []; }
  return data ?? [];
}
export async function savePlayerMerges(rows: PmMerge[]): Promise<boolean> {
  if (rows.length === 0) return true;
  const supabase = createClient();
  const payload = rows.map((r) => ({ league: LEAGUE, ...r, updated_at: new Date().toISOString() }));
  const { error } = await supabase.schema("analytics").from("bb_pm_player_merges")
    .upsert(payload, { onConflict: "league,alias_slug" });
  if (error) { console.error("savePlayerMerges", error.message); return false; }
  return true;
}
export async function deletePlayerMerge(alias_slug: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.schema("analytics").from("bb_pm_player_merges")
    .delete().eq("league", LEAGUE).eq("alias_slug", alias_slug);
  if (error) { console.error("deletePlayerMerge", error.message); return false; }
  return true;
}

/* ---------------- player external ids ---------------- */
export async function fetchPlayerIds(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics").from("bb_pm_player_ids")
    .select("player_slug,external_id").eq("league", LEAGUE)
    .returns<{ player_slug: string; external_id: string | null }[]>();
  if (error) { console.error("fetchPlayerIds", error.message); return {}; }
  const out: Record<string, string> = {};
  for (const r of data ?? []) if (r.external_id) out[r.player_slug] = r.external_id;
  return out;
}
export async function savePlayerIds(entries: Record<string, string>): Promise<boolean> {
  const rows = Object.entries(entries).map(([player_slug, v]) => ({
    league: LEAGUE, player_slug, external_id: v.trim() || null, updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return true;
  const supabase = createClient();
  const { error } = await supabase.schema("analytics").from("bb_pm_player_ids").upsert(rows, { onConflict: "league,player_slug" });
  if (error) { console.error("savePlayerIds", error.message); return false; }
  return true;
}
