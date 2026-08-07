import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// Takim notlari server yardimcilari. team_notes tablosuna yalnizca service
// role erisir (bkz. sql/2026-08-07_team_notes.sql), bu yuzden okuma/yazma
// hep admin client ile burada yapilir. Cagiran route once oturumu dogrular.

export type TeamNote = {
  id: string;
  teamSlug: string;
  body: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  // Goruntuleyen bu notu duzenleyip silebilir mi (sahibi veya admin).
  canEdit: boolean;
};

type Viewer = { userId: string | null; isAdmin: boolean };

type NoteRow = {
  id: string;
  team_slug: string;
  body: string;
  author_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
};

function toNote(row: NoteRow, viewer: Viewer): TeamNote {
  return {
    id: row.id,
    teamSlug: row.team_slug,
    body: row.body,
    authorName: row.author_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canEdit: viewer.isAdmin || row.author_id === viewer.userId,
  };
}

// Notu yazan icin gorunecek ad: aktif passwordless alias, yoksa e-postanin
// @ oncesi kismi. Yazi aninda cagirilir ve author_name'e snapshot yazilir.
export async function resolveAuthorName(
  admin: SupabaseClient,
  userId: string,
  email: string | null
): Promise<string> {
  try {
    const { data } = await admin
      .from("direct_access_users")
      .select("alias")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle();

    const alias = data?.alias;
    if (typeof alias === "string" && alias.length > 0) {
      return alias;
    }
  } catch (error) {
    console.error("resolveAuthorName alias lookup error:", error);
  }

  const localPart = (email ?? "").split("@")[0]?.trim();
  return localPart || "kullanici";
}

// Verilen slug'lar icin notlari slug -> notlar seklinde gruplayarak dondurur.
// Her nota goruntuleyene gore canEdit eklenir. Bos slug listesi -> bos harita.
export async function getNotesForSlugs(
  slugs: string[],
  viewer: Viewer
): Promise<Record<string, TeamNote[]>> {
  const uniqueSlugs = [...new Set(slugs.filter((s) => s && s.length > 0))];
  const bySlug: Record<string, TeamNote[]> = {};
  for (const slug of uniqueSlugs) {
    bySlug[slug] = [];
  }
  if (uniqueSlugs.length === 0) {
    return bySlug;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_notes")
    .select("id, team_slug, body, author_id, author_name, created_at, updated_at")
    .in("team_slug", uniqueSlugs)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getNotesForSlugs error:", error);
    return bySlug;
  }

  for (const row of (data ?? []) as NoteRow[]) {
    (bySlug[row.team_slug] ??= []).push(toNote(row, viewer));
  }
  return bySlug;
}
