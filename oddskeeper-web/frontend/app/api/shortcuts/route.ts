import { NextResponse } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

// Header Shortcuts menusunun okuma ucu. Tablo service-role-only (RLS policy
// yok); oturumu olan HER kullanici okuyabilir (menu herkese acik, gorunurluk
// header tarafinda nav-permission "shortcuts" anahtariyla ayarlanir).

export type ShortcutRow = {
  id: string;
  name: string;
  url: string;
  logoUrl: string | null;
  sortOrder: number;
};

export async function GET() {
  const access = await getNavAccess();

  // Dev bypass'ta userId null ama isAdmin true doner; gercek anonimde ikisi de bos.
  if (!access.userId && !access.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await createAdminClient()
    .from("shortcuts")
    .select("id, name, url, logo_url, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Shortcuts list error:", error.message);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  const shortcuts: ShortcutRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    logoUrl: (row.logo_url as string | null) ?? null,
    sortOrder: (row.sort_order as number) ?? 0,
  }));

  return NextResponse.json({ shortcuts });
}
