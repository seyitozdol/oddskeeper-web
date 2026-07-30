// Yaklaşan maçlar öncelik listesi: aşağıdaki takımların maçları sarı yıldızla
// işaretlenir.
//   1) Süper Lig (TSL) kulüplerinin futbol maçları (her turnuvada)
//   2) A Milli Takım futbol ve basketbol maçları
//   3) Kadın Voleybol Milli Takım maçları
//
// Kulüp eşleştirmesi öncelikli olarak SofaScore takım id'si ile yapılır
// (ref.sofascore_team_logos'taki curated Süper Lig id'leri); id boşsa isim
// içeriğiyle yedeklenir. Milli takımlar national bayrağı + "Türkiye/Turkey"
// ülke/isim eşleşmesiyle bulunur, alt yaş (U19 vb.) hariç tutulur.

import type { UpcomingEventRow } from "./types";

// Süper Lig SofaScore takım id'leri (ref.sofascore_team_logos).
const SUPER_LIG_TEAM_IDS = new Set<number>([
  6362, // Alanyaspor
  3056, // Antalyaspor
  3086, // Başakşehir FK
  3050, // Beşiktaş JK
  3064, // Çaykur Rizespor
  7040, // Eyüpspor
  3052, // Fenerbahçe
  3061, // Galatasaray
  5138, // Gaziantep FK
  3054, // Göztepe
  6063, // Kasımpaşa
  3072, // Kayserispor
  3085, // Konyaspor
  3053, // Samsunspor
  3051, // Trabzonspor
  3065, // Kocaelispor (2025/26 çıkan)
  7802, // Gençlerbirliği (2025/26 çıkan)
]);

// 1. Lig (TFF 1. Lig) SofaScore takım id'leri — bu takımların maçları da
// (her turnuvada, hazırlık dahil) öncelikli sayılır. Kaynak: 2025/26 "1. Lig"
// fikstürleri (tracker.upcoming_events) + Amed. Sezon başı kadro değişirse
// buradan güncellenir.
const FIRST_LIG_TEAM_IDS = new Set<number>([
  44320, // Bandırmaspor
  3099, // Batman Petrolspor
  202390, // Bodrum FK
  6414, // Boluspor
  3055, // Bursaspor
  262480, // Esenler Erokspor
  4954, // Fatih Karagümrük
  388264, // Iğdır FK
  3066, // İstanbulspor
  6366, // Keçiörengücü
  202391, // Manisa FK
  296730, // Mardin 1969 Spor
  7034, // Muğlaspor
  7032, // Pendikspor
  4952, // Sarıyer
  3076, // Sivasspor
  55625, // Ümraniyespor
  24750, // Vanspor FK
  207011, // Amed Sportif Faaliyetler (1. Lig'e yeni çıkan)
]);

// İsim bazlı yedek eşleşme (id boş gelirse). Normalize edilmiş isimde bu
// belirteçlerden biri geçerse Süper Lig kulübü sayılır. SADECE 2025/26 Süper
// Lig takımları: yukarıdaki 15 id'li kulüp + id'si listede olmayan çıkanlar
// (Kocaelispor, Gençlerbirliği). NOT: Fatih Karagümrük / Sivasspor / Bodrum
// gibi 1. Lig takımları BİLEREK dışarıda; yıldız yalnızca gerçek Süper Lig.
const SUPER_LIG_NAME_TOKENS = [
  "galatasaray",
  "fenerbahce",
  "besiktas",
  "trabzonspor",
  "basaksehir",
  "samsunspor",
  "eyupspor",
  "kasimpasa",
  "konyaspor",
  "gaziantep",
  "antalyaspor",
  "alanyaspor",
  "rizespor",
  "kayserispor",
  "goztepe",
  "kocaelispor",
  "genclerbirligi",
];

// Türkçe karakterleri sadeleştirip yalnızca harf/rakam bırakır.
function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLocaleLowerCase("tr")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Süper Lig SofaScore takım id'si -> takım detay sayfası slug'ı
// (public/images/football_logos dosya adları). "Bizim takımlar" için maç
// listesindeki isimler bu slug ile takım sayfasına linklenir.
const SUPER_LIG_TEAM_SLUGS: Record<number, string> = {
  6362: "alanyaspor",
  3056: "antalyaspor",
  3086: "basaksehir",
  3050: "besiktas",
  3064: "rizespor",
  7040: "eyupspor",
  3052: "fenerbahce",
  3061: "galatasaray",
  5138: "gaziantep",
  3054: "goztepe",
  6063: "kasimpasa",
  3072: "kayserispor",
  3085: "konyaspor",
  3053: "samsunspor",
  3051: "trabzonspor",
};

// Takımın detay sayfası slug'ı (yalnız Süper Lig kulüpleri); yoksa null.
export function superLigTeamSlug(teamId: number | null): string | null {
  if (teamId == null) return null;
  return SUPER_LIG_TEAM_SLUGS[teamId] ?? null;
}

// Alt yaş / genç milli takımlarını ayıklar (U15..U23, "youth").
function isYouthTeam(name: string | null | undefined): boolean {
  if (!name) return false;
  return /\bu-?\d{2}\b/i.test(name) || /youth/i.test(name);
}

// Türkiye milli takımı mı (isim veya ülke "Türkiye/Turkey" içeriyor).
function isTurkiye(name: string | null, country: string | null): boolean {
  return normalize(name).includes("turk") || normalize(country).includes("turk");
}

function isSuperLigClub(
  teamId: number | null,
  teamName: string | null
): boolean {
  if (teamId != null && SUPER_LIG_TEAM_IDS.has(teamId)) return true;
  const n = normalize(teamName);
  return n.length > 0 && SUPER_LIG_NAME_TOKENS.some((token) => n.includes(token));
}

// Süper Lig veya 1. Lig kulübü (id/isim ile). Her ikisinin de maçları öncelikli.
function isTurkishLeagueClub(
  teamId: number | null,
  teamName: string | null
): boolean {
  if (teamId != null && FIRST_LIG_TEAM_IDS.has(teamId)) return true;
  return isSuperLigClub(teamId, teamName);
}

function isSeniorTurkNational(
  name: string | null,
  country: string | null,
  national: boolean
): boolean {
  return national && isTurkiye(name, country) && !isYouthTeam(name);
}

// Maç öncelik listesinde mi (sarı yıldız gösterilecek mi).
export function isPriorityEvent(e: UpcomingEventRow): boolean {
  // 1) Süper Lig + 1. Lig kulüplerinin futbol maçları.
  if (
    e.sport === "football" &&
    (isTurkishLeagueClub(e.home_team_id, e.home_team_name) ||
      isTurkishLeagueClub(e.away_team_id, e.away_team_name))
  ) {
    return true;
  }

  // 2) & 3) Türkiye milli takımı maçları.
  const turkNational =
    isSeniorTurkNational(
      e.home_team_name,
      e.home_team_country,
      e.home_team_national
    ) ||
    isSeniorTurkNational(
      e.away_team_name,
      e.away_team_country,
      e.away_team_national
    );

  if (turkNational) {
    // Futbol + basketbol: A Milli (her cinsiyet). Voleybol: yalnızca kadın.
    if (e.sport === "football" || e.sport === "basketball") return true;
    if (e.sport === "volleyball" && e.gender === "F") return true;
  }

  return false;
}
