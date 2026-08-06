"use client";

import { createClient } from "@/lib/supabase/client";
import type { MarketConfig, ModelConfig, HFAA } from "@/features/match-stats-model/engine";

// Excel'deki market sırası.
export const MARKETS = [
  "Shot", "SOT", "Foul", "Corner", "Offside", "Saves", "Tackle", "Card", "Throw-in", "Goal Kick",
] as const;
export type Market = (typeof MARKETS)[number];

// Geçmiş sezonlar (msm.histdata) + güncel sezon (henüz boş olabilir).
export const HIST_SEASONS = ["2025-2026", "2024-2025", "2023-2024"] as const;
export const CURRENT_SEASON = "2026-2027";

// Supremacy yönü: pozitif = favori daha çok (Shot/SOT/Corner); negatif = favori daha az.
const SUPREMACY_SIGN: Record<string, "positive" | "negative" | "none"> = {
  Shot: "positive", SOT: "positive", Corner: "positive",
  Foul: "negative", Card: "negative", Saves: "negative", "Goal Kick": "negative",
  Offside: "none", Tackle: "none", "Throw-in": "none",
};

export interface TeamOption {
  slug: string;
  name: string;
}
export interface RefereeRow {
  referee_name: string;
  cards_pg: number | null;
  fouls_pg: number | null;
  played: number | null;
}
// slug -> season -> HFAA
export type HistBySlug = Record<string, Record<string, HFAA>>;
// slug -> HFAA (güncel sezon)
export type CurrentBySlug = Record<string, HFAA>;

function sb() {
  return createClient().schema("analytics");
}

// league → league_fixtures_v1.competition eşlemesi.
const COMPETITION: Record<string, string> = { tsl: "Süper Lig", tff1: "1. Lig" };
export const FIXTURE_SEASON = "2026/2027"; // league_fixtures_v1 slash formatı

export interface FixtureRow {
  fixtureId: string;
  round: number;
  homeSlug: string;
  awaySlug: string;
  homeName: string;
  awayName: string;
  label: string;
}
export interface FixtureInput {
  externalFixtureId: string;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
}

export async function fetchFixtures(league: string, round?: number): Promise<FixtureRow[]> {
  let q = sb()
    .from("league_fixtures_v1")
    .select("fixture_id, round_number, home_team_slug, away_team_slug, home_team_name, away_team_name, fixture_datetime")
    .eq("competition", COMPETITION[league] ?? league)
    .eq("season_label", FIXTURE_SEASON)
    .order("round_number")
    .order("fixture_datetime");
  if (round != null) q = q.eq("round_number", round);
  const { data, error } = await q;
  if (error) { console.error("fetchFixtures", error); return []; }
  return (data ?? []).map((r) => ({
    fixtureId: String(r.fixture_id),
    round: Number(r.round_number),
    homeSlug: r.home_team_slug as string,
    awaySlug: r.away_team_slug as string,
    homeName: (r.home_team_name as string) ?? r.home_team_slug,
    awayName: (r.away_team_name as string) ?? r.away_team_slug,
    label: `${r.home_team_name} - ${r.away_team_name}`,
  }));
}

export async function fetchFixtureInputs(league: string): Promise<Record<string, FixtureInput>> {
  const { data, error } = await sb()
    .from("msm_fixture_inputs_v1")
    .select("fixture_id, external_fixture_id, home_odds, draw_odds, away_odds")
    .eq("league", league);
  if (error) { console.error("fetchFixtureInputs", error); return {}; }
  const out: Record<string, FixtureInput> = {};
  for (const r of data ?? []) {
    out[String(r.fixture_id)] = {
      externalFixtureId: (r.external_fixture_id as string) ?? "",
      homeOdds: r.home_odds != null ? Number(r.home_odds) : null,
      drawOdds: r.draw_odds != null ? Number(r.draw_odds) : null,
      awayOdds: r.away_odds != null ? Number(r.away_odds) : null,
    };
  }
  return out;
}

// Bets10 önerisi (resolver'ın doldurduğu tracker.fixture_bets10_link).
export interface Bets10Link {
  bets10EventId: string | null;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
  matchScore: number | null;
}
export async function fetchBets10Links(league: string): Promise<Record<string, Bets10Link>> {
  const { data, error } = await sb()
    .from("fixture_bets10_link_v1")
    .select("fixture_id, bets10_event_id, home_odds, draw_odds, away_odds, match_score")
    .eq("league", league);
  if (error) { console.error("fetchBets10Links", error); return {}; }
  const out: Record<string, Bets10Link> = {};
  for (const r of data ?? []) {
    out[String(r.fixture_id)] = {
      bets10EventId: (r.bets10_event_id as string) ?? null,
      homeOdds: r.home_odds != null ? Number(r.home_odds) : null,
      drawOdds: r.draw_odds != null ? Number(r.draw_odds) : null,
      awayOdds: r.away_odds != null ? Number(r.away_odds) : null,
      matchScore: r.match_score != null ? Number(r.match_score) : null,
    };
  }
  return out;
}

export async function saveFixtureInputs(
  league: string,
  rows: Array<{ fixture_id: string; external_fixture_id: string; home_odds: number | null; draw_odds: number | null; away_odds: number | null }>
): Promise<boolean> {
  const { error } = await createClient().rpc("msm_upsert_fixture_inputs", { p_league: league, p_rows: rows });
  if (error) { console.error("saveFixtureInputs", error); return false; }
  return true;
}

export async function logImport(league: string, row: Record<string, unknown>): Promise<boolean> {
  const { error } = await createClient().rpc("msm_log_import", { p_league: league, p_row: row });
  if (error) { console.error("logImport", error); return false; }
  return true;
}

export async function fetchTeams(league: string): Promise<TeamOption[]> {
  const { data, error } = await sb()
    .from("msm_teams_v1")
    .select("team_slug, display_name")
    .eq("league", league);
  if (error) {
    console.error("fetchTeams", error);
    return [];
  }
  return (data ?? [])
    .map((r) => ({ slug: r.team_slug as string, name: (r.display_name as string) ?? r.team_slug }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export async function fetchMarketConfigs(league: string): Promise<Record<string, MarketConfig>> {
  const { data, error } = await sb()
    .from("msm_market_config_v1")
    .select("*")
    .eq("league", league);
  if (error) {
    console.error("fetchMarketConfigs", error);
    return {};
  }
  const out: Record<string, MarketConfig> = {};
  for (const r of data ?? []) {
    const market = r.market as string;
    out[market] = {
      market,
      stdHomeFt: Number(r.std_home_ft), stdAwayFt: Number(r.std_away_ft),
      stdHome1h: Number(r.std_home_1h), stdAway1h: Number(r.std_away_1h),
      stdHome2h: Number(r.std_home_2h), stdAway2h: Number(r.std_away_2h),
      split1h: Number(r.split_1h), split2h: Number(r.split_2h),
      supremacyApplies: !!r.supremacy_applies,
      supremacySign: SUPREMACY_SIGN[market] ?? "none",
      refereeApplies: !!r.referee_applies,
    };
  }
  return out;
}

export async function fetchModelConfig(league: string): Promise<ModelConfig> {
  const { data, error } = await sb()
    .from("msm_model_config_v1")
    .select("*")
    .eq("league", league)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("fetchModelConfig", error);
    // güvenli varsayılan (msm.model_config defaultlarıyla aynı)
    return {
      margin: 0.93, refereeWeight: 0.3, supremacyDivisor: 5.5,
      xmatrixWOwnFor: 0.65, xmatrixWOwnAlt: 0.05, xmatrixWOppAlt: 0.05, xmatrixWOppAgainst: 0.25,
      suLow: 1.17, suHigh: 4.51,
    };
  }
  return {
    margin: Number(data.margin), refereeWeight: Number(data.referee_weight),
    supremacyDivisor: Number(data.supremacy_divisor),
    xmatrixWOwnFor: Number(data.xmatrix_w_own_for), xmatrixWOwnAlt: Number(data.xmatrix_w_own_alt),
    xmatrixWOppAlt: Number(data.xmatrix_w_opp_alt), xmatrixWOppAgainst: Number(data.xmatrix_w_opp_against),
    suLow: Number(data.su_low), suHigh: Number(data.su_high),
  };
}

export async function fetchReferees(league: string): Promise<RefereeRow[]> {
  const { data, error } = await sb()
    .from("msm_referee_v1")
    .select("referee_name, cards_pg, fouls_pg, played")
    .eq("league", league)
    .order("played", { ascending: false });
  if (error) {
    console.error("fetchReferees", error);
    return [];
  }
  return (data ?? []) as RefereeRow[];
}

export async function fetchHistData(
  league: string,
  market: string,
  slugs: string[]
): Promise<HistBySlug> {
  if (slugs.length === 0) return {};
  const { data, error } = await sb()
    .from("msm_histdata_v1")
    .select("team_slug, season, hf, ha, af, aa")
    .eq("league", league)
    .eq("market", market)
    .in("team_slug", slugs);
  if (error) {
    console.error("fetchHistData", error);
    return {};
  }
  const out: HistBySlug = {};
  for (const r of data ?? []) {
    const slug = r.team_slug as string;
    (out[slug] ??= {})[r.season as string] = {
      hf: Number(r.hf), ha: Number(r.ha), af: Number(r.af), aa: Number(r.aa),
    };
  }
  return out;
}

// ─── Config sekmesi: ham satırlar + yazma (RPC) + template listesi ──────────
export interface RawModelConfig {
  margin: number; referee_weight: number; supremacy_divisor: number;
  xmatrix_w_own_for: number; xmatrix_w_own_alt: number;
  xmatrix_w_opp_alt: number; xmatrix_w_opp_against: number;
  su_low: number; su_high: number;
  engine: "analytic" | "montecarlo"; mc_samples: number;
  weight_s1: number; weight_s2: number; weight_s3: number; weight_s4: number; default_etki: number;
}
export interface RawMarketConfig {
  market: string;
  std_home_ft: number; std_away_ft: number;
  std_home_1h: number; std_away_1h: number;
  std_home_2h: number; std_away_2h: number;
  split_1h: number; split_2h: number;
  supremacy_applies: boolean; referee_applies: boolean;
  line_count: number; send_halves: boolean; mid_only: boolean;
}
export interface TemplateRow {
  market: string; template_code: string; details: string | null; sort_order: number;
}

export async function fetchRawModelConfig(league: string): Promise<RawModelConfig | null> {
  const { data, error } = await sb().from("msm_model_config_v1").select("*").eq("league", league).maybeSingle();
  if (error || !data) { if (error) console.error("fetchRawModelConfig", error); return null; }
  const n = (v: unknown) => Number(v);
  return {
    margin: n(data.margin), referee_weight: n(data.referee_weight), supremacy_divisor: n(data.supremacy_divisor),
    xmatrix_w_own_for: n(data.xmatrix_w_own_for), xmatrix_w_own_alt: n(data.xmatrix_w_own_alt),
    xmatrix_w_opp_alt: n(data.xmatrix_w_opp_alt), xmatrix_w_opp_against: n(data.xmatrix_w_opp_against),
    su_low: n(data.su_low), su_high: n(data.su_high),
    engine: (data.engine as "analytic" | "montecarlo") ?? "analytic", mc_samples: n(data.mc_samples),
    weight_s1: n(data.weight_s1), weight_s2: n(data.weight_s2), weight_s3: n(data.weight_s3), weight_s4: n(data.weight_s4),
    default_etki: n(data.default_etki),
  };
}

export async function fetchRawMarketConfigs(league: string): Promise<RawMarketConfig[]> {
  const { data, error } = await sb().from("msm_market_config_v1").select("*").eq("league", league);
  if (error) { console.error("fetchRawMarketConfigs", error); return []; }
  const n = (v: unknown) => Number(v);
  return (data ?? []).map((r) => ({
    market: r.market as string,
    std_home_ft: n(r.std_home_ft), std_away_ft: n(r.std_away_ft),
    std_home_1h: n(r.std_home_1h), std_away_1h: n(r.std_away_1h),
    std_home_2h: n(r.std_home_2h), std_away_2h: n(r.std_away_2h),
    split_1h: n(r.split_1h), split_2h: n(r.split_2h),
    supremacy_applies: !!r.supremacy_applies, referee_applies: !!r.referee_applies,
    line_count: n(r.line_count), send_halves: !!r.send_halves, mid_only: !!r.mid_only,
  })).sort((a, b) => MARKETS.indexOf(a.market as Market) - MARKETS.indexOf(b.market as Market));
}

export async function fetchTemplates(league: string): Promise<TemplateRow[]> {
  const { data, error } = await sb()
    .from("msm_template_v1")
    .select("market, template_code, details, sort_order")
    .eq("league", league)
    .order("market")
    .order("sort_order");
  if (error) { console.error("fetchTemplates", error); return []; }
  return (data ?? []) as TemplateRow[];
}

export async function saveModelConfig(league: string, patch: Partial<RawModelConfig>): Promise<boolean> {
  const { error } = await createClient().rpc("msm_update_model_config", { p_league: league, p_patch: patch });
  if (error) { console.error("saveModelConfig", error); return false; }
  return true;
}

export async function saveMarketConfig(league: string, market: string, patch: Partial<RawMarketConfig>): Promise<boolean> {
  const { error } = await createClient().rpc("msm_update_market_config", { p_league: league, p_market: market, p_patch: patch });
  if (error) { console.error("saveMarketConfig", error); return false; }
  return true;
}

// Güncel sezon MAÇ LOGU (Excel AM-BC alanı): seçili market, takım başına maç-maç.
export interface MatchLogRow {
  index: number;
  isHome: boolean;
  forVal: number;
  againstVal: number;
  oppSlug: string;
  oppName: string;
  redCards: number;
}
export async function fetchCurrentMatchLog(
  league: string,
  market: string,
  slugs: string[],
  season: string
): Promise<Record<string, MatchLogRow[]>> {
  if (slugs.length === 0) return {};
  const { data, error } = await sb()
    .from("msm_team_match_log_v1")
    .select("team_slug, source_rank, team_match_index, is_home, for_value, against_value, opp_slug, opponent_team_name, match_red_cards")
    .eq("league", league)
    .eq("market", market)
    .eq("season", season)
    .in("team_slug", slugs)
    .order("team_match_index");
  if (error) {
    console.error("fetchCurrentMatchLog", error);
    return {};
  }
  // Takım başına en düşük source_rank kaynağını seç (tek kaynak beklenir).
  const bestSrc: Record<string, number> = {};
  for (const r of data ?? []) {
    const slug = r.team_slug as string;
    const rank = Number(r.source_rank);
    if (bestSrc[slug] == null || rank < bestSrc[slug]) bestSrc[slug] = rank;
  }
  const out: Record<string, MatchLogRow[]> = {};
  for (const r of data ?? []) {
    const slug = r.team_slug as string;
    if (Number(r.source_rank) !== bestSrc[slug]) continue;
    (out[slug] ??= []).push({
      index: Number(r.team_match_index),
      isHome: !!r.is_home,
      forVal: Number(r.for_value),
      againstVal: r.against_value != null ? Number(r.against_value) : NaN,
      oppSlug: (r.opp_slug as string) ?? "",
      oppName: (r.opponent_team_name as string) ?? "",
      redCards: Number(r.match_red_cards) || 0,
    });
  }
  return out;
}

// Güncel sezon HF/HA/AF/AA (varsa). Kaynak önceliği: en düşük source_rank.
export async function fetchCurrentStats(
  league: string,
  market: string,
  slugs: string[],
  season: string
): Promise<CurrentBySlug> {
  if (slugs.length === 0) return {};
  const { data, error } = await sb()
    .from("msm_team_season_stats_v1")
    .select("team_slug, source_rank, hf, ha, af, aa")
    .eq("league", league)
    .eq("market", market)
    .eq("season", season)
    .in("team_slug", slugs);
  if (error) {
    console.error("fetchCurrentStats", error);
    return {};
  }
  const best: Record<string, number> = {};
  const out: CurrentBySlug = {};
  for (const r of data ?? []) {
    const slug = r.team_slug as string;
    const rank = Number(r.source_rank);
    if (best[slug] == null || rank < best[slug]) {
      best[slug] = rank;
      out[slug] = { hf: Number(r.hf), ha: Number(r.ha), af: Number(r.af), aa: Number(r.aa) };
    }
  }
  return out;
}
