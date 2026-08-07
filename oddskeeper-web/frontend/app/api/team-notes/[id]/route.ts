import { NextResponse, type NextRequest } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TeamNote } from "@/lib/team-notes";

// Tek notu duzenle (PATCH) / sil (DELETE). Yetki: notu yazan kisi VEYA admin.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 2000;

// Notu getirir ve goruntuleyenin duzenleme yetkisini dogrular.
async function loadAuthorized(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  viewer: { userId: string | null; isAdmin: boolean }
): Promise<
  | { ok: true; authorId: string }
  | { ok: false; status: number; error: string }
> {
  const { data, error } = await admin
    .from("team_notes")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("team-notes load error:", error);
    return { ok: false, status: 500, error: "load_failed" };
  }
  if (!data) {
    return { ok: false, status: 404, error: "not_found" };
  }

  const authorId = data.author_id as string;
  const canEdit = viewer.isAdmin || authorId === viewer.userId;
  if (!canEdit) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true, authorId };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getNavAccess();
  if (!access.userId && !access.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let payload: { body?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (body.length === 0 || body.length > MAX_BODY) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const auth = await loadAuthorized(admin, id, access);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await admin
    .from("team_notes")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, team_slug, body, author_name, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("team-notes update error:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  const note: TeamNote = {
    id: data.id as string,
    teamSlug: data.team_slug as string,
    body: data.body as string,
    authorName: data.author_name as string,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    canEdit: true,
  };

  return NextResponse.json({ note });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getNavAccess();
  if (!access.userId && !access.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const auth = await loadAuthorized(admin, id, access);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { error } = await admin.from("team_notes").delete().eq("id", id);
  if (error) {
    console.error("team-notes delete error:", error);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
