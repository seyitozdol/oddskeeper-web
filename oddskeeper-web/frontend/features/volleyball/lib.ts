// Voleybol gorsel yardimcilari: oyuncu fotografi (volleyballworld cloudinary) + ulke bayragi.

// volleyballworld oyuncu fotografi. Yalniz t_editorial_squared_6_desktop named transform calisiyor.
export function vbwPhotoUrl(id: string | null | undefined): string | null {
  if (!id) return null;
  return `https://images.volleyballworld.com/image/upload/t_editorial_squared_6_desktop/f_auto/fivb-prd/${id}.webp`;
}

// FIVB/IOC 3-harfli ulke kodu -> ISO alpha2 (flagcdn). Voleybol milletleri.
const FIVB_TO_ISO2: Record<string, string> = {
  TUR: "tr", BRA: "br", ITA: "it", USA: "us", CHN: "cn", JPN: "jp", GER: "de",
  NED: "nl", POL: "pl", SRB: "rs", CAN: "ca", DOM: "do", BUL: "bg", CZE: "cz",
  FRA: "fr", THA: "th", UKR: "ua", BEL: "be", SLO: "si", KEN: "ke", LAT: "lv",
  HUN: "hu", ARG: "ar", KOR: "kr", PUR: "pr", EGY: "eg", CUB: "cu", CRO: "hr",
  SVK: "sk", GRE: "gr", ESP: "es", SWE: "se", FIN: "fi", AZE: "az", ROU: "ro",
  MEX: "mx", COL: "co", PER: "pe", IRI: "ir", QAT: "qa", TUN: "tn", CMR: "cm",
  KAZ: "kz", AUS: "au", PHI: "ph", VIE: "vn", INA: "id", BLR: "by", SUI: "ch",
  POR: "pt", MNE: "me", MKD: "mk", BIH: "ba", CHI: "cl", VEN: "ve", ALG: "dz",
  MAR: "ma", RSA: "za", NGR: "ng", ENG: "gb-eng", GBR: "gb", DEN: "dk", NOR: "no",
  AUT: "at", EST: "ee", LTU: "lt", ISR: "il", GEO: "ge", ARM: "am",
};

export function fivbFlagUrl(code: string | null | undefined, w = 40): string | null {
  if (!code) return null;
  const iso = FIVB_TO_ISO2[code.trim().toUpperCase()];
  return iso ? `https://flagcdn.com/w${w}/${iso}.png` : null;
}
