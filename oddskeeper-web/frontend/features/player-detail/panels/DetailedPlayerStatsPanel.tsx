"use client";

import Link from "next/link";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Translator } from "@/lib/i18n/messages";
import { categoryLabel, metricLabel } from "@/lib/i18n/metricLabel";
import type {
  PlayerDetailedCategoryKey,
  PlayerDetailedMetricRow,
} from "../types";
import {
  competitionLabel,
  isNationalCompetition,
  orderCompetitions,
  shortSeason,
} from "../competitions";
import {
  EMPTY_SCOPE,
  ScopeFilter,
  matchesScope,
  type ScopeSelection,
} from "../components/ScopeFilter";
import {
  aggregateScope,
  formatAggValue,
  type MetricAggregate,
  type PlayerMatchMetricRow,
  type PlayerMetricCatalogRow,
  type ScopeAggregate,
} from "../utils/aggregateMetrics";

type DetailedPlayerStatsPanelProps = {
  // Lig baglami (lig ortalamasi / sira): tsl_ss mat satirlari, oyuncunun TUM
  // Super Lig sezonlari. Yalniz tek bir Super Lig sezonu seciliyken gosterilir.
  rows?: PlayerDetailedMetricRow[];
  // Oyuncunun oynadigi tum maclar (lig + kupa + milli takim), metrik bazinda.
  matches?: PlayerMatchMetricRow[];
  catalog?: PlayerMetricCatalogRow[];
  playerSlug?: string;
  // Acilis secimi: profilin rekabeti + sezonu (eski davranisla ayni gorunum).
  defaultCompetition?: string | null;
  defaultSeason?: string | null;
};

type CategoryFilter = "all" | PlayerDetailedCategoryKey;
type SummaryTone = "neutral" | "positive" | "negative" | "accent" | "warning";
type CompareMode = "off" | "type" | "competition" | "season";
type Basis = "total" | "perMatch" | "per90";

type SortKey =
  | "total"
  | "perMatch"
  | "per90"
  | "home"
  | "away"
  | "last5"
  | "league_avg"
  | "league_rank"
  | "vs_league_avg_pct";

type SortDirection = "asc" | "desc";

type SortConfig = {
  key: SortKey;
  direction: SortDirection;
} | null;

const LEAGUE_COMPETITION = "Süper Lig";

// SofaScore kataloğu (tsl_ss) yeni kategori uzayını kullanır; eski Opta
// anahtarları (shooting/defence/usage/goalkeeper) geriye dönük uyum için
// listede kalır.
const CATEGORY_ORDER: PlayerDetailedCategoryKey[] = [
  "playing_time",
  "attacking",
  "shooting",
  "creation",
  "passing",
  "duels",
  "possession",
  "defending",
  "defence",
  "discipline",
  "goalkeeping",
  "goalkeeper",
  "physical",
  "overall",
  "usage",
];

// Kategori görünür etiketleri: render sırasında t() ile çözülür (bkz.
// PlayerStatsExplorer.tsx içindeki labelKey deseni).
const CATEGORY_LABEL_KEYS: Record<PlayerDetailedCategoryKey, string> = {
  attacking: "playerDetail.categoryAttacking",
  shooting: "playerDetail.categoryShooting",
  passing: "playerDetail.categoryPassing",
  defence: "playerDetail.categoryDefence",
  discipline: "playerDetail.categoryDiscipline",
  usage: "playerDetail.categoryUsage",
  goalkeeper: "common.goalkeeper",
  playing_time: "playerDetail.categoryPlayingTime",
  creation: "playerDetail.categoryCreation",
  duels: "playerDetail.categoryDuels",
  possession: "playerDetail.categoryPossession",
  defending: "playerDetail.categoryDefence",
  goalkeeping: "common.goalkeeper",
  physical: "playerDetail.categoryPhysical",
  overall: "playerDetail.categoryOverall",
};

function formatRawNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

// Lig baglami kolonlari (mat degerleri) icin eski bicimleyici.
function formatMetricValue(
  value: number | null | undefined,
  valueFormat: string | null | undefined
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  if (valueFormat === "integer") {
    return formatRawNumber(value, 0);
  }

  if (valueFormat === "decimal_1") {
    return formatRawNumber(value, 1);
  }

  if (valueFormat === "decimal_2") {
    return formatRawNumber(value, 2);
  }

  if (valueFormat === "decimal_3") {
    return formatRawNumber(value, 3);
  }

  if (valueFormat === "pct_1") {
    const normalized = Math.abs(value) <= 1 ? value * 100 : value;
    return `${formatRawNumber(normalized, 1)}%`;
  }

  return formatRawNumber(value, 2);
}

function getRankTone(rank: number | null | undefined) {
  if (rank === null || rank === undefined) {
    return "text-ink-2";
  }

  if (rank <= 4) {
    return "text-pos";
  }

  if (rank >= 40) {
    return "text-neg";
  }

  if (rank >= 25) {
    return "text-warn";
  }

  return "text-ink";
}

function getDeltaTone(
  value: number | null | undefined,
  isHigherBetter: boolean | null | undefined
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "text-ink-2";
  }

  const isPositive = value > 0;
  const isGood = isHigherBetter ? isPositive : !isPositive;

  if (value === 0) {
    return "text-ink-2";
  }

  return isGood ? "text-pos" : "text-neg";
}

function formatDirectionBadge(
  t: Translator,
  rankDirection: string | null | undefined,
  isHigherBetter: boolean | null | undefined
) {
  if (!rankDirection) {
    return "—";
  }

  if (isHigherBetter === false || rankDirection === "asc") {
    return t("playerDetail.lowerBetterBadge");
  }

  return t("playerDetail.higherBetterBadge");
}

function getMetricAdvantage(row: PlayerDetailedMetricRow) {
  if (
    row.vs_league_avg_pct === null ||
    row.vs_league_avg_pct === undefined ||
    Number.isNaN(row.vs_league_avg_pct)
  ) {
    return null;
  }

  return row.is_higher_better === false
    ? -row.vs_league_avg_pct
    : row.vs_league_avg_pct;
}

function isMeaningfulSummaryMetric(row: PlayerDetailedMetricRow) {
  if (!row.coverage_flag) return false;
  if (row.league_rank === null || row.league_rank === undefined) return false;

  const blockedKeys = new Set([
    "cards_yellow_total",
    "cards_red_total",
    "fouls_won_total",
    "penalties_saved_total",
  ]);

  if (blockedKeys.has(row.metric_key)) {
    return false;
  }

  return true;
}

function getSummaryToneClasses(tone: SummaryTone) {
  if (tone === "positive") {
    return "border-pos/20 bg-card";
  }

  if (tone === "negative") {
    return "border-neg/20 bg-card";
  }

  if (tone === "accent") {
    return "border-accent/20 bg-card";
  }

  if (tone === "warning") {
    return "border-warn/20 bg-card";
  }

  return "border-line bg-veil";
}

function SummaryCard({
  label,
  value,
  subvalue,
  tone = "neutral",
}: {
  label: string;
  value: string;
  subvalue?: string;
  tone?: SummaryTone;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 ${getSummaryToneClasses(tone)}`}
    >
      <div className="text-[9px] uppercase tracking-[0.16em] text-ink-3">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-semibold leading-5 text-ink">
        {value}
      </div>
      {subvalue ? (
        <div className="mt-1 text-[11px] leading-4 text-ink-2">
          {subvalue}
        </div>
      ) : null}
    </div>
  );
}

function InfoTooltip() {
  const { t } = useI18n();

  return (
    <div className="group relative">
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-line bg-veil text-[11px] text-ink-2 transition hover:border-line-strong hover:text-ink"
      >
        i
      </button>

      <div className="pointer-events-none absolute left-0 top-7 z-20 hidden w-[300px] rounded-xl border border-line bg-card px-3 py-2 text-[11px] leading-5 text-ink-2 shadow-lg group-hover:block">
        {t("playerDetail.detailedStatsInfoTooltip")}
      </div>
    </div>
  );
}

function getDefaultSortDirection(key: SortKey): SortDirection {
  if (key === "league_rank") {
    return "asc";
  }

  return "desc";
}

function compareNullableNumbers(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: SortDirection
) {
  const aNull = a === null || a === undefined || Number.isNaN(a);
  const bNull = b === null || b === undefined || Number.isNaN(b);

  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;

  return direction === "asc" ? a - b : b - a;
}

function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
}) {
  const { t } = useI18n();
  const isActive = sortConfig?.key === sortKey;
  const direction = sortConfig?.direction;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 transition hover:text-ink ${
        isActive ? "text-ink" : "text-ink-3"
      }`}
      title={t("playerDetail.sortByLabel", { label })}
    >
      <span>{label}</span>
      <span className="text-[10px]">
        {isActive ? (direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

const segClass = (active: boolean) =>
  `rounded-md px-2.5 py-1 text-[12px] font-medium transition ${
    active ? "bg-card-2 text-ink" : "text-ink-2 hover:text-ink"
  }`;

// Mac verisi olmayan (yalniz mat satiri olan) oyuncu icin: mat satirlarindan
// katalog + tek kapsam toplami kur; tablo ayni bilesenle cizilir.
function catalogFromRows(rows: PlayerDetailedMetricRow[]): PlayerMetricCatalogRow[] {
  const seen = new Map<string, PlayerMetricCatalogRow>();
  for (const r of rows) {
    if (seen.has(r.metric_key)) continue;
    seen.set(r.metric_key, {
      metricKey: r.metric_key,
      metricLabel: r.metric_label,
      categoryKey: r.category_key,
      categoryLabel: r.category_label,
      displayPriority: r.display_priority ?? 9999,
      aggKind: "sum",
      per90Eligible: r.per90_value !== null,
      valueFormat: String(r.value_format ?? "count"),
      isHigherBetter: r.is_higher_better !== false,
      rankDirection: r.rank_direction ?? null,
    });
  }
  return [...seen.values()];
}

function aggregateFromRows(rows: PlayerDetailedMetricRow[]): ScopeAggregate {
  const byMetric: Record<string, MetricAggregate> = {};
  for (const r of rows) {
    byMetric[r.metric_key] = {
      total: r.total_value,
      perMatch: r.per_match_value,
      per90: r.per90_value,
      home: r.home_value,
      away: r.away_value,
      last5: r.last5_value,
    };
  }
  const apps = rows.find((r) => r.metric_key === "appearances")?.total_value ?? 0;
  const starts = rows.find((r) => r.metric_key === "starts")?.total_value ?? 0;
  const minutes = rows.find((r) => r.metric_key === "total_minutes")?.total_value ?? 0;
  return { matches: apps, starts, minutes, byMetric };
}

type Group = { key: string; label: string; agg: ScopeAggregate };

export default function DetailedPlayerStatsPanel({
  rows = [],
  matches = [],
  catalog = [],
  playerSlug,
  defaultCompetition,
  defaultSeason,
}: DetailedPlayerStatsPanelProps) {
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [compare, setCompare] = useState<CompareMode>("off");
  const [basis, setBasis] = useState<Basis>("per90");

  const hasMatches = matches.length > 0;
  const scopeItems = useMemo(
    () => matches.map((m) => ({ competition: m.competition, season: m.seasonLabel })),
    [matches]
  );

  // Acilis: profilin rekabeti + sezonu (o kapsamda mac varsa); yoksa hepsi.
  const [scope, setScope] = useState<ScopeSelection>(() => {
    if (
      defaultCompetition &&
      defaultSeason &&
      matches.some((m) => m.competition === defaultCompetition && m.seasonLabel === defaultSeason)
    ) {
      return { competitions: [defaultCompetition], seasons: [defaultSeason] };
    }
    return EMPTY_SCOPE;
  });

  const effectiveCatalog = useMemo(
    () => (catalog.length ? catalog : catalogFromRows(rows)),
    [catalog, rows]
  );

  const scoped = useMemo(
    () => matches.filter((m) => matchesScope({ competition: m.competition, season: m.seasonLabel }, scope)),
    [matches, scope]
  );

  // Lig baglami: secim tam olarak TEK bir Super Lig sezonuna denk geliyorsa mat
  // satirlari (lig ortalamasi, sira, fark) tabloya eklenir.
  const leagueSeason = useMemo(() => {
    if (!hasMatches) return rows[0]?.season_label ?? null;
    const comps = new Set(scoped.map((m) => m.competition));
    const seasons = new Set(scoped.map((m) => m.seasonLabel));
    if (comps.size === 1 && comps.has(LEAGUE_COMPETITION) && seasons.size === 1) {
      return [...seasons][0] ?? null;
    }
    return null;
  }, [hasMatches, rows, scoped]);

  const leagueRows = useMemo(
    () =>
      leagueSeason
        ? rows.filter((r) => r.season_label === leagueSeason && (r.competition ?? LEAGUE_COMPETITION) === LEAGUE_COMPETITION)
        : [],
    [rows, leagueSeason]
  );
  const leagueByKey = useMemo(() => {
    const m = new Map<string, PlayerDetailedMetricRow>();
    for (const r of leagueRows) m.set(r.metric_key, r);
    return m;
  }, [leagueRows]);

  // Kiyas gruplari. "off" = tek birlesik grup.
  const groups: Group[] = useMemo(() => {
    if (!hasMatches) {
      const base = leagueRows.length ? leagueRows : rows;
      return base.length ? [{ key: "all", label: "", agg: aggregateFromRows(base) }] : [];
    }
    const make = (key: string, label: string, list: PlayerMatchMetricRow[]): Group => ({
      key,
      label,
      agg: aggregateScope(list, effectiveCatalog),
    });
    if (compare === "type") {
      const club = scoped.filter((m) => !isNationalCompetition(m.competition));
      const natl = scoped.filter((m) => isNationalCompetition(m.competition));
      return [
        make("club", t("playerDetail.scopeClub"), club),
        make("national", t("playerDetail.scopeNational"), natl),
      ].filter((g) => g.agg.matches > 0);
    }
    if (compare === "competition") {
      return orderCompetitions(scoped.map((m) => m.competition ?? "")).map((c) =>
        make(c, competitionLabel(t, c), scoped.filter((m) => m.competition === c))
      );
    }
    if (compare === "season") {
      const seasons = [...new Set(scoped.map((m) => m.seasonLabel ?? ""))].sort((a, b) => b.localeCompare(a));
      return seasons.map((s) => make(s, shortSeason(s), scoped.filter((m) => m.seasonLabel === s)));
    }
    return [make("all", "", scoped)];
  }, [hasMatches, leagueRows, rows, compare, scoped, effectiveCatalog, t]);

  const comparing = hasMatches && compare !== "off";
  const single = groups[0]?.agg ?? null;

  // Sıra hücresi artık metrik sıralama sayfasına gider (drawer kaldırıldı).
  const buildMetricHref = (metricKey: string) => {
    const params = new URLSearchParams();
    if (playerSlug) params.set("player", playerSlug);
    params.set("metric", metricKey);
    return `/dashboard/stats-analysis/football/player-stats/metric?${params.toString()}`;
  };

  // Tabloda gosterilecek metrikler: en az bir grupta degeri olanlar.
  const metricRows = useMemo(() => {
    const list = effectiveCatalog.filter((c) =>
      groups.some((g) => {
        const a = g.agg.byMetric[c.metricKey];
        return a && a.total !== null && a.total !== undefined;
      })
    );
    return list.sort((a, b) => {
      const ca = CATEGORY_ORDER.indexOf(a.categoryKey as PlayerDetailedCategoryKey);
      const cb = CATEGORY_ORDER.indexOf(b.categoryKey as PlayerDetailedCategoryKey);
      if (ca !== cb) return ca - cb;
      return a.displayPriority - b.displayPriority;
    });
  }, [effectiveCatalog, groups]);

  const availableCategories = useMemo(() => {
    const set = new Set(metricRows.map((c) => c.categoryKey as PlayerDetailedCategoryKey));
    return CATEGORY_ORDER.filter((key) => set.has(key));
  }, [metricRows]);

  const visibleRows = useMemo(() => {
    const base =
      activeCategory === "all"
        ? metricRows
        : metricRows.filter((c) => c.categoryKey === activeCategory);
    if (comparing || !sortConfig || !single) return base;
    const valueOf = (c: PlayerMetricCatalogRow): number | null | undefined => {
      const k = sortConfig.key;
      if (k === "league_avg" || k === "league_rank" || k === "vs_league_avg_pct") {
        return leagueByKey.get(c.metricKey)?.[k];
      }
      return single.byMetric[c.metricKey]?.[k];
    };
    return [...base].sort((a, b) =>
      compareNullableNumbers(valueOf(a), valueOf(b), sortConfig.direction)
    );
  }, [metricRows, activeCategory, comparing, sortConfig, single, leagueByKey]);

  const summary = useMemo(() => {
    const src = leagueRows;
    if (src.length === 0) return null;

    const meaningfulRows = src.filter(isMeaningfulSummaryMetric);

    const strongestCandidates = meaningfulRows.filter((row) => {
      const advantage = getMetricAdvantage(row);
      return (
        advantage !== null &&
        advantage > 0 &&
        row.league_rank !== null &&
        row.league_rank <= 8
      );
    });

    const strongestRow = [...strongestCandidates].sort((a, b) => {
      const aRank = a.league_rank ?? 999;
      const bRank = b.league_rank ?? 999;
      if (aRank !== bRank) return aRank - bRank;

      const aAdvantage = getMetricAdvantage(a) ?? -999;
      const bAdvantage = getMetricAdvantage(b) ?? -999;
      return bAdvantage - aAdvantage;
    })[0];

    const weaknessCandidates = meaningfulRows.filter((row) => {
      const advantage = getMetricAdvantage(row);
      return (
        advantage !== null &&
        advantage < 0 &&
        row.league_rank !== null &&
        row.league_rank >= 25
      );
    });

    const weakestRow = [...weaknessCandidates].sort((a, b) => {
      const aAdvantage = getMetricAdvantage(a) ?? 999;
      const bAdvantage = getMetricAdvantage(b) ?? 999;
      if (aAdvantage !== bAdvantage) return aAdvantage - bAdvantage;

      const aRank = a.league_rank ?? -1;
      const bRank = b.league_rank ?? -1;
      return bRank - aRank;
    })[0];

    const biggestPositiveDeltaRow = [...meaningfulRows]
      .filter((row) => {
        const advantage = getMetricAdvantage(row);
        return (
          advantage !== null &&
          advantage > 0 &&
          row.metric_key !== strongestRow?.metric_key
        );
      })
      .sort((a, b) => {
        const aAdvantage = getMetricAdvantage(a) ?? -999;
        const bAdvantage = getMetricAdvantage(b) ?? -999;
        return bAdvantage - aAdvantage;
      })[0];

    const biggestGapRow = [...src]
      .filter(
        (row) =>
          row.home_away_gap_abs !== null && row.home_away_gap_abs !== undefined
      )
      .sort(
        (a, b) => (b.home_away_gap_abs ?? -1) - (a.home_away_gap_abs ?? -1)
      )[0];

    return {
      strongestEdge: strongestRow
        ? t("playerDetail.metricWithRank", {
            metric: metricLabel(t, strongestRow.metric_key, strongestRow.metric_label),
            rank: strongestRow.league_rank ?? "—",
          })
        : t("playerDetail.noClearEdge"),
      strongestEdgeSub: strongestRow
        ? t("playerDetail.categoryVsAvg", {
            category: categoryLabel(t, strongestRow.category_key, strongestRow.category_label),
            value: formatMetricValue(strongestRow.vs_league_avg_pct, "pct_1"),
          })
        : t("playerDetail.noMetricClearedThreshold"),
      strongestEdgeTone: strongestRow
        ? ("positive" as SummaryTone)
        : ("neutral" as SummaryTone),

      mainWeakness: weakestRow
        ? t("playerDetail.metricWithRank", {
            metric: metricLabel(t, weakestRow.metric_key, weakestRow.metric_label),
            rank: weakestRow.league_rank ?? "—",
          })
        : t("playerDetail.noMajorWeakness"),
      mainWeaknessSub: weakestRow
        ? t("playerDetail.categoryVsAvg", {
            category: categoryLabel(t, weakestRow.category_key, weakestRow.category_label),
            value: formatMetricValue(weakestRow.vs_league_avg_pct, "pct_1"),
          })
        : t("playerDetail.noWeaknessCrossedThreshold"),
      mainWeaknessTone: weakestRow
        ? ("negative" as SummaryTone)
        : ("neutral" as SummaryTone),

      biggestPositiveDelta: biggestPositiveDeltaRow
        ? t("playerDetail.metricWithValue", {
            metric: metricLabel(
              t,
              biggestPositiveDeltaRow.metric_key,
              biggestPositiveDeltaRow.metric_label
            ),
            value: formatMetricValue(
              biggestPositiveDeltaRow.vs_league_avg_pct,
              "pct_1"
            ),
          })
        : "—",
      biggestPositiveDeltaSub: biggestPositiveDeltaRow
        ? t("playerDetail.categoryRank", {
            category: categoryLabel(
              t,
              biggestPositiveDeltaRow.category_key,
              biggestPositiveDeltaRow.category_label
            ),
            rank: biggestPositiveDeltaRow.league_rank ?? "—",
          })
        : undefined,
      biggestPositiveDeltaTone: biggestPositiveDeltaRow
        ? ("accent" as SummaryTone)
        : ("neutral" as SummaryTone),

      biggestSplitGap: biggestGapRow
        ? t("playerDetail.metricValue", {
            metric: metricLabel(t, biggestGapRow.metric_key, biggestGapRow.metric_label),
            value: formatMetricValue(
              biggestGapRow.home_away_gap_abs,
              biggestGapRow.value_format
            ),
          })
        : "—",
      biggestSplitGapSub: biggestGapRow
        ? t("playerDetail.homeAwayValues", {
            home: formatMetricValue(
              biggestGapRow.home_value,
              biggestGapRow.value_format
            ),
            away: formatMetricValue(
              biggestGapRow.away_value,
              biggestGapRow.value_format
            ),
          })
        : undefined,
      biggestSplitGapTone: biggestGapRow
        ? ("warning" as SummaryTone)
        : ("neutral" as SummaryTone),
    };
  }, [leagueRows, t]);

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return {
          key,
          direction: getDefaultSortDirection(key),
        };
      }

      return {
        key,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  };

  if (!hasMatches && rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-veil px-4 py-4 text-sm text-ink-2">
        {t("playerDetail.noDetailedStatsData")}
      </div>
    );
  }

  const showCategoryColumn = activeCategory === "all";
  const showLeague = !comparing && leagueRows.length > 0;

  // Kiyas hucresi: secili bazdaki deger. Oran / ortalama / en yuksek metrikler
  // her bazda ayni degeri tasir. 90 dk bazi tanimsiz toplamlarda (dakika, km)
  // bos hucre yerine anlamli olan gosterilir: oynama suresi toplam, digeri mac basi.
  const per90Fallback = (c: PlayerMetricCatalogRow) =>
    c.categoryKey === "playing_time" ? "total" : "perMatch";
  const compareValue = (c: PlayerMetricCatalogRow, a: MetricAggregate | undefined): number | null => {
    if (!a) return null;
    if (c.aggKind !== "sum") return a.total;
    if (basis === "total") return a.total;
    if (basis === "perMatch") return a.perMatch;
    return c.per90Eligible ? a.per90 : a[per90Fallback(c)];
  };
  // Sayim degerleri tam sayi yazilir: toplam bazi + mac / ilk 11 gibi turetilmis sayimlar.
  const rateBasis = (c: PlayerMetricCatalogRow) => {
    if (c.aggKind === "derived") return c.valueFormat === "count" ? "total" : "rate";
    if (c.aggKind !== "sum") return "rate";
    if (basis === "total") return "total";
    return basis === "per90" && !c.per90Eligible && per90Fallback(c) === "total" ? "total" : "rate";
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-veil px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3">
                {t("playerDetail.detailedPlayerStatsHeading")}
              </div>
              <InfoTooltip />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                  activeCategory === "all"
                    ? "border-line-strong bg-card-2 text-ink"
                    : "border-line bg-veil text-ink-2 hover:bg-veil"
                }`}
              >
                {t("common.all")}
              </button>

              {availableCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                    activeCategory === category
                      ? "border-line-strong bg-card-2 text-ink"
                      : "border-line bg-veil text-ink-2 hover:bg-veil"
                  }`}
                >
                  {t(CATEGORY_LABEL_KEYS[category])}
                </button>
              ))}
            </div>
          </div>

          {hasMatches ? (
            <div className="space-y-2 border-t border-line pt-3">
              <ScopeFilter items={scopeItems} value={scope} onChange={setScope} />

              <div className="flex flex-wrap items-center gap-2">
                <span className="w-[86px] shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("playerDetail.compareLabel")}
                </span>
                <div className="inline-flex rounded-lg border border-line bg-card p-0.5">
                  {(
                    [
                      ["off", "playerDetail.compareOff"],
                      ["type", "playerDetail.compareType"],
                      ["competition", "playerDetail.compareCompetition"],
                      ["season", "playerDetail.compareSeason"],
                    ] as [CompareMode, string][]
                  ).map(([mode, key]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCompare(mode)}
                      className={segClass(compare === mode)}
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>

                {comparing ? (
                  <div className="inline-flex rounded-lg border border-line bg-card p-0.5">
                    {(
                      [
                        ["total", "playerDetail.totalColumn"],
                        ["perMatch", "playerDetail.perMatchColumn"],
                        ["per90", "playerDetail.per90Label"],
                      ] as [Basis, string][]
                    ).map(([b, key]) => (
                      <button key={b} type="button" onClick={() => setBasis(b)} className={segClass(basis === b)}>
                        {t(key)}
                      </button>
                    ))}
                  </div>
                ) : single ? (
                  <span className="text-[12px] text-ink-2">
                    {t("playerDetail.scopeSummary", {
                      matches: single.matches,
                      minutes: Math.round(single.minutes),
                    })}
                  </span>
                ) : null}
              </div>

              {!comparing && !showLeague ? (
                <div className="text-[11px] text-ink-3">{t("playerDetail.leagueContextNote")}</div>
              ) : null}
            </div>
          ) : null}

          {summary && !comparing ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label={t("playerDetail.strongestEdgeLabel")}
                value={summary.strongestEdge}
                subvalue={summary.strongestEdgeSub}
                tone={summary.strongestEdgeTone}
              />
              <SummaryCard
                label={t("playerDetail.mainWeaknessLabel")}
                value={summary.mainWeakness}
                subvalue={summary.mainWeaknessSub}
                tone={summary.mainWeaknessTone}
              />
              <SummaryCard
                label={t("playerDetail.biggestPositiveDeltaLabel")}
                value={summary.biggestPositiveDelta}
                subvalue={summary.biggestPositiveDeltaSub}
                tone={summary.biggestPositiveDeltaTone}
              />
              <SummaryCard
                label={t("playerDetail.biggestSplitGapLabel")}
                value={summary.biggestSplitGap}
                subvalue={summary.biggestSplitGapSub}
                tone={summary.biggestSplitGapTone}
              />
            </div>
          ) : null}
        </div>
      </div>

      {groups.length === 0 || visibleRows.length === 0 ? (
        <div className="rounded-xl border border-line bg-veil px-4 py-4 text-sm text-ink-2">
          {t("playerDetail.noMatchesForScope")}
        </div>
      ) : comparing ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-field">
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
                <th className="px-3 py-1.5 font-medium">{t("playerDetail.metricLabel")}</th>
                {showCategoryColumn ? (
                  <th className="px-3 py-1.5 font-medium">{t("playerDetail.categoryColumn")}</th>
                ) : null}
                {groups.map((g) => (
                  <th key={g.key} className="px-3 py-1.5 text-right font-medium">
                    <div className="text-[11px] normal-case tracking-normal text-ink">{g.label}</div>
                    <div className="text-[10px] normal-case tracking-normal text-ink-3">
                      {t("playerDetail.scopeSummary", {
                        matches: g.agg.matches,
                        minutes: Math.round(g.agg.minutes),
                      })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((c) => {
                const values = groups.map((g) => compareValue(c, g.agg.byMetric[c.metricKey]));
                // En iyi deger vurgusu: oran bazlarinda (toplamlar mac sayisina bagli).
                const comparable = !(c.aggKind === "sum" && basis === "total") && c.categoryKey !== "playing_time";
                const nums = values.filter((v): v is number => v !== null);
                const best =
                  comparable && nums.length > 1 && new Set(nums).size > 1
                    ? c.isHigherBetter
                      ? Math.max(...nums)
                      : Math.min(...nums)
                    : null;
                return (
                  <tr
                    key={c.metricKey}
                    className="border-t border-line text-[13px] text-ink transition hover:bg-veil"
                  >
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap text-ink">
                      {metricLabel(t, c.metricKey, c.metricLabel)}
                    </td>
                    {showCategoryColumn ? (
                      <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                        {categoryLabel(t, c.categoryKey, c.categoryLabel)}
                      </td>
                    ) : null}
                    {groups.map((g, i) => (
                      <td
                        key={g.key}
                        className={`px-3 py-1.5 text-right whitespace-nowrap tabular-nums ${
                          best !== null && values[i] === best ? "font-semibold text-pos" : ""
                        }`}
                      >
                        {formatAggValue(values[i], c.valueFormat, rateBasis(c))}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-field">
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
                <th className="px-3 py-1.5 font-medium">{t("playerDetail.metricLabel")}</th>
                {showCategoryColumn ? (
                  <th className="px-3 py-1.5 font-medium">{t("playerDetail.categoryColumn")}</th>
                ) : null}
                <th className="px-3 py-1.5 font-medium">
                  <SortableHeader label={t("playerDetail.totalColumn")} sortKey="total" sortConfig={sortConfig} onSort={handleSort} />
                </th>
                <th className="px-3 py-1.5 font-medium">
                  <SortableHeader label={t("playerDetail.perMatchColumn")} sortKey="perMatch" sortConfig={sortConfig} onSort={handleSort} />
                </th>
                <th className="px-3 py-1.5 font-medium">
                  <SortableHeader label={t("playerDetail.per90Label")} sortKey="per90" sortConfig={sortConfig} onSort={handleSort} />
                </th>
                <th className="px-3 py-1.5 font-medium">
                  <SortableHeader label={t("common.home")} sortKey="home" sortConfig={sortConfig} onSort={handleSort} />
                </th>
                <th className="px-3 py-1.5 font-medium">
                  <SortableHeader label={t("common.away")} sortKey="away" sortConfig={sortConfig} onSort={handleSort} />
                </th>
                <th className="px-3 py-1.5 font-medium">
                  <SortableHeader label={t("playerDetail.last5Column")} sortKey="last5" sortConfig={sortConfig} onSort={handleSort} />
                </th>
                {showLeague ? (
                  <>
                    <th className="px-3 py-1.5 font-medium">
                      <SortableHeader label={t("playerDetail.leagueAvgLabel")} sortKey="league_avg" sortConfig={sortConfig} onSort={handleSort} />
                    </th>
                    <th className="px-3 py-1.5 font-medium">
                      <SortableHeader label={t("playerDetail.rankColumn")} sortKey="league_rank" sortConfig={sortConfig} onSort={handleSort} />
                    </th>
                    <th className="px-3 py-1.5 font-medium">
                      <SortableHeader label={t("playerDetail.vsAvgPctLabel")} sortKey="vs_league_avg_pct" sortConfig={sortConfig} onSort={handleSort} />
                    </th>
                    <th className="px-3 py-1.5 font-medium">{t("playerDetail.directionColumn")}</th>
                  </>
                ) : null}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((c) => {
                const a = single?.byMetric[c.metricKey];
                const lg = leagueByKey.get(c.metricKey);
                return (
                  <tr
                    key={c.metricKey}
                    className="border-t border-line text-[13px] text-ink transition hover:bg-veil"
                  >
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap text-ink">
                      {metricLabel(t, c.metricKey, c.metricLabel)}
                    </td>

                    {showCategoryColumn ? (
                      <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                        {categoryLabel(t, c.categoryKey, c.categoryLabel)}
                      </td>
                    ) : null}

                    <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                      {formatAggValue(a?.total, c.valueFormat, "total")}
                    </td>

                    <td className="px-3 py-1.5 whitespace-nowrap font-medium tabular-nums text-ink">
                      {/* Turetilmis metriklerde (mac, ilk 11, oranlar) mac basi anlamsiz. */}
                      {c.aggKind === "derived" ? "—" : formatAggValue(a?.perMatch, c.valueFormat, "rate")}
                    </td>

                    <td className="px-3 py-1.5 whitespace-nowrap font-medium tabular-nums text-ink">
                      {formatAggValue(a?.per90, c.valueFormat, "rate")}
                    </td>

                    <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                      {formatAggValue(a?.home, c.valueFormat, c.aggKind === "sum" ? "total" : "rate")}
                    </td>

                    <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                      {formatAggValue(a?.away, c.valueFormat, c.aggKind === "sum" ? "total" : "rate")}
                    </td>

                    <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                      {formatAggValue(a?.last5, c.valueFormat, "rate")}
                    </td>

                    {showLeague ? (
                      <>
                        <td className="px-3 py-1.5 whitespace-nowrap tabular-nums text-ink-2">
                          {formatAggValue(lg?.league_avg, c.valueFormat, "rate")}
                        </td>

                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {lg && lg.league_rank !== null && lg.league_rank !== undefined ? (
                            <Link
                              href={buildMetricHref(c.metricKey)}
                              title={t("playerDetail.openMetricLeaderboardTitle")}
                              className={`group inline-flex items-center gap-1 font-semibold transition duration-150 hover:underline cursor-pointer ${getRankTone(
                                lg.league_rank
                              )}`}
                            >
                              <span>{lg.league_rank}</span>
                              <span className="text-[10px] opacity-60 transition group-hover:opacity-100">
                                ↗
                              </span>
                            </Link>
                          ) : (
                            <span className="text-ink-2">—</span>
                          )}
                        </td>

                        <td
                          className={`px-3 py-1.5 whitespace-nowrap font-medium ${getDeltaTone(
                            lg?.vs_league_avg_pct,
                            c.isHigherBetter
                          )}`}
                        >
                          {formatMetricValue(lg?.vs_league_avg_pct, "pct_1")}
                        </td>

                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className="inline-flex rounded-md border border-line bg-veil px-2 py-1 text-[11px] text-ink-2">
                            {formatDirectionBadge(t, c.rankDirection, c.isHigherBetter)}
                          </span>
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
