import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isAdminPath,
  isNavKeyAllowed,
  navKeyForPath,
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
  const userId = (data?.claims?.sub as string | undefined) ?? null;

  // Header baslik izinleri: izinli olmayan rotaya dogrudan URL ile
  // girilirse /dashboard'a yonlendir. Kullanici yoksa dokunma
  // (oturum kontrolu dashboard/layout.tsx'te; dev bypass da orada).
  const pathname = request.nextUrl.pathname;
  const navKey = navKeyForPath(pathname);
  const adminPath = isAdminPath(pathname);

  if (userId && (navKey || adminPath)) {
    const { data: perm } = await supabase
      .from("user_nav_permissions")
      .select("is_admin, allowed_keys")
      .eq("user_id", userId)
      .maybeSingle();

    const allowed = adminPath
      ? perm?.is_admin === true
      : isNavKeyAllowed(navKey!, perm?.allowed_keys ?? null);

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

  return response;
}
