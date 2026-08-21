import { NextResponse, type NextRequest } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin panel ShortCuts sekmesi: mevcut kisayolu duzenleme/silme.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

type PatchBody = {
  name?: unknown;
  url?: unknown;
  // string = yeni logo adresi, null/bos = logoyu kaldir
  logoUrl?: unknown;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getNavAccess();

  if (!access.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const patch: Record<string, string | null> = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) {
      return NextResponse.json({ error: "invalid_name" }, { status: 400 });
    }
    patch.name = name;
  }

  if ("url" in body) {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url || url.length > 500 || !isValidHttpUrl(url)) {
      return NextResponse.json({ error: "invalid_url" }, { status: 400 });
    }
    patch.url = url;
  }

  if ("logoUrl" in body) {
    const logoUrl = typeof body.logoUrl === "string" ? body.logoUrl.trim() : "";
    if (logoUrl && (logoUrl.length > 500 || !isValidHttpUrl(logoUrl))) {
      return NextResponse.json({ error: "invalid_logo_url" }, { status: 400 });
    }
    patch.logo_url = logoUrl || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  const { error } = await createAdminClient()
    .from("shortcuts")
    .update(patch)
    .eq("id", id);

  if (error) {
    console.error("Shortcut update error:", error.message);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getNavAccess();

  if (!access.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("shortcuts")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Shortcut delete error:", error.message);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
