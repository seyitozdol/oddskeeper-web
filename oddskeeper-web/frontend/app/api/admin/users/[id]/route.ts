import { NextResponse, type NextRequest } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { isValidNavKey } from "@/lib/nav-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

type PatchBody = {
  allowedKeys?: string[] | null;
  isAdmin?: boolean;
  // string = sifresiz giris alias'i ata/guncelle, null = kaldir
  directAlias?: string | null;
  email?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALIAS_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const hasEmail = typeof body.email === "string";

  if (!hasAllowedKeys && !hasIsAdmin && !hasDirectAlias && !hasEmail) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }

  let nextEmail: string | null = null;
  if (hasEmail) {
    nextEmail = (body.email as string).trim().toLowerCase();
    if (!EMAIL_RE.test(nextEmail)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }
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

  // E-posta degisikligi: once auth tarafinda guncelle ki asagidaki
  // user_nav_permissions satiri yeni adresi yazsin.
  if (nextEmail !== null && nextEmail !== (target.user.email ?? "")) {
    const { error: emailError } = await admin.auth.admin.updateUserById(id, {
      email: nextEmail,
      email_confirm: true,
    });

    if (emailError) {
      const status = /already|exists|registered/i.test(emailError.message)
        ? 409
        : 500;
      if (status === 500) console.error("Admin email update error:", emailError);
      return NextResponse.json(
        { error: status === 409 ? "email_exists" : "save_failed" },
        { status }
      );
    }
  }

  const { data: existing } = await admin
    .from("user_nav_permissions")
    .select("is_admin, allowed_keys")
    .eq("user_id", id)
    .maybeSingle();

  const nextRow = {
    user_id: id,
    email: nextEmail ?? target.user.email ?? "",
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

  // Kendi hesabini silip paneli kilitlemesin
  if (access.userId === id) {
    return NextResponse.json({ error: "cannot_delete_self" }, { status: 400 });
  }

  const admin = createAdminClient();

  // user_nav_permissions ve direct_access_users satirlari FK cascade ile silinir.
  const { error: deleteError } = await admin.auth.admin.deleteUser(id);

  if (deleteError) {
    console.error("Admin user delete error:", deleteError);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
