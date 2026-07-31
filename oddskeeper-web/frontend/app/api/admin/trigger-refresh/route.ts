import { NextResponse } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

// Manuel pipeline tetikleme (yalnizca admin). public.pipeline_triggers'a
// 'pending' satir yazar; VPS'te trigger_worker.py bunu gorup pipeline'i bir kez
// calistirir. Scheduled cron'lar bagimsiz devam eder (bu yalnizca ek kosu).

export async function POST() {
  const access = await getNavAccess();
  if (!access.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Debounce: zaten bekleyen/calisan bir tetik varsa yenisini ekleme.
  const { data: active, error: activeErr } = await admin
    .from("pipeline_triggers")
    .select("id, status")
    .in("status", ["pending", "running"])
    .limit(1);
  if (activeErr) {
    console.error("trigger-refresh active check error:", activeErr);
    return NextResponse.json({ error: "check_failed" }, { status: 500 });
  }
  if (active && active.length > 0) {
    return NextResponse.json({ ok: true, alreadyQueued: true, status: active[0].status });
  }

  const { error } = await admin.from("pipeline_triggers").insert({
    requested_by: access.userEmail,
    status: "pending",
  });
  if (error) {
    console.error("trigger-refresh insert error:", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, queued: true });
}

// Buton durumu icin: en son tetigin durumu.
export async function GET() {
  const access = await getNavAccess();
  if (!access.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pipeline_triggers")
    .select("id, status, requested_at, started_at, finished_at, note")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("trigger-refresh status error:", error);
    return NextResponse.json({ error: "status_failed" }, { status: 500 });
  }
  return NextResponse.json({ latest: data ?? null });
}
