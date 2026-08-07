import { NextResponse } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { enqueueTrigger, latestTrigger, type TriggerKind } from "@/lib/pipeline-trigger";

// Manuel pipeline tetikleme (yalnizca admin). public.pipeline_triggers'a 'pending'
// satir yazar; VPS'te trigger_worker.py bunu gorup pipeline'i bir kez calistirir.
// Scheduled cron'lar bagimsiz devam eder.
//
// kind (query param) ile hangi zincirin kosacagi secilir:
//   'all'         = futbol/oran zinciri tumu (Upcoming Events butonu, varsayilan)
//   'bets10_odds' = yalniz Bets10 oran yakalama + fixture<->bets10 resolver
//                   (MSM Fixture sekmesi butonu; hizli, sofascore/365/oddsportal atlanir)
// Debounce ve durum sorgusu kind-BAZLI: biri digerini bloklamaz.
const ALLOWED_KINDS: TriggerKind[] = ["all", "bets10_odds"];

function parseKind(req: Request): TriggerKind {
  const k = new URL(req.url).searchParams.get("kind");
  return (ALLOWED_KINDS as string[]).includes(k ?? "") ? (k as TriggerKind) : "all";
}

export async function POST(req: Request) {
  const access = await getNavAccess();
  if (!access.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const res = await enqueueTrigger(parseKind(req), access.userEmail);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json(res);
}

// Buton durumu icin: ilgili kind'in en son tetiginin durumu.
export async function GET(req: Request) {
  const access = await getNavAccess();
  if (!access.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ latest: await latestTrigger(parseKind(req)) });
}
