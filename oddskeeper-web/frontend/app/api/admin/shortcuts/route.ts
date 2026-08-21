import { NextResponse, type NextRequest } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShortcutRow } from "../../shortcuts/route";

// Admin panel ShortCuts sekmesi: yeni kisayol olusturma. Listeleme herkesle
// ortak /api/shortcuts ucundan yapilir.

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

type CreateBody = {
  name?: unknown;
  url?: unknown;
  logoUrl?: unknown;
};

export async function POST(request: NextRequest) {
  const access = await getNavAccess();

  if (!access.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const logoUrl = typeof body.logoUrl === "string" ? body.logoUrl.trim() : "";

  if (!name || name.length > 80) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }
  if (!url || url.length > 500 || !isValidHttpUrl(url)) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }
  if (logoUrl && (logoUrl.length > 500 || !isValidHttpUrl(logoUrl))) {
    return NextResponse.json({ error: "invalid_logo_url" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Yeni kayit listenin sonuna eklenir (en buyuk sort_order + 10).
  const { data: maxRow } = await admin
    .from("shortcuts")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = ((maxRow?.sort_order as number | undefined) ?? 0) + 10;

  const { data, error } = await admin
    .from("shortcuts")
    .insert({
      name,
      url,
      logo_url: logoUrl || null,
      sort_order: sortOrder,
    })
    .select("id, name, url, logo_url, sort_order")
    .single();

  if (error || !data) {
    console.error("Shortcut create error:", error?.message);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  return NextResponse.json({
    shortcut: {
      id: data.id as string,
      name: data.name as string,
      url: data.url as string,
      logoUrl: (data.logo_url as string | null) ?? null,
      sortOrder: (data.sort_order as number) ?? 0,
    } satisfies ShortcutRow,
  });
}
