import { NextResponse, type NextRequest } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { isValidNavKey } from "@/lib/nav-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

type PatchBody = {
  allowedKeys?: string[] | null;
  isAdmin?: boolean;
  // string = sifresiz giris alias'i ata/guncelle, null = kaldir
  directAlias?: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALIAS_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

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

  const hasAllowedKeys = "allowedKeys" in body;
  const hasIsAdmin = typeof body.isAdmin === "boolean";
  const hasDirectAlias = "directAlias" in body;

  if (!hasAllowedKeys && !hasIsAdmin && !hasDirectAlias) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }

  let nextAlias: string | null = null;
  if (hasDirectAlias && body.directAlias !== null) {
    if (typeof body.directAlias !== "string") {
      return NextResponse.json({ error: "invalid_alias" }, { status: 400 });
    }
    nextAlias = body.directAlias.trim().toLowerCase();
    if (!ALIAS_RE.test(nextAlias)) {
      return NextResponse.json({ error: "invalid_alias" }, { status: 400 });
    }
  }

  if (hasAllowedKeys && body.allowedKeys !== null) {
    if (
      !Array.isArray(body.allowedKeys) ||
      body.allowedKeys.some((k) => typeof k !== "string" || !isValidNavKey(k))
    ) {
      return NextResponse.json({ error: "invalid_keys" }, { status: 400 });
    }
  }

  // Kendi admin yetkisini kaldirip paneli kilitlemesin
  if (hasIsAdmin && body.isAdmin === false && access.userId === id) {
    return NextResponse.json({ error: "cannot_demote_self" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: target, error: targetError } =
    await admin.auth.admin.getUserById(id);
  if (targetError || !target?.user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("user_nav_permissions")
    .select("is_admin, allowed_keys")
    .eq("user_id", id)
    .maybeSingle();

  const nextRow = {
    user_id: id,
    email: target.user.email ?? "",
    is_admin: hasIsAdmin ? body.isAdmin! : existing?.is_admin === true,
    allowed_keys: hasAllowedKeys
      ? body.allowedKeys
      : ((existing?.allowed_keys as string[] | null) ?? null),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await admin
    .from("user_nav_permissions")
    .upsert(nextRow, { onConflict: "user_id" });

  if (upsertError) {
    console.error("Admin permission upsert error:", upsertError);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  if (hasDirectAlias) {
    if (nextAlias === null) {
      const { error: aliasDeleteError } = await admin
        .from("direct_access_users")
        .delete()
        .eq("user_id", id);

      if (aliasDeleteError) {
        console.error("Admin alias delete error:", aliasDeleteError);
        return NextResponse.json({ error: "save_failed" }, { status: 500 });
      }
    } else {
      const { error: aliasUpsertError } = await admin
        .from("direct_access_users")
        .upsert(
          {
            user_id: id,
            alias: nextAlias,
            active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (aliasUpsertError) {
        // unique alias catismasi buyuk ihtimalle
        console.error("Admin alias upsert error:", aliasUpsertError);
        return NextResponse.json({ error: "alias_taken" }, { status: 409 });
      }
    }
  }

  return NextResponse.json({
    user: {
      id,
      email: nextRow.email,
      isAdmin: nextRow.is_admin,
      allowedKeys: nextRow.allowed_keys,
      directAlias: hasDirectAlias ? nextAlias : undefined,
    },
  });
}
