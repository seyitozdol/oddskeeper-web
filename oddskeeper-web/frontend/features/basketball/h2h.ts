// Basketbol H2H (oyuncu - oyuncu) oran motoru.
//
// Girdi: iki oyuncunun ayni market icin beklentisi (Player Dist'ten Input'a GONDERILEN
// deger) + marketin std'si. Her oyuncunun mac degeri Normal(beklenti, std) cekilir, tam
// sayiya yuvarlanir (istatistik negatif olamaz: 0'in altina inmez). N mac simule edilir;
// bir oyuncunun daha yuksek bitirdigi maclarin orani onun olasiligi, oran = payback / olasilik.
//
// Simulasyon DETERMINISTIK: cekilisler sabit tohumludur, ayni girdi herkeste ve her
// acilista ayni orani verir. Maclarin ikinci yarisi ilk yarinin cekilislerini oyuncular
// arasinda yer degistirerek kullanir: beklentisi ve std'si esit iki oyuncu birebir ayni
// olasiligi alir (ornekleme sansi bir tarafa kaymaz).

import { normalCdf } from "./odds";

export const H2H_METRICS = ["points", "rebounds", "assists"] as const;
export type H2HMetric = (typeof H2H_METRICS)[number];

export type H2HConfig = {
  payback: number;
  // Simule edilen mac sayisi. 0 = ornekleme yok, ayni modelin kesin (sonsuz mac) sonucu.
  sims: number;
  // Beraberlik: false = iki secenek de kaybeder (oran = payback / kazanma olasiligi).
  // true = beraberlikte bahis iade: olasiliklar beraberlik disindaki maclara gore alinir.
  tieVoid: boolean;
};

export const H2H_DEFAULTS: H2HConfig = { payback: 0.915, sims: 1000, tieVoid: false };
export const H2H_MAX_SIMS = 200_000;
const PRICE_CAP = 999;

export type H2HProbs = { pA: number; pB: number; pTie: number };
export type H2HResult = H2HProbs & {
  // null = olasilik 0 (oran verilemez; 0 / sonsuz oran hicbir yere yazilmaz).
  oddsA: number | null;
  oddsB: number | null;
};

// mulberry32: kucuk, hizli, tekrarlanabilir.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sabit tohumlu standart normal cekilisler (Box-Muller). Tum eslesmeler AYNI cekilisleri
// kullanir: beklenti artinca olasilik hic ters yone oynamaz.
const drawCache = new Map<number, { z1: Float64Array; z2: Float64Array }>();
function draws(half: number): { z1: Float64Array; z2: Float64Array } {
  const hit = drawCache.get(half);
  if (hit) return hit;
  const next = rng(20260930);
  const z1 = new Float64Array(half);
  const z2 = new Float64Array(half);
  for (let i = 0; i < half; i++) {
    const u = Math.max(next(), 1e-12);
    const v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    z1[i] = r * Math.cos(2 * Math.PI * v);
    z2[i] = r * Math.sin(2 * Math.PI * v);
  }
  const out = { z1, z2 };
  drawCache.set(half, out);
  return out;
}

const stat = (mean: number, std: number, z: number) => Math.max(0, Math.round(mean + std * z));

// N mac simulasyonu. N tek ise bir fazlasi oynanir (yarilar esit olsun).
export function h2hSimulate(meanA: number, stdA: number, meanB: number, stdB: number, sims: number): H2HProbs {
  const half = Math.ceil(Math.min(Math.max(sims, 2), H2H_MAX_SIMS) / 2);
  const { z1, z2 } = draws(half);
  let winA = 0, winB = 0;
  for (let i = 0; i < half; i++) {
    // ilk yari: A z1, B z2; ikinci yari: cekilisler yer degistirir.
    const a1 = stat(meanA, stdA, z1[i]), b1 = stat(meanB, stdB, z2[i]);
    if (a1 > b1) winA++; else if (b1 > a1) winB++;
    const a2 = stat(meanA, stdA, z2[i]), b2 = stat(meanB, stdB, z1[i]);
    if (a2 > b2) winA++; else if (b2 > a2) winB++;
  }
  const n = half * 2;
  return { pA: winA / n, pB: winB / n, pTie: (n - winA - winB) / n };
}

// Ayni modelin kesin sonucu (sonsuz mac): tam sayi dagilimlarinin karsilastirmasi.
// P(X = 0) = P(N < 0.5); P(X = k) = P(k - 0.5 <= N < k + 0.5), k >= 1.
export function h2hExact(meanA: number, stdA: number, meanB: number, stdB: number): H2HProbs {
  const top = Math.ceil(Math.max(meanA + 8 * stdA, meanB + 8 * stdB, 1)) + 1;
  const cdfA = (k: number) => (k < 0 ? 0 : normalCdf(k + 0.5, meanA, stdA)); // P(A <= k)
  const cdfB = (k: number) => (k < 0 ? 0 : normalCdf(k + 0.5, meanB, stdB));
  let pA = 0, pTie = 0;
  for (let k = 0; k <= top; k++) {
    const massA = cdfA(k) - cdfA(k - 1);
    pA += massA * cdfB(k - 1);
    pTie += massA * (cdfB(k) - cdfB(k - 1));
  }
  return { pA, pB: Math.max(0, 1 - pA - pTie), pTie };
}

function price(payback: number, prob: number): number | null {
  if (!(prob > 0) || !(payback > 0)) return null;
  // Alt sinir 1.01: olasilik payback'i astiginda 1'in altinda oran cikmasin.
  return Math.min(PRICE_CAP, Math.max(1.01, Math.round((payback / prob) * 100) / 100));
}

export function h2hPrice(meanA: number, stdA: number, meanB: number, stdB: number, cfg: H2HConfig): H2HResult {
  const p = cfg.sims > 0 ? h2hSimulate(meanA, stdA, meanB, stdB, cfg.sims) : h2hExact(meanA, stdA, meanB, stdB);
  const decided = p.pA + p.pB;
  const winA = cfg.tieVoid && decided > 0 ? p.pA / decided : p.pA;
  const winB = cfg.tieVoid && decided > 0 ? p.pB / decided : p.pB;
  return { ...p, oddsA: price(cfg.payback, winA), oddsB: price(cfg.payback, winB) };
}
