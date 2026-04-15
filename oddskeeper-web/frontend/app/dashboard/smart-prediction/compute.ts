import type { Market, StatsCache } from "./queries";

export type PredictionParams = {
  nMatches: number;
  effPct: number;
  manualLevel: 0 | 1 | 2 | 3;
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
  // Tablo 1: Years Weighted (geçmiş sezonlar + güncel sezon, years dist. ağırlıklı)
  table1: { home: TableData; away: TableData; homeEq: number; awayEq: number };
  // Tablo 2: Son N Hafta (sadece cari sezon)
  table2: { home: TableData; away: TableData; homeEq: number; awayEq: number };
  // Tablo 3: Ağırlıklı (Tablo2 × effPct + Tablo1 × (1-effPct)) — asıl beklenti
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

const MKT_REVERSE: Market[] = ["saves", "goalkick"];
const MKT_REF: Market[]     = ["card", "foul"];

// Eq formülleri — çapraz: ev sahibi HF/AF home takımdan, AA/HA away takımdan
function calcHomeEq(homeData: TableData, awayData: TableData): number {
  return (homeData.hf * 0.65) + (homeData.af * 0.05) + (awayData.aa * 0.25) + (awayData.ha * 0.05);
}

function calcAwayEq(homeData: TableData, awayData: TableData): number {
  return (awayData.af * 0.65) + (awayData.hf * 0.05) + (homeData.ha * 0.25) + (homeData.aa * 0.05);
}

function getLevelKatsayi(level: 0 | 1 | 2 | 3, probHome: number, probAway: number) {
  if (level === 0) return { homeLvl: 1, awayLvl: 1 };
  const mid = (probHome + probAway) / 2;
  const div = [0, 8, 5.5, 3][level];
  return {
    homeLvl: (probHome - mid) / div + 1,
    awayLvl: (probAway - mid) / div + 1,
  };
}

function cacheToTable(c: StatsCache | null): TableData | null {
  if (!c || c.hf == null) return null;
  return { hf: c.hf, ha: c.ha!, af: c.af!, aa: c.aa! };
}

// Tablo3: ağırlıklı blend — effPct cari sezonu, (1-effPct) years weighted'ı ağırlıklandırır
function blendTables(t1: TableData, t2: TableData, effPct: number): TableData {
  const w1 = 1 - effPct;
  const w2 = effPct;
  return {
    hf: t1.hf * w1 + t2.hf * w2,
    ha: t1.ha * w1 + t2.ha * w2,
    af: t1.af * w1 + t2.af * w2,
    aa: t1.aa * w1 + t2.aa * w2,
  };
}

export function computePrediction(
  market: Market,
  params: PredictionParams,
  // prevHome/Away = years weighted blend (tüm sezonlar ağırlıklı)
  prevHome: StatsCache | null,
  prevAway: StatsCache | null,
  // currHome/Away = son N hafta (cari sezon)
  currHome: StatsCache | null,
  currAway: StatsCache | null
): PredictionResult | null {

  const t1HomeData = cacheToTable(prevHome);
  const t1AwayData = cacheToTable(prevAway);
  const t2HomeData = cacheToTable(currHome);
  const t2AwayData = cacheToTable(currAway);

  // En az bir tablo olmalı
  if ((!t1HomeData && !t2HomeData) || (!t1AwayData && !t2AwayData)) return null;

  // Fallback: biri yoksa diğerini kullan
  const t1Home = t1HomeData ?? t2HomeData!;
  const t1Away = t1AwayData ?? t2AwayData!;
  const t2Home = t2HomeData ?? t1HomeData!;
  const t2Away = t2AwayData ?? t1AwayData!;

  // Tablo 1: Years Weighted — Eq çapraz
  const t1HomeEq = calcHomeEq(t1Home, t1Away);
  const t1AwayEq = calcAwayEq(t1Home, t1Away);

  // Tablo 2: Son N Hafta — Eq çapraz
  const t2HomeEq = calcHomeEq(t2Home, t2Away);
  const t2AwayEq = calcAwayEq(t2Home, t2Away);

  // Tablo 3: Ağırlıklı = T2 × effPct + T1 × (1-effPct)
  const t3Home = blendTables(t1Home, t2Home, params.effPct);
  const t3Away = blendTables(t1Away, t2Away, params.effPct);
  const t3HomeEq = calcHomeEq(t3Home, t3Away);
  const t3AwayEq = calcAwayEq(t3Home, t3Away);

  const probHome = 1 / params.oddsHome;
  const probAway = 1 / params.oddsAway;
  const level = params.manualLevel;
  const { homeLvl, awayLvl } = getLevelKatsayi(level, probHome, probAway);

  // Tahmin = Tablo3 Eq × level katsayısı
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
