// Basketbol oran motoru — Excel'in Normal(mean,std) Monte-Carlo'sunun analitik eşdeğeri.
// Excel: sims = ROUND(NORM.INV(RAND(), mean, std), 0); Over prob = COUNT(sims>line)/N.
// x.5 line + tamsayı yuvarlama ⇒ P(round(X)>line) = P(X>line) = 1 - Φ((line-mean)/std).
// Bu analitik form örnekleme gürültüsü olmadan birebir aynı sonucu verir.

// Abramowitz-Stegun 7.1.26 erf yaklaşımı (|hata| < 1.5e-7).
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export function normalCdf(x: number, mean: number, std: number): number {
  if (std <= 0) return x < mean ? 1 : 0;
  return 0.5 * (1 + erf((x - mean) / (std * Math.SQRT2)));
}

export type LadderRow = {
  line: number;
  overProb: number;
  overPrice: number;
  underPrice: number;
  isMid: boolean; // mean'e en yakın (|overProb-0.5| minimum) çizgi
};

const PRICE_CAP = 999;

function price(payback: number, prob: number): number {
  if (prob <= 0) return PRICE_CAP;
  return Math.min(PRICE_CAP, Math.round((payback / prob) * 100) / 100);
}

// Excel ladder: start = MAX(0.5, FLOOR(mean-2.5)+0.5), +1 adımla `count` çizgi.
export function buildLadder(
  mean: number,
  std: number,
  payback: number,
  count = 15
): LadderRow[] {
  const start = Math.max(0.5, Math.floor(mean - 2.5) + 0.5);
  const rows: LadderRow[] = [];
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const line = start + i;
    const overProb = 1 - normalCdf(line, mean, std);
    rows.push({
      line,
      overProb,
      overPrice: price(payback, overProb),
      underPrice: price(payback, 1 - overProb),
      isMid: false,
    });
    const dist = Math.abs(overProb - 0.5);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  if (rows[bestIdx]) rows[bestIdx].isMid = true;
  return rows;
}

// Excel handikap/ML/total için: iki takım xG (mean) + std → toplam ve fark dağılımı.
// Toplam ~ Normal(muH+muA, sqrt(sH^2+sA^2)); fark ~ Normal(muH-muA, sqrt(sH^2+sA^2)).
export function matchTotalsLadder(
  muHome: number,
  stdHome: number,
  muAway: number,
  stdAway: number,
  payback: number,
  count = 13
): { total: LadderRow[]; totalMean: number } {
  const totalMean = muHome + muAway;
  const totalStd = Math.sqrt(stdHome * stdHome + stdAway * stdAway);
  const start = Math.round(totalMean) - Math.floor(count / 2) + 0.5;
  const rows: LadderRow[] = [];
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const line = start + i;
    const overProb = 1 - normalCdf(line, totalMean, totalStd);
    rows.push({
      line,
      overProb,
      overPrice: price(payback, overProb),
      underPrice: price(payback, 1 - overProb),
      isMid: false,
    });
    const dist = Math.abs(overProb - 0.5);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  if (rows[bestIdx]) rows[bestIdx].isMid = true;
  return { total: rows, totalMean };
}

// Money line: home kazanma olasılığı = P(fark > 0), fark ~ Normal(muH-muA, totalStd).
export function moneyline(
  muHome: number,
  stdHome: number,
  muAway: number,
  stdAway: number,
  payback: number
): { homeProb: number; homePrice: number; awayPrice: number } {
  const diffMean = muHome - muAway;
  const diffStd = Math.sqrt(stdHome * stdHome + stdAway * stdAway);
  const homeProb = 1 - normalCdf(0, diffMean, diffStd);
  return {
    homeProb,
    homePrice: price(payback, homeProb),
    awayPrice: price(payback, 1 - homeProb),
  };
}
