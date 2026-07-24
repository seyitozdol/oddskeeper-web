import { NextResponse } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminUserRow = {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  isAdmin: boolean;
  // null = kisitlama yok (tum basliklar)
  allowedKeys: string[] | null;
};

export async function GET() {
  const access = await getNavAccess();

  if (!access.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const [{ data: list, error: listError }, { data: perms, error: permError }] =
    await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 500 }),
      admin.from("user_nav_permissions").select("user_id, is_admin, allowed_keys"),
    ]);

  if (listError || permError) {
    console.error("Admin users list error:", listError ?? permError);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  const permByUserId = new Map(
    (perms ?? []).map((p) => [p.user_id as string, p])
  );

  const users: AdminUserRow[] = (list?.users ?? [])
    .map((u) => {
      const perm = permByUserId.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        createdAt: u.created_at ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
        isAdmin: perm?.is_admin === true,
        allowedKeys: (perm?.allowed_keys as string[] | null) ?? null,
      };
    })
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));

  return NextResponse.json({
    users,
    requesterId: access.userId,
  });
}
