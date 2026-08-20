// H11/P-3 (2026-08-20): kullanici-BAGIMSIZ agir okumalar icin kisa-TTL
// istek-arasi onbellek. unstable_cache kapsami cookies() okuyamaz; bu yuzden
// cache'li fonksiyon cookie'siz service-role client ile okur (yalniz server
// tarafi, anahtar bundle'a sizamaz). Buraya YALNIZ her kullanici icin ayni
// sonucu ureten liste/istatistik okumalari baglanir (sayfalar zaten oturum
// kapisinin arkasinda; kisisel veri iceren sorgu BAGLANMAZ). Veri 10 dk'lik
// pipeline turlariyla degistigi icin 120 sn TTL bayatlik riski tasimaz;
// donen deger JSON-serializable olmali (unstable_cache sozlesmesi).
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./admin";

export const CACHED_QUERY_TTL_S = 120;

export function cachedQuery<Args extends (string | number)[], T>(
  keyPrefix: string,
  fn: (sb: SupabaseClient, ...args: Args) => Promise<T>,
  ttl: number = CACHED_QUERY_TTL_S
): (...args: Args) => Promise<T> {
  return unstable_cache(
    async (...args: Args) => fn(createAdminClient(), ...args),
    [keyPrefix],
    { revalidate: ttl }
  );
}
