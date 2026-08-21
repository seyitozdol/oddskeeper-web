import { NextResponse, type NextRequest } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

// Player Market (TSL + TFF1 + Avrupa kupalari) kalici tablolarina yazma.
// Tablolar yalnizca service-role erisimine acik; her istek once oturumu
// dogrular. Ayni endpoint tum ligleri karsilar (league='tsl' | 'tff1' |
// 'eurocl' | 'euel' | 'euecl'); shaping tek yerde yapilir ki client dosyalari
// ayni kurallari paylassin.

const LEAGUES = new Set(["tsl", "tff1", "eurocl", "euel", "euecl"]);

type Body = { league?: unknown; action?: unknown; payload?: unknown };

export async function POST(request: NextRequest) {
  const access = await getNavAccess();
  // Giris yapmis herhangi bir ic kullanici (veya lokal dev bypass) yazabilir;
  // giris yapmamis (anon) istek reddedilir.
  if (!access.userId && !access.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const league = typeof body.league === "string" ? body.league : "";
  const action = typeof body.action === "string" ? body.action : "";
  const payload = (body.payload ?? {}) as Record<string, unknown>;

  if (!LEAGUES.has(league)) {
    return NextResponse.json({ error: "invalid_league" }, { status: 400 });
  }

  const db = createAdminClient().schema("analytics");
  const now = new Date().toISOString();

  try {
    switch (action) {
      case "savePlayerIds": {
        const entries = (payload.entries ?? {}) as Record<string, string>;
        const rows = Object.entries(entries).map(([player_slug, v]) => ({
          league,
          player_slug,
          external_id: (typeof v === "string" ? v.trim() : "") || null,
          updated_at: now,
        }));
        if (rows.length === 0) return ok();
        const { error } = await db
          .from("pm_player_ids")
          .upsert(rows, { onConflict: "league,player_slug" });
        return respond(error);
      }

      case "saveFixtureInputs": {
        const entries = (payload.entries ?? {}) as Record<string, string>;
        const rows = Object.entries(entries).map(([fixture_id, v]) => ({
          league,
          fixture_id: Number(fixture_id),
          input_value: (typeof v === "string" ? v.trim() : "") || null,
          updated_at: now,
        }));
        if (rows.length === 0) return ok();
        const { error } = await db
          .from("pm_fixture_inputs")
          .upsert(rows, { onConflict: "league,fixture_id" });
        return respond(error);
      }

      case "upsertMarket": {
        const m = (payload.market ?? {}) as Record<string, unknown>;
        if (typeof m.market_key !== "string" || !m.market_key) {
          return NextResponse.json({ error: "invalid_market" }, { status: 400 });
        }
        const { error } = await db
          .from("pm_markets")
          .upsert(
            { ...m, league, updated_at: now },
            { onConflict: "league,market_key" }
          );
        return respond(error);
      }

      case "deleteMarket": {
        const market_key = String(payload.market_key ?? "");
        if (!market_key) {
          return NextResponse.json({ error: "invalid_market" }, { status: 400 });
        }
        const { error } = await db
          .from("pm_markets")
          .delete()
          .eq("league", league)
          .eq("market_key", market_key);
        return respond(error);
      }

      case "saveDistWeights": {
        const w = (payload.weights ?? {}) as Record<string, unknown>;
        const rows = [
          { league, config_key: "dist_weight_ly", config_value: Number(w.ly), updated_at: now },
          { league, config_key: "dist_weight_last5", config_value: Number(w.last5), updated_at: now },
          { league, config_key: "dist_weight_avg", config_value: Number(w.avg), updated_at: now },
        ];
        const { error } = await db
          .from("pm_model_config")
          .upsert(rows, { onConflict: "league,config_key" });
        return respond(error);
      }

      case "savePlayerStatusOverride": {
        const player_key = String(payload.player_key ?? "");
        const status = payload.status == null ? null : String(payload.status);
        if (!player_key) {
          return NextResponse.json({ error: "invalid_player" }, { status: 400 });
        }
        // status null = override'i kaldir (otomatik cikarima don).
        if (status === null) {
          const { error } = await db
            .from("pm_player_status_overrides")
            .delete()
            .eq("league", league)
            .eq("player_key", player_key);
          return respond(error);
        }
        if (!["Pos. Starter", "Pos. Sub", "Out"].includes(status)) {
          return NextResponse.json({ error: "invalid_status" }, { status: 400 });
        }
        const { error } = await db
          .from("pm_player_status_overrides")
          .upsert(
            { league, player_key, status, updated_at: now },
            { onConflict: "league,player_key" }
          );
        return respond(error);
      }

      case "saveStatusConfig": {
        const c = (payload.config ?? {}) as Record<string, unknown>;
        const kv: [string, number][] = [
          ["status_out_n", Number(c.outN)],
          ["status_out_k", Number(c.outK)],
          ["status_starter_n", Number(c.starterN)],
          ["status_starter_k", Number(c.starterK)],
          ["status_sub_n", Number(c.subN)],
          ["status_sub_k", Number(c.subK)],
          ["status_last_only", c.lastOnly ? 1 : 0],
        ];
        const rows = kv.map(([config_key, config_value]) => ({
          league,
          config_key,
          config_value,
          updated_at: now,
        }));
        const { error } = await db
          .from("pm_model_config")
          .upsert(rows, { onConflict: "league,config_key" });
        return respond(error);
      }

      default:
        return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
  } catch (e) {
    console.error("player-market/write", action, e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

function ok() {
  return NextResponse.json({ ok: true });
}
function respond(error: { message: string } | null) {
  if (error) {
    console.error("player-market/write db error:", error.message);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
