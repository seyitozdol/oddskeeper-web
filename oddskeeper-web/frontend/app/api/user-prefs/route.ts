import { NextResponse, type NextRequest } from "next/server";
import { getNavAccess, isDevAuthBypass } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

// Kullanici bazli arayuz tercihleri (analytics.user_prefs). Tercihler GLOBAL
// degil kullanici basinadir; tablo yalniz service-role erisimli, kimlik burada
// oturumdan dogrulanir. GET ?key=... tek tercihi dondurur, POST {key, value}
// upsert eder. Lokal dev bypass sabit 'dev-bypass' kimligiyle calisir.

const KEY_RE = /^[a-z0-9_.-]{1,64}$/;

async function resolveUserId(): Promise<string | null> {
  const access = await getNavAccess();
  if (access.userId) return access.userId;
  if (isDevAuthBypass()) return "dev-bypass";
  return null;
}

export async function GET(request: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!KEY_RE.test(key)) {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .schema("analytics")
    .from("user_prefs")
    .select("pref_value")
    .eq("user_id", userId)
    .eq("pref_key", key)
    .maybeSingle();

  if (error) {
    console.error("user-prefs GET:", error.message);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  return NextResponse.json({ value: data?.pref_value ?? null });
}

export async function POST(request: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { key?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const key = typeof body.key === "string" ? body.key : "";
  if (!KEY_RE.test(key) || body.value === undefined) {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .schema("analytics")
    .from("user_prefs")
    .upsert(
      { user_id: userId, pref_key: key, pref_value: body.value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,pref_key" }
    );

  if (error) {
    console.error("user-prefs POST:", error.message);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
