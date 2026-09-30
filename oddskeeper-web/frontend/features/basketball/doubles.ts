// Double-double / triple-double olasiligi (oyuncu marketi, Yes fiyati).
//
// Yalniz sayi, ribaund ve asist sayilir. Her istatistik Normal(beklenti, std) cekilir ve
// tam sayiya yuvarlanir (oyuncu line'larindaki modelin aynisi); bir macta en az 10'a
// ulasan istatistik sayisi >= 2 ise double-double, 3 ise triple-double. Olasilik =
// boyle maclarin orani; oran = payback / olasilik. Uc istatistik bagimsiz cekilir.
//
// Cekilisler sabit tohumlu: ayni girdi her acilista ve herkeste ayni olasiligi verir.
// sims = 0 ise ornekleme yapilmaz, ayni modelin kesin (sonsuz mac) sonucu hesaplanir.

import { normalCdf } from "./odds";
import { H2H_MAX_SIMS, seededNormals } from "./h2h";

export const DOUBLE_STATS = ["points", "rebounds", "assists"] as const;
export const DOUBLE_THRESHOLD = 10;
export const DOUBLE_DEFAULT_SIMS = 10000;
// Player market base anahtarlari (bb_pm_market_config.base_metric).
export const DOUBLE_BASES = ["dd", "td"] as const;
export const isDoubleBase = (base: string | null | undefined) => base === "dd" || base === "td";

export type DoubleProbs = { dd: number; td: number };

const SEED = 20260931;

// means / stds: DOUBLE_STATS sirasiyla (sayi, ribaund, asist).
export function doubleProbs(means: number[], stds: number[], sims: number): DoubleProbs {
  if (!(sims > 0)) {
    // round(X) >= 10  <=>  X >= 9.5
    const p = means.map((m, i) => (stds[i] > 0 ? 1 - normalCdf(DOUBLE_THRESHOLD - 0.5, m, stds[i]) : m >= DOUBLE_THRESHOLD - 0.5 ? 1 : 0));
    const td = p[0] * p[1] * p[2];
    return { dd: p[0] * p[1] + p[0] * p[2] + p[1] * p[2] - 2 * td, td };
  }
  const n = Math.min(Math.max(Math.round(sims), 1), H2H_MAX_SIMS);
  const z = [seededNormals(n, SEED), seededNormals(n, SEED + 1), seededNormals(n, SEED + 2)];
  let dd = 0, td = 0;
  for (let k = 0; k < n; k++) {
    let hit = 0;
    for (let i = 0; i < 3; i++) if (Math.round(means[i] + stds[i] * z[i][k]) >= DOUBLE_THRESHOLD) hit++;
    if (hit >= 2) dd++;
    if (hit === 3) td++;
  }
  return { dd: dd / n, td: td / n };
}
