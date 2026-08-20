// PostgREST/Supabase varsayilan db-max-rows=1000 uygular: `.limit(N>1000)` sessizce
// 1000'e caplenir. 1000'i asabilecek tablolarin TAMAMINI cekmek icin .range() ile
// sayfalayin. makeQuery MUTLAKA stabil bir .order() icermeli (yoksa sayfalar
// cakisir/atlar). Bkz tff1 oyuncu foto bug'i (2050 satir, .limit(3000) capleniyordu).
type PageResult<T> = { data: T[] | null; error: { message: string } | null };

export async function fetchAllPaged<T>(
  makeQuery: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1);
    if (error) {
      // K-3 (2026-08-20): hata anında o ana kadarki KISMİ satırları normal
      // sonuçmuş gibi döndürmek, L5/L10/sezon ortalamalarını sessizce yanlışa
      // düşürüyordu (statement-timeout sınıfı canlıda görüldü). Yanlış
      // istatistik render etmektense yüksek sesle patla.
      throw new Error(`fetchAllPaged (from=${from}): ${error.message}`);
    }
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}
