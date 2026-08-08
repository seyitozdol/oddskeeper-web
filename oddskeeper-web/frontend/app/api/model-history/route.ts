import { NextResponse, type NextRequest } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAuthorName } from "@/lib/team-notes";
import {
  applyRetention,
  clampRetention,
  getMsmSuspend,
  getRetention,
  insertHistory,
  listHistory,
  setMsmSuspend,
  setRetention,
} from "@/lib/model-history-server";
import type { ModelHistoryDraft } from "@/lib/model-history";

// Model export gecmisi: liste + saklama-suresi (GET), export yazma (POST),
// saklama-suresi ayari (PUT). Tablolar yalnizca service role erisimine acik;
// her istek once oturumu dogrular. Gecmis ORTAKtir (herkes birbirinin
// export'unu gorur); giren kullanicinin adi kayitta tutulur.

const SPORTS = new Set([
  "football_msm",
  "football_psm",
  "basketball",
  "volleyball",
]);
const LEAGUE_RE = /^[a-z0-9_-]{1,32}$/;
const MAX_ENTRIES = 100;
const MAX_LABEL = 200;

function parseTarget(sport: unknown, league: unknown) {
  const s = typeof sport === "string" ? sport : "";
  const l = typeof league === "string" ? league.toLowerCase() : "";
  if (!SPORTS.has(s) || !LEAGUE_RE.test(l)) return null;
  return { sport: s, league: l };
}

// GET /api/model-history?sport=..&league=..            -> { records }
// GET /api/model-history?sport=..&league=..&config=1   -> { retentionDays }
export async function GET(request: NextRequest) {
  const access = await getNavAccess();
  if (!access.userId && !access.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const target = parseTarget(params.get("sport"), params.get("league"));
  if (!target) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (params.get("config") === "1") {
    const [retentionDays, msmSuspendMissing] = await Promise.all([
      getRetention(admin, target.sport, target.league),
      getMsmSuspend(admin, target.sport, target.league),
    ]);
    return NextResponse.json({ retentionDays, msmSuspendMissing });
  }

  const limit = Number(params.get("limit")) || 50;
  const records = await listHistory(admin, target.sport, target.league, limit);
  return NextResponse.json({ records });
}

// POST /api/model-history  body: { sport, league, entries[] } -> { inserted }
export async function POST(request: NextRequest) {
  const access = await getNavAccess();
  if (!access.userId && !access.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: {
    sport?: unknown;
    league?: unknown;
    entries?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const target = parseTarget(payload.sport, payload.league);
  if (!target) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }
  if (!Array.isArray(payload.entries) || payload.entries.length === 0) {
    return NextResponse.json({ error: "invalid_entries" }, { status: 400 });
  }

  const entries: ModelHistoryDraft[] = [];
  for (const raw of payload.entries.slice(0, MAX_ENTRIES)) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const matchLabel =
      typeof e.matchLabel === "string" ? e.matchLabel.slice(0, MAX_LABEL) : "";
    const market =
      typeof e.market === "string" ? e.market.slice(0, MAX_LABEL) : "";
    if (!matchLabel || !market) continue;
    entries.push({
      kind: typeof e.kind === "string" ? e.kind.slice(0, 32) : undefined,
      fixtureExtId:
        typeof e.fixtureExtId === "string"
          ? e.fixtureExtId.slice(0, MAX_LABEL)
          : null,
      matchLabel,
      market,
      // snapshot serbest bicimli; oldugu gibi saklanir.
      snapshot: e.snapshot ?? {},
    });
  }
  if (entries.length === 0) {
    return NextResponse.json({ error: "invalid_entries" }, { status: 400 });
  }

  const admin = createAdminClient();
  const authorName = await resolveAuthorName(
    admin,
    access.userId ?? "",
    access.userEmail
  );

  const inserted = await insertHistory(admin, {
    sport: target.sport,
    league: target.league,
    entries,
    authorId: access.userId,
    authorName,
  });

  // Yazma aninda otomatik temizlik: saklama suresinden eski kayitlari sil.
  await applyRetention(admin, target.sport, target.league);

  return NextResponse.json({ inserted }, { status: 201 });
}

// PUT /api/model-history  body: { sport, league, retentionDays?, msmSuspendMissing? }
// Verilen alan(lar) guncellenir; digerlerine dokunulmaz.
export async function PUT(request: NextRequest) {
  const access = await getNavAccess();
  if (!access.userId && !access.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: {
    sport?: unknown;
    league?: unknown;
    retentionDays?: unknown;
    msmSuspendMissing?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const target = parseTarget(payload.sport, payload.league);
  if (!target) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  const admin = createAdminClient();
  let ok = true;
  const out: { retentionDays?: number; msmSuspendMissing?: boolean } = {};

  if (payload.retentionDays !== undefined) {
    const retentionDays = clampRetention(payload.retentionDays);
    ok = ok && (await setRetention(admin, target.sport, target.league, retentionDays));
    out.retentionDays = retentionDays;
  }
  if (payload.msmSuspendMissing !== undefined) {
    const value = payload.msmSuspendMissing === true;
    ok = ok && (await setMsmSuspend(admin, target.sport, target.league, value));
    out.msmSuspendMissing = value;
  }

  if (!ok) {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json(out);
}
