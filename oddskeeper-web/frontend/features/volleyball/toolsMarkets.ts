// Voleybol Match-Player Tools market katalogu. Team + Player ayni 6 market.
// std degerleri kaba baslangic; Config sekmesinden market bazinda override edilir.

export type VbMarket = {
  key: string;    // veri anahtari (team-match / player-match kolonu)
  label: string;  // gorunen ad
  tpl: string;    // platform sablon kodu (Config'ten override)
  std: number;    // varsayilan std (line uretimi)
  pct?: boolean;  // yuzde market (dagitilmaz, ort. gosterilir)
};

export const VB_MARKETS: VbMarket[] = [
  { key: "points", label: "Total Points", tpl: "VBPTS", std: 8 },
  { key: "ace", label: "Aces", tpl: "VBACE", std: 2 },
  { key: "block", label: "Block Points", tpl: "VBBLK", std: 2.5 },
  { key: "attack", label: "Attack Points", tpl: "VBATK", std: 6 },
  { key: "digs", label: "Digs", tpl: "VBDIG", std: 6 },
  { key: "rec_pct", label: "Reception Success Rate", tpl: "VBREC", std: 8, pct: true },
];

export const VB_MARKET_BY = new Map(VB_MARKETS.map((m) => [m.key, m]));

export function vbMarketStd(key: string): number {
  return VB_MARKET_BY.get(key)?.std ?? 3;
}
