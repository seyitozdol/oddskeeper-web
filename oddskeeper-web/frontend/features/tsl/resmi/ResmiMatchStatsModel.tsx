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
  const [selWeek, setSelWeek] = useState(99); // Hafta seçiniz (99 = en son)
  const [lastX, setLastX] = useState(99); // Son x hafta (99 = hepsi)
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
    fetchTeams(LEAGUE).then((ts) => {
      setTeams(ts);
      if (ts.length >= 2) {
        setHomeSlug((h) => h || ts[0].slug);
        setAwaySlug((a) => a || ts[1].slug);
      }
    });
    fetchReferees(LEAGUE).then(setReferees);
    fetchFixtures(LEAGUE).then(setFixtures);
    fetchFixtureInputs(LEAGUE).then(setFixtureInputs);
    loadConfig();
  }, [loadConfig]);

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
    if (!fid) return;
    const f = fixtures.find((x) => x.fixtureId === fid);
    if (!f) return;
    setHomeSlug(f.homeSlug);
    setAwaySlug(f.awaySlug);
    const fi = fixtureInputs[fid];
    setOddsHome(fi?.homeOdds != null ? String(fi.homeOdds) : "");
    setOddsDraw(fi?.drawOdds != null ? String(fi.drawOdds) : "");
    setOddsAway(fi?.awayOdds != null ? String(fi.awayOdds) : "");
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

  // Reset: seçimleri başa döndür, ayarları config'ten yeniden yükle.
  function resetModel() {
    setSelectedFixtureId("");
    setMarket("SOT");
    setOddsHome("");
    setOddsDraw("");
    setOddsAway("");
    setManHome("");
    setManAway("");
    setManTotal("");
    setRefereeName("");
    if (teams.length >= 2) {
      setHomeSlug(teams[0].slug);
      setAwaySlug(teams[1].slug);
    }
    loadConfig();
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  const selCls =
    "rounded-md border border-line bg-field px-2 py-1.5 text-sm text-ink focus:outline-none focus:border-accent";
  const numCls = `${selCls} ${NO_SPINNER} w-full`;
  const lblCls = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-3";

  return (
    <div className="space-y-4">
      {/* Alt sekmeler */}
      <div className="flex gap-1 border-b border-line">
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
          {/* Kontroller */}
          <div className="rounded-xl border border-line bg-card p-4">
            {/* Fixture seçimi (Fixture ID sekmesinden gelir) + Reset */}
            <div className="mb-3 flex items-end gap-2">
              <div className="flex-1">
                <label className={lblCls}>{t("msm.tab_fixtures")}</label>
                <select className={`${selCls} w-full md:w-1/2`} value={selectedFixtureId} onChange={(e) => selectFixture(e.target.value)}>
                  <option value="" className="bg-field text-ink">— Manuel —</option>
                  {fixtures.map((f) => (
                    <option key={f.fixtureId} value={f.fixtureId} className="bg-field text-ink">
                      R{f.round} · {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={addCurrentMarket}
                disabled={currentRows.length === 0}
                className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
              >
                {t("msm.addToInput")} ({currentRows.length})
              </button>
              {importNotice && <span className="self-center text-[11px] text-neg">{importNotice}</span>}
              <button
                onClick={resetModel}
                className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:text-ink"
              >
                {t("msm.reset")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <label className={lblCls}>{t("msm.home")}</label>
                <select className={`${selCls} w-full`} value={homeSlug} onChange={(e) => setHomeSlug(e.target.value)}>
                  {teams.map((x) => (
                    <option key={x.slug} value={x.slug} className="bg-field text-ink">{x.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lblCls}>{t("msm.away")}</label>
                <select className={`${selCls} w-full`} value={awaySlug} onChange={(e) => setAwaySlug(e.target.value)}>
                  {teams.map((x) => (
                    <option key={x.slug} value={x.slug} className="bg-field text-ink">{x.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lblCls}>{t("msm.market")}</label>
                <select className={`${selCls} w-full`} value={market} onChange={(e) => setMarket(e.target.value)}>
                  {MARKETS.map((m) => (
                    <option key={m} value={m} className="bg-field text-ink">{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lblCls}>{t("msm.oddsHome")}</label>
                <input className={numCls} inputMode="decimal" value={oddsHome} onChange={(e) => setOddsHome(e.target.value)} placeholder="—" />
              </div>
              <div>
                <label className={lblCls}>{t("msm.oddsDraw")}</label>
                <input className={numCls} inputMode="decimal" value={oddsDraw} onChange={(e) => setOddsDraw(e.target.value)} placeholder="—" />
              </div>
              <div>
                <label className={lblCls}>{t("msm.oddsAway")}</label>
                <input className={numCls} inputMode="decimal" value={oddsAway} onChange={(e) => setOddsAway(e.target.value)} placeholder="—" />
              </div>
            </div>

            {/* Hafta/Son-x (26-27 güncel sezon penceresi) + 4 sezon ağırlığı */}
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <label className={lblCls}>{t("msm.selWeek")}</label>
                <input className={numCls} inputMode="numeric" value={selWeek}
                  onChange={(e) => setSelWeek(Math.max(1, parseInt(e.target.value) || 99))} />
              </div>
              <div>
                <label className={lblCls}>{t("msm.lastX")}</label>
                <input className={numCls} inputMode="numeric" value={lastX}
                  onChange={(e) => setLastX(Math.max(1, parseInt(e.target.value) || 99))} />
              </div>
              <div className="md:col-span-2">
                <label className={lblCls}>{t("msm.cfgWeighting")}</label>
                <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-ink-2">
                  {[...HIST_SEASONS, CURRENT_SEASON].map((s, i) => (
                    <span key={s} className={`rounded px-1.5 py-1 tabular-nums ${weights[i] > 0 ? "bg-field" : "bg-field/40 text-ink-3"}`}>
                      {s.replace(/^20(\d\d)-20(\d\d)$/, "$1/$2")}: <b className={weights[i] > 0 ? "text-ink" : "text-ink-3"}>{weights[i]}</b>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Hakem + elle override */}
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {showReferee && (
                <div>
                  <label className={lblCls}>{t("msm.referee")}</label>
                  <select className={`${selCls} w-full`} value={refereeName} onChange={(e) => setRefereeName(e.target.value)}>
                    <option value="" className="bg-field text-ink">—</option>
                    {referees.map((r) => (
                      <option key={r.referee_name} value={r.referee_name} className="bg-field text-ink">{r.referee_name}</option>
                    ))}
                  </select>
                </div>
              )}
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

          {/* Beklenti özeti */}
          {exp && (
            <div className="grid grid-cols-3 gap-3">
              {([
                [t("msm.homeExp"), exp.ft.homeMean, exp.h1.homeMean, exp.h2.homeMean],
                [t("msm.awayExp"), exp.ft.awayMean, exp.h1.awayMean, exp.h2.awayMean],
                [t("msm.totalExp"), exp.ft.totalMean, exp.h1.totalMean, exp.h2.totalMean],
              ] as const).map(([lbl, ft, h1, h2]) => (
                <div key={lbl} className="rounded-lg border border-line bg-card p-3 text-center">
                  <div className="text-[11px] uppercase tracking-wide text-ink-3">{lbl}</div>
                  <div className="mt-1 text-2xl font-semibold text-ink tabular-nums">{fmt(ft as number)}</div>
                  <div className="mt-0.5 text-[11px] text-ink-3 tabular-nums">
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
              <table className="w-full max-w-md text-center text-[12px] tabular-nums">
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
              {exp.refereeSuggestedTotal != null && (
                <div className="mt-2 text-[11px] text-ink-3">
                  {t("msm.refereeSuggestion")}: <b className="text-ink">{exp.refereeSuggestedTotal.toFixed(2)}</b>
                </div>
              )}
            </div>
          )}

          {/* Güncel sezon maç logu (Excel AM-BC) + Big4/RedC istisnaları */}
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { id: "home", name: homeName || t("msm.home"), slug: homeSlug, b4: big4H, setB4: setBig4H, rc: redcH, setRc: setRedcH },
              { id: "away", name: awayName || t("msm.away"), slug: awaySlug, b4: big4A, setB4: setBig4A, rc: redcA, setRc: setRedcA },
            ].map(({ id, name, slug, b4, setB4, rc, setRc }) => {
              const rows = windowRows(matchLog[slug], selWeek, lastX, b4, rc);
              return (
                <div key={id} className="rounded-xl border border-line bg-card p-3">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-xs font-semibold text-ink">{name} · {market}</span>
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

          {/* Segment çizgi tabloları */}
          <div className="space-y-4">
            <SegmentBlock label={t("msm.fullTime")} seg={output?.ft ?? null} homeName={homeName} awayName={awayName} />
            <SegmentBlock label={t("msm.firstHalf")} seg={output?.h1 ?? null} homeName={homeName} awayName={awayName} />
            <SegmentBlock label={t("msm.secondHalf")} seg={output?.h2 ?? null} homeName={homeName} awayName={awayName} />
          </div>

          <p className="text-[11px] text-ink-3">{t("msm.engineNote")}</p>
        </div>
      )}
    </div>
  );
}
