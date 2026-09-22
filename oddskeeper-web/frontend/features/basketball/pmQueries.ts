"use client";

import { createClient } from "@/lib/supabase/client";
import { pmWrite } from "@/lib/pm-write-client";

const PM_WRITE = "/api/basketball/pm-write";

// league varsayılan 'basketball' (BSL); EL/EC için 'euroleague'/'eurocup' geçilir.
// Tüm pm_* tabloları league kolonu + bileşik PK ile çok-lig paylaşımlı.

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
  // Basketbol: Bets10 toplam sayı + handikap çizgisi (ev perspektifi). Voleybol yazmaz (opsiyonel).
  total_line?: number | null;
  hcp_line?: number | null;
};

// Bets10 basketbol bağı (resolver link_fixtures_bets10.py -> tracker.bb_fixture_bets10_link).
// Event bazlı: takım slug'ları bizim uzayda; Fixtures sekmesi "Bets10'dan doldur" + satır önerisi.
export type BbBets10Link = {
  event_id: number;
  bets10_event_id: string | null;
  home_team_slug: string;
  away_team_slug: string;
  home_team_name: string | null;
  away_team_name: string | null;
  tournament_name: string | null;
  start_ts: string | null;
  home_odds: number | null;
  away_odds: number | null;
  hcp_line: number | null;
  hcp_home_odds: number | null;
  hcp_away_odds: number | null;
  total_line: number | null;
  total_over_odds: number | null;
  total_under_odds: number | null;
};
export async function fetchBets10Links(league = "basketball"): Promise<BbBets10Link[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics").from("bb_fixture_bets10_link_v1")
    .select("event_id,bets10_event_id,home_team_slug,away_team_slug,home_team_name,away_team_name,tournament_name,start_ts,home_odds,away_odds,hcp_line,hcp_home_odds,hcp_away_odds,total_line,total_over_odds,total_under_odds")
    .eq("league", league)
    .order("start_ts", { ascending: true })
    .limit(200)
    .returns<BbBets10Link[]>();
  if (error) { console.error("fetchBets10Links", error.message); return []; }
  return (data ?? []).map((r) => ({
    ...r,
    home_odds: r.home_odds != null ? Number(r.home_odds) : null,
    away_odds: r.away_odds != null ? Number(r.away_odds) : null,
    hcp_line: r.hcp_line != null ? Number(r.hcp_line) : null,
    hcp_home_odds: r.hcp_home_odds != null ? Number(r.hcp_home_odds) : null,
    hcp_away_odds: r.hcp_away_odds != null ? Number(r.hcp_away_odds) : null,
    total_line: r.total_line != null ? Number(r.total_line) : null,
    total_over_odds: r.total_over_odds != null ? Number(r.total_over_odds) : null,
    total_under_odds: r.total_under_odds != null ? Number(r.total_under_odds) : null,
  }));
}

/* ---------------- markets ---------------- */
export async function fetchMarkets(league = "basketball"): Promise<PmMarket[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics").from("bb_pm_markets")
    .select("market_key,label,template_id,std,is_custom,market_type,in_model,sort_order")
    .eq("league", league)
    .order("sort_order", { ascending: true })
    .returns<PmMarket[]>();
  if (error) { console.error("fetchMarkets", error.message); return []; }
  return data ?? [];
}
export async function upsertMarket(m: Partial<PmMarket> & { market_key: string; label: string }, league = "basketball"): Promise<boolean> {
  return pmWrite(PM_WRITE, { league, action: "upsertMarket", payload: { market: m } });
}
export async function deleteMarket(market_key: string, league = "basketball"): Promise<boolean> {
  return pmWrite(PM_WRITE, { league, action: "deleteMarket", payload: { market_key } });
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
  // Market bazinda Under tarafini tamamen kapatir (voleybol Config'te kullaniliyor;
  // basketbolda kolon UI'da yok, degeri hep true kalir).
  under_enabled: boolean;
};

const CFG_COLS = "market_group,market_key,label,base_metric,side,template_id,std,lines,under_lines,payback,round_odds,max_lines,odds_cap,skip_after,skip_step,in_model,sort_order,under_enabled";

export async function fetchMarketConfig(league = "basketball"): Promise<PmMarketConfig[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics").from("bb_pm_market_config")
    .select(CFG_COLS).eq("league", league)
    .order("sort_order", { ascending: true })
    .returns<PmMarketConfig[]>();
  if (error) { console.error("fetchMarketConfig", error.message); return []; }
  return data ?? [];
}
export async function upsertMarketConfig(rows: (Partial<PmMarketConfig> & { market_group: string; market_key: string })[], league = "basketball"): Promise<boolean> {
  if (rows.length === 0) return true;
  return pmWrite(PM_WRITE, { league, action: "upsertMarketConfig", payload: { rows } });
}
export async function deleteMarketConfig(market_group: string, market_key: string, league = "basketball"): Promise<boolean> {
  return pmWrite(PM_WRITE, { league, action: "deleteMarketConfig", payload: { market_group, market_key } });
}

/* ---------------- fixtures (manual) ---------------- */
export async function fetchPmFixtures(league = "basketball"): Promise<PmFixture[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics").from("bb_pm_fixtures")
    .select("id,home_team_slug,away_team_slug,home_team_name,away_team_name,external_id,match_date,note,total_line,hcp_line")
    .eq("league", league)
    .order("match_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .returns<PmFixture[]>();
  if (error) { console.error("fetchPmFixtures", error.message); return []; }
  return (data ?? []).map((f) => ({
    ...f,
    total_line: f.total_line != null ? Number(f.total_line) : null,
    hcp_line: f.hcp_line != null ? Number(f.hcp_line) : null,
  }));
}
export async function insertFixture(f: Omit<PmFixture, "id">, league = "basketball"): Promise<boolean> {
  return pmWrite(PM_WRITE, { league, action: "insertFixture", payload: { fixture: f } });
}
export async function updateFixture(id: number, patch: Partial<PmFixture>): Promise<boolean> {
  return pmWrite(PM_WRITE, { action: "updateFixture", payload: { id, patch } });
}
export async function deleteFixture(id: number): Promise<boolean> {
  return pmWrite(PM_WRITE, { action: "deleteFixture", payload: { id } });
}

/* ---------------- player merges (mükerrer → kanonik) ---------------- */
export type PmMerge = {
  alias_slug: string;
  canonical_slug: string;
  canonical_name: string | null;
};
export async function fetchPlayerMerges(league = "basketball"): Promise<PmMerge[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics").from("bb_pm_player_merges")
    .select("alias_slug,canonical_slug,canonical_name").eq("league", league)
    .returns<PmMerge[]>();
  if (error) { console.error("fetchPlayerMerges", error.message); return []; }
  return data ?? [];
}
export async function savePlayerMerges(rows: PmMerge[], league = "basketball"): Promise<boolean> {
  if (rows.length === 0) return true;
  return pmWrite(PM_WRITE, { league, action: "savePlayerMerges", payload: { rows } });
}
export async function deletePlayerMerge(alias_slug: string, league = "basketball"): Promise<boolean> {
  return pmWrite(PM_WRITE, { league, action: "deletePlayerMerge", payload: { alias_slug } });
}

/* ---------------- model config (rol eşikleri vb.) ---------------- */
export type PmModelConfig = { key: string; value: number; note: string | null };

export async function fetchModelConfig(): Promise<PmModelConfig[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics").from("bb_model_config")
    .select("key,value,note").order("key", { ascending: true })
    .returns<PmModelConfig[]>();
  if (error) { console.error("fetchModelConfig", error.message); return []; }
  return data ?? [];
}
// Sadece mevcut anahtarların value'sunu günceller (view auto-updatable, insert gerekmez).
export async function saveModelConfig(rows: { key: string; value: number }[]): Promise<boolean> {
  if (rows.length === 0) return true;
  return pmWrite(PM_WRITE, { action: "saveModelConfig", payload: { rows } });
}

/* ---------------- player external ids ---------------- */
export async function fetchPlayerIds(league = "basketball"): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics").from("bb_pm_player_ids")
    .select("player_slug,external_id").eq("league", league)
    .returns<{ player_slug: string; external_id: string | null }[]>();
  if (error) { console.error("fetchPlayerIds", error.message); return {}; }
  const out: Record<string, string> = {};
  for (const r of data ?? []) if (r.external_id) out[r.player_slug] = r.external_id;
  return out;
}
export async function savePlayerIds(entries: Record<string, string>, league = "basketball"): Promise<boolean> {
  return pmWrite(PM_WRITE, { league, action: "savePlayerIds", payload: { entries } });
}
