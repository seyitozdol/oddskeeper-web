import { NextResponse, type NextRequest } from "next/server";
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
  // null = normal kullanici; dolu = sifresiz giris alias'i (super user)
  directAlias: string | null;
};

export async function GET() {
  const access = await getNavAccess();

  if (!access.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const [
    { data: list, error: listError },
    { data: perms, error: permError },
    { data: aliases, error: aliasError },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 500 }),
    admin.from("user_nav_permissions").select("user_id, is_admin, allowed_keys"),
    admin.from("direct_access_users").select("user_id, alias, active"),
  ]);

  if (listError || permError || aliasError) {
    console.error(
      "Admin users list error:",
      listError ?? permError ?? aliasError
    );
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  const permByUserId = new Map(
    (perms ?? []).map((p) => [p.user_id as string, p])
  );
  const aliasByUserId = new Map(
    (aliases ?? [])
      .filter((a) => a.active === true)
      .map((a) => [a.user_id as string, a.alias as string])
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
        directAlias: aliasByUserId.get(u.id) ?? null,
      };
    })
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));

  return NextResponse.json({
    users,
    requesterId: access.userId,
  });
}

type CreateBody = {
  email?: unknown;
  password?: unknown;
  isAdmin?: unknown;
  directAlias?: unknown;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALIAS_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

// Manuel kullanici olusturma. E-posta onayi beklenmez (email_confirm: true),
// hesap aninda giris yapabilir. directAlias verilirse kullanici sifresiz
// giris listesine de eklenir.
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

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const isAdmin = body.isAdmin === true;
  const directAlias =
    typeof body.directAlias === "string"
      ? body.directAlias.trim().toLowerCase()
      : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "invalid_password" }, { status: 400 });
  }
  if (directAlias && !ALIAS_RE.test(directAlias)) {
    return NextResponse.json({ error: "invalid_alias" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError || !created?.user) {
    const msg = createError?.message ?? "";
    const status = /already|exists|registered/i.test(msg) ? 409 : 500;
    if (status === 500) console.error("Admin user create error:", createError);
    return NextResponse.json(
      { error: status === 409 ? "email_exists" : "create_failed" },
      { status }
    );
  }

  const userId = created.user.id;

  const { error: permError } = await admin.from("user_nav_permissions").upsert(
    {
      user_id: userId,
      email,
      is_admin: isAdmin,
      allowed_keys: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (permError) {
    console.error("Admin user perm upsert error:", permError);
  }

  if (directAlias) {
    const { error: aliasErrorInsert } = await admin
      .from("direct_access_users")
      .upsert(
        {
          user_id: userId,
          alias: directAlias,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (aliasErrorInsert) {
      console.error("Admin alias upsert error:", aliasErrorInsert);
      return NextResponse.json(
        { error: "alias_taken", userId },
        { status: 409 }
      );
    }
  }

  return NextResponse.json({
    user: {
      id: userId,
      email,
      createdAt: created.user.created_at ?? null,
      lastSignInAt: null,
      isAdmin,
      allowedKeys: null,
      directAlias: directAlias || null,
    } satisfies AdminUserRow,
  });
}
