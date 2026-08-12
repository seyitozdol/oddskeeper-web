// API-Football uyruk adlarını ISO bayrak kodlarına eşler (flagcdn.com).
// Veride aynı ülkenin iki yazımı var: Turkey/Türkiye ve Ivory Coast/Côte
// d'Ivoire; canonicalNationality ikisini tek isimde birleştirir.

const COUNTRY_ISO: Record<string, string> = {
  Türkiye: "tr",
  Turkey: "tr",
  Brazil: "br",
  Germany: "de",
  France: "fr",
  Portugal: "pt",
  Senegal: "sn",
  Nigeria: "ng",
  Mali: "ml",
  Netherlands: "nl",
  Kosovo: "xk",
  Romania: "ro",
  Gambia: "gm",
  "Côte d'Ivoire": "ci",
  "Ivory Coast": "ci",
  Belgium: "be",
  Croatia: "hr",
  Poland: "pl",
  "Bosnia and Herzegovina": "ba",
  England: "gb-eng",
  Tunisia: "tn",
  Greece: "gr",
  "Korea Republic": "kr",
  Ukraine: "ua",
  Spain: "es",
  Albania: "al",
  Serbia: "rs",
  Cameroon: "cm",
  "North Macedonia": "mk",
  Uzbekistan: "uz",
  Norway: "no",
  Congo: "cg",
  "Congo DR": "cd",
  Ghana: "gh",
  Sweden: "se",
  Colombia: "co",
  Slovenia: "si",
  "Republic of Ireland": "ie",
  Suriname: "sr",
  Iceland: "is",
  Hungary: "hu",
  Scotland: "gb-sct",
  Angola: "ao",
  Bulgaria: "bg",
  Georgia: "ge",
  Czechia: "cz",
  Benin: "bj",
  Denmark: "dk",
  Austria: "at",
  "Guinea-Bissau": "gw",
  Italy: "it",
  Montenegro: "me",
  Panama: "pa",
  Tanzania: "tz",
  Israel: "il",
  Slovakia: "sk",
  "Cape Verde": "cv",
  Chad: "td",
  Azerbaijan: "az",
  Finland: "fi",
  Uruguay: "uy",
  Morocco: "ma",
  Russia: "ru",
  Honduras: "hn",
  Switzerland: "ch",
  Jordan: "jo",
  Guinea: "gn",
  Egypt: "eg",
  Madagascar: "mg",
  Gabon: "ga",
  Ireland: "ie",
  Jamaica: "jm",
  Libya: "ly",
  Venezuela: "ve",
  "Curaçao": "cw",
  "DR Congo": "cd",
  "Congo Republic": "cg",
  Algeria: "dz",
  Argentina: "ar",
  "Bosnia & Herzegovina": "ba",
  "Burkina Faso": "bf",
  Canada: "ca",
  "Central African Republic": "cf",
  Chile: "cl",
  "Costa Rica": "cr",
  Curacao: "cw",
  Cyprus: "cy",
  Ecuador: "ec",
  Estonia: "ee",
  Guadeloupe: "gp",
  Haiti: "ht",
  Iran: "ir",
  Japan: "jp",
  Kazakhstan: "kz",
  Kyrgyzstan: "kg",
  Liberia: "lr",
  Lithuania: "lt",
  Malaysia: "my",
  Malta: "mt",
  Martinique: "mq",
  Mexico: "mx",
  Moldova: "md",
  Mozambique: "mz",
  Paraguay: "py",
  Peru: "pe",
  "Sierra Leone": "sl",
  "South Korea": "kr",
  Syria: "sy",
  Togo: "tg",
  Wales: "gb-wls",
};

const CANONICAL_NAMES: Record<string, string> = {
  Turkey: "Türkiye",
  "Ivory Coast": "Côte d'Ivoire",
};

export function canonicalNationality(
  nationality: string | null | undefined
): string | null {
  if (!nationality) {
    return null;
  }

  const trimmed = nationality.trim();
  return CANONICAL_NAMES[trimmed] ?? trimmed;
}

export function getCountryFlagUrl(
  nationality: string | null | undefined
): string | null {
  if (!nationality) {
    return null;
  }

  const code = COUNTRY_ISO[nationality.trim()];
  return code ? `https://flagcdn.com/w40/${code}.png` : null;
}
