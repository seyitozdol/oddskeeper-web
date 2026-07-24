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

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    isAdmin: perm?.is_admin === true,
    allowedKeys: perm?.allowed_keys ?? null,
  };
}
