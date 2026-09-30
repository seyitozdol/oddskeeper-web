// Double-double / triple-double olasiligi (oyuncu marketi, Yes fiyati).
//
// Yalniz sayi, ribaund ve asist sayilir. Her istatistik Normal(beklenti, std) cekilir ve
// tam sayiya yuvarlanir (oyuncu line'larindaki modelin aynisi); bir macta en az 10'a
// ulasan istatistik sayisi >= 2 ise double-double, 3 ise triple-double. Olasilik =
// boyle maclarin orani; oran = payback / olasilik.
//
// KORELASYON: uc istatistik ayni macta birlikte hareket eder (cok sure alan oyuncu hem
// sayi hem ribaund toplar). Bagimsiz cekim double-double'i dusuk fiyatliyordu; cekilisler
// verilen korelasyonlarla (sayi-ribaund, sayi-asist, ribaund-asist) birlikte uretilir.
// Varsayilanlar lig verisinden olculdu (oyuncunun kendi ortalamasindan sapmalari; BSL +
// EuroLeague + EuroCup, 12 bin mac): 0.30 / 0.18 / 0.17.
//
// Cekilisler sabit tohumlu: ayni girdi her acilista ve herkeste ayni olasiligi verir.
// sims = 0: korelasyon yoksa kapali formul; varsa en buyuk mac sayisiyla (200 bin) cekim.

import { normalCdf } from "./odds";
import { H2H_MAX_SIMS, seededNormals } from "./h2h";

export const DOUBLE_STATS = ["points", "rebounds", "assists"] as const;
export const DOUBLE_THRESHOLD = 10;
export const DOUBLE_DEFAULT_SIMS = 10000;
// Sirasiyla: sayi-ribaund, sayi-asist, ribaund-asist.
export const DOUBLE_DEFAULT_CORR: [number, number, number] = [0.3, 0.18, 0.17];
export const DOUBLE_MAX_CORR = 0.95;
// Player market base anahtarlari (bb_pm_market_config.base_metric).
export const DOUBLE_BASES = ["dd", "td"] as const;
export const isDoubleBase = (base: string | null | undefined) => base === "dd" || base === "td";

export type DoubleProbs = { dd: number; td: number };

const SEED = 20260931;
const clampCorr = (v: number) => (Number.isFinite(v) ? Math.max(-DOUBLE_MAX_CORR, Math.min(DOUBLE_MAX_CORR, v)) : 0);

// Ayni girdi tekrar tekrar sorulur (tablo her cizimde tum oyunculari hesaplar): sonuc saklanir.
const cache = new Map<string, DoubleProbs>();

// means / stds: DOUBLE_STATS sirasiyla (sayi, ribaund, asist).
// corr: [sayi-ribaund, sayi-asist, ribaund-asist]; verilmezse bagimsiz.
export function doubleProbs(means: number[], stds: number[], sims: number, corr: number[] = [0, 0, 0]): DoubleProbs {
  const r12 = clampCorr(corr[0] ?? 0), r13 = clampCorr(corr[1] ?? 0), r23 = clampCorr(corr[2] ?? 0);
  const correlated = r12 !== 0 || r13 !== 0 || r23 !== 0;
  const key = `${means.join(",")}|${stds.join(",")}|${sims}|${r12},${r13},${r23}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let out: DoubleProbs;
  if (!(sims > 0) && !correlated) {
    // round(X) >= 10  <=>  X >= 9.5
    const p = means.map((m, i) => (stds[i] > 0 ? 1 - normalCdf(DOUBLE_THRESHOLD - 0.5, m, stds[i]) : m >= DOUBLE_THRESHOLD - 0.5 ? 1 : 0));
    const td = p[0] * p[1] * p[2];
    out = { dd: p[0] * p[1] + p[0] * p[2] + p[1] * p[2] - 2 * td, td };
  } else {
    const n = sims > 0 ? Math.min(Math.max(Math.round(sims), 1), H2H_MAX_SIMS) : H2H_MAX_SIMS;
    const e = [seededNormals(n, SEED), seededNormals(n, SEED + 1), seededNormals(n, SEED + 2)];
    // Cholesky: z1 = e1; z2 = r12 e1 + s2 e2; z3 = r13 e1 + b e2 + c e3. Gecersiz (pozitif tanimli
    // olmayan) korelasyon ucluleri c = 0'a kirpilir.
    const s2 = Math.sqrt(1 - r12 * r12);
    const b = (r23 - r12 * r13) / s2;
    const c = Math.sqrt(Math.max(0, 1 - r13 * r13 - b * b));
    let dd = 0, td = 0;
    for (let k = 0; k < n; k++) {
      const e1 = e[0][k], e2 = e[1][k], e3 = e[2][k];
      let hits = 0;
      if (Math.round(means[0] + stds[0] * e1) >= DOUBLE_THRESHOLD) hits++;
      if (Math.round(means[1] + stds[1] * (r12 * e1 + s2 * e2)) >= DOUBLE_THRESHOLD) hits++;
      if (Math.round(means[2] + stds[2] * (r13 * e1 + b * e2 + c * e3)) >= DOUBLE_THRESHOLD) hits++;
      if (hits >= 2) dd++;
      if (hits === 3) td++;
    }
    out = { dd: dd / n, td: td / n };
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, out);
  return out;
}
