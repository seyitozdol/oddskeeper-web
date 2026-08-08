import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  HistorySport,
  ModelHistoryDraft,
  ModelHistoryRecord,
} from "./model-history";

// Model export gecmisi server yardimcilari. model_export_history ve
// model_history_config tablolarina yalnizca service role erisir (bkz.
// sql/2026-08-08_model_export_history.sql), bu yuzden okuma/yazma hep admin
// client ile burada yapilir. Cagiran route once oturumu dogrular.

const DEFAULT_RETENTION_DAYS = 30;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3650;

type HistoryRow = {
  id: string;
  sport: string;
  league: string;
  kind: string;
  fixture_ext_id: string | null;
  match_label: string;
  market: string;
  author_name: string;
  created_at: string;
  snapshot: unknown;
};

function toRecord(row: HistoryRow): ModelHistoryRecord {
  return {
    id: row.id,
    sport: row.sport as HistorySport,
    league: row.league,
    kind: row.kind,
    fixtureExtId: row.fixture_ext_id,
    matchLabel: row.match_label,
    market: row.market,
    authorName: row.author_name,
    createdAt: row.created_at,
    snapshot: row.snapshot,
  };
}

// Saklama suresini 1..3650 araligina kelepceleyip tam sayiya yuvarlar.
export function clampRetention(days: unknown): number {
  const n = Math.round(Number(days));
  if (!Number.isFinite(n)) return DEFAULT_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, n));
}

// Verili spor/lig icin son kayitlari getirir (ortak liste, en yeni ustte).
export async function listHistory(
  admin: SupabaseClient,
  sport: string,
  league: string,
  limit: number
): Promise<ModelHistoryRecord[]> {
  const { data, error } = await admin
    .from("model_export_history")
    .select(
      "id, sport, league, kind, fixture_ext_id, match_label, market, author_name, created_at, snapshot"
    )
    .eq("sport", sport)
    .eq("league", league)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(1, limit), 200));

  if (error) {
    console.error("listHistory error:", error);
    return [];
  }
  return (data ?? []).map((r) => toRecord(r as HistoryRow));
}

// Export edilen kayitlari yazar. author_id dev/bypass'ta null olabilir.
export async function insertHistory(
  admin: SupabaseClient,
  args: {
    sport: string;
    league: string;
    entries: ModelHistoryDraft[];
    authorId: string | null;
    authorName: string;
  }
): Promise<number> {
  const rows = args.entries.map((e) => ({
    sport: args.sport,
    league: args.league,
    kind: typeof e.kind === "string" && e.kind ? e.kind : "match",
    fixture_ext_id: e.fixtureExtId ?? null,
    match_label: e.matchLabel,
    market: e.market,
    snapshot: e.snapshot ?? {},
    author_id: args.authorId,
    author_name: args.authorName,
  }));
  if (rows.length === 0) return 0;

  const { error } = await admin.from("model_export_history").insert(rows);
  if (error) {
    console.error("insertHistory error:", error);
    return 0;
  }
  return rows.length;
}

// Saklama suresini (gun) dondurur; satir yoksa varsayilan.
export async function getRetention(
  admin: SupabaseClient,
  sport: string,
  league: string
): Promise<number> {
  const { data, error } = await admin
    .from("model_history_config")
    .select("retention_days")
    .eq("sport", sport)
    .eq("league", league)
    .maybeSingle();

  if (error) {
    console.error("getRetention error:", error);
    return DEFAULT_RETENTION_DAYS;
  }
  const days = data?.retention_days;
  return typeof days === "number" ? days : DEFAULT_RETENTION_DAYS;
}

// MSM "eksik line'lari SU'la" bayragini dondurur (spor+lig basina).
export async function getMsmSuspend(
  admin: SupabaseClient,
  sport: string,
  league: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("model_history_config")
    .select("msm_suspend_missing")
    .eq("sport", sport)
    .eq("league", league)
    .maybeSingle();
  if (error) {
    console.error("getMsmSuspend error:", error);
    return false;
  }
  return data?.msm_suspend_missing === true;
}

// MSM "eksik line'lari SU'la" bayragini kaydeder. Diger kolonlara dokunmaz
// (upsert yalnizca verilen kolonlari gunceller; retention korunur).
export async function setMsmSuspend(
  admin: SupabaseClient,
  sport: string,
  league: string,
  value: boolean
): Promise<boolean> {
  const { error } = await admin.from("model_history_config").upsert(
    {
      sport,
      league,
      msm_suspend_missing: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "sport,league" }
  );
  if (error) {
    console.error("setMsmSuspend error:", error);
    return false;
  }
  return true;
}

// Saklama suresini kaydeder (spor+lig basina).
export async function setRetention(
  admin: SupabaseClient,
  sport: string,
  league: string,
  retentionDays: number
): Promise<boolean> {
  const { error } = await admin.from("model_history_config").upsert(
    {
      sport,
      league,
      retention_days: retentionDays,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "sport,league" }
  );
  if (error) {
    console.error("setRetention error:", error);
    return false;
  }
  return true;
}

// Yazma aninda otomatik temizlik: saklama suresinden eski kayitlari siler.
export async function applyRetention(
  admin: SupabaseClient,
  sport: string,
  league: string
): Promise<void> {
  const days = await getRetention(admin, sport, league);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin
    .from("model_export_history")
    .delete()
    .eq("sport", sport)
    .eq("league", league)
    .lt("created_at", cutoff);
  if (error) {
    console.error("applyRetention error:", error);
  }
}
