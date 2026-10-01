// Oyuncu mac metriklerini secili kapsama (rekabet + sezon) gore toplar.
// Kurallar analytics.tsl_ss_player_detailed_metrics_v1 ile AYNI (ayni katalog,
// ayni toplama): Super Lig tek sezon seciminde sonuc mat'taki degerlerle birebir
// tutar (2026-10-01'de uc sezonda dogrulandi).
//   sum     : toplam; mac basi = toplam / mac; 90 dk = toplam / dakika * 90
//             (per90Eligible ise); ev/deplasman toplami; son 5 = mac ortalamasi.
//             Eksik anahtar 0 sayilir (SofaScore 0 degerleri yazmaz).
//   avg     : degeri olan maclarin ortalamasi (reyting).
//   max     : en yuksek deger (en yuksek hiz).
//   derived : mac / ilk 11 / oran / dakika ortalamasi / isabet yuzdeleri / xG90.

export type PlayerMetricAggKind = "sum" | "avg" | "max" | "derived";

export type PlayerMatchMetricRow = {
  sourceMatchId: string;
  competition: string | null;
  seasonLabel: string | null;
  matchDatetime: string | null;
  isHome: boolean;
  isStart: boolean;
  minutes: number;
  metrics: Record<string, number>;
  cardsYellow: number;
  cardsRed: number;
};

export type PlayerMetricCatalogRow = {
  metricKey: string;
  metricLabel: string;
  categoryKey: string;
  categoryLabel: string;
  displayPriority: number;
  aggKind: PlayerMetricAggKind;
  per90Eligible: boolean;
  valueFormat: string; // count | decimal | pct
  isHigherBetter: boolean;
  rankDirection: string | null;
};

export type MetricAggregate = {
  total: number | null;
  perMatch: number | null;
  per90: number | null;
  home: number | null;
  away: number | null;
  last5: number | null;
};

export type ScopeAggregate = {
  matches: number;
  starts: number;
  minutes: number;
  byMetric: Record<string, MetricAggregate>;
};

const EMPTY: MetricAggregate = { total: null, perMatch: null, per90: null, home: null, away: null, last5: null };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);

// Macin bir metrik icin degeri. Kartlar ayri kolonlardan gelir.
function matchValue(row: PlayerMatchMetricRow, c: PlayerMetricCatalogRow): number | null {
  if (c.metricKey === "cards_yellow_total") return row.cardsYellow;
  if (c.metricKey === "cards_red_total") return row.cardsRed;
  const v = row.metrics[c.metricKey];
  if (v === undefined || v === null || Number.isNaN(Number(v))) return c.aggKind === "sum" ? 0 : null;
  return Number(v);
}

function ts(row: PlayerMatchMetricRow): number {
  return row.matchDatetime ? new Date(row.matchDatetime).getTime() : 0;
}

export function aggregateScope(
  rows: PlayerMatchMetricRow[],
  catalog: PlayerMetricCatalogRow[]
): ScopeAggregate {
  const played = rows.filter((r) => r.minutes > 0);
  const matches = played.length;
  const starts = played.filter((r) => r.isStart).length;
  const minutes = sum(played.map((r) => r.minutes));
  const recent = [...played].sort((a, b) => ts(b) - ts(a)).slice(0, 5);
  const byMetric: Record<string, MetricAggregate> = {};

  const total = (key: string) => {
    const c = catalog.find((x) => x.metricKey === key);
    return c ? sum(played.map((r) => matchValue(r, c) ?? 0)) : 0;
  };

  for (const c of catalog) {
    if (!matches) {
      byMetric[c.metricKey] = EMPTY;
      continue;
    }
    if (c.aggKind === "derived") {
      let v: number | null = null;
      if (c.metricKey === "appearances") v = matches;
      else if (c.metricKey === "starts") v = starts;
      else if (c.metricKey === "starter_rate_pct") v = (100 * starts) / matches;
      else if (c.metricKey === "avg_minutes") v = minutes / matches;
      else if (c.metricKey === "shot_accuracy_pct") {
        const sh = total("shots_total");
        v = sh > 0 ? (100 * total("shots_on_target_total")) / sh : null;
      } else if (c.metricKey === "pass_accuracy_pct") {
        const p = total("passes_total");
        v = p > 0 ? (100 * total("accurate_pass_total")) / p : null;
      } else if (c.metricKey === "xg_per90") {
        v = minutes > 0 ? (total("expected_goals_total") / minutes) * 90 : null;
      }
      byMetric[c.metricKey] = { ...EMPTY, total: v, perMatch: v };
      continue;
    }
    const vals = played.map((r) => ({ r, v: matchValue(r, c) }));
    const present = vals.filter((x): x is { r: PlayerMatchMetricRow; v: number } => x.v !== null);
    const last5 = mean(recent.map((r) => matchValue(r, c)).filter((v): v is number => v !== null));
    if (c.aggKind === "sum") {
      const tot = sum(present.map((x) => x.v));
      byMetric[c.metricKey] = {
        total: tot,
        perMatch: tot / matches,
        per90: c.per90Eligible && minutes > 0 ? (tot / minutes) * 90 : null,
        home: sum(present.filter((x) => x.r.isHome).map((x) => x.v)),
        away: sum(present.filter((x) => !x.r.isHome).map((x) => x.v)),
        last5,
      };
    } else {
      const pick = (xs: number[]) => (c.aggKind === "max" ? (xs.length ? Math.max(...xs) : null) : mean(xs));
      const v = pick(present.map((x) => x.v));
      byMetric[c.metricKey] = {
        total: v,
        perMatch: v,
        per90: null,
        home: pick(present.filter((x) => x.r.isHome).map((x) => x.v)),
        away: pick(present.filter((x) => !x.r.isHome).map((x) => x.v)),
        last5,
      };
    }
  }
  return { matches, starts, minutes, byMetric };
}

// Deger bicimi: sayim toplamlari tam sayi; mac basi / 90 dk iki ondalik;
// yuzde bir ondalik + %.
export function formatAggValue(
  value: number | null | undefined,
  valueFormat: string,
  basis: "total" | "rate"
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const fmt = (v: number, d: number) =>
    new Intl.NumberFormat("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  if (valueFormat === "pct") return `${fmt(value, 1)}%`;
  if (valueFormat === "count" && basis === "total") return fmt(value, 0);
  return fmt(value, 2);
}
