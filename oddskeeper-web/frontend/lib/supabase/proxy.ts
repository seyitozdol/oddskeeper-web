import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSessionPastDailyLogout } from "../auth/daily-logout";
import {
  isAdminPath,
  isNavKeyVisible,
  navAccessKeysForPath,
} from "../nav-permissions";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = (claims?.sub as string | undefined) ?? null;

  const pathname = request.nextUrl.pathname;
  const accessKeys = navAccessKeysForPath(pathname);
  const adminPath = isAdminPath(pathname);

  if (userId) {
    // Hem gunluk-logout kontrolu hem baslik-izni icin tek okuma.
    const { data: perm } = await supabase
      .from("user_nav_permissions")
      .select("is_admin, allowed_keys")
      .eq("user_id", userId)
      .maybeSingle();

    const isAdmin = perm?.is_admin === true;
    // Izin satiri olmayan kullanici (kendi kaydolan) hicbir basliga erisemez:
    // satirsiz durumu bos diziye cevir. Satir icindeki null tam erisim demek.
    const effectiveKeys = perm ? (perm.allowed_keys ?? null) : [];

    // GUNLUK OTOMATIK LOGOUT: admin haric, oturumu en son 23:59 UTC sinirindan
    // once acilmis kullaniciyi cikar. signOut cookie'leri temizler + refresh
    // token'i iptal eder (tekrar giris zorunlu). Tum /dashboard/* rotalarinda,
    // baslik izninden BAGIMSIZ calisir.
    const iat = typeof claims?.iat === "number" ? claims.iat : undefined;
    if (!isAdmin && isSessionPastDailyLogout(iat)) {
      // signOut cookie'leri temizler + refresh token'i iptal eder. Ag hatasi
      // olsa bile (GoTrue erisimi) yine /sign-in'e yonlendir; sonraki istek
      // tekrar dener.
      try {
        await supabase.auth.signOut();
      } catch {
        // yut: yonlendirme yine de yapilacak
      }
      const redirectResponse = NextResponse.redirect(
        new URL("/sign-in", request.url)
      );
      // signOut'un temizleme (silme) cookie'lerini yanit'a tasi.
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    }

    // Header baslik izinleri: izinli olmayan rotaya dogrudan URL ile
    // girilirse /dashboard'a yonlendir.
    if (accessKeys || adminPath) {
      // accessKeys birden fazla anahtar donebilir (OR): herhangi biri izinliyse gecer.
      // isNavKeyVisible opt-in anahtarlari (or. league-eurocl) admin/acik-izin disinda
      // NULL tam-erisimli kullaniciya bile KAPATIR.
      const allowed = adminPath
        ? isAdmin
        : accessKeys!.some((key) =>
            isNavKeyVisible(key, effectiveKeys, isAdmin)
          );

      if (!allowed) {
        const redirectResponse = NextResponse.redirect(
          new URL("/dashboard", request.url)
        );
        // updateSession'in tazeledigi oturum cookie'lerini kaybetme
        response.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie);
        });
        return redirectResponse;
      }
    }
  }

  return response;
}
