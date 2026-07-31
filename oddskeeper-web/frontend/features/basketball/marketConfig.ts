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
