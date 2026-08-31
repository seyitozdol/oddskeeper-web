import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNtfy } from "@/lib/ntfy-server";

// Tek giris kapisi. Client sadece identifier + password gonderir; hangi
// hesabin nasil dogrulandigi (sifre / dogrudan erisim) tamamen burada,
// server tarafinda belirlenir. Client bundle'ina hicbir ipucu sizmaz.
//
// Dogrudan erisim (alias) yolunda cihaz kilidi vardir ("ilk giris sahiplenir"):
// alias'la ilk basarili giris tarayiciya httpOnly bir cihaz token'i yazar ve
// hash'ini direct_access_devices'a kaydeder. Sonrasinda o alias'a yalnizca
// kayitli token'i tasiyan tarayici girebilir; ayni tarayicidan baska alias
// denemesi de reddedilir. Admin panelden "cihazi sifirla" bagi cozer.

type LoginBody = {
  identifier?: unknown;
  password?: unknown;
};

const ALIAS_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

const DEVICE_COOKIE = "ok_device";
// Chrome cookie omrunu ~400 gunle sinirlar; her basarili giriste yenilenir.
const DEVICE_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

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

  // 1) Dogrudan erisim kontrolu (service role, client'a kapali tablolar).
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
        const userId = row.user_id as string;
        const cookieStore = await cookies();
        const cookieToken = cookieStore.get(DEVICE_COOKIE)?.value ?? "";
        const cookieHash = cookieToken ? sha256(cookieToken) : null;
        const userAgent =
          request.headers.get("user-agent")?.slice(0, 200) ?? "";

        // Cihaz kilidi: hesabin kayitli cihazi var mi?
        const { data: bound, error: boundError } = await admin
          .from("direct_access_devices")
          .select("token_hash")
          .eq("user_id", userId)
          .maybeSingle();

        // Kilit durumu okunamadiysa fail-closed: sahiplenme yanlis kisiye
        // gecmesin diye giris reddedilir.
        if (boundError) {
          console.error("Login device lookup error:", boundError);
          return fail();
        }

        let deviceToken = cookieToken;
        let claimed = false;

        if (bound) {
          if (!cookieHash || cookieHash !== bound.token_hash) {
            await sendNtfy(
              "Oddskeeper giris engellendi",
              `"${aliasCandidate}" icin kayitsiz cihazdan giris denendi. IP: ${ip}. Tarayici: ${userAgent}`,
              { priority: "high", tags: "no_entry" }
            );
            return fail();
          }
        } else {
          // Hesap sahiplenilmemis. Bu tarayici baska bir hesaba bagliysa
          // sahiplenemez (bir cihaz = tek hesap).
          if (cookieHash) {
            const { data: other, error: otherError } = await admin
              .from("direct_access_devices")
              .select("user_id")
              .eq("token_hash", cookieHash)
              .maybeSingle();

            if (otherError) {
              console.error("Login device cross-check error:", otherError);
              return fail();
            }
            if (other) {
              await sendNtfy(
                "Oddskeeper giris engellendi",
                `Baska hesaba bagli bir cihaz "${aliasCandidate}" alias'i ile giris denedi. IP: ${ip}. Tarayici: ${userAgent}`,
                { priority: "high", tags: "no_entry" }
              );
              return fail();
            }
          }

          deviceToken = randomBytes(32).toString("hex");
          const { error: claimError } = await admin
            .from("direct_access_devices")
            .insert({
              user_id: userId,
              token_hash: sha256(deviceToken),
              user_agent: userAgent,
              ip,
            });

          // PK(user_id) sayesinde es zamanli sahiplenme yarisini tek istek
          // kazanir; kaybeden buraya duser.
          if (claimError) {
            console.error("Login device claim error:", claimError);
            return fail();
          }
          claimed = true;
        }

        const rollbackClaim = async () => {
          if (!claimed) return;
          await admin
            .from("direct_access_devices")
            .delete()
            .eq("user_id", userId)
            .eq("token_hash", sha256(deviceToken));
        };

        const { data: target } = await admin.auth.admin.getUserById(userId);
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
              cookieStore.set(DEVICE_COOKIE, deviceToken, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/",
                maxAge: DEVICE_COOKIE_MAX_AGE_S,
              });

              if (claimed) {
                await sendNtfy(
                  "Oddskeeper cihaz sahiplenildi",
                  `"${aliasCandidate}" ilk cihazini sahiplendi. IP: ${ip}. Tarayici: ${userAgent}`,
                  { priority: "default", tags: "key" }
                );
              } else {
                // Kayitli cihazdan rutin giris: son gorulme guncellenir.
                await admin
                  .from("direct_access_devices")
                  .update({
                    last_seen_at: new Date().toISOString(),
                    user_agent: userAgent,
                    ip,
                  })
                  .eq("user_id", userId);
              }

              await padTiming(startedAt);
              return NextResponse.json({ ok: true });
            }
          }
        }

        // Oturum acilamadi: yeni sahiplenme geri alinir ki hesap cookie'siz
        // bir kayda kilitlenmesin.
        await rollbackClaim();
        return fail();
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
