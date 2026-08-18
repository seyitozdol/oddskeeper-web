import { isDailyLogoutEnabled, isSessionPastDailyLogout } from "./auth/daily-logout";
import { createClient } from "./supabase/server";

export type NavAccess = {
  userId: string | null;
  userEmail: string | null;
  isAdmin: boolean;
  // null = kisitlama yok, tum basliklar erisilebilir
  allowedKeys: string[] | null;
};

// Lokal gelistirme bypass'i: dashboard/layout.tsx'teki kuralla ayni;
// production build'de NODE_ENV "production" oldugu icin canlida asla
// devreye girmez. Bypass aktifken tam erisim + admin kabul edilir ki
// panel login'siz test edilebilsin.
export function isDevAuthBypass(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_BYPASS === "1"
  );
}

// Oturumdaki kullanicinin header erisim iznini ve admin bayragini dondurur.
// Satiri olmayan kullanici varsayilan olarak tum basliklara erisebilir.
export async function getNavAccess(): Promise<NavAccess> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isDevAuthBypass()) {
      return { userId: null, userEmail: null, isAdmin: true, allowedKeys: null };
    }
    return { userId: null, userEmail: null, isAdmin: false, allowedKeys: null };
  }

  const { data: perm } = await supabase
    .from("user_nav_permissions")
    .select("is_admin, allowed_keys")
    .eq("user_id", user.id)
    .maybeSingle();

  const isAdmin = perm?.is_admin === true;

  // Gunluk otomatik logout (savunma katmani): admin OLMAYAN ve oturumu en son
  // 23:59 UTC sinirindan once acilmis kullaniciyi cikmis say -> layout /sign-in'e
  // yonlendirir. Asil cookie temizligi + refresh iptali proxy'de (o once calisir);
  // burada Server Component cookie yazamadigi icin yalniz "cikmis" durumu doneriz.
  if (!isAdmin && isDailyLogoutEnabled()) {
    const { data: claimsData } = await supabase.auth.getClaims();
    const iat = claimsData?.claims?.iat;
    if (isSessionPastDailyLogout(typeof iat === "number" ? iat : undefined)) {
      return { userId: null, userEmail: null, isAdmin: false, allowedKeys: null };
    }
  }

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    isAdmin,
    // Izin satiri OLMAYAN kullanici ( or. kendi kaydolan biri) hicbir basliga
    // erisemez: satirsiz durumu bos diziye cevir. Satir icinde allowed_keys
    // null ise bu bilincli "tam erisim" demektir (admin panelinden acilan
    // kullanici varsayilani), oyle kalir.
    allowedKeys: perm ? (perm.allowed_keys ?? null) : [],
  };
}
