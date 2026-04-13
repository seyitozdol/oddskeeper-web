import type { Market, StatsCache } from "./queries";

export type PredictionParams = {
  nMatches: number;
  pastSeasonWeight: number;
  tableWeight: number;
  effPct: number;
  levelEnabled: boolean;
  refEnabled: boolean;
  oddsHome: number;
  oddsAway: number;
  refStats?: {
    cardAvg: number;
    homeCardAvg: number;
    awayCardAvg: number;
    foulAvg: number;
  };
};

export type TableData = {
  hf: number;
  ha: number;
  af: number;
  aa: number;
};

export type PredictionResult = {
  table1: { home: TableData; away: TableData; homeEq: number; awayEq: number };
  table2: { home: TableData; away: TableData; homeEq: number; awayEq: number };
  table3: { home: TableData; away: TableData; homeEq: number; awayEq: number };
  predHome: number;
  predAway: number;
  total: number;
  level: 0 | 1 | 2 | 3;
  homeLvl: number;
  awayLvl: number;
  halfRatio: [number, number];
};

const HALF_RATIOS: Record<Market, [number, number]> = {
  shot:       [0.42, 0.58],
  sot:        [0.42, 0.58],
  corner:     [0.44, 0.56],
  foul:       [0.48, 0.52],
  card:       [0.45, 0.55],
  saves:      [0.42, 0.58],
  tackle:     [0.48, 0.52],
  offside:    [0.46, 0.54],
  possession: [0.50, 0.50],
  throwin:    [0.48, 0.52],
  goalkick:   [0.44, 0.56],
};

const MKT_LEVEL: Market[]  = ["shot", "sot", "saves", "goalkick", "corner"];
const MKT_LVL1: Market[]   = ["foul", "tackle", "card"];
const MKT_REVERSE: Market[] = ["saves", "goalkick"];
const MKT_REF: Market[]    = ["card", "foul"];

function calcEq(d: TableData, eff: number): number {
  const w2 = 1 - eff;
  return (d.hf * eff) + (d.af * 0.05) + (d.aa * (w2 - 0.05)) + (d.ha * 0.05);
}

function calcAwayEq(d: TableData, eff: number): number {
  const w2 = 1 - eff;
  return (d.af * eff) + (d.hf * 0.05) + (d.ha * (w2 - 0.05)) + (d.aa * 0.05);
}

function getLevel(market: Market, probDiff: number, enabled: boolean): 0 | 1 | 2 | 3 {
  if (!enabled) return 0;
  if (MKT_LEVEL.includes(market)) {
    if (probDiff > 4.5) return 3;
    if (probDiff > 1.6) return 2;
    if (probDiff > 0.25) return 1;
    return 0;
  }
  if (MKT_LVL1.includes(market)) return 1;
  return 0;
}

function getLevelKatsayi(
  level: 0 | 1 | 2 | 3,
  probHome: number,
  probAway: number
): { homeLvl: number; awayLvl: number } {
  if (level === 0) return { homeLvl: 1, awayLvl: 1 };
  const mid = (probHome + probAway) / 2;
  const div = [0, 8, 5, 3][level];
  return {
    homeLvl: (probHome - mid) / div + 1,
    awayLvl: (probAway - mid) / div + 1,
  };
}

function blendTableData(
  prev: TableData,
  curr: TableData,
  w: number
): TableData {
  return {
    hf: prev.hf * (1 - w) + curr.hf * w,
    ha: prev.ha * (1 - w) + curr.ha * w,
    af: prev.af * (1 - w) + curr.af * w,
    aa: prev.aa * (1 - w) + curr.aa * w,
  };
}

function cacheToTable(c: StatsCache | null): TableData | null {
  if (!c || c.hf == null) return null;
  return { hf: c.hf, ha: c.ha!, af: c.af!, aa: c.aa! };
}

export function computePrediction(
  market: Market,
  params: PredictionParams,
  prevHome: StatsCache | null,
  prevAway: StatsCache | null,
  currHome: StatsCache | null,
  currAway: StatsCache | null
): PredictionResult | null {
  const ph = cacheToTable(prevHome);
  const pa = cacheToTable(prevAway);
  const ch = cacheToTable(currHome);
  const ca = cacheToTable(currAway);

  if ((!ph && !ch) || (!pa && !ca)) return null;

  // Fallback: curr yoksa prev kullan, prev yoksa curr kullan
  const t1Home: TableData = ph ?? ch!;
  const t1Away: TableData = pa ?? ca!;
  const t2Home: TableData = ch ?? ph!;
  const t2Away: TableData = ca ?? pa!;

  const { effPct, tableWeight: w } = params;

  const t3Home = blendTableData(t1Home, t2Home, w);
  const t3Away = blendTableData(t1Away, t2Away, w);

  const t1HomeEq = calcEq(t1Home, effPct);
  const t1AwayEq = calcAwayEq(t1Away, effPct);
  const t2HomeEq = calcEq(t2Home, effPct);
  const t2AwayEq = calcAwayEq(t2Away, effPct);
  const t3HomeEq = calcEq(t3Home, effPct);
  const t3AwayEq = calcAwayEq(t3Away, effPct);

  const probHome = 1 / params.oddsHome;
  const probAway = 1 / params.oddsAway;
  const probDiff = Math.abs(probHome - probAway);

  const level = getLevel(market, probDiff, params.levelEnabled);
  const { homeLvl, awayLvl } = getLevelKatsayi(level, probHome, probAway);

  const isReverse = MKT_REVERSE.includes(market);
  let predHome = isReverse ? t3HomeEq * (1 / awayLvl) : t3HomeEq * homeLvl;
  let predAway = isReverse ? t3AwayEq * (1 / homeLvl) : t3AwayEq * awayLvl;

  // Hakem etkisi
  if (params.refEnabled && params.refStats && MKT_REF.includes(market)) {
    if (market === "card") {
      predHome = predHome * 0.70 + params.refStats.homeCardAvg * 0.30;
      predAway = predAway * 0.70 + params.refStats.awayCardAvg * 0.30;
    }
    if (market === "foul") {
      predHome = predHome * 0.70 + params.refStats.foulAvg * 0.30 * 0.5;
      predAway = predAway * 0.70 + params.refStats.foulAvg * 0.30 * 0.5;
    }
  }

  return {
    table1: { home: t1Home, away: t1Away, homeEq: t1HomeEq, awayEq: t1AwayEq },
    table2: { home: t2Home, away: t2Away, homeEq: t2HomeEq, awayEq: t2AwayEq },
    table3: { home: t3Home, away: t3Away, homeEq: t3HomeEq, awayEq: t3AwayEq },
    predHome,
    predAway,
    total: predHome + predAway,
    level,
    homeLvl,
    awayLvl,
    halfRatio: HALF_RATIOS[market],
  };
}
