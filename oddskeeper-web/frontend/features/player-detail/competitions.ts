import type { Translator } from "@/lib/i18n/messages";

// Oyuncu profilindeki rekabet (competition) bilgisi: siralama, kisa rozet, mac
// detay rotasi, tur (kulup / milli takim) ve gorunen ad. Etiketler DB'deki
// football.matches.competition degerleridir. Mac Logu ve Detailed Stats ayni
// listeyi kullanir; yeni bir rekabet eklenince YALNIZ burasi guncellenir.

// Chip sirasi: lig(ler) once, kupalar, sonra milli takim turnuvalari.
export const COMP_ORDER = [
  "Süper Lig",
  "Trendyol 1. Lig",
  "Türkiye Kupası",
  "UEFA Şampiyonlar Ligi",
  "UEFA Avrupa Ligi",
  "UEFA Konferans Ligi",
  "UEFA Uluslar Ligi",
  "FIFA Dünya Kupası",
  "Dünya Kupası Elemeleri",
  "EURO",
  "EURO Elemeleri",
];

// Lig disi maclar rakip adinin yaninda kisa rozetle isaretlenir ve mac linki
// rekabetin kendi detay sayfasina gider (football mac sayfasi opta-id uzayindadir).
// shortKey: rozet metninin i18n anahtari (dile gore: WC / DK).
export const CUP_INFO: Record<string, { shortKey: string; matchBase: string }> = {
  "UEFA Şampiyonlar Ligi": { shortKey: "playerDetail.compShortCl", matchBase: "/dashboard/euro-cups/cl/match" },
  "UEFA Avrupa Ligi": { shortKey: "playerDetail.compShortEl", matchBase: "/dashboard/euro-cups/el/match" },
  "UEFA Konferans Ligi": { shortKey: "playerDetail.compShortConf", matchBase: "/dashboard/euro-cups/conf/match" },
  // Milli takim maclari (ref.national_competitions etiketleri).
  "UEFA Uluslar Ligi": { shortKey: "playerDetail.compShortUnl", matchBase: "/dashboard/national/tr/match" },
  "FIFA Dünya Kupası": { shortKey: "playerDetail.compShortWc", matchBase: "/dashboard/national/tr/match" },
  "Dünya Kupası Elemeleri": { shortKey: "playerDetail.compShortWcq", matchBase: "/dashboard/national/tr/match" },
  "EURO": { shortKey: "playerDetail.compShortEuro", matchBase: "/dashboard/national/tr/match" },
  "EURO Elemeleri": { shortKey: "playerDetail.compShortEuroQ", matchBase: "/dashboard/national/tr/match" },
};

// Milli takim turnuvalari (ref.national_competitions ile ayni liste).
export const NATIONAL_COMPETITIONS: ReadonlySet<string> = new Set([
  "UEFA Uluslar Ligi",
  "FIFA Dünya Kupası",
  "Dünya Kupası Elemeleri",
  "EURO",
  "EURO Elemeleri",
]);

export function isNationalCompetition(competition: string | null | undefined): boolean {
  return !!competition && NATIONAL_COMPETITIONS.has(competition);
}

const COMP_LABEL_KEYS: Record<string, string> = {
  "Süper Lig": "playerDetail.compSuperLig",
  "Trendyol 1. Lig": "playerDetail.compFirstLig",
  "Türkiye Kupası": "playerDetail.compTurkishCup",
  "UEFA Şampiyonlar Ligi": "playerDetail.compChampionsLeague",
  "UEFA Avrupa Ligi": "playerDetail.compEuropaLeague",
  "UEFA Konferans Ligi": "playerDetail.compConferenceLeague",
  "UEFA Uluslar Ligi": "playerDetail.compNationsLeague",
  "FIFA Dünya Kupası": "playerDetail.compWorldCup",
  "Dünya Kupası Elemeleri": "playerDetail.compWorldCupQualifiers",
  "EURO": "playerDetail.compEuro",
  "EURO Elemeleri": "playerDetail.compEuroQualifiers",
};

// Rekabetin secili dildeki adi; sozlukte yoksa DB etiketi.
export function competitionLabel(t: Translator, competition: string): string {
  const key = COMP_LABEL_KEYS[competition];
  return key ? t(key) : competition;
}

// Veride bulunan rekabetleri COMP_ORDER sirasiyla dizer; listede olmayan sona.
export function orderCompetitions(present: Iterable<string>): string[] {
  const set = new Set(present);
  return [
    ...COMP_ORDER.filter((c) => set.has(c)),
    ...[...set].filter((c) => !COMP_ORDER.includes(c)).sort(),
  ];
}

// "2026/2027" -> "26/27" (chip etiketi).
export function shortSeason(season: string): string {
  const m = season.match(/^(\d{4})\/(\d{4})$/);
  return m ? `${m[1].slice(2)}/${m[2].slice(2)}` : season;
}
