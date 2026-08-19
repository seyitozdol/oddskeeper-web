import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  // anon SELECT lockdown (2026-08-19) sonrasi oturumsuz istekler veri okuyamaz.
  // DEV_AUTH_BYPASS=1 iken oturum yoksa istekler anon'a dusup bos donecegi icin
  // bypass modunda secret key kullanilir (service_role). Oturum cookie'si varsa
  // Authorization yine kullanici JWT'sidir, rol authenticated kalir. NODE_ENV
  // kontrolu sayesinde canlida asla devreye girmez (nav-access-server.ts'teki
  // isDevAuthBypass ile ayni kural; oradan import etmek dongusel bagimlilik
  // yaratirdi).
  const devBypassKey =
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_BYPASS === "1"
      ? process.env.SUPABASE_SECRET_KEY
      : undefined;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    devBypassKey ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component içinden cookie set edilemeyen durumlar için sessiz geç
          }
        },
      },
    }
  );
}