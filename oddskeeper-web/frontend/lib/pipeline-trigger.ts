import { createAdminClient } from "@/lib/supabase/admin";

// Manuel pipeline tetikleme yardımcıları (yalnız admin API'lerinden çağrılır).
// kind ile ayrıştırılır: 'all' (futbol/oran zinciri) | 'tbf_basketball' (TBF scraper).
// Debounce ve durum sorgusu kind-BAZLI: basketbol tetiği futbol butonunu bloklamaz.

export type TriggerKind = "all" | "bets10_odds" | "tbf_basketball";

export type TriggerRow = {
  id: number;
  status: string;
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  note: string | null;
};

export async function enqueueTrigger(kind: TriggerKind, requestedBy: string | null) {
  const admin = createAdminClient();
  // Aynı kind'de bekleyen/çalışan tetik varsa yenisini ekleme.
  const { data: active, error: activeErr } = await admin
    .from("pipeline_triggers")
    .select("id, status")
    .eq("kind", kind)
    .in("status", ["pending", "running"])
    .limit(1);
  if (activeErr) return { ok: false as const, error: "check_failed" };
  if (active && active.length > 0) {
    return { ok: true as const, alreadyQueued: true, status: active[0].status as string };
  }
  const { error } = await admin
    .from("pipeline_triggers")
    .insert({ requested_by: requestedBy, status: "pending", kind });
  if (error) return { ok: false as const, error: "insert_failed" };
  return { ok: true as const, queued: true };
}

export async function latestTrigger(kind: TriggerKind): Promise<TriggerRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pipeline_triggers")
    .select("id, status, requested_at, started_at, finished_at, note")
    .eq("kind", kind)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as TriggerRow) ?? null;
}
