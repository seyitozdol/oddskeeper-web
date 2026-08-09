// SofaScore takım kimliği köprüsü.
// tsl_ss_* analytics view'ları takım kimliğini SofaScore sayısal id'siyle
// (source_team_id) taşır ve team_slug NULL bırakır; site rotaları ise
// team_slug uzayını kullanır. Bu harita iki yönü de çözer. Takım
// leaderboard view'ında id kolonu olmadığından ad bazlı yedek harita da var
// (adlar SofaScore kanonik yazımı). Slug'ı olmayan takımlar (düşen eski
// sezon takımları: Hatayspor, Sivasspor, Bodrum FK...) null döner; link
// bileşenleri bunu zarifçe düz metne çevirir.

const SLUG_BY_SOFASCORE_ID: Record<string, string> = {
  "3050": "besiktas",
  "3051": "trabzonspor",
  "3052": "fenerbahce",
  "3053": "samsunspor",
  "3054": "goztepe",
  "3056": "antalyaspor",
  "3061": "galatasaray",
  "3064": "rizespor",
  "3065": "kocaelispor",
  "3072": "kayserispor",
  "3085": "konyaspor",
  "3086": "basaksehir",
  "4954": "karagumruk",
  "5138": "gaziantep",
  "6063": "kasimpasa",
  "6362": "alanyaspor",
  "7040": "eyupspor",
  "7802": "genclerbirligi",
  "55603": "erzurumspor",
  "77629": "corum",
  "207011": "amed",
};

const SLUG_BY_SOFASCORE_NAME: Record<string, string> = {
  "Beşiktaş JK": "besiktas",
  Trabzonspor: "trabzonspor",
  Fenerbahçe: "fenerbahce",
  Samsunspor: "samsunspor",
  Göztepe: "goztepe",
  Antalyaspor: "antalyaspor",
  Galatasaray: "galatasaray",
  "Çaykur Rizespor": "rizespor",
  Kocaelispor: "kocaelispor",
  Kayserispor: "kayserispor",
  Konyaspor: "konyaspor",
  "Başakşehir FK": "basaksehir",
  "Fatih Karagümrük": "karagumruk",
  "Gaziantep FK": "gaziantep",
  Kasımpaşa: "kasimpasa",
  Alanyaspor: "alanyaspor",
  Eyüpspor: "eyupspor",
  Gençlerbirliği: "genclerbirligi",
  "Erzurumspor FK": "erzurumspor",
  "Çorum FK": "corum",
  "Amed Sportif Faaliyetler": "amed",
};

const SOFASCORE_ID_BY_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_BY_SOFASCORE_ID).map(([id, slug]) => [slug, id])
);

export function slugForSofascoreTeam(
  sofascoreTeamId: string | number | null | undefined
): string | null {
  if (sofascoreTeamId === null || sofascoreTeamId === undefined) return null;
  return SLUG_BY_SOFASCORE_ID[String(sofascoreTeamId)] ?? null;
}

export function slugForSofascoreTeamName(
  teamName: string | null | undefined
): string | null {
  if (!teamName) return null;
  return SLUG_BY_SOFASCORE_NAME[teamName] ?? null;
}

export function sofascoreIdForTeamSlug(
  teamSlug: string | null | undefined
): string | null {
  if (!teamSlug) return null;
  return SOFASCORE_ID_BY_SLUG[teamSlug] ?? null;
}
