import { NextResponse, type NextRequest } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

// Basketbol Player Market (BSL / EuroLeague / EuroCup) kalici tablolarina yazma.
// Tablolar yalnizca service-role erisimine acik; her istek once oturumu
// dogrular. league kolonu cok-lig paylasimli tablolari ayirir.

const LEAGUES = new Set(["basketball", "euroleague", "eurocup", "volleyball"]);

type Body = { league?: unknown; action?: unknown; payload?: unknown };

export async function POST(request: NextRequest) {
  const access = await getNavAccess();
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

  // updateFixture/deleteFixture/saveModelConfig id/anahtar bazli calisir, league
  // kullanmaz; digerleri league ayrimina gore yazdigindan gecerli lig ister.
  const LEAGUE_AGNOSTIC = new Set(["updateFixture", "deleteFixture", "saveModelConfig"]);
  if (!LEAGUE_AGNOSTIC.has(action) && !LEAGUES.has(league)) {
    return NextResponse.json({ error: "invalid_league" }, { status: 400 });
  }

  const db = createAdminClient().schema("analytics");
  const now = new Date().toISOString();

  try {
    switch (action) {
      case "upsertMarket": {
        const m = (payload.market ?? {}) as Record<string, unknown>;
        if (typeof m.market_key !== "string" || !m.market_key) {
          return NextResponse.json({ error: "invalid_market" }, { status: 400 });
        }
        const { error } = await db
          .from("bb_pm_markets")
          .upsert({ ...m, league, updated_at: now }, { onConflict: "league,market_key" });
        return respond(error);
      }

      case "deleteMarket": {
        const market_key = String(payload.market_key ?? "");
        if (!market_key) return bad("invalid_market");
        const { error } = await db
          .from("bb_pm_markets")
          .delete()
          .eq("league", league)
          .eq("market_key", market_key);
        return respond(error);
      }

      case "upsertMarketConfig": {
        const rows = (payload.rows ?? []) as Record<string, unknown>[];
        if (!Array.isArray(rows) || rows.length === 0) return ok();
        const shaped = rows.map((r) => ({ ...r, league, updated_at: now }));
        const { error } = await db
          .from("bb_pm_market_config")
          .upsert(shaped, { onConflict: "league,market_group,market_key" });
        return respond(error);
      }

      case "deleteMarketConfig": {
        const market_group = String(payload.market_group ?? "");
        const market_key = String(payload.market_key ?? "");
        if (!market_group || !market_key) return bad("invalid_market");
        const { error } = await db
          .from("bb_pm_market_config")
          .delete()
          .eq("league", league)
          .eq("market_group", market_group)
          .eq("market_key", market_key);
        return respond(error);
      }

      case "insertFixture": {
        const f = (payload.fixture ?? {}) as Record<string, unknown>;
        const { error } = await db.from("bb_pm_fixtures").insert({ league, ...f });
        return respond(error);
      }

      case "updateFixture": {
        const id = Number(payload.id);
        const patch = (payload.patch ?? {}) as Record<string, unknown>;
        if (!Number.isFinite(id)) return bad("invalid_id");
        const { error } = await db
          .from("bb_pm_fixtures")
          .update({ ...patch, updated_at: now })
          .eq("id", id);
        return respond(error);
      }

      case "deleteFixture": {
        const id = Number(payload.id);
        if (!Number.isFinite(id)) return bad("invalid_id");
        const { error } = await db.from("bb_pm_fixtures").delete().eq("id", id);
        return respond(error);
      }

      case "savePlayerMerges": {
        const rows = (payload.rows ?? []) as Record<string, unknown>[];
        if (!Array.isArray(rows) || rows.length === 0) return ok();
        const shaped = rows.map((r) => ({ ...r, league, updated_at: now }));
        const { error } = await db
          .from("bb_pm_player_merges")
          .upsert(shaped, { onConflict: "league,alias_slug" });
        return respond(error);
      }

      case "deletePlayerMerge": {
        const alias_slug = String(payload.alias_slug ?? "");
        if (!alias_slug) return bad("invalid_alias");
        const { error } = await db
          .from("bb_pm_player_merges")
          .delete()
          .eq("league", league)
          .eq("alias_slug", alias_slug);
        return respond(error);
      }

      case "saveModelConfig": {
        // bb_model_config: yalnizca mevcut anahtarlarin value'su guncellenir
        // (league kolonu yok, view auto-updatable).
        const rows = (payload.rows ?? []) as { key: string; value: number }[];
        if (!Array.isArray(rows) || rows.length === 0) return ok();
        for (const r of rows) {
          const { error } = await db
            .from("bb_model_config")
            .update({ value: Number(r.value) })
            .eq("key", String(r.key));
          if (error) return respond(error);
        }
        return ok();
      }

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
          .from("bb_pm_player_ids")
          .upsert(rows, { onConflict: "league,player_slug" });
        return respond(error);
      }

      default:
        return bad("invalid_action");
    }
  } catch (e) {
    console.error("basketball/pm-write", action, e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

function ok() {
  return NextResponse.json({ ok: true });
}
function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
function respond(error: { message: string } | null) {
  if (error) {
    console.error("basketball/pm-write db error:", error.message);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
