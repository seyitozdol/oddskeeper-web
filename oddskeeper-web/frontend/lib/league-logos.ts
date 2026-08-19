// Turnuva amblemleri icin TEK KAYNAK: hangi turnuva hangi dosyayi kullanir ve
// tema filtresinden gecer mi. Yeni turnuva geldiginde yalniz buraya eklenir.
//
// themed=true olanlar duz (tek renk) amblemler: globals.css'teki
// .tsl-league-mark filtresiyle koyu temalarda beyaz siluete doner,
// calimla-light'ta orijinal renginde kalir. Cok renkli SVG'ler (basketbol
// ligleri) filtresizdir, her temada oldugu gibi gosterilir.
//
// Eslesme SofaScore turnuva adi uzerinden ve SPOR BAZLI yapilir: "Champions
// League" futbolda UEFA CL, basketbolda BCL'dir; spor ayrimi olmadan yanlis
// amblem cikar. Amblemi olmayan turnuva icin null doner (cagiran taraf bosluk
// birakir), tahmin yapilmaz.

import { normalizeSearch } from "@/features/tsl/lib";

export type LeagueLogo = {
  src: string;
  /** alt/tooltip metni (ozel ad, cevrilmez) */
  label: string;
  /** true -> .tsl-league-mark sinifi (koyu temada beyaz silue) */
  themed: boolean;
};

const SUPER_LIG: LeagueLogo = {
  src: "/images/leagues/super-lig.png",
  label: "Süper Lig",
  themed: true,
};
const TFF_1_LIG: LeagueLogo = {
  src: "/images/leagues/tff-1-lig.png",
  label: "1. Lig",
  themed: true,
};
const TURKIYE_KUPASI: LeagueLogo = {
  src: "/images/leagues/turkiye-kupasi.png",
  label: "Türkiye Kupası",
  themed: true,
};
const UCL: LeagueLogo = {
  src: "/images/leagues/ucl.png",
  label: "UEFA Champions League",
  themed: true,
};
const UEL: LeagueLogo = {
  src: "/images/leagues/uel.png",
  label: "UEFA Europa League",
  themed: true,
};
const UECL: LeagueLogo = {
  src: "/images/leagues/uecl.png",
  label: "UEFA Conference League",
  themed: true,
};
const BSL: LeagueLogo = {
  src: "/images/leagues/bsl.svg",
  label: "Basketbol Süper Ligi",
  themed: false,
};
const EUROLEAGUE: LeagueLogo = {
  src: "/images/leagues/euroleague.svg",
  label: "EuroLeague",
  themed: false,
};
const EUROCUP: LeagueLogo = {
  src: "/images/leagues/eurocup.svg",
  label: "EuroCup",
  themed: false,
};

// Turnuva adini karsilastirma tokenine cevirir. normalizeSearch kucuk harf "ı"yi
// oldugu gibi birakir (NFD onu ayristirmaz), once "i"ye katlanir; ardindan
// harf/rakam disi her sey atilir ("Trendyol Süper Lig" -> "trendyolsuperlig").
function flatten(text: string | null | undefined): string {
  if (!text) return "";
  return normalizeSearch(text)
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "");
}

function footballLogo(flat: string, raw: string): LeagueLogo | null {
  if (flat.includes("superlig")) return SUPER_LIG; // "Trendyol Süper Lig"
  // "1. Lig" — 2./3. Lig ile karismasin diye onunde rakam olmayan desen.
  if (/(^|[^\d])1\.\s*lig/i.test(raw)) return TFF_1_LIG;
  if (flat.includes("turkiyekupasi") || flat.includes("turkishcup"))
    return TURKIYE_KUPASI;
  // Sira onemli: "UEFA Europa Conference League" hem "conference" hem "europa"
  // tasir, once conference bakilir.
  if (flat.includes("conferenceleague")) return UECL;
  if (flat.includes("europaleague")) return UEL;
  if (flat.includes("championsleague")) return UCL;
  return null;
}

function basketballLogo(flat: string): LeagueLogo | null {
  if (flat.includes("euroleague")) return EUROLEAGUE;
  if (flat.includes("eurocup")) return EUROCUP;
  if (flat.includes("superlig")) return BSL; // Basketbol Süper Ligi
  // BCL ("Champions League") ve TBL icin amblem yok -> null.
  return null;
}

// Turnuvanin amblemi; bilinmiyorsa null. Voleybolda self-host amblem yok.
export function leagueLogoFor(
  sport: string,
  tournamentName: string | null | undefined
): LeagueLogo | null {
  const raw = tournamentName ?? "";
  const flat = flatten(raw);
  if (!flat) return null;
  if (sport === "football") return footballLogo(flat, raw);
  if (sport === "basketball") return basketballLogo(flat);
  return null;
}
