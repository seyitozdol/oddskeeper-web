// Çizgi/oran motoru: normal CDF ile over olasılıkları (deterministik, kesin).
// Her seçim için |p-0.5| en küçük "dengeli çizgi" + etrafında 5 çizgi.
import { normCdf } from './normal';
import type { LineOdds, SelectionLines, SegmentExpectancy, ModelConfig } from './types';

const halfLine = (x: number) => Math.floor(x) + 0.5;

// Segment-bazlı fiyatlama seçenekleri: yarılar kendi payback'i (marj) ve Under
// bayrağıyla fiyatlanabilir (Config Markets sekmesi). Boşsa global davranış.
export interface SegmentPricing {
  margin?: number; // yoksa cfg.margin
  includeUnder?: boolean; // false → SU kontrolü yalnız Over fiyatına bakar
}

// Bir over-olasılık fonksiyonu + merkez tahmininden dengeli çizgi ve 5 çizgi üretir.
function buildSelection(
  overProb: (line: number) => number,
  centerHint: number,
  cfg: ModelConfig,
  pricing?: SegmentPricing
): SelectionLines {
  // Beklenti hesaplanamadıysa (ör. etki>0 ama son-x verisi yok) boş çizgi seti.
  if (!isFinite(centerHint)) return { balancedLine: NaN, lines: [] };
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
  const margin = pricing?.margin ?? cfg.margin;
  const includeUnder = pricing?.includeUnder ?? true;
  const lines: LineOdds[] = [];
  for (let k = -2; k <= 2; k++) {
    const L = balanced + k;
    if (L < 0.5) continue;
    const p = Math.min(0.999999, Math.max(1e-6, overProb(L)));
    const overOdds = margin / p;
    const underOdds = margin / (1 - p);
    // Under açılmayacaksa SU kontrolü yalnızca Over fiyatına bakar.
    const suspended =
      overOdds < cfg.suLow || overOdds > cfg.suHigh ||
      (includeUnder && (underOdds < cfg.suLow || underOdds > cfg.suHigh));
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
export function analyticSegment(
  seg: SegmentExpectancy,
  cfg: ModelConfig,
  pricing?: SegmentPricing
): {
  home: SelectionLines;
  away: SelectionLines;
  total: SelectionLines;
} {
  const totalStd = Math.sqrt(seg.stdHome * seg.stdHome + seg.stdAway * seg.stdAway);
  // P(değer > L) = 1 - Φ((L-mean)/std); yarım çizgide yuvarlama etkisi yok.
  const over = (mean: number, std: number) => (L: number) => 1 - normCdf(L, mean, std);
  return {
    home: buildSelection(over(seg.homeMean, seg.stdHome), seg.homeMean, cfg, pricing),
    away: buildSelection(over(seg.awayMean, seg.stdAway), seg.awayMean, cfg, pricing),
    total: buildSelection(over(seg.totalMean, totalStd), seg.totalMean, cfg, pricing),
  };
}
