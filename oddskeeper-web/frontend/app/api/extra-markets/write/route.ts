import { NextResponse, type NextRequest } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

// Extra Markets (futbol Extras sekmesi) yazma kapisi. msm/write deseni: istek oturum
// kontrolunden gecer, tabloya service-role ile yazilir (authenticated yalniz okur).
// Tablolar: sql/2026-09-30_msm_extra_markets.sql.

const LEAGUES = new Set(["tsl", "tff1", "cup"]);
const MAX_CONFIG_BYTES = 100_000;
const MAX_FIXTURE_ROWS = 200;

type Body = { action?: unknown; payload?: unknown };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Bicim kontrolu kaba tutuldu: ayrintili anlam frontend motorunda (engine.ts). Amac
// bozuk/asiri buyuk bir govdenin ortak config'i ezmesini onlemek.
function validConfig(c: unknown): c is Record<string, unknown> {
  if (!isObj(c)) return false;
  if (typeof c.payback !== "number" || !(c.payback > 0 && c.payback < 1)) return false;
  if (!Array.isArray(c.profiles) || !c.profiles.every((p) => typeof p === "string")) return false;
  if (!Array.isArray(c.markets) || c.markets.length === 0 || c.markets.length > 200) return false;
  if (!Array.isArray(c.extraTime1h) || !Array.isArray(c.extraTime2h) || !isObj(c.goalType)) return false;
  return JSON.stringify(c).length <= MAX_CONFIG_BYTES;
}

export async function POST(request: NextRequest) {
  const access = await getNavAccess();
  // Giris yapmis herhangi bir ic kullanici yazabilir (MSM ile ayni karar).
  if (!access.userId && !access.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const payload = isObj(body.payload) ? body.payload : {};
  const db = createAdminClient().schema("analytics");

  try {
    switch (action) {
      case "saveConfig": {
        if (!validConfig(payload.config)) {
          return NextResponse.json({ error: "invalid_config" }, { status: 400 });
        }
        const { error } = await db.from("msm_extra_markets_config").upsert({
          id: 1,
          config: payload.config,
          updated_at: new Date().toISOString(),
          updated_by: access.userId,
        });
        return respond(error, action);
      }

      case "saveFixtures": {
        const league = typeof payload.league === "string" ? payload.league : "";
        if (!LEAGUES.has(league)) return NextResponse.json({ error: "invalid_league" }, { status: 400 });
        const raw = Array.isArray(payload.rows) ? payload.rows : [];
        if (raw.length > MAX_FIXTURE_ROWS) return NextResponse.json({ error: "too_many_rows" }, { status: 400 });
        const now = new Date().toISOString();
        const rows = [];
        for (const r of raw) {
          if (!isObj(r)) return NextResponse.json({ error: "invalid_args" }, { status: 400 });
          const fixtureId = String(r.fixture_id ?? "").trim();
          const profile = String(r.profile ?? "").trim();
          const noGoal = r.no_goal == null ? null : Number(r.no_goal);
          if (!fixtureId || fixtureId.length > 80 || profile.length > 40) {
            return NextResponse.json({ error: "invalid_args" }, { status: 400 });
          }
          if (noGoal != null && !(Number.isFinite(noGoal) && noGoal > 0)) {
            return NextResponse.json({ error: "invalid_args" }, { status: 400 });
          }
          rows.push({ league, fixture_id: fixtureId, profile, no_goal: noGoal, updated_at: now });
        }
        if (rows.length === 0) return NextResponse.json({ ok: true });
        const { error } = await db.from("msm_extra_markets_fixtures").upsert(rows, { onConflict: "league,fixture_id" });
        return respond(error, action);
      }

      default:
        return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
  } catch (e) {
    console.error("extra-markets/write", action, e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

function respond(error: { message: string } | null, action: string) {
  if (error) {
    console.error("extra-markets/write db error:", action, error.message);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
