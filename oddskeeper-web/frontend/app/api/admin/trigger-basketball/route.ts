import { NextResponse } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { enqueueTrigger, latestTrigger } from "@/lib/pipeline-trigger";

// Manuel TBF basketbol scraper tetigi (yalnizca admin, kind='tbf_basketball').
// public.pipeline_triggers'a 'pending' satir yazar; VPS'te trigger_worker.py
// bunu gorup run_tbf_basketball.sh'i bir kez calistirir (headful+xvfb+TR proxy).
// Idempotent upsert: ayni mac tekrar cekilirse duplicate OLMAZ (tbf_match_id+tbf_player_id).

export async function POST() {
  const access = await getNavAccess();
  if (!access.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const res = await enqueueTrigger("tbf_basketball", access.userEmail);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json(res);
}

export async function GET() {
  const access = await getNavAccess();
  if (!access.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ latest: await latestTrigger("tbf_basketball") });
}
