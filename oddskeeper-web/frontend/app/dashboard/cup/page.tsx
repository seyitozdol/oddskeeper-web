// Türkiye Kupası panosu. Veri Mackolik uygulama API'sinden çekilip
// football.mackolik_matches + football.mackolik_team_stats tablolarında.
// İçerik (fikstür, maç istatistikleri, takım/oyuncu eşleştirmesi) sonraki
// adımda doldurulacak; bu sayfa şimdilik giriş placeholder'ı.

import Image from "next/image";
import { getLocale } from "@/lib/i18n/server";

export default async function CupPage() {
  const locale = await getLocale();
  const tr = locale === "tr";
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Image
          src="/images/leagues/turkiye-kupasi.png"
          alt={tr ? "Türkiye Kupası" : "Turkish Cup"}
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 object-contain"
        />
        <div>
          <h1 className="text-lg font-semibold text-ink">
            {tr ? "Türkiye Kupası" : "Turkish Cup"}
          </h1>
          <p className="text-[13px] text-ink-3">
            {tr ? "Ziraat Türkiye Kupası" : "Ziraat Turkish Cup"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-card p-5">
        <p className="text-[13px] leading-relaxed text-ink-2">
          {tr
            ? "Kupa verisi veritabanına alındı (son 2 sezon: 2024/25 ve 2025/26, tüm turlar). Fikstür, maç istatistikleri ve takım/oyuncu içeriği bu sayfada kısa süre içinde yer alacak."
            : "Cup data has been loaded (last 2 seasons: 2024/25 and 2025/26, all rounds). Fixtures, match statistics and team/player content will appear here shortly."}
        </p>
      </div>
    </div>
  );
}
