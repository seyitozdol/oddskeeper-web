// Yaklaşan maçlar öncelik puanı: her maça bir YILDIZ SAYISI verilir. Yıldızlar
// birden çok kaynaktan gelir ve TOPLANIR (lig + turnuva + takım + milli), toplam
// en fazla 5 ile sınırlıdır. Puanı 0 olan maç öncelikli değildir.
//
// Yıldız kaynakları (kullanıcı tanımı):
//   Futbol
//     Süper Lig maçı ................. 2
//     4 büyük takım (GS/FB/BJK/TS) ... her biri +1 (maçta ikisi de varsa +2)
//     Champions League ............... 2
//     Europa League .................. 2
//     Conference League .............. 1
//     1. Lig ......................... 1
//     Türkiye Kupası ................. 1
//     A Milli (erkek) ................ 3
//   Basketbol
//     BSL (Süper Lig) ................ 2
//     TBL (2. lig) ................... 1
//     EuroLeague ..................... 1
//     EuroCup ........................ 1
//     Fenerbahçe / Efes / Beşiktaş ... her biri +2
//     Bahçeşehir / Türk Telekom / Tofaş  her biri +1
//     A Milli (erkek) ................ 3
//   Voleybol
//     Kadın A Milli .................. 3
//
// Alt yaş (U16/U18/U19/U21, PAF, youth) takımlarının maçları ve kadın KULÜP
// takımlarının maçları yıldız almaz. Milli takım cinsiyet kuralı: futbol/basketbol
// yalnız erkek, voleybol yalnız kadın (kullanıcı tercihi). Turnuva eşleşmesi
// SofaScore tournament_name üstünden yapılır (ör. "Trendyol Süper Lig",
// "UEFA Champions League, Qualification").

import type { UpcomingEventRow } from "./types";

// Toplam yıldız üst sınırı (kullanıcı tercihi).
const MAX_STARS = 5;

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

// 4 büyük futbol kulübü (SofaScore id'leri) — maçta her biri +1 yıldız.
const BIG_FOUR_TEAM_IDS = new Set<number>([
  3061, // Galatasaray
  3052, // Fenerbahçe
  3050, // Beşiktaş
  3051, // Trabzonspor
]);

const BIG_FOUR_NAME_TOKENS = [
  "galatasaray",
  "fenerbahce",
  "besiktas",
  "trabzonspor",
];

// İsim bazlı yedek eşleşme (id boş gelirse). Normalize edilmiş isimde bu
// belirteçlerden biri geçerse Süper Lig kulübü sayılır. SADECE 2025/26 Süper
// Lig takımları.
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

// Basketbol yıldızlı takımları (isim belirteci -> yıldız). SofaScore takım
// isimleri sponsorlu olabilir (ör. "Fenerbahçe Beko", "Beşiktaş GAİN"), bu
// yüzden normalize edilmiş isimde belirteç aranır.
const BASKETBALL_TEAM_STARS: Array<{ token: string; stars: number }> = [
  { token: "fenerbahce", stars: 2 },
  { token: "efes", stars: 2 }, // Anadolu Efes
  { token: "besiktas", stars: 2 },
  { token: "bahcesehir", stars: 1 }, // Bahçeşehir Koleji
  { token: "turktelekom", stars: 1 },
  { token: "tofas", stars: 1 },
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

// Alt yaş / genç takımı mı (U15..U23, "youth", "PAF"). NOT: "gençler" belirteci
// KULLANILMAZ — "Gençlerbirliği" (kıdemli Süper Lig kulübü) ile çakışır. SofaScore
// alt yaş takımlarını daima U-numarası / PAF ile adlandırır.
function isYouthText(value: string | null | undefined): boolean {
  if (!value) return false;
  if (/\bu-?\d{2}\b/i.test(value)) return true;
  const n = normalize(value);
  return n.includes("youth") || n.includes("paf");
}

function isYouthEvent(e: UpcomingEventRow): boolean {
  return (
    isYouthText(e.home_team_name) ||
    isYouthText(e.away_team_name) ||
    isYouthText(e.tournament_name) ||
    isYouthText(e.round_info)
  );
}

// Türkiye milli takımı mı (isim veya ülke "Türkiye/Turkey" içeriyor).
function isTurkiye(name: string | null, country: string | null): boolean {
  return normalize(name).includes("turk") || normalize(country).includes("turk");
}

function isSeniorTurkNational(e: UpcomingEventRow): boolean {
  const side = (
    name: string | null,
    country: string | null,
    national: boolean
  ) => national && isTurkiye(name, country);
  return (
    side(e.home_team_name, e.home_team_country, e.home_team_national) ||
    side(e.away_team_name, e.away_team_country, e.away_team_national)
  );
}

// Bir takımın 4 büyükten olup olmadığı (id veya isim ile), her biri +1.
function bigFourStars(teamId: number | null, teamName: string | null): number {
  if (teamId != null && BIG_FOUR_TEAM_IDS.has(teamId)) return 1;
  const n = normalize(teamName);
  return n.length > 0 && BIG_FOUR_NAME_TOKENS.some((tok) => n.includes(tok))
    ? 1
    : 0;
}

// Bir basketbol takımının yıldızı (isim belirteci ile), yoksa 0.
function basketballTeamStars(teamName: string | null): number {
  const n = normalize(teamName);
  if (!n) return 0;
  for (const { token, stars } of BASKETBALL_TEAM_STARS) {
    if (n.includes(token)) return stars;
  }
  return 0;
}

// Futbol turnuva yıldızı (maç tek bir turnuvaya ait, o yüzden tek değer döner).
function footballTournamentStars(tournamentName: string): number {
  const raw = tournamentName;
  const n = normalize(raw);
  // Kadın CL/EL turnuvaları çağrı öncesi zaten elenir (kadın kulüp = 0).
  if (n.includes("conferenceleague")) return 1; // UEFA (Europa) Conference League
  if (n.includes("europaleague")) return 2;
  if (n.includes("championsleague")) return 2;
  if (n.includes("superlig")) return 2; // Trendyol Süper Lig
  if (/(^|[^\d])1\.\s*lig/i.test(raw)) return 1; // "1. Lig" (3./2. Lig hariç)
  if (n.includes("turkiyekupasi") || n.includes("turkishcup")) return 1;
  return 0;
}

// Basketbol turnuva yıldızı.
function basketballTournamentStars(tournamentName: string): number {
  const n = normalize(tournamentName);
  if (n.includes("euroleague")) return 1;
  if (n.includes("eurocup")) return 1;
  if (n.includes("superlig")) return 2; // Basketbol Süper Ligi (BSL)
  if (n.includes("basketbolligi") || n.includes("tbl")) return 1; // Türkiye Basketbol Ligi
  return 0;
}

// Maçın toplam yıldız puanı (0 = öncelikli değil), üst sınır MAX_STARS.
export function eventStarCount(e: UpcomingEventRow): number {
  // Alt yaş takımlarının maçları hiç yıldız almaz.
  if (isYouthEvent(e)) return 0;

  const women = e.gender === "F";

  // Milli takım: futbol/basketbol yalnız erkek, voleybol yalnız kadın.
  if (isSeniorTurkNational(e)) {
    if ((e.sport === "football" || e.sport === "basketball") && !women) return 3;
    if (e.sport === "volleyball" && women) return 3;
    return 0; // diğer milli maçlar (ör. kadın futbol milli) yıldızsız
  }

  // Kadın kulüp takımlarının maçları yıldız almaz.
  if (women) return 0;

  let stars = 0;

  if (e.sport === "football") {
    stars += footballTournamentStars(e.tournament_name);
    stars += bigFourStars(e.home_team_id, e.home_team_name);
    stars += bigFourStars(e.away_team_id, e.away_team_name);
  } else if (e.sport === "basketball") {
    stars += basketballTournamentStars(e.tournament_name);
    stars += basketballTeamStars(e.home_team_name);
    stars += basketballTeamStars(e.away_team_name);
  }
  // Voleybol kulüp maçları yıldız almaz.

  return Math.min(stars, MAX_STARS);
}

// Geriye dönük yardımcı: maç öncelikli mi (en az bir yıldız).
export function isPriorityEvent(e: UpcomingEventRow): boolean {
  return eventStarCount(e) > 0;
}
