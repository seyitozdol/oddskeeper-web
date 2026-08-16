// Puan durumu renk bantlari (SofaScore tarzi). Lige gore bolge tanimlari.
//  TSL (18 takim): 1 Sampiyonlar Ligi, 2 SL Elemesi, 3 Avrupa Ligi Elemesi,
//                  4-5 Konferans Ligi Elemesi, son 3 kume dusme.
//  1.Lig:          1-2 direkt yukselme, 3-6 play-off, son 3 kume dusme.
// Renkler inline hex (Tailwind purge riski olmasin diye class degil).

export type ZoneKey =
  | "ucl"
  | "uclq"
  | "uelq"
  | "confq"
  | "promotion"
  | "playoff"
  | "relegation";

export type ZoneStyle = { key: ZoneKey; color: string; labelKey: string };

const STYLE: Record<ZoneKey, { color: string; labelKey: string }> = {
  ucl: { color: "#2f6fed", labelKey: "tsl.zoneUcl" },
  uclq: { color: "#4aa3e0", labelKey: "tsl.zoneUclQ" },
  uelq: { color: "#e58f2a", labelKey: "tsl.zoneUelQ" },
  confq: { color: "#1f9d55", labelKey: "tsl.zoneConfQ" },
  promotion: { color: "#1f9d55", labelKey: "tsl.zonePromotion" },
  playoff: { color: "#4aa3e0", labelKey: "tsl.zonePlayoff" },
  relegation: { color: "#e0483d", labelKey: "tsl.zoneRelegation" },
};

// Lig kaynagi ("tsl" | "tff1" | "cup") + sira -> bolge anahtari.
export function zoneForRank(
  source: string,
  rank: number,
  total: number
): ZoneKey | null {
  if (source === "tff1") {
    if (rank <= 2) return "promotion";
    if (rank <= 6) return "playoff";
    if (rank > total - 3) return "relegation";
    return null;
  }
  if (source === "tsl") {
    if (rank === 1) return "ucl";
    if (rank === 2) return "uclq";
    if (rank === 3) return "uelq";
    if (rank <= 5) return "confq";
    if (rank > total - 3) return "relegation";
    return null;
  }
  return null;
}

export function zoneColor(key: ZoneKey): string {
  return STYLE[key].color;
}

export function zoneStyle(key: ZoneKey): ZoneStyle {
  return { key, ...STYLE[key] };
}

// Tabloda goze gorunen bolgelerin (sirali, tekil) legend listesi.
export function zoneLegend(source: string, total: number): ZoneStyle[] {
  const keys: ZoneKey[] = [];
  for (let r = 1; r <= total; r++) {
    const k = zoneForRank(source, r, total);
    if (k && !keys.includes(k)) keys.push(k);
  }
  return keys.map(zoneStyle);
}
