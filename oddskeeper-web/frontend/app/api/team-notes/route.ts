import { NextResponse, type NextRequest } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getNotesForSlugs,
  resolveAuthorName,
  type TeamNote,
} from "@/lib/team-notes";

// Takim notlari: liste (GET) + olusturma (POST). Tablo yalnizca service role
// erisimine acik; her istek once oturumu dogrular.

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_BODY = 2000;

// GET /api/team-notes?slug=galatasaray
// GET /api/team-notes?slugs=galatasaray,fenerbahce
// -> { bySlug: { [slug]: TeamNote[] } }
export async function GET(request: NextRequest) {
  const access = await getNavAccess();
  if (!access.userId && !access.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const raw = params.get("slugs") ?? params.get("slug") ?? "";
  const slugs = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => SLUG_RE.test(s));

  const bySlug = await getNotesForSlugs(slugs, {
    userId: access.userId,
    isAdmin: access.isAdmin,
  });

  return NextResponse.json({ bySlug });
}

// POST /api/team-notes  body: { slug, body } -> { note: TeamNote }
export async function POST(request: NextRequest) {
  const access = await getNavAccess();
  if (!access.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { slug?: unknown; body?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const slug =
    typeof payload.slug === "string" ? payload.slug.trim().toLowerCase() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  }
  if (body.length === 0 || body.length > MAX_BODY) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const authorName = await resolveAuthorName(
    admin,
    access.userId,
    access.userEmail
  );

  const { data, error } = await admin
    .from("team_notes")
    .insert({
      team_slug: slug,
      body,
      author_id: access.userId,
      author_name: authorName,
    })
    .select("id, team_slug, body, author_name, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("team-notes insert error:", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
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

  return NextResponse.json({ note }, { status: 201 });
}
