import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Tek giris kapisi. Client sadece identifier + password gonderir; hangi
// hesabin nasil dogrulandigi (sifre / dogrudan erisim) tamamen burada,
// server tarafinda belirlenir. Client bundle'ina hicbir ipucu sizmaz.

type LoginBody = {
  identifier?: unknown;
  password?: unknown;
};

const ALIAS_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

// Basit IP bazli deneme siniri (instance basina, best-effort).
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

// Zamanlama farkindan bilgi sizmasin diye her cevap en az bu kadar surer.
const MIN_RESPONSE_MS = 650;

async function padTiming(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  const fail = async (status = 401) => {
    await padTiming(startedAt);
    return NextResponse.json({ error: "invalid_credentials" }, { status });
  };

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (isRateLimited(ip)) {
    return fail(429);
  }

  let body: LoginBody;
  try {
    body = await request.json();
  } catch {
    return fail(400);
  }

  const identifier =
    typeof body.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!identifier) {
    return fail(400);
  }

  const supabase = await createClient();

  // 1) Dogrudan erisim kontrolu (service role, client'a kapali tablo).
  const aliasCandidate = identifier.toLowerCase();
  if (ALIAS_RE.test(aliasCandidate)) {
    try {
      const admin = createAdminClient();
      const { data: row } = await admin
        .from("direct_access_users")
        .select("user_id")
        .eq("alias", aliasCandidate)
        .eq("active", true)
        .maybeSingle();

      if (row?.user_id) {
        const { data: target } = await admin.auth.admin.getUserById(
          row.user_id as string
        );
        const email = target?.user?.email;

        if (email) {
          const { data: linkData, error: linkError } =
            await admin.auth.admin.generateLink({ type: "magiclink", email });
          const tokenHash = linkData?.properties?.hashed_token;

          if (!linkError && tokenHash) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              type: "email",
              token_hash: tokenHash,
            });

            if (!verifyError) {
              await padTiming(startedAt);
              return NextResponse.json({ ok: true });
            }
          }
        }
      }
    } catch (error) {
      console.error("Login direct access error:", error);
    }
  }

  // 2) Normal e-posta + sifre girisi.
  if (!identifier.includes("@") || !password) {
    return fail();
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: identifier,
    password,
  });

  if (error) {
    return fail();
  }

  await padTiming(startedAt);
  return NextResponse.json({ ok: true });
}
