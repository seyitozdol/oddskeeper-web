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

// ---- Config sekmesi kurallarıyla line üretimi (bb_pm_market_config) ----
export type LineConfig = {
  lines: number;        // toplam çizgi
  under_lines: number;  // alttan kaç çizgide Under açık
  payback: number | null;
  round_odds: boolean;
  max_lines: number;
  odds_cap: number;
  skip_after: number;   // skip'ten önce ardışık çizgi (>=lines => skip yok)
  skip_step: number;    // skip sonrası adım
};

export type ConfiguredLine = {
  line: number;
  overProb: number;
  overPrice: number;
  underPrice: number | null; // null = Under kapalı (Over-only)
  isMid: boolean;
};

// Geometri: ana çizgi (mean'e en yakın x.5) merkezli `skip_after` ardışık çizgi,
// sonra `skip_step` ile YUKARI devam. Örn main=15.5, skip_after=3, step=2 →
// 14.5 15.5 16.5 18.5 20.5 22.5. Under alttan ilk `under_lines` çizgide açık.
export function buildConfiguredLines(
  mean: number, std: number, cfg: LineConfig, defaultPayback: number
): ConfiguredLine[] {
  const payback = cfg.payback ?? defaultPayback;
  const cap = cfg.odds_cap > 0 ? cfg.odds_cap : PRICE_CAP;
  const total = Math.max(1, Math.min(cfg.lines || 1, cfg.max_lines || cfg.lines || 1));
  const main = Math.floor(mean) + 0.5;
  const consecutive = Math.max(1, Math.min(cfg.skip_after || total, total));
  const kBelow = Math.floor((consecutive - 1) / 2);
  const step = cfg.skip_step > 0 ? cfg.skip_step : 1;

  let start = main - kBelow;
  if (start < 0.5) start = 0.5;                       // düşük mean'de negatife inme
  const vals: number[] = [];
  for (let i = 0; i < consecutive; i++) vals.push(start + i);
  const top = vals[vals.length - 1];
  for (let j = 1; vals.length < total; j++) vals.push(top + j * step);

  const priceOf = (prob: number): number => {
    if (prob <= 0) return cap;
    const raw = payback / prob;
    // round_odds kapalı = standart 2 ondalık. Açık: >=2.00 oranları 1 ondalığa yuvarla
    // (2.83→2.8), 2.00 ALTINDA yuvarlama YOK (2 ondalık kalır).
    const r = cfg.round_odds
      ? (raw >= 2 ? Math.round(raw * 10) / 10 : Math.round(raw * 100) / 100)
      : Math.round(raw * 100) / 100;
    return Math.min(cap, r);
  };

  const rows: ConfiguredLine[] = vals.map((line, idx) => {
    const overProb = 1 - normalCdf(line, mean, std);
    return {
      line, overProb,
      overPrice: priceOf(overProb),
      underPrice: idx < cfg.under_lines ? priceOf(1 - overProb) : null,
      isMid: false,
    };
  });
  let bestIdx = 0, bestDist = Infinity;
  rows.forEach((r, i) => { const d = Math.abs(r.line - mean); if (d < bestDist) { bestDist = d; bestIdx = i; } });
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
