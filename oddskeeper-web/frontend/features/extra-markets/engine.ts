// Extra Markets: "Extra_Markets_v3.xlsm" (modExtraMarkets.ExportExtraMarkets) makrosunun
// web portu. Girdi: maclar (Fixture ID + profil + No Goal orani) ve Profiles tablosu.
// Cikti: iki import dosyasi, Dynamic (Over/Under line'li) ve Static (secenekli).
// Saf hesap; React/DB bagimliligi yok (tests: scratch referansi Python portuyla esit).

export type ExtraMarketType = "Dynamic" | "Static";

export interface ExtraMarket {
  // Profiller tablosundaki tik: false ise market hicbir mac icin yazilmaz. Alan eski
  // kayitlarda yok; yoksa acik sayilir.
  enabled?: boolean;
  template: string;
  name: string;
  type: ExtraMarketType;
  // Dynamic: line (0.5); Static: Selection_1 adi ("Yes").
  line: number | string;
  // Dynamic: Under fiyati hesaplansin mi (Excel "Line Under" = Y). Kapaliysa Under = 1.
  under: boolean;
  // profil adi -> Over / Yes fiyati. Bos (null) ya da 0 ise o profilde market yazilmaz.
  prices: Record<string, number | null>;
}

export interface ExtraSelection {
  name: string;
  price: number | null;
}

export interface GoalTypeConfig {
  payback: number; // TFG/TLG marketinin kendi payback'i
  kickPrice: number; // Kick sabit oran
  wHeader: number;
  wFreeKick: number;
  wPenalty: number;
  wOwnGoal: number;
  // Secenek adlari, sirayla: No goal, Kick, Header, Free-Kick, Penalty, Own goal.
  names: string[];
}

export interface ExtraConfig {
  payback: number;
  profiles: string[];
  // Bu profillerde 1HFATN / 2HFATN / TFG / TLG yazilmaz.
  noExtraProfiles: string[];
  markets: ExtraMarket[];
  extraTime1h: ExtraSelection[];
  extraTime2h: ExtraSelection[];
  goalType: GoalTypeConfig;
}

// Fiyati profil kolonundan gelmeyen, kendi tablosundan uretilen ozel marketler.
export const SPECIAL_TEMPLATES = ["1HFATN", "2HFATN", "TFG", "TLG"] as const;
export const isSpecialTemplate = (tpl: string) =>
  (SPECIAL_TEMPLATES as readonly string[]).includes(tpl.trim().toUpperCase());

const P = (derbi: number, buyuk3: number, anadolu: number, lig1: number, rest: number) => ({
  Derbi: derbi,
  "3 Buyuk": buyuk3,
  Anadolu: anadolu,
  "1. Lig": lig1,
  "TR Kupasi": rest,
  Avrupa: rest,
  "Custom 1": rest,
  "Custom 2": rest,
});
const ALL = (v: number) => P(v, v, v, v, v);
const NONE: Record<string, number | null> = {};

// Excel Profiles sayfasinin birebir karsiligi (DB'de kayit yokken kullanilir).
export const DEFAULT_EXTRA_CONFIG: ExtraConfig = {
  payback: 0.93,
  profiles: ["Derbi", "3 Buyuk", "Anadolu", "1. Lig", "TR Kupasi", "Avrupa", "Custom 1", "Custom 2"],
  noExtraProfiles: ["1. Lig"],
  markets: [
    { template: "WWOUM", name: "Woodwork", type: "Dynamic", line: 0.5, under: true, prices: P(1.8, 1.8, 2.22, 2.22, 2.22) },
    { template: "WWOUM", name: "Woodwork", type: "Dynamic", line: 1.5, under: false, prices: P(3.5, 3.5, 5.5, 5.5, 5.5) },
    { template: "WWOUM", name: "Woodwork", type: "Dynamic", line: 2.5, under: false, prices: P(8, 8, 12, 12, 12) },
    { template: "VARRVW", name: "VAR", type: "Dynamic", line: 0.5, under: true, prices: { ...P(2.65, 2.85, 3, 3.2, 3.5), "TR Kupasi": 3.2 } },
    { template: "VARRVW", name: "VAR", type: "Dynamic", line: 1.5, under: false, prices: { ...P(6, 7, 9, 11, 13), "TR Kupasi": 11 } },
    { template: "VARRVW", name: "VAR", type: "Dynamic", line: 2.5, under: false, prices: { ...P(19, 21, 25, 31, 41), "TR Kupasi": 31 } },
    { template: "SOMN", name: "Sending Off", type: "Dynamic", line: 0.5, under: true, prices: P(3.5, 4, 4, 4, 4) },
    { template: "SOMN", name: "Sending Off", type: "Dynamic", line: 1.5, under: false, prices: P(8, 11, 11, 11, 11) },
    { template: "PMN", name: "Penalty", type: "Dynamic", line: 0.5, under: true, prices: P(2.8, 2.8, 3.1, 2.6, 2.6) },
    { template: "PMN", name: "Penalty", type: "Dynamic", line: 1.5, under: false, prices: P(8, 8, 11, 11, 11) },
    { template: "ATOG", name: "Own Goal", type: "Static", line: "Yes", under: false, prices: ALL(9) },
    { template: "1HS", name: "1st HF Sub Y/N", type: "Static", line: "Yes", under: false, prices: ALL(3.2) },
    { template: "WTBSS", name: "Sub to Score", type: "Static", line: "Yes", under: false, prices: ALL(2.5) },
    { template: "SUBBOOK", name: "Substitute Booked", type: "Static", line: "Yes", under: false, prices: ALL(1.7) },
    { template: "PVSO", name: "Pen + VAR + Sending Off", type: "Static", line: "Yes", under: false, prices: P(11, 15, 18, 16, 16) },
    { template: "1HFATN", name: "1st Half Extra Time", type: "Static", line: "", under: false, prices: NONE },
    { template: "2HFATN", name: "2nd Half Extra Time", type: "Static", line: "", under: false, prices: NONE },
    { template: "TFG", name: "Type of First Goal", type: "Static", line: "", under: false, prices: NONE },
    { template: "TLG", name: "Type of Last Goal", type: "Static", line: "", under: false, prices: NONE },
  ],
  extraTime1h: [
    { name: "0-3 Minutes", price: 1.14 },
    { name: "4-5 Minutes", price: 3.6 },
    { name: "6-7 Minutes", price: 11 },
    { name: "8-9 Minutes", price: 21 },
    { name: "10+ Minutes", price: 51 },
  ],
  extraTime2h: [
    { name: "0-3 Minutes", price: 1.86 },
    { name: "4-5 Minutes", price: 2.1 },
    { name: "6-7 Minutes", price: 2.6 },
    { name: "8-9 Minutes", price: 11 },
    { name: "10+ Minutes", price: 31 },
  ],
  goalType: {
    payback: 0.75,
    kickPrice: 1.2,
    wHeader: 0.22,
    wFreeKick: 0.035,
    wPenalty: 0.16,
    wOwnGoal: 0.04,
    names: ["No goal", "Kick", "Header", "Free-Kick", "Penalty", "Own goal"],
  },
};

// Excel ROUND: yarim, sifirdan uzaga; 15 anlamli basamak uzerinden (ikili kayan nokta
// artiklari 2.675 gibi degerleri asagi yuvarlamasin).
export function xlRound(v: number, dp: number): number {
  if (!Number.isFinite(v)) return v;
  const abs = Number(Math.abs(v).toPrecision(15));
  const r = Number(`${Math.round(Number(`${abs}e${dp}`))}e-${dp}`);
  return v < 0 ? -r : r;
}

// Under fiyati: payback / (1 - payback / Over). Over payback'ten buyuk degilse 1.
export function underPrice(over: number, payback: number): number {
  if (over <= payback) return 1;
  return xlRound(payback / (1 - payback / over), 2);
}

// TFG/TLG fiyatlari, sirayla: No goal, Kick, Header, Free-Kick, Penalty, Own goal.
// No Goal orani cok dusukse (kalan olasilik <= 0) null doner.
export function goalTypePrices(noGoal: number, g: GoalTypeConfig): number[] | null {
  if (!(noGoal > 0)) return null;
  const rem = 1 - g.payback / g.kickPrice - g.payback / noGoal;
  if (rem <= 0) return null;
  const wSum = g.wHeader + g.wFreeKick + g.wPenalty + g.wOwnGoal;
  const price = (w: number, dp: number) => xlRound(g.payback / ((w * rem) / wSum), dp);
  return [noGoal, g.kickPrice, price(g.wHeader, 1), price(g.wFreeKick, 0), price(g.wPenalty, 1), price(g.wOwnGoal, 0)];
}

export interface ExtraFixture {
  fixtureId: string; // import dosyasina yazilan (dis) Fixture ID
  label: string;
  profile: string;
  noGoal: number | null;
}

export type ExtraCell = string | number | null;

export interface ExtraWarning {
  kind: "profileMissing" | "noGoalMissing" | "noGoalTooLow";
  label: string;
  template?: string;
}

export const DYNAMIC_HEADERS = [
  "Fixture ID", "Market Template", "Line", "Market Status",
  "Selection_1_Name", "Selection_1_Price", "Selection_2_Name", "Selection_2_Price",
];
export const STATIC_MAX_SELECTIONS = 6;
export const STATIC_HEADERS = [
  "Fixture ID", "Market Template", "Market Status",
  ...Array.from({ length: STATIC_MAX_SELECTIONS }, (_, i) => [`Selection_${i + 1}_Name`, `Selection_${i + 1}_Price`]).flat(),
];

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
// Gonderilebilir oran: sayi ve 0'dan buyuk. 0 (ya da bos) oran HICBIR sekilde dosyaya
// girmez (sahip karari 2026-09-30): 0 yazmak "bu profilde bu market yok" demektir.
const isPrice = (v: unknown): v is number => isNum(v) && v > 0;
// Son emniyet: satirdaki oran hucrelerinden biri 0 ya da negatifse satir atilir.
const allPricesPositive = (row: ExtraCell[], priceCols: number[]) =>
  priceCols.every((c) => row[c] == null || isPrice(row[c]));
const DYNAMIC_PRICE_COLS = [5, 7];
const STATIC_PRICE_COLS = Array.from({ length: STATIC_MAX_SELECTIONS }, (_, i) => 4 + i * 2);

function staticRow(fixtureId: string, template: string, sels: Array<[string, number]>): ExtraCell[] {
  const row: ExtraCell[] = [fixtureId, template, null];
  for (let i = 0; i < STATIC_MAX_SELECTIONS; i++) {
    const s = sels[i];
    row.push(s ? s[0] : null, s ? s[1] : null);
  }
  return row;
}

// Satirlar basliksiz doner (baslik: DYNAMIC_HEADERS / STATIC_HEADERS). Sira Excel'deki
// gibi: mac sirasi, mac icinde Profiles satir sirasi.
export function buildExtraMarketRows(
  config: ExtraConfig,
  fixtures: ExtraFixture[]
): { dynamic: ExtraCell[][]; static: ExtraCell[][]; warnings: ExtraWarning[] } {
  const dynamic: ExtraCell[][] = [];
  const stat: ExtraCell[][] = [];
  const warnings: ExtraWarning[] = [];

  for (const f of fixtures) {
    const fixtureId = f.fixtureId.trim();
    if (!fixtureId || !f.profile.trim()) continue;
    const profile = config.profiles.find((p) => same(p, f.profile));
    if (!profile) {
      warnings.push({ kind: "profileMissing", label: f.label });
      continue;
    }
    const skipExtra = config.noExtraProfiles.some((p) => same(p, profile));

    for (const m of config.markets) {
      const tpl = m.template.trim();
      if (!tpl || m.enabled === false) continue;
      const code = tpl.toUpperCase();

      if (code === "1HFATN" || code === "2HFATN") {
        if (skipExtra) continue;
        const sels = (code === "1HFATN" ? config.extraTime1h : config.extraTime2h)
          .filter((s) => s.name.trim() && isPrice(s.price))
          .map((s): [string, number] => [s.name, s.price as number]);
        if (sels.length) stat.push(staticRow(fixtureId, tpl, sels));
        continue;
      }

      if (code === "TFG" || code === "TLG") {
        if (skipExtra) continue;
        if (!isPrice(f.noGoal)) {
          warnings.push({ kind: "noGoalMissing", label: f.label, template: tpl });
          continue;
        }
        const prices = goalTypePrices(f.noGoal, config.goalType);
        if (!prices || !prices.every(isPrice)) {
          warnings.push({ kind: "noGoalTooLow", label: f.label, template: tpl });
          continue;
        }
        stat.push(staticRow(fixtureId, tpl, prices.map((p, i): [string, number] => [config.goalType.names[i] ?? "", p])));
        continue;
      }

      const price = m.prices[profile];
      if (!isPrice(price)) continue;
      if (m.type === "Dynamic") {
        dynamic.push([fixtureId, tpl, m.line, null, "Over", price, "Under", m.under ? underPrice(price, config.payback) : 1]);
      } else {
        stat.push(staticRow(fixtureId, tpl, [[String(m.line), price], ["No", 1]]));
      }
    }
  }
  return {
    dynamic: dynamic.filter((r) => allPricesPositive(r, DYNAMIC_PRICE_COLS)),
    static: stat.filter((r) => allPricesPositive(r, STATIC_PRICE_COLS)),
    warnings,
  };
}

// Acilista onerilen profil (kullanici mac bazinda degistirir, secim kaydedilir).
// 1. Lig maclari "1. Lig"; digerlerinde iki taraf da dort buyukten ise "Derbi",
// bir taraf uc buyukten ise "3 Buyuk", degilse "Anadolu" (Excel'deki kullanimla ayni).
const BIG3 = ["galatasaray", "fenerbahce", "besiktas"];
const BIG4 = [...BIG3, "trabzonspor"];
const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u");
const isOneOf = (list: string[], slug: string, name: string) =>
  list.some((k) => fold(slug).includes(k) || fold(name).includes(k));

export function defaultProfile(
  league: string,
  home: { slug: string; name: string },
  away: { slug: string; name: string }
): string {
  if (league === "tff1") return "1. Lig";
  const h4 = isOneOf(BIG4, home.slug, home.name);
  const a4 = isOneOf(BIG4, away.slug, away.name);
  if (h4 && a4) return "Derbi";
  if (isOneOf(BIG3, home.slug, home.name) || isOneOf(BIG3, away.slug, away.name)) return "3 Buyuk";
  return "Anadolu";
}
