// Excel PlayerCalc/TeamProps'tan çıkarılan market kataloğu + SABİT std değerleri.
// Excel'de std hesaplanmıyor, market bazlı elle-ayarlı sabit → model birebir tutması için burada.

export type PlayerMarket = {
  key: string;       // model view market_key
  label: string;     // TR görünen ad
  tpl: string;       // platform şablon kodu (MarketTemplate)
  std: number;       // Excel sabit std
  distributable: boolean; // takım toplamından dağıtılabilir mi (kombine/yüzde değil)
};

// Excel STD: Sayi 5.79, Ribaund 3.25, Asist 3.28, 2PMade 3.25, FTMade 2.75,
// FGMadePct 7, FTPct 11.3, SayiRib/SayiAs/SayiRibAs 8, else 1.75.
export const PLAYER_MARKETS: PlayerMarket[] = [
  { key: "points",    label: "Sayı",           tpl: "PPOINTS",   std: 5.79, distributable: true },
  { key: "rebounds",  label: "Ribaund",        tpl: "PREB",      std: 3.25, distributable: true },
  { key: "assists",   label: "Asist",          tpl: "PAST",      std: 3.28, distributable: true },
  { key: "threes",    label: "3 Sayı",         tpl: "P3PTM",     std: 1.75, distributable: true },
  { key: "twos",      label: "2 Sayı",         tpl: "P2PTSM",    std: 3.25, distributable: true },
  { key: "ftm",       label: "Serbest Atış",   tpl: "PFTRWM",    std: 2.75, distributable: true },
  { key: "steals",    label: "Top Çalma",      tpl: "PSTL",      std: 1.75, distributable: true },
  { key: "blocks",    label: "Blok",           tpl: "PBLCK",     std: 1.75, distributable: true },
  { key: "turnovers", label: "Top Kaybı",      tpl: "PTURNOVR",  std: 1.75, distributable: true },
  { key: "pr",        label: "Sayı+Ribaund",   tpl: "PPTSREB",   std: 8,    distributable: false },
  { key: "pa",        label: "Sayı+Asist",     tpl: "PPTSAST",   std: 8,    distributable: false },
  { key: "pra",       label: "Sayı+Rib+Asist", tpl: "PPTSRBAST", std: 8,    distributable: false },
  { key: "fgmadepct", label: "İsabet %",       tpl: "PFGLSM",    std: 7,    distributable: false },
  { key: "ftpct",     label: "Serbest %",      tpl: "PTFTRWM",   std: 11.3, distributable: false },
];

export function playerStd(key: string): number {
  return PLAYER_MARKETS.find((m) => m.key === key)?.std ?? 1.75;
}

// Excel TeamProps STD (D kolonu, sabit)
export const TEAM_STD: Record<string, number> = {
  points: 8.78,
  rebounds: 5.84,
  oreb: 3,
  dreb: 4.1,
  assists: 4.34,
  threes: 3.16,
  twos: 3.8,
  ftm: 3.5,
  steals: 0.9,
  blocks: 2,
  turnovers: 1.1,
  fgm: 4.5,
};
export function teamStd(key: string): number {
  return TEAM_STD[key] ?? 3;
}

export const TEAM_MARKETS: { key: string; label: string }[] = [
  { key: "points", label: "Sayı" },
  { key: "rebounds", label: "Toplam Ribaund" },
  { key: "oreb", label: "Hücum Ribaund" },
  { key: "dreb", label: "Savunma Ribaund" },
  { key: "assists", label: "Asist" },
  { key: "threes", label: "3 Sayı" },
  { key: "twos", label: "2 Sayı" },
  { key: "ftm", label: "Serbest Atış" },
  { key: "steals", label: "Top Çalma" },
  { key: "blocks", label: "Blok" },
  { key: "turnovers", label: "Top Kaybı" },
];

// Locale-duyarlı metrik + taraf etiketleri (TR/EN). Config + Model ekranları kullanır.
export const METRIC_LABELS: Record<string, { tr: string; en: string }> = {
  points: { tr: "Sayı", en: "Points" },
  rebounds: { tr: "Ribaund", en: "Rebounds" },
  oreb: { tr: "Hücum Ribaund", en: "Off. Rebounds" },
  dreb: { tr: "Savunma Ribaund", en: "Def. Rebounds" },
  assists: { tr: "Asist", en: "Assists" },
  threes: { tr: "3 Sayı", en: "3 Pointers" },
  twos: { tr: "2 Sayı", en: "2 Pointers" },
  ftm: { tr: "Serbest Atış", en: "Free Throws" },
  steals: { tr: "Top Çalma", en: "Steals" },
  blocks: { tr: "Blok", en: "Blocks" },
  turnovers: { tr: "Top Kaybı", en: "Turnovers" },
  pr: { tr: "Sayı+Ribaund", en: "Pts+Reb" },
  pa: { tr: "Sayı+Asist", en: "Pts+Ast" },
  pra: { tr: "Sayı+Rib+Asist", en: "Pts+Reb+Ast" },
  fgmadepct: { tr: "İsabet %", en: "FG %" },
  ftpct: { tr: "Serbest %", en: "FT %" },
};
export const SIDE_LABELS: Record<string, { tr: string; en: string }> = {
  home: { tr: "Ev", en: "Home" }, away: { tr: "Dep", en: "Away" }, total: { tr: "Toplam", en: "Total" },
};
export function metricLabel(key: string, locale: string, fallback?: string): string {
  const m = METRIC_LABELS[key];
  return m ? (locale === "tr" ? m.tr : m.en) : (fallback ?? key);
}

// Model ekranı takım metriği hover açıklaması: metrik anlamı + Model hesabı.
// Model (points hariç) = (projeksiyon sayı / takım sezon sayı ort) × metrik son-10 ort.
export function metricInfo(key: string, locale: string): string {
  const name = metricLabel(key, locale, key);
  if (key === "points") {
    return locale === "tr"
      ? "Takım sayısı. Model = maç projeksiyon sayısı (takım hücumu × rakip savunması / lig ortalaması, log5). Trader'ı elle değiştirebilirsin."
      : "Team points. Model = projected match points (team offense x opponent defense / league average, log5). You can override Trader.";
  }
  const low = name.toLocaleLowerCase(locale === "tr" ? "tr" : "en");
  return locale === "tr"
    ? `${name}: takım maç başına ${low}. Model = (projeksiyon sayı / takım sezon sayı ort) × ${low} son-10 ort. Trader'ı elle değiştirebilirsin.`
    : `${name}: team ${low} per match. Model = (projected points / team season points avg) x this stat's last-10 avg. You can override Trader.`;
}
export function sideLabel(side: string | null | undefined, locale: string): string {
  const s = side ? SIDE_LABELS[side] : undefined;
  return s ? (locale === "tr" ? s.tr : s.en) : "";
}
// Config satırı görünen adı (custom market'te DB label'ına düşer).
export function configLabel(
  c: { market_group: string; base_metric: string | null; side: string | null; label: string | null; market_key: string },
  locale: string
): string {
  if (c.base_metric && METRIC_LABELS[c.base_metric]) {
    const ml = metricLabel(c.base_metric, locale);
    if (c.market_group === "team" && c.side) return `${sideLabel(c.side, locale)} ${ml}`.trim();
    return ml;
  }
  return c.label ?? c.market_key;
}

// Kombine + yüzde marketleri takım toplamından DAĞITILMAZ (oyuncunun kendi ort.)
const NON_DISTRIBUTABLE = new Set(["pr", "pa", "pra", "fgmadepct", "ftpct"]);
export function isDistributable(baseMetric: string | null | undefined): boolean {
  return !NON_DISTRIBUTABLE.has(baseMetric ?? "");
}
