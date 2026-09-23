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
//     Sultanlar / Efeler Ligi ........ 0 (listede, "low profile"; kullanıcı 2026-09-23)
//   Hentbol (2026-09-23)
//     Süper Lig (erkek VE kadın) ..... 1 (kadın kulüp kuralının istisnası)
//
// Alt yaş (U16/U18/U19/U21, PAF, youth) takımlarının maçları ve kadın KULÜP
// takımlarının maçları yıldız almaz. Milli takım cinsiyet kuralı: futbol/basketbol
// yalnız erkek, voleybol yalnız kadın (kullanıcı tercihi). Turnuva eşleşmesi
// SofaScore tournament_name üstünden yapılır (ör. "Trendyol Süper Lig",
// "UEFA Champions League, Qualification").

import type { UpcomingEventRow } from "./types";

// Toplam yıldız üst sınırı (kullanıcı tercihi).
const MAX_STARS = 5;

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

  // Hentbol: yalnız Süper Lig çekiliyor; erkek ve kadın ligi tek yıldız (kadın kulüp
  // kuralı burada uygulanmaz, kullanıcı isteği).
  if (e.sport === "handball") {
    return /s[uü]per\s*lig/i.test(e.tournament_name) ? 1 : 0;
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
