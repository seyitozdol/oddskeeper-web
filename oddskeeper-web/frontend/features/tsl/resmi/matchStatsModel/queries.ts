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
export interface RefereeSeasonStat {
  apps: number;
  cards_pg: number | null;
  fouls_pg: number | null;
}
// Hakem: güncel + bir önceki sezon istatistikleri (o lige ait maçlar).
export interface RefereeRow {
  referee_name: string;
  current: RefereeSeasonStat | null; // güncel sezon (2026/2027)
  prev: RefereeSeasonStat | null;    // bir önceki sezon (2025/2026)
}
// Seçili hakemin efektif verisi: güncel sezonda apps>=minMatches ise güncel,
// değilse geçmiş sezon, o da yoksa null (veri yok). "used" hangi sezonun kullanıldığı.
export function resolveReferee(
  row: RefereeRow | undefined,
  minMatches: number
): { stat: RefereeSeasonStat; used: "current" | "prev" } | null {
  if (!row) return null;
  if (row.current && row.current.apps >= minMatches) return { stat: row.current, used: "current" };
  if (row.prev) return { stat: row.prev, used: "prev" };
  return null;
}
// slug -> season -> HFAA
export type HistBySlug = Record<string, Record<string, HFAA>>;
// slug -> HFAA (güncel sezon)
export type CurrentBySlug = Record<string, HFAA>;

function sb() {
  return createClient().schema("analytics");
}

// league → fikstür kaynağı. TSL apifootball (league_fixtures_v1); 1.Lig SofaScore
// (msm_fixtures_tff1_v1 = tff1_fixtures_v1 + team_id→msm slug köprüsü).
const COMPETITION: Record<string, string> = { tsl: "Süper Lig", tff1: "1. Lig" };
const FIXTURE_VIEW: Record<string, string> = { tsl: "league_fixtures_v1", tff1: "msm_fixtures_tff1_v1" };
export const FIXTURE_SEASON = "2026/2027"; // slash formatı (her iki kaynak da)

export interface FixtureRow {
  fixtureId: string;
  round: number;
  homeSlug: string;
  awaySlug: string;
  homeName: string;
  awayName: string;
  label: string;
  datetime: string | null;
  // Kullanicinin elle olusturdugu fikstür (round'dan bagimsiz, en ustte, silinebilir).
  manual?: boolean;
  // Manuel fikstürde ligde olmayan taraf icin secilen "benzer takım" (proxy)
  // slug'i; model verileri bu takımdan alinir, gorunen isim manuel kalir.
  homeProxySlug?: string | null;
  awayProxySlug?: string | null;
}
export interface FixtureInput {
  externalFixtureId: string;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
}

// Mac basladi mi? Deadline = baslama saati; skora bakilmaz (fixture_status
// kaynakta bayat kalabiliyor, ona guvenilmez).
export function fixtureStarted(f: FixtureRow): boolean {
  if (!f.datetime) return false;
  const t = new Date(f.datetime).getTime();
  return Number.isFinite(t) && t <= Date.now();
}

// Bir mac bitti mi? Kickoff + tipik toplam mac suresi (2x45 + devre arasi + uzatma
// + olasi VAR/gecikme icin guvenli tampon) gectiyse bitmis sayilir. Round beklemeden
// MAC BAZLI arsivleme icin (fixture_status guvenilmez, ona bakilmaz; erteleme
// edge-case'i disinda kickoff saati gectiyse mac oynanmis varsayilir).
export const MATCH_DURATION_MS = 2.5 * 60 * 60 * 1000; // ~2.5 saat (kickoff -> kesin bitis)
export function fixtureFinished(f: FixtureRow): boolean {
  if (!f.datetime) return false;
  const t = new Date(f.datetime).getTime();
  return Number.isFinite(t) && t + MATCH_DURATION_MS <= Date.now();
}

// Tamamlanan haftalar: round'un SON macinin baslama saati gectiyse o round
// "tamamlanan hafta" sayilir. Manuel fikstürler (round=0, datetime yok) haric.
export function completedRoundSet(fixtures: FixtureRow[]): Set<number> {
  const last: Record<number, number> = {};
  for (const f of fixtures) {
    if (f.manual || !f.datetime) continue;
    const t = new Date(f.datetime).getTime();
    if (!Number.isFinite(t)) continue;
    if (!(f.round in last) || t > last[f.round]) last[f.round] = t;
  }
  const now = Date.now();
  const out = new Set<number>();
  for (const [r, t] of Object.entries(last)) if (t <= now) out.add(Number(r));
  return out;
}

export async function fetchFixtures(league: string, round?: number): Promise<FixtureRow[]> {
  let q = sb()
    .from(FIXTURE_VIEW[league] ?? "league_fixtures_v1")
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
    datetime: (r.fixture_datetime as string) ?? null,
  }));
}

// GSheet sekmesi: maç başına takım statları (analytics.msm_gsheet_v1, source='sofascore').
export interface GsheetRow {
  sourceMatchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeSlug: string;
  awaySlug: string;
  vals: Record<string, number | null>;
}
export async function fetchGsheetRows(league: string): Promise<GsheetRow[]> {
  const { data, error } = await sb()
    .from("msm_gsheet_v1")
    .select("*")
    .eq("league", league)
    .eq("season_label", FIXTURE_SEASON);
  if (error) { console.error("fetchGsheetRows", error); return []; }
  return (data ?? []).map((r) => {
    const vals: Record<string, number | null> = {};
    for (const k of Object.keys(r)) {
      if (["source_match_id", "league", "competition", "match_datetime", "season_label",
           "home_team_id", "away_team_id", "home_team_name", "away_team_name",
           "home_team_slug", "away_team_slug"].includes(k)) continue;
      vals[k] = r[k] != null ? Number(r[k]) : null;
    }
    return {
      sourceMatchId: String(r.source_match_id),
      homeTeamName: (r.home_team_name as string) ?? "",
      awayTeamName: (r.away_team_name as string) ?? "",
      homeSlug: (r.home_team_slug as string) ?? "",
      awaySlug: (r.away_team_slug as string) ?? "",
      vals,
    };
  });
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

// ── Manuel fikstürler ──────────────────────────────────────────────────────
// Serbest metin (slug'sız) takım için sentetik slug: model'in output guard'ı boş
// slug'ı reddeder. "manual-" öneki gerçek takım slug'larıyla çakışmaz (stats boş
// kalır, kullanicinin elle girdiği home/away değerleriyle line üretilir).
export function manualSlug(name: string): string {
  return (
    "manual-" +
    (name
      .toLowerCase()
      .replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[ğĞ]/g, "g")
      .replace(/[çÇ]/g, "c").replace(/[öÖ]/g, "o").replace(/[üÜ]/g, "u")
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "team")
  );
}

export async function fetchManualFixtures(league: string): Promise<FixtureRow[]> {
  const { data, error } = await sb()
    .from("msm_manual_fixtures")
    .select("id, home_slug, home_name, away_slug, away_name, home_proxy_slug, away_proxy_slug, created_at")
    .eq("league", league)
    .order("created_at", { ascending: false });
  if (error) { console.error("fetchManualFixtures", error); return []; }
  return (data ?? []).map((r) => ({
    fixtureId: String(r.id),
    round: 0,
    // Boş slug (serbest metin / eski kayıt) -> sentetik slug (guard geçsin).
    homeSlug: (r.home_slug as string) || manualSlug(r.home_name as string),
    awaySlug: (r.away_slug as string) || manualSlug(r.away_name as string),
    homeName: r.home_name as string,
    awayName: r.away_name as string,
    label: `${r.home_name} - ${r.away_name}`,
    datetime: null,
    manual: true,
    homeProxySlug: (r.home_proxy_slug as string) ?? null,
    awayProxySlug: (r.away_proxy_slug as string) ?? null,
  }));
}

// Manuel fikstürün bir tarafina "benzer takım" (proxy) atar/temizler.
export async function setManualFixtureProxy(
  id: string,
  side: "home" | "away",
  proxySlug: string
): Promise<boolean> {
  const { error } = await createClient().rpc("msm_set_manual_fixture_proxy", {
    p_id: id, p_side: side, p_proxy_slug: proxySlug,
  });
  if (error) { console.error("setManualFixtureProxy", error); return false; }
  return true;
}

export async function addManualFixture(
  league: string,
  homeSlug: string,
  homeName: string,
  awaySlug: string,
  awayName: string
): Promise<string | null> {
  const { data, error } = await createClient().rpc("msm_add_manual_fixture", {
    p_league: league,
    p_home_slug: homeSlug,
    p_home_name: homeName,
    p_away_slug: awaySlug,
    p_away_name: awayName,
  });
  if (error) { console.error("addManualFixture", error); return null; }
  return (data as string) ?? null;
}

export async function deleteManualFixture(id: string): Promise<boolean> {
  const { error } = await createClient().rpc("msm_delete_manual_fixture", { p_id: id });
  if (error) { console.error("deleteManualFixture", error); return false; }
  return true;
}

// Takım logoları: tsl → null (lokal /images/football_logos/{slug}.png kullanılır);
// tff1 → slug→logo_url (msm_team_logos_tff1_v1); cup → slug→Mackolik CDN URL
// (cup_msm_team_logos_v1) çünkü amatör takımların yerel logosu yok (404 → kırık).
export async function fetchTeamLogos(league: string): Promise<Record<string, string> | null> {
  if (league !== "tff1" && league !== "cup") return null;
  const view = league === "cup" ? "cup_msm_team_logos_v1" : "msm_team_logos_tff1_v1";
  const { data, error } = await sb().from(view).select("slug, logo_url");
  if (error) { console.error("fetchTeamLogos", error); return {}; }
  const out: Record<string, string> = {};
  for (const r of data ?? []) if (r.logo_url) out[r.slug as string] = r.logo_url as string;
  return out;
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
      // Yarı-bazlı fiyatlama (Config Markets); kolon yoksa (eski şema) global davranış.
      payback1h: r.payback_1h != null ? Number(r.payback_1h) : undefined,
      payback2h: r.payback_2h != null ? Number(r.payback_2h) : undefined,
      under1h: r.under_1h != null ? !!r.under_1h : undefined,
      under2h: r.under_2h != null ? !!r.under_2h : undefined,
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
      suLow: 1.17, suHigh: 4.51, refereeMinMatches: 5,
    };
  }
  return {
    margin: Number(data.margin), refereeWeight: Number(data.referee_weight),
    supremacyDivisor: Number(data.supremacy_divisor),
    xmatrixWOwnFor: Number(data.xmatrix_w_own_for), xmatrixWOwnAlt: Number(data.xmatrix_w_own_alt),
    xmatrixWOppAlt: Number(data.xmatrix_w_opp_alt), xmatrixWOppAgainst: Number(data.xmatrix_w_opp_against),
    suLow: Number(data.su_low), suHigh: Number(data.su_high),
    refereeMinMatches: data.referee_min_matches != null ? Number(data.referee_min_matches) : 5,
  };
}

// Güncel + bir önceki sezonun (slash formatı) hakem istatistikleri; hakem başına
// birleştirilir. Kaynak: analytics.msm_referee_season_stats_v1 (o lige ait maçlar).
export async function fetchReferees(league: string): Promise<RefereeRow[]> {
  const cur = CURRENT_SEASON.replace("-", "/"); // "2026/2027"
  const prev = HIST_SEASONS[0].replace("-", "/"); // "2025/2026"
  const { data, error } = await sb()
    .from("msm_referee_season_stats_v1")
    .select("referee, season, apps, cards_pg, fouls_pg")
    .eq("league", league)
    .in("season", [cur, prev]);
  if (error) {
    console.error("fetchReferees", error);
    return [];
  }
  const byName: Record<string, RefereeRow> = {};
  for (const r of data ?? []) {
    const name = r.referee as string;
    const stat: RefereeSeasonStat = {
      apps: Number(r.apps),
      cards_pg: r.cards_pg != null ? Number(r.cards_pg) : null,
      fouls_pg: r.fouls_pg != null ? Number(r.fouls_pg) : null,
    };
    const row = (byName[name] ??= { referee_name: name, current: null, prev: null });
    if (r.season === cur) row.current = stat;
    else if (r.season === prev) row.prev = stat;
  }
  return Object.values(byName).sort((a, b) =>
    a.referee_name.localeCompare(b.referee_name, "tr")
  );
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

// Bu market + takımlarda verisi TAHMINI (estimated=true) olan slug'lar. MSM rozeti
// icin: kupa Saves gibi gercek veri olmayan yerlerde SOT*oran ile turetilmis deger.
export async function fetchEstimatedSlugs(
  league: string,
  market: string,
  slugs: string[]
): Promise<Set<string>> {
  if (slugs.length === 0) return new Set();
  const { data, error } = await sb()
    .from("msm_histdata_v1")
    .select("team_slug")
    .eq("league", league)
    .eq("market", market)
    .eq("estimated", true)
    .in("team_slug", slugs);
  if (error) { console.error("fetchEstimatedSlugs", error); return new Set(); }
  return new Set((data ?? []).map((r) => r.team_slug as string));
}

// ─── Config sekmesi: ham satırlar + yazma (RPC) + template listesi ──────────
export interface RawModelConfig {
  margin: number; referee_weight: number; supremacy_divisor: number;
  xmatrix_w_own_for: number; xmatrix_w_own_alt: number;
  xmatrix_w_opp_alt: number; xmatrix_w_opp_against: number;
  su_low: number; su_high: number;
  engine: "analytic" | "montecarlo"; mc_samples: number;
  weight_s1: number; weight_s2: number; weight_s3: number; weight_s4: number; default_etki: number;
  referee_min_matches: number;
}
export interface RawMarketConfig {
  market: string;
  std_home_ft: number; std_away_ft: number;
  std_home_1h: number; std_away_1h: number;
  std_home_2h: number; std_away_2h: number;
  split_1h: number; split_2h: number;
  supremacy_applies: boolean; referee_applies: boolean;
  line_count: number; send_halves: boolean; mid_only: boolean;
  line_count_1h: number; line_count_2h: number;
  under_1h: boolean; under_2h: boolean;
  payback_1h: number; payback_2h: number;
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
    referee_min_matches: data.referee_min_matches != null ? n(data.referee_min_matches) : 5,
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
    line_count_1h: r.line_count_1h != null ? n(r.line_count_1h) : 3,
    line_count_2h: r.line_count_2h != null ? n(r.line_count_2h) : 3,
    under_1h: r.under_1h != null ? !!r.under_1h : true,
    under_2h: r.under_2h != null ? !!r.under_2h : true,
    payback_1h: r.payback_1h != null ? n(r.payback_1h) : 0.93,
    payback_2h: r.payback_2h != null ? n(r.payback_2h) : 0.93,
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
