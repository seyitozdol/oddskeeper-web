// Çizgi/oran motoru: Excel Calcv3'ün iki eşdeğeri.
//  - analytic: normal CDF ile over olasılıkları (deterministik, hızlı).
//  - montecarlo: 4000 (config) örnek NORM.INV çekimi (Excel'e sadık, tohumlu → determinist).
// Her seçim için |p-0.5| en küçük "dengeli çizgi" + etrafında 5 çizgi.
import { normCdf, normInv, mulberry32 } from './normal';
import type { LineOdds, SelectionLines, SegmentExpectancy, ModelConfig } from './types';

const halfLine = (x: number) => Math.floor(x) + 0.5;

// Bir over-olasılık fonksiyonu + merkez tahmininden dengeli çizgi ve 5 çizgi üretir.
function buildSelection(
  overProb: (line: number) => number,
  centerHint: number,
  cfg: ModelConfig
): SelectionLines {
  // Aday yarım-tam çizgiler: merkez ± ~7.
  const start = Math.max(0.5, halfLine(centerHint) - 7);
  const candidates: number[] = [];
  for (let L = start; L <= halfLine(centerHint) + 7; L += 1) candidates.push(L);

  // Dengeli çizgi = |p - 0.5| en küçük.
  let balanced = candidates[0];
  let best = Infinity;
  for (const L of candidates) {
    const d = Math.abs(overProb(L) - 0.5);
    if (d < best) {
      best = d;
      balanced = L;
    }
  }

  // Dengeli etrafında 5 çizgi (mid-2..mid+2), 0.5 altına düşenler elenir.
  const lines: LineOdds[] = [];
  for (let k = -2; k <= 2; k++) {
    const L = balanced + k;
    if (L < 0.5) continue;
    const p = Math.min(0.999999, Math.max(1e-6, overProb(L)));
    const overOdds = cfg.margin / p;
    const underOdds = cfg.margin / (1 - p);
    const suspended =
      overOdds < cfg.suLow || overOdds > cfg.suHigh || underOdds < cfg.suLow || underOdds > cfg.suHigh;
    lines.push({
      line: L,
      overProb: p,
      underProb: 1 - p,
      overOdds,
      underOdds,
      suspended,
    });
  }
  return { balancedLine: balanced, lines };
}

// ---- Analitik motor ----
export function analyticSegment(seg: SegmentExpectancy, cfg: ModelConfig): {
  home: SelectionLines;
  away: SelectionLines;
  total: SelectionLines;
} {
  const totalStd = Math.sqrt(seg.stdHome * seg.stdHome + seg.stdAway * seg.stdAway);
  // P(değer > L) = 1 - Φ((L-mean)/std); yarım çizgide yuvarlama etkisi yok.
  const over = (mean: number, std: number) => (L: number) => 1 - normCdf(L, mean, std);
  return {
    home: buildSelection(over(seg.homeMean, seg.stdHome), seg.homeMean, cfg),
    away: buildSelection(over(seg.awayMean, seg.stdAway), seg.awayMean, cfg),
    total: buildSelection(over(seg.totalMean, totalStd), seg.totalMean, cfg),
  };
}

// ---- Monte-Carlo motor ----
function sampleCounts(mean: number, std: number, n: number, rng: () => number): number[] {
  const arr = new Array<number>(n);
  for (let i = 0; i < n; i++) arr[i] = Math.max(0, Math.round(normInv(rng(), mean, std)));
  return arr;
}
function median(sorted: number[]): number {
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
// Örnek dizisinden over(L)=count(>L)/n; L artınca azalan → sıralı dizide binary search.
function overFromSamples(sortedAsc: number[]): (line: number) => number {
  const n = sortedAsc.length;
  return (L: number) => {
    // ilk index > L
    let lo = 0,
      hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedAsc[mid] > L) hi = mid;
      else lo = mid + 1;
    }
    return (n - lo) / n;
  };
}

export function monteCarloSegment(
  seg: SegmentExpectancy,
  cfg: ModelConfig,
  seed: number
): { home: SelectionLines; away: SelectionLines; total: SelectionLines } {
  const rng = mulberry32(seed);
  const n = cfg.mcSamples;
  const homeArr = sampleCounts(seg.homeMean, seg.stdHome, n, rng);
  const awayArr = sampleCounts(seg.awayMean, seg.stdAway, n, rng);
  const totalArr = new Array<number>(n);
  for (let i = 0; i < n; i++) totalArr[i] = homeArr[i] + awayArr[i];

  const hs = [...homeArr].sort((a, b) => a - b);
  const as = [...awayArr].sort((a, b) => a - b);
  const ts = [...totalArr].sort((a, b) => a - b);

  return {
    home: buildSelection(overFromSamples(hs), median(hs), cfg),
    away: buildSelection(overFromSamples(as), median(as), cfg),
    total: buildSelection(overFromSamples(ts), median(ts), cfg),
  };
}
