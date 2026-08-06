"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import ConfigTab from "./matchStatsModel/ConfigTab";
import FixtureIdTab from "./matchStatsModel/FixtureIdTab";
import * as XLSX from "xlsx";
import { buildImportRows, type ImportRow } from "./matchStatsModel/exportRows";
import {
  runModel,
  type ModelInputs,
  type SeasonWeighted,
  type SelectionLines,
  type HFAA,
} from "@/features/match-stats-model/engine";
import {
  MARKETS,
  HIST_SEASONS,
  CURRENT_SEASON,
  fetchTeams,
  fetchMarketConfigs,
  fetchModelConfig,
  fetchReferees,
  fetchHistData,
  fetchCurrentStats,
  fetchCurrentMatchLog,
  fetchRawModelConfig,
  fetchRawMarketConfigs,
  fetchTemplates,
  fetchFixtures,
  fetchFixtureInputs,
  logImport,
  type TeamOption,
  type RefereeRow,
  type HistBySlug,
  type CurrentBySlug,
  type RawMarketConfig,
  type FixtureRow,
  type FixtureInput,
  type MatchLogRow,
} from "./matchStatsModel/queries";
import type { MarketConfig, ModelConfig } from "@/features/match-stats-model/engine";
import TeamCrest from "@/features/tsl/shared/TeamCrest";
import { getTeamLogoPath } from "@/features/player-detail/utils/getTeamLogoPath";

const LEAGUE = "tsl";
const BIG4 = new Set(["besiktas", "galatasaray", "fenerbahce", "trabzonspor"]);
const TABS = ["model", "config", "fixtures", "input"] as const;

// Güncel sezon maç logundan HF/HA/AF/AA (Excel U11-14): hafta penceresi + Big4/RedC istisnası.
function currentHFAA(
  log: MatchLogRow[] | undefined,
  week: number,
  lastX: number,
  excludeBig4: boolean,
  excludeRedC: boolean
): { hf: number; ha: number; af: number; aa: number } | null {
  if (!log || log.length === 0) return null;
  let rows = log.filter((r) => r.index <= week);
  if (excludeBig4) rows = rows.filter((r) => !BIG4.has(r.oppSlug));
  if (excludeRedC) rows = rows.filter((r) => r.redCards === 0);
  if (lastX > 0) rows = rows.slice(-lastX);
  if (rows.length === 0) return null;
  const home = rows.filter((r) => r.isHome);
  const away = rows.filter((r) => !r.isHome);
  const avg = (arr: MatchLogRow[], f: (r: MatchLogRow) => number) =>
    arr.length ? arr.reduce((s, r) => s + f(r), 0) / arr.length : NaN;
  const v = {
    hf: avg(home, (r) => r.forVal),
    ha: avg(home, (r) => r.againstVal),
    af: avg(away, (r) => r.forVal),
    aa: avg(away, (r) => r.againstVal),
  };
  // Herhangi biri NaN ise (ör. pencerede ev/dep maçı yok) güncel bileşeni kullanma.
  return [v.hf, v.ha, v.af, v.aa].every(Number.isFinite) ? v : null;
}

// Pencere+istisna uygulanmış maç satırları (AM-BC paneli görüntüsü).
function windowRows(
  log: MatchLogRow[] | undefined,
  week: number,
  lastX: number,
  excludeBig4: boolean,
  excludeRedC: boolean
): MatchLogRow[] {
  if (!log) return [];
  let rows = log.filter((r) => r.index <= week);
  if (excludeBig4) rows = rows.filter((r) => !BIG4.has(r.oppSlug));
  if (excludeRedC) rows = rows.filter((r) => r.redCards === 0);
  return lastX > 0 ? rows.slice(-lastX) : rows;
}
type Tab = (typeof TABS)[number];

const NO_SPINNER =
  "appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const fmt = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");

// Ondalık orandan zımni yüzde (Excel gösterimi): 1.25 → "80%".
const impliedPct = (s: string): string => {
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? `${(100 / n).toFixed(0)}%` : "—";
};

// Ağırlıklandırma donut'u (tek pasta). Etiketler (yıl + %) dilimin üzerinde, küçük font.
const PIE_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981"];
function WeightPie({ labels, weights }: { labels: string[]; weights: number[] }) {
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
  const R = 32, cx = 50, cy = 50, sw = 20;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const segs = weights.map((w, i) => {
    const frac = total > 0 ? Math.max(0, w) / total : 0;
    const start = acc;
    acc += frac;
    return { i, frac, start };
  });
  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 100 100" className="h-32 w-32" role="img" aria-label="weighting">
        {/* dilimler (12 yönünden saat yönünde) */}
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {total > 0 ? (
            segs
              .filter((s) => s.frac > 0)
              .map((s) => (
                <circle
                  key={s.i}
                  cx={cx}
                  cy={cy}
                  r={R}
                  fill="none"
                  stroke={PIE_COLORS[s.i]}
                  strokeWidth={sw}
                  strokeDasharray={`${s.frac * C} ${C - s.frac * C}`}
                  strokeDashoffset={-s.start * C}
                />
              ))
          ) : (
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--color-veil)" strokeWidth={sw} />
          )}
        </g>
        {/* etiketler: yıl + yüzde, dilimin ortasında */}
        {total > 0 &&
          segs
            .filter((s) => s.frac >= 0.08)
            .map((s) => {
              const ang = (s.start + s.frac / 2) * 2 * Math.PI - Math.PI / 2;
              const x = cx + R * Math.cos(ang);
              const y = cy + R * Math.sin(ang);
              return (
                <text key={s.i} x={x} y={y} textAnchor="middle" fill="#fff" fontSize="5.5" fontWeight={700}>
                  <tspan x={x} dy="-0.3em">{labels[s.i]}</tspan>
                  <tspan x={x} dy="1.05em">{Math.round(s.frac * 100)}%</tspan>
                </text>
              );
            })}
      </svg>
    </div>
  );
}

// ─── Line tablosu (bir seçim: Home/Away/Total) ──────────────────────────────
function LineTable({ title, sel }: { title: string; sel: SelectionLines | null }) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-line bg-card-2 p-2">
      <div className="mb-1 text-center text-[11px] font-semibold text-ink-2">{title}</div>
      <table className="w-full text-center text-[11px] tabular-nums">
        <thead>
          <tr className="text-ink-3">
            <th className="py-0.5 font-medium">{t("msm.line")}</th>
            <th className="py-0.5 font-medium">{t("msm.over")}</th>
            <th className="py-0.5 font-medium">{t("msm.under")}</th>
          </tr>
        </thead>
        <tbody>
          {(sel?.lines ?? []).map((ln) => {
            const isBal = ln.line === sel?.balancedLine;
            return (
              <tr
                key={ln.line}
                className={isBal ? "bg-veil font-semibold text-ink" : "text-ink-2"}
              >
                <td className="py-0.5">{ln.line}</td>
                <td className={`py-0.5 ${ln.suspended ? "text-neg" : ""}`}>{fmt(ln.overOdds)}</td>
                <td className={`py-0.5 ${ln.suspended ? "text-neg" : ""}`}>{fmt(ln.underOdds)}</td>
              </tr>
            );
          })}
          {!sel && (
            <tr>
              <td colSpan={3} className="py-2 text-ink-3">
                —
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SegmentBlock({
  label,
  seg,
  homeName,
  awayName,
}: {
  label: string;
  seg: { home: SelectionLines; away: SelectionLines; total: SelectionLines } | null;
  homeName: string;
  awayName: string;
}) {
  const { t } = useI18n();
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        <LineTable title={homeName || t("msm.home")} sel={seg?.home ?? null} />
        <LineTable title={awayName || t("msm.away")} sel={seg?.away ?? null} />
        <LineTable title={t("msm.total")} sel={seg?.total ?? null} />
      </div>
    </div>
  );
}

// ─── Ana bileşen ────────────────────────────────────────────────────────────
export default function ResmiMatchStatsModel() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("model");

  // Referans veriler.
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [marketCfgs, setMarketCfgs] = useState<Record<string, MarketConfig>>({});
  const [modelCfg, setModelCfg] = useState<ModelConfig | null>(null);
  const [referees, setReferees] = useState<RefereeRow[]>([]);

  // Seçimler / knob'lar.
  const [homeSlug, setHomeSlug] = useState("");
  const [awaySlug, setAwaySlug] = useState("");
  const [market, setMarket] = useState<string>("SOT");
  const [oddsHome, setOddsHome] = useState("");
  const [oddsDraw, setOddsDraw] = useState("");
  const [oddsAway, setOddsAway] = useState("");
  const [weights, setWeights] = useState<number[]>([0.5, 0.3, 0.2, 0]); // 25-26/24-25/23-24/26-27(güncel)
  const [refereeName, setRefereeName] = useState("");
  const [manHome, setManHome] = useState("");
  const [manAway, setManAway] = useState("");
  const [manTotal, setManTotal] = useState("");

  // Seçilen market+takımlar için veri.
  const [hist, setHist] = useState<HistBySlug>({});
  const [current, setCurrent] = useState<CurrentBySlug>({});

  // Güncel sezon pencereleme (Excel W7/W8) + istisnalar (Big4/RedC) + maç logu.
  const [selWeek, setSelWeek] = useState(0); // Hafta (0 = veri yok; veri gelince maxWeek'e set edilir)
  const [lastX, setLastX] = useState(0); // Son x hafta (varsayılan = oynanmış tüm haftalar)
  const [big4H, setBig4H] = useState(false);
  const [redcH, setRedcH] = useState(false);
  const [big4A, setBig4A] = useState(false);
  const [redcA, setRedcA] = useState(false);
  const [matchLog, setMatchLog] = useState<Record<string, MatchLogRow[]>>({});

  // Fixture ID + export.
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [fixtureInputs, setFixtureInputs] = useState<Record<string, FixtureInput>>({});
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [rawMarketCfgs, setRawMarketCfgs] = useState<Record<string, RawMarketConfig>>({});
  const [templatesByMarket, setTemplatesByMarket] = useState<Record<string, string[]>>({});
  const [importList, setImportList] = useState<ImportRow[]>([]);
  const [importNotice, setImportNotice] = useState("");

  // Config yükleme (mount + Config sekmesinde kaydedince yeniden).
  const loadConfig = useCallback(() => {
    fetchMarketConfigs(LEAGUE).then(setMarketCfgs);
    fetchModelConfig(LEAGUE).then(setModelCfg);
    // Sezon ağırlıkları (4 sezon, 26-27 dahil) Config'ten gelir.
    fetchRawModelConfig(LEAGUE).then((r) => {
      if (r) setWeights([r.weight_s1, r.weight_s2, r.weight_s3, r.weight_s4]);
    });
    // Export için ham market config + template'ler (blok sırasında).
    fetchRawMarketConfigs(LEAGUE).then((rows) => {
      const map: Record<string, RawMarketConfig> = {};
      for (const r of rows) map[r.market] = r;
      setRawMarketCfgs(map);
    });
    fetchTemplates(LEAGUE).then((rows) => {
      const map: Record<string, string[]> = {};
      for (const r of rows) (map[r.market] ??= []).push(r.template_code);
      setTemplatesByMarket(map);
    });
  }, []);

  // Mount: referans veriler.
  useEffect(() => {
    fetchTeams(LEAGUE).then(setTeams);
    fetchReferees(LEAGUE).then(setReferees);
    fetchFixtures(LEAGUE).then(setFixtures);
    fetchFixtureInputs(LEAGUE).then(setFixtureInputs);
    loadConfig();
  }, [loadConfig]);

  // Takımlar SADECE fikstürden gelir: fikstürler yüklenince ilkini otomatik seç.
  useEffect(() => {
    if (!selectedFixtureId && fixtures.length) {
      const f = fixtures[0];
      setSelectedFixtureId(f.fixtureId);
      setHomeSlug(f.homeSlug);
      setAwaySlug(f.awaySlug);
    }
  }, [fixtures, selectedFixtureId]);

  // Seçili fikstürün oranlarını fixture_inputs'tan doldur (geç yüklenmeyi de yakalar).
  useEffect(() => {
    const fi = selectedFixtureId ? fixtureInputs[selectedFixtureId] : undefined;
    setOddsHome(fi?.homeOdds != null ? String(fi.homeOdds) : "");
    setOddsDraw(fi?.drawOdds != null ? String(fi.drawOdds) : "");
    setOddsAway(fi?.awayOdds != null ? String(fi.awayOdds) : "");
  }, [selectedFixtureId, fixtureInputs]);

  // Takım/market değişince hist + current çek.
  useEffect(() => {
    if (!homeSlug || !awaySlug || !market) return;
    const slugs = [homeSlug, awaySlug];
    fetchHistData(LEAGUE, market, slugs).then(setHist);
    fetchCurrentStats(LEAGUE, market, slugs, CURRENT_SEASON).then(setCurrent);
    fetchCurrentMatchLog(LEAGUE, market, slugs, CURRENT_SEASON).then(setMatchLog);
  }, [homeSlug, awaySlug, market]);

  // Market / fixture / takım değişince elle override'lar (home/away/total) sıfırlanır.
  useEffect(() => {
    setManHome("");
    setManAway("");
    setManTotal("");
  }, [market, homeSlug, awaySlug, selectedFixtureId]);

  const marketCfg = marketCfgs[market] ?? null;
  const homeName = teams.find((x) => x.slug === homeSlug)?.name ?? "";
  const awayName = teams.find((x) => x.slug === awaySlug)?.name ?? "";

  // Güncel sezon (26-27) oynanmış maç sayısı = maç-logu max index (iki takım).
  const maxWeek = useMemo(() => {
    const idx = [...(matchLog[homeSlug] ?? []), ...(matchLog[awaySlug] ?? [])].map((r) => r.index);
    return idx.length ? Math.max(...idx) : 0;
  }, [matchLog, homeSlug, awaySlug]);
  // Veri geldiğinde Hafta / Son-x varsayılanı = oynanmış tüm haftalar (99 değil).
  useEffect(() => {
    if (maxWeek > 0) { setSelWeek(maxWeek); setLastX(maxWeek); }
  }, [maxWeek]);
  // Hafta girişi oynanmış maks. haftayı aşamaz (12 oynandıysa 13 seçilemez).
  const clampWeek = (raw: string) => {
    const n = parseInt(raw);
    const hi = Math.max(1, maxWeek);
    return isFinite(n) ? Math.min(hi, Math.max(1, n)) : hi;
  };
  // 26/27 sezonunun harmandaki etki yüzdesi (weight_s4 / toplam ağırlık).
  const etkiPct = (() => {
    const tot = weights.reduce((a, b) => a + Math.max(0, b), 0);
    return tot > 0 ? Math.round((100 * Math.max(0, weights[3])) / tot) : 0;
  })();

  const output = useMemo(() => {
    if (!marketCfg || !modelCfg || !homeSlug || !awaySlug) return null;
    // 4 sezonluk harman: 3 geçmiş (histdata) + 26-27 güncel (maç-logu penceresinden).
    // Bir sezon verisi yoksa veya ağırlığı 0 ise harmana katılmaz.
    const seasonsFor = (slug: string, current: HFAA | null): SeasonWeighted[] => {
      const arr = HIST_SEASONS.map((s, i) => {
        const v = hist[slug]?.[s];
        if (!v || weights[i] <= 0) return null;
        return { ...v, weight: weights[i] };
      }).filter(Boolean) as SeasonWeighted[];
      if (current && weights[3] > 0) arr.push({ ...current, weight: weights[3] });
      return arr;
    };

    const num = (s: string): number | null => {
      const n = parseFloat(s);
      return isFinite(n) ? n : null;
    };
    const oH = num(oddsHome);
    const oA = num(oddsAway);
    const ref = referees.find((r) => r.referee_name === refereeName);
    const homeCur = currentHFAA(matchLog[homeSlug], selWeek, lastX, big4H, redcH);
    const awayCur = currentHFAA(matchLog[awaySlug], selWeek, lastX, big4A, redcA);

    const inputs: ModelInputs = {
      market,
      homeSeasons: seasonsFor(homeSlug, homeCur),
      awaySeasons: seasonsFor(awaySlug, awayCur),
      // Oran yoksa nötr supremacy (eşit oran → faktör 1).
      homeOdds: oH ?? 2,
      drawOdds: num(oddsDraw) ?? 3.4,
      awayOdds: oA ?? 2,
      manualHome: num(manHome),
      manualAway: num(manAway),
      manualTotal: num(manTotal),
      refereeCardsPg: ref?.cards_pg ?? null,
      refereeFoulsPg: ref?.fouls_pg ?? null,
    };
    try {
      return runModel(inputs, marketCfg, modelCfg);
    } catch (e) {
      console.error("runModel", e);
      return null;
    }
  }, [
    marketCfg, modelCfg, homeSlug, awaySlug, market, hist, matchLog, selWeek, lastX,
    big4H, redcH, big4A, redcA, weights,
    oddsHome, oddsDraw, oddsAway, manHome, manAway, manTotal, refereeName, referees,
  ]);

  const exp = output?.expectancy;
  const showReferee = marketCfg?.refereeApplies;

  // ─── Fixture seçimi + export ────────────────────────────────────────────────
  function selectFixture(fid: string) {
    setSelectedFixtureId(fid);
    const f = fixtures.find((x) => x.fixtureId === fid);
    if (f) {
      setHomeSlug(f.homeSlug);
      setAwaySlug(f.awaySlug);
    }
    // Oranlar [selectedFixtureId, fixtureInputs] effect'inde doldurulur.
  }

  const externalFixtureId = selectedFixtureId
    ? fixtureInputs[selectedFixtureId]?.externalFixtureId || selectedFixtureId
    : "";
  const matchLabel = `${homeName} - ${awayName}`;

  // Seçili market için export satırları (canlı önizleme).
  const currentRows = useMemo<ImportRow[]>(() => {
    if (!output) return [];
    const rc = rawMarketCfgs[market];
    const tpls = templatesByMarket[market] ?? [];
    if (!rc || tpls.length === 0) return [];
    return buildImportRows(output, { lineCount: rc.line_count, sendHalves: rc.send_halves, midOnly: rc.mid_only }, tpls, externalFixtureId, market, matchLabel);
  }, [output, rawMarketCfgs, templatesByMarket, market, externalFixtureId, matchLabel]);

  const num = (s: string): number | null => {
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  };
  // Aynı maç+market importa daha önce yazıldıysa mükerrer eklemeyi engelle.
  const dupKey = (fixtureId: string, mLabel: string, mkt: string) => `${fixtureId}|${mLabel}|${mkt}`;
  const alreadyIn = (fixtureId: string, mLabel: string, mkt: string) =>
    importList.some((r) => dupKey(r.fixtureId, r.matchLabel, r.market) === dupKey(fixtureId, mLabel, mkt));

  async function addCurrentMarket() {
    if (currentRows.length === 0) return;
    if (alreadyIn(externalFixtureId, matchLabel, market)) {
      setImportNotice(t("msm.alreadyAdded"));
      setTimeout(() => setImportNotice(""), 3000);
      return;
    }
    setImportList((l) => [...l, ...currentRows]);
    await logImport(LEAGUE, {
      fixture_id: externalFixtureId, match: matchLabel, market,
      home_exp: exp?.ft.homeMean ?? null, away_exp: exp?.ft.awayMean ?? null, total_exp: exp?.ft.totalMean ?? null,
      manual_home: num(manHome), manual_away: num(manAway), manual_total: num(manTotal),
      row_count: currentRows.length,
    });
  }

  function exportXlsx() {
    if (importList.length === 0) return;
    // Excel Import formatı: 8 kolon (market YAZILMAZ).
    const data = importList.map((r) => ({
      "Fixture ID": r.fixtureId,
      "Market Template": r.template,
      Line: r.line,
      "Market Status": r.status,
      Selection_1_Name: r.sel1Name,
      Selection_1_Price: Number(r.sel1Price.toFixed(2)),
      Selection_2_Name: r.sel2Name,
      Selection_2_Price: Number(r.sel2Price.toFixed(2)),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Input");
    XLSX.writeFile(wb, `${matchLabel || "input"}.xlsx`);
  }

  // Reset: ilk fikstüre + varsayılan markete dön, ayarları config'ten yeniden yükle.
  function resetModel() {
    setMarket("SOT");
    setManHome("");
    setManAway("");
    setManTotal("");
    setRefereeName("");
    if (fixtures.length) selectFixture(fixtures[0].fixtureId);
    loadConfig();
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  const selCls =
    "rounded-md border border-line bg-field px-2 py-1.5 text-sm text-ink focus:outline-none focus:border-accent";
  const numCls = `${selCls} ${NO_SPINNER} w-full`;
  const oddCls = `rounded border border-line bg-field ${NO_SPINNER} w-14 px-1.5 py-1 text-center text-xs text-ink focus:outline-none focus:border-accent`;
  const lblCls = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-3";

  return (
    <div className="space-y-4">
      {/* Alt sekmeler + (Model'de) Add to Input / Reset sağda */}
      <div className="flex items-center gap-1 border-b border-line">
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`rounded-t-md px-3 py-1.5 text-sm ${
              tab === tb
                ? "bg-veil font-semibold text-ink"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {t(`msm.tab_${tb}`)}
          </button>
        ))}
        {tab === "model" && (
          <div className="ml-auto flex items-center gap-2 pb-1">
            {importNotice && <span className="text-[11px] text-neg">{importNotice}</span>}
            <button
              onClick={addCurrentMarket}
              disabled={currentRows.length === 0}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
            >
              {t("msm.addToInput")} ({currentRows.length})
            </button>
            <button
              onClick={resetModel}
              className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
            >
              {t("msm.reset")}
            </button>
          </div>
        )}
      </div>

      {tab === "config" ? (
        <ConfigTab league={LEAGUE} onSaved={loadConfig} />
      ) : tab === "fixtures" ? (
        <FixtureIdTab league={LEAGUE} onSaved={() => fetchFixtureInputs(LEAGUE).then(setFixtureInputs)} />
      ) : tab === "input" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card p-3 text-sm">
            <span className="text-xs text-ink-3">{importList.length} {t("msm.rows")}</span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={exportXlsx} disabled={importList.length === 0}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50">
                {t("msm.exportXlsx")}
              </button>
              <button onClick={() => setImportList([])} disabled={importList.length === 0}
                className="rounded-md border border-line bg-field px-3 py-1.5 text-xs text-ink-2 hover:bg-veil disabled:opacity-50">
                {t("msm.clear")}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full min-w-[760px] text-left text-[11px] tabular-nums">
              <thead className="bg-card-2 text-[10px] uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-2 py-1.5">Fixture ID</th>
                  <th className="px-2 py-1.5">{t("msm.match")}</th>
                  <th className="px-2 py-1.5">{t("msm.market")}</th>
                  <th className="px-2 py-1.5">Template</th>
                  <th className="px-2 py-1.5">Line</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5">Over</th>
                  <th className="px-2 py-1.5">Under</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {importList.map((r, i) => (
                  <tr key={i} className={`border-t border-line/60 ${r.status === "SU" ? "text-neg" : "text-ink-2"}`}>
                    <td className="px-2 py-1 whitespace-nowrap">{r.fixtureId || "—"}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-ink">{r.matchLabel}</td>
                    <td className="px-2 py-1 text-ink">{r.market}</td>
                    <td className="px-2 py-1">{r.template}</td>
                    <td className="px-2 py-1">{r.line}</td>
                    <td className="px-2 py-1">{r.status}</td>
                    <td className="px-2 py-1">{r.sel1Price.toFixed(2)}</td>
                    <td className="px-2 py-1">{r.sel2Price.toFixed(2)}</td>
                    <td className="px-2 py-1 text-center">
                      {importList.length > 0 && (
                        <button
                          onClick={() => setImportList((l) => l.filter((_, idx) => idx !== i))}
                          className="text-ink-3 hover:text-neg"
                          title={t("msm.clear")}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {importList.length === 0 && (
                  <tr><td colSpan={9} className="px-2 py-6 text-center text-ink-3">—</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab !== "model" ? (
        <div className="rounded-xl border border-line bg-card px-5 py-16 text-center text-sm text-ink-3">
          {t("msm.comingSoon")}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative isolate">
          {/* Arka planda iki takım logosu — ortada, düşük opacity (basketbol filigranı) */}
          {homeSlug && awaySlug && homeSlug !== awaySlug && (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex items-start justify-center gap-12 sm:gap-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getTeamLogoPath(homeSlug)} alt="" className="h-72 w-72 max-w-[42%] object-contain opacity-[0.06] dark:opacity-[0.09] sm:h-96 sm:w-96" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getTeamLogoPath(awaySlug)} alt="" className="h-72 w-72 max-w-[42%] object-contain opacity-[0.06] dark:opacity-[0.09] sm:h-96 sm:w-96" />
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,0.85fr)]">
            {/* ═══ 1. KOLON: seçimler + expectancy + hesaplama + 26/27 penceresi + donut ═══ */}
            <div className="min-w-0 space-y-4">
          {/* Kontroller */}
          <div className="rounded-xl border border-line bg-card p-4">
            {/* Fixture + 1X2 (salt-okunur, hemen yanında; oranlar Fixture sekmesinden girilir) */}
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1">
                <label className={lblCls}>{t("msm.tab_fixtures")}</label>
                <select className={`${selCls} w-full`} value={selectedFixtureId} onChange={(e) => selectFixture(e.target.value)}>
                  {fixtures.map((f) => (
                    <option key={f.fixtureId} value={f.fixtureId} className="bg-field text-ink">
                      R{f.round} · {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lblCls}>1X2</label>
                <div className="flex items-center gap-x-3 rounded-md border border-line bg-card-2 px-2.5 py-[7px]">
                  <span className="flex items-center gap-1">
                    <TeamCrest logo={getTeamLogoPath(homeSlug)} name={homeName} size="xs" />
                    <b className="text-xs tabular-nums text-ink">{oddsHome || "—"}</b>
                    <span className="text-[10px] tabular-nums text-ink-3">{impliedPct(oddsHome)}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-veil text-[8px] font-semibold text-ink-3">X</span>
                    <b className="text-xs tabular-nums text-ink">{oddsDraw || "—"}</b>
                    <span className="text-[10px] tabular-nums text-ink-3">{impliedPct(oddsDraw)}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <TeamCrest logo={getTeamLogoPath(awaySlug)} name={awayName} size="xs" />
                    <b className="text-xs tabular-nums text-ink">{oddsAway || "—"}</b>
                    <span className="text-[10px] tabular-nums text-ink-3">{impliedPct(oddsAway)}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Market */}
            <div className="mt-3">
              <label className={lblCls}>{t("msm.market")}</label>
              <select className={`${selCls} w-full sm:w-40`} value={market} onChange={(e) => setMarket(e.target.value)}>
                {MARKETS.map((m) => (
                  <option key={m} value={m} className="bg-field text-ink">{m}</option>
                ))}
              </select>
            </div>

            {/* Hakem seçimi (sadece Card/Foul marketlerinde) */}
            {showReferee && (
              <div className="mt-3">
                <label className={lblCls}>{t("msm.referee")}</label>
                <select className={`${selCls} w-full`} value={refereeName} onChange={(e) => setRefereeName(e.target.value)}>
                  <option value="" className="bg-field text-ink">—</option>
                  {referees.map((r) => (
                    <option key={r.referee_name} value={r.referee_name} className="bg-field text-ink">{r.referee_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Elle override (home/away/total) */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <label className={lblCls}>{t("msm.manualHome")}</label>
                <input className={numCls} inputMode="decimal" value={manHome} onChange={(e) => setManHome(e.target.value)} placeholder="—" />
              </div>
              <div>
                <label className={lblCls}>{t("msm.manualAway")}</label>
                <input className={numCls} inputMode="decimal" value={manAway} onChange={(e) => setManAway(e.target.value)} placeholder="—" />
              </div>
              <div>
                <label className={lblCls}>{t("msm.manualTotal")}</label>
                <input className={numCls} inputMode="decimal" value={manTotal} onChange={(e) => setManTotal(e.target.value)} placeholder="—" />
              </div>
            </div>

            {/* Hakem düzeltilmiş toplam önerisi (Excel'de M8'e uygulanır) */}
            {exp?.refereeSuggestedTotal != null && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-card-2 px-3 py-2 text-sm">
                <span className="text-ink-2">
                  {t("msm.refereeSuggestion")}:{" "}
                  <b className="text-ink tabular-nums">{exp.refereeSuggestedTotal.toFixed(2)}</b>
                </span>
                <button
                  onClick={() => setManTotal(exp.refereeSuggestedTotal!.toFixed(3))}
                  className="ml-auto rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink hover:opacity-90"
                >
                  {t("msm.apply")}
                </button>
              </div>
            )}
          </div>

          {/* Nihai beklenti (expectancy) — büyük */}
          {exp && (
            <div className="grid grid-cols-3 gap-2">
              {([
                [t("msm.homeExp"), exp.ft.homeMean, exp.h1.homeMean, exp.h2.homeMean],
                [t("msm.awayExp"), exp.ft.awayMean, exp.h1.awayMean, exp.h2.awayMean],
                [t("msm.totalExp"), exp.ft.totalMean, exp.h1.totalMean, exp.h2.totalMean],
              ] as const).map(([lbl, ft, h1, h2]) => (
                <div key={lbl} className="rounded-xl border border-line bg-card p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-ink-3">{lbl}</div>
                  <div className="mt-1 text-[32px] font-bold leading-none text-ink tabular-nums">{fmt(ft as number)}</div>
                  <div className="mt-1.5 text-[10px] text-ink-3 tabular-nums">
                    1H {fmt(h1 as number)} · 2H {fmt(h2 as number)}
                  </div>
                </div>
              ))}
            </div>
          )}

            {/* Hesaplama (Excel Sim R22 "Calculated x": harman HF/HA/AF/AA → Eq → xS) */}
            {exp && (
              <div className="rounded-xl border border-line bg-card p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{t("msm.calcTitle")}</div>
                <table className="w-full text-center text-[12px] tabular-nums">
                  <thead>
                    <tr className="text-ink-3">
                      <th className="py-1 text-left font-medium"></th>
                      <th className="py-1 font-medium">{homeName || t("msm.home")}</th>
                      <th className="py-1 font-medium">{awayName || t("msm.away")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ["HF", exp.homeStats.hf, exp.awayStats.hf, false],
                      ["HA", exp.homeStats.ha, exp.awayStats.ha, false],
                      ["AF", exp.homeStats.af, exp.awayStats.af, false],
                      ["AA", exp.homeStats.aa, exp.awayStats.aa, false],
                      ["Eq", exp.homeEq, exp.awayEq, false],
                      ["xS", exp.homeXs, exp.awayXs, true],
                    ] as const).map(([lbl, h, a, strong]) => (
                      <tr key={lbl} className="border-t border-line/60">
                        <td className="py-1 text-left font-semibold text-ink">{lbl}</td>
                        <td className={`py-1 ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>{fmt(h as number)}</td>
                        <td className={`py-1 ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>{fmt(a as number)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 26/27 penceresi + yıl dağılımı */}
            <div className="space-y-3 rounded-xl border border-line bg-card p-3">
              {/* 26/27 penceresi (kompakt) + etki % */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-ink-3">{t("msm.currentWindow")}</span>
                  <span className="text-[10px] tabular-nums text-ink-3">{maxWeek > 0 ? maxWeek : "—"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="flex items-center gap-1">
                    <label className="text-[10px] uppercase text-ink-3">{t("msm.selWeek")}</label>
                    <input className={`${oddCls} disabled:opacity-50`} type="number" min={1} max={Math.max(1, maxWeek)}
                      disabled={maxWeek === 0} value={maxWeek === 0 ? "" : selWeek}
                      onChange={(e) => setSelWeek(clampWeek(e.target.value))} />
                  </span>
                  <span className="flex items-center gap-1">
                    <label className="text-[10px] uppercase text-ink-3">{t("msm.lastX")}</label>
                    <input className={`${oddCls} disabled:opacity-50`} type="number" min={1} max={Math.max(1, maxWeek)}
                      disabled={maxWeek === 0} value={maxWeek === 0 ? "" : lastX}
                      onChange={(e) => setLastX(clampWeek(e.target.value))} />
                  </span>
                  <span className="flex items-center gap-1 rounded bg-field px-1.5 py-1 text-[10px] text-ink-2">
                    {t("msm.impact")} <b className="tabular-nums text-ink">{etkiPct}%</b>
                  </span>
                </div>
              </div>
              {/* Yıl dağılımı (donut) */}
              <div className="border-t border-line/60 pt-3">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-3">{t("msm.cfgWeighting")}</div>
                <WeightPie
                  labels={[...HIST_SEASONS, CURRENT_SEASON].map((s) => s.replace(/^20(\d\d)-20(\d\d)$/, "$1/$2"))}
                  weights={weights}
                />
              </div>
            </div>
            </div>

            {/* ═══ SAĞ: odds tabloları (segment çizgileri) ═══ */}
            <div className="min-w-0 space-y-4">
              <SegmentBlock label={t("msm.fullTime")} seg={output?.ft ?? null} homeName={homeName} awayName={awayName} />
              <SegmentBlock label={t("msm.firstHalf")} seg={output?.h1 ?? null} homeName={homeName} awayName={awayName} />
              <SegmentBlock label={t("msm.secondHalf")} seg={output?.h2 ?? null} homeName={homeName} awayName={awayName} />
              <p className="text-[11px] text-ink-3">{t("msm.engineNote")}</p>
            </div>

            {/* ═══ 3. KOLON: güncel sezon maç logu (Excel AM-BC) ═══ */}
            <div className="min-w-0 space-y-3">
            {[
              { id: "home", name: homeName || t("msm.home"), slug: homeSlug, b4: big4H, setB4: setBig4H, rc: redcH, setRc: setRedcH },
              { id: "away", name: awayName || t("msm.away"), slug: awaySlug, b4: big4A, setB4: setBig4A, rc: redcA, setRc: setRedcA },
            ].map(({ id, name, slug, b4, setB4, rc, setRc }) => {
              const rows = windowRows(matchLog[slug], selWeek, lastX, b4, rc);
              return (
                <div key={id} className="min-w-0 rounded-xl border border-line bg-card p-3">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                      <TeamCrest logo={getTeamLogoPath(slug)} name={name} size="xs" />
                      {name} · {market}
                    </span>
                    <label className="ml-auto flex items-center gap-1 text-[11px] text-ink-2">
                      <input type="checkbox" checked={b4} onChange={(e) => setB4(e.target.checked)} className="h-3 w-3 accent-[var(--color-accent)]" />
                      {t("msm.big4")}
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-ink-2">
                      <input type="checkbox" checked={rc} onChange={(e) => setRc(e.target.checked)} className="h-3 w-3 accent-[var(--color-accent)]" />
                      {t("msm.redc")}
                    </label>
                  </div>
                  {rows.length === 0 ? (
                    <div className="py-4 text-center text-[11px] text-ink-3">{t("msm.noCurrent")}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-center text-[11px] tabular-nums">
                        <thead>
                          <tr className="text-ink-3">
                            <th className="py-0.5">{t("msm.selWeek")}</th>
                            <th>H/A</th>
                            <th className="text-left">{t("msm.away")}</th>
                            <th>For</th>
                            <th>Ag</th>
                            <th>RC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={i} className="border-t border-line/60 text-ink-2">
                              <td className="py-0.5">{r.index}</td>
                              <td>{r.isHome ? "H" : "A"}</td>
                              <td className="text-left">{r.oppName}</td>
                              <td>{fmt(r.forVal, 0)}</td>
                              <td>{fmt(r.againstVal, 0)}</td>
                              <td>{r.redCards}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
