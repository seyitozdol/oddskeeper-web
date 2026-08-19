import { NextResponse, type NextRequest } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

// Match Stats Model yazma islemleri (2.1 Faz 2, 2026-08-19).
//
// Onceden bu msm_* SECURITY DEFINER RPC'leri tarayicidan publishable anahtarla
// cagriliyordu; anon EXECUTE 38a28ba'da geri alinmisti ama yazma yolu hala
// dogrudan PostgREST /rpc uzerindeydi. Artik pm_* deseniyle ayni: istek once
// burada oturum kontrolunden gecer, RPC service-role ile cagrilir ve
// authenticated'in dogrudan EXECUTE yetkisi kaldirilir (migration:
// sql/2026-08-19_msm_rpc_service_role_only.sql).
//
// RPC GOVDELERI DEGISMEDI: is kurallari (upsert/patch/silme) SQL tarafinda
// kaliyor, burasi yalniz kapi. Boylece davranis riski sifir.

const LEAGUES = new Set(["tsl", "tff1"]);

type Body = { action?: unknown; payload?: unknown };

export async function POST(request: NextRequest) {
  const access = await getNavAccess();
  // Giris yapmis herhangi bir ic kullanici yazabilir (sahip karari 2026-08-19:
  // admin-only DEGIL); giris yapmamis istek reddedilir.
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
  const payload = (body.payload ?? {}) as Record<string, unknown>;
  const db = createAdminClient();

  const league = typeof payload.league === "string" ? payload.league : "";
  const needsLeague = new Set([
    "saveFixtureInputs",
    "logImport",
    "addManualFixture",
    "saveModelConfig",
    "saveMarketConfig",
  ]);
  if (needsLeague.has(action) && !LEAGUES.has(league)) {
    return NextResponse.json({ error: "invalid_league" }, { status: 400 });
  }

  try {
    switch (action) {
      case "saveFixtureInputs": {
        const rows = Array.isArray(payload.rows) ? payload.rows : [];
        if (rows.length === 0) return NextResponse.json({ ok: true });
        const { error } = await db.rpc("msm_upsert_fixture_inputs", {
          p_league: league,
          p_rows: rows,
        });
        return respond(error, action);
      }

      case "logImport": {
        const { error } = await db.rpc("msm_log_import", {
          p_league: league,
          p_row: payload.row ?? {},
        });
        return respond(error, action);
      }

      case "setManualFixtureProxy": {
        const id = String(payload.id ?? "");
        const side = String(payload.side ?? "");
        if (!id || (side !== "home" && side !== "away")) {
          return NextResponse.json({ error: "invalid_args" }, { status: 400 });
        }
        const { error } = await db.rpc("msm_set_manual_fixture_proxy", {
          p_id: id,
          p_side: side,
          p_proxy_slug: String(payload.proxySlug ?? ""),
        });
        return respond(error, action);
      }

      case "addManualFixture": {
        const { data, error } = await db.rpc("msm_add_manual_fixture", {
          p_league: league,
          p_home_slug: String(payload.homeSlug ?? ""),
          p_home_name: String(payload.homeName ?? ""),
          p_away_slug: String(payload.awaySlug ?? ""),
          p_away_name: String(payload.awayName ?? ""),
        });
        if (error) return respond(error, action);
        return NextResponse.json({ ok: true, id: (data as string) ?? null });
      }

      case "deleteManualFixture": {
        const id = String(payload.id ?? "");
        if (!id) return NextResponse.json({ error: "invalid_args" }, { status: 400 });
        const { error } = await db.rpc("msm_delete_manual_fixture", { p_id: id });
        return respond(error, action);
      }

      case "saveModelConfig": {
        const { error } = await db.rpc("msm_update_model_config", {
          p_league: league,
          p_patch: payload.patch ?? {},
        });
        return respond(error, action);
      }

      case "saveMarketConfig": {
        const market = String(payload.market ?? "");
        if (!market) return NextResponse.json({ error: "invalid_args" }, { status: 400 });
        const { error } = await db.rpc("msm_update_market_config", {
          p_league: league,
          p_market: market,
          p_patch: payload.patch ?? {},
        });
        return respond(error, action);
      }

      default:
        return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
  } catch (e) {
    console.error("msm/write", action, e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

function respond(error: { message: string } | null, action: string) {
  if (error) {
    console.error("msm/write db error:", action, error.message);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
