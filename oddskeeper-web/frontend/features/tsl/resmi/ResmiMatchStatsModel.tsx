"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import HistoryDropdown from "@/features/model-history/HistoryDropdown";
import RetentionConfig from "@/features/model-history/RetentionConfig";
import {
  postModelHistory,
  type ModelHistoryDraft,
  type ModelHistoryRecord,
} from "@/lib/model-history";
import ConfigTab from "./matchStatsModel/ConfigTab";
import GSheetTab from "./matchStatsModel/GSheetTab";
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
  fetchTeamLogos,
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
  resolveReferee,
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
import TeamNoteBadge from "./matchStatsModel/TeamNoteBadge";
import type { TeamNote } from "@/lib/team-notes";
import { getTeamLogoPath } from "@/features/player-detail/utils/getTeamLogoPath";

const BIG4 = new Set(["besiktas", "galatasaray", "fenerbahce", "trabzonspor"]);
const TABS = ["model", "config", "fixtures", "input", "gsheet"] as const;

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

// Export gecmisi snapshot'i: bir maci restore etmek icin gereken kullanici
// girdileri. Oran (fixtureInputs'tan) ve sezon agirliklari (config'ten) turev
// oldugu icin saklanmaz; fixture secilince otomatik dolar.
type MsmSnapshot = {
  selectedFixtureId: string;
  market: string;
  selWeek: number;
  lastX: number;
  big4H: boolean;
  redcH: boolean;
  big4A: boolean;
  redcA: boolean;
  etki: number;
  manHome: string;
  manAway: string;
  manTotal: string;
  refereeName: string;
};

const NO_SPINNER =
  "appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const fmt = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");

// Ondalık orandan zımni yüzde (Excel gösterimi): 1.25 → "80%".
const impliedPct = (s: string): string => {
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? `${(100 / n).toFixed(0)}%` : "—";
};

// Ağırlıklandırma: dikey bar grafik (yıl bazında weighted ağırlıklar).
const PIE_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981"];
function WeightBars({ labels, weights }: { labels: string[]; weights: number[] }) {
  const maxW = Math.max(...weights.map((w) => Math.max(0, w)), 0.0001);
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
  return (
    <div className="flex items-stretch justify-between gap-2" style={{ height: 104 }}>
      {labels.map((lbl, i) => {
        const w = Math.max(0, weights[i] ?? 0);
        const hPct = (w / maxW) * 100;
        const pct = total > 0 ? Math.round((100 * w) / total) : 0;
        return (
          <div key={lbl} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-semibold leading-none tabular-nums text-ink">{w}</span>
            <div className="flex w-full flex-1 items-end">
              <div className="w-full rounded-t" style={{ height: `${Math.max(3, hPct)}%`, background: PIE_COLORS[i] }} />
            </div>
            <span className="text-[9px] leading-none text-ink-2">{lbl}</span>
            <span className="text-[9px] leading-none tabular-nums text-ink-3">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// Kompakt HF/HA/AF/AA tablosu (weighted / son-x / calculated). rows: [etiket, ev, dep, kalın].
function MiniHFAA({
  title,
  homeName,
  awayName,
  rows,
}: {
  title: string;
  homeName: string;
  awayName: string;
  rows: Array<readonly [string, number, number, boolean]>;
}) {
  return (
    <div className="min-w-[116px] flex-1">
      <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-3">{title}</div>
      <table className="w-full text-center text-[11px] tabular-nums">
        <thead>
          <tr className="text-ink-3">
            <th className="py-0.5"></th>
            <th className="py-0.5 font-medium">{homeName}</th>
            <th className="py-0.5 font-medium">{awayName}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([lbl, h, a, strong]) => (
            <tr key={lbl} className="border-t border-line/60">
              <td className="py-0.5 text-left font-semibold text-ink">{lbl}</td>
              <td className={`py-0.5 ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>{isFinite(h) ? h.toFixed(2) : "—"}</td>
              <td className={`py-0.5 ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>{isFinite(a) ? a.toFixed(2) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Dişli çark: tıklayınca Config sekmesindeki ilgili bölüme götürür.
function ConfigGear({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="shrink-0 rounded p-0.5 text-ink-3 transition hover:text-accent"
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
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
export default function ResmiMatchStatsModel({
  league: LEAGUE = "tsl",
  isAdmin = false,
  canGSheet = true,
}: {
  league?: string;
  isAdmin?: boolean;
  // GSheet alt sekmesi erişimi (admin access listesindeki "msm-gsheet" izni).
  canGSheet?: boolean;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("model");
  // İzni olmayan kullanıcıya GSheet sekmesi hiç gösterilmez.
  const visibleTabs = canGSheet ? TABS : TABS.filter((tb) => tb !== "gsheet");
  const [configFocus, setConfigFocus] = useState<string | null>(null);
  // Model'deki dişli → Config sekmesine geç + ilgili bölüme kaydır.
  const goConfig = (section: string) => {
    setConfigFocus(section);
    setTab("config");
  };

  // Referans veriler.
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamLogos, setTeamLogos] = useState<Record<string, string> | null>(null); // tff1: slug→url; tsl: null (lokal)
  const [marketCfgs, setMarketCfgs] = useState<Record<string, MarketConfig>>({});
  const [modelCfg, setModelCfg] = useState<ModelConfig | null>(null);
  const [referees, setReferees] = useState<RefereeRow[]>([]);

  // Seçimler / knob'lar.
  const [homeSlug, setHomeSlug] = useState("");
  const [awaySlug, setAwaySlug] = useState("");
  // Takım notları (slug → notlar): 1X2 logolarındaki rozet + hover için.
  const [teamNotes, setTeamNotes] = useState<Record<string, TeamNote[]>>({});
  const [market, setMarket] = useState<string>("Shot");
  const [oddsHome, setOddsHome] = useState("");
  const [oddsDraw, setOddsDraw] = useState("");
  const [oddsAway, setOddsAway] = useState("");
  const [weights, setWeights] = useState<number[]>([0.5, 0.3, 0.2, 0]); // 25-26/24-25/23-24/26-27 (weighted)
  const [etki, setEtki] = useState(0); // W6 etki %: 0..1, son-x-hafta harman ağırlığı
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

  // Export gecmisi: Add to Input aninda mac+market bazinda snapshot toplanir,
  // SADECE export'ta sunucuya yazilir. reloadKey export sonrasi dropdown'i
  // tazeler. windowMode "full" (maxWeek'e uy) veya restore'da "fixed" (snapshot
  // penceresi) olur; restoringRef restore secim degisiminin normal reset'i
  // tetiklemesini engeller.
  const [snapshotByKey, setSnapshotByKey] = useState<Record<string, MsmSnapshot>>({});
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const [windowMode, setWindowMode] = useState<
    { mode: "full" } | { mode: "fixed"; selWeek: number; lastX: number }
  >({ mode: "full" });
  const restoringRef = useRef(false);

  // Config yükleme (mount + Config sekmesinde kaydedince yeniden).
  const loadConfig = useCallback(() => {
    fetchMarketConfigs(LEAGUE).then(setMarketCfgs);
    fetchModelConfig(LEAGUE).then(setModelCfg);
    // Sezon ağırlıkları (25-26/24-25/23-24/26-27) + Etki% varsayılanı Config'ten gelir.
    fetchRawModelConfig(LEAGUE).then((r) => {
      if (r) {
        setWeights([r.weight_s1, r.weight_s2, r.weight_s3, r.weight_s4]);
        setEtki(r.default_etki);
      }
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
  }, [LEAGUE]);

  // Mount: referans veriler.
  useEffect(() => {
    fetchTeams(LEAGUE).then(setTeams);
    fetchTeamLogos(LEAGUE).then(setTeamLogos);
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

  // Takımlar değişince iki takımın notlarını tek istekte çek.
  useEffect(() => {
    if (!homeSlug || !awaySlug) {
      setTeamNotes({});
      return;
    }
    let alive = true;
    const slugs = [homeSlug, awaySlug].join(",");
    fetch(`/api/team-notes?slugs=${encodeURIComponent(slugs)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { bySlug?: Record<string, TeamNote[]> } | null) => {
        if (alive && data?.bySlug) setTeamNotes(data.bySlug);
      })
      .catch(() => {
        if (alive) setTeamNotes({});
      });
    return () => {
      alive = false;
    };
  }, [homeSlug, awaySlug]);

  // Market / fixture / takım değişince elle override'lar sıfırlanır + pencere
  // full'a döner. Geçmişten restore ise (restoringRef) bu tek seferi atla:
  // snapshot değerleri handler'da set edildi, korunmalı.
  useEffect(() => {
    if (restoringRef.current) {
      restoringRef.current = false;
      return;
    }
    setManHome("");
    setManAway("");
    setManTotal("");
    setWindowMode({ mode: "full" });
  }, [market, homeSlug, awaySlug, selectedFixtureId]);

  const marketCfg = marketCfgs[market] ?? null;
  const homeName = teams.find((x) => x.slug === homeSlug)?.name ?? "";
  const awayName = teams.find((x) => x.slug === awaySlug)?.name ?? "";
  // Logo: tsl → lokal path; tff1 → slug→url (yoksa null → TeamCrest baş harf).
  const logoFor = (slug: string): string | null =>
    teamLogos ? (teamLogos[slug] ?? null) : getTeamLogoPath(slug);

  // Güncel sezon (26-27) oynanmış maç sayısı = maç-logu max index (iki takım).
  const maxWeek = useMemo(() => {
    const idx = [...(matchLog[homeSlug] ?? []), ...(matchLog[awaySlug] ?? [])].map((r) => r.index);
    return idx.length ? Math.max(...idx) : 0;
  }, [matchLog, homeSlug, awaySlug]);
  // Veri geldiğinde Hafta / Son-x: normalde tüm oynanmış haftalar (full);
  // geçmişten restore'da snapshot penceresi (fixed), maxWeek'e kelepçelenir.
  useEffect(() => {
    if (maxWeek <= 0) return;
    if (windowMode.mode === "fixed") {
      const clamp = (v: number) => Math.min(maxWeek, Math.max(1, v || maxWeek));
      setSelWeek(clamp(windowMode.selWeek));
      setLastX(clamp(windowMode.lastX));
    } else {
      setSelWeek(maxWeek);
      setLastX(maxWeek);
    }
  }, [maxWeek, windowMode]);
  // Hafta girişi oynanmış maks. haftayı aşamaz (12 oynandıysa 13 seçilemez).
  const clampWeek = (raw: string) => {
    const n = parseInt(raw);
    const hi = Math.max(1, maxWeek);
    return isFinite(n) ? Math.min(hi, Math.max(1, n)) : hi;
  };
  const output = useMemo(() => {
    if (!marketCfg || !modelCfg || !homeSlug || !awaySlug) return null;
    // weighted = 4 sezon yıl-ağırlıklı: 3 geçmiş (histdata) + 26-27 sezon-başı-bugüne (tüm oynanmış).
    // 26-27 son-x-hafta penceresi AYRICA "last-x" olarak Etki% (W6) ile harmana girer.
    const seasonsFor = (slug: string, full: HFAA | null): SeasonWeighted[] => {
      const arr = HIST_SEASONS.map((s, i) => {
        const v = hist[slug]?.[s];
        if (!v || weights[i] <= 0) return null;
        return { ...v, weight: weights[i] };
      }).filter(Boolean) as SeasonWeighted[];
      if (full && weights[3] > 0) arr.push({ ...full, weight: weights[3] });
      return arr;
    };

    const num = (s: string): number | null => {
      const n = parseFloat(s);
      return isFinite(n) ? n : null;
    };
    const oH = num(oddsHome);
    const oA = num(oddsAway);
    // Hakem: güncel sezonda X maç varsa güncel, yoksa geçmiş sezon, o da yoksa veri yok.
    const refRow = referees.find((r) => r.referee_name === refereeName);
    const refResolved = resolveReferee(refRow, modelCfg?.refereeMinMatches ?? 5);
    // 26-27 weighted 4. sezon = tüm oynanmış maç ortalaması (sezon-başı-bugüne).
    const homeFull = currentHFAA(matchLog[homeSlug], 99, 99, big4H, redcH);
    const awayFull = currentHFAA(matchLog[awaySlug], 99, 99, big4A, redcA);

    const inputs: ModelInputs = {
      market,
      homeSeasons: seasonsFor(homeSlug, homeFull),
      awaySeasons: seasonsFor(awaySlug, awayFull),
      // Güncel sezon (26-27) son-x-hafta penceresi + Etki% (W6) harmanı.
      homeCurrent: currentHFAA(matchLog[homeSlug], selWeek, lastX, big4H, redcH),
      awayCurrent: currentHFAA(matchLog[awaySlug], selWeek, lastX, big4A, redcA),
      etki,
      // Oran yoksa nötr supremacy (eşit oran → faktör 1).
      homeOdds: oH ?? 2,
      drawOdds: num(oddsDraw) ?? 3.4,
      awayOdds: oA ?? 2,
      manualHome: num(manHome),
      manualAway: num(manAway),
      manualTotal: num(manTotal),
      refereeCardsPg: refResolved?.stat.cards_pg ?? null,
      refereeFoulsPg: refResolved?.stat.fouls_pg ?? null,
    };
    try {
      return runModel(inputs, marketCfg, modelCfg);
    } catch (e) {
      console.error("runModel", e);
      return null;
    }
  }, [
    marketCfg, modelCfg, homeSlug, awaySlug, market, hist, matchLog, selWeek, lastX,
    big4H, redcH, big4A, redcA, weights, etki,
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
    // Restore için snapshot topla (mac+market bazinda). Yalnizca export'ta yazilir.
    const snap: MsmSnapshot = {
      selectedFixtureId, market, selWeek, lastX,
      big4H, redcH, big4A, redcA, etki,
      manHome, manAway, manTotal, refereeName,
    };
    setSnapshotByKey((m) => ({ ...m, [dupKey(externalFixtureId, matchLabel, market)]: snap }));
    await logImport(LEAGUE, {
      fixture_id: externalFixtureId, match: matchLabel, market,
      home_exp: exp?.ft.homeMean ?? null, away_exp: exp?.ft.awayMean ?? null, total_exp: exp?.ft.totalMean ?? null,
      manual_home: num(manHome), manual_away: num(manAway), manual_total: num(manTotal),
      row_count: currentRows.length,
    });
  }

  async function exportXlsx() {
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

    // Export gecmisi: mac+market bazinda tek kayit (snapshot ile). Sadece burada yazilir.
    const seen = new Set<string>();
    const entries: ModelHistoryDraft[] = [];
    for (const r of importList) {
      const k = dupKey(r.fixtureId, r.matchLabel, r.market);
      if (seen.has(k)) continue;
      seen.add(k);
      entries.push({
        kind: "match",
        fixtureExtId: r.fixtureId,
        matchLabel: r.matchLabel,
        market: r.market,
        snapshot: snapshotByKey[k] ?? null,
      });
    }
    if (entries.length > 0) {
      await postModelHistory("football_msm", LEAGUE, entries);
      setHistoryReloadKey((k) => k + 1);
    }
  }

  // Geçmiş dropdown'undan bir kaydı geri yükle. Fixture hâlâ listede olmalı.
  function restoreFromHistory(rec: ModelHistoryRecord) {
    const snap = rec.snapshot as MsmSnapshot | null;
    // Snapshot'taki fixture id (yoksa dış id ile eşleştir) hâlâ fikstürde mi?
    let fid = snap?.selectedFixtureId ?? "";
    if (!fid || !fixtures.some((f) => f.fixtureId === fid)) {
      const byExt = Object.entries(fixtureInputs).find(
        ([, fi]) => fi.externalFixtureId && fi.externalFixtureId === rec.fixtureExtId
      );
      fid = byExt?.[0] ?? "";
    }
    if (!fid || !fixtures.some((f) => f.fixtureId === fid)) {
      setImportNotice(t("modelHistory.fixtureGone"));
      setTimeout(() => setImportNotice(""), 3000);
      return;
    }
    // restoringRef: seçim değişimi effect'inin manuel/pencereyi sıfırlamasını engelle.
    restoringRef.current = true;
    selectFixture(fid);
    if (snap) {
      setMarket(snap.market);
      setManHome(snap.manHome);
      setManAway(snap.manAway);
      setManTotal(snap.manTotal);
      setBig4H(snap.big4H);
      setRedcH(snap.redcH);
      setBig4A(snap.big4A);
      setRedcA(snap.redcA);
      setEtki(snap.etki);
      setRefereeName(snap.refereeName);
      setWindowMode({ mode: "fixed", selWeek: snap.selWeek, lastX: snap.lastX });
    } else {
      setMarket(rec.market);
    }
    setTab("model");
    // Güvenlik ağı: aynı seçim restore edilirse seçim-effect'i hiç tetiklenmez
    // ve ref takılı kalabilir; tick sonunda temizle (effect zaten öne geçer).
    setTimeout(() => {
      restoringRef.current = false;
    }, 0);
    setImportNotice(t("modelHistory.restored"));
    setTimeout(() => setImportNotice(""), 3000);
  }

  // Reset: ilk fikstüre + varsayılan markete dön, ayarları config'ten yeniden yükle.
  function resetModel() {
    setMarket("Shot");
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
        {visibleTabs.map((tb) => (
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
            <HistoryDropdown
              sport="football_msm"
              league={LEAGUE}
              reloadKey={historyReloadKey}
              onRestore={restoreFromHistory}
            />
            <button
              onClick={addCurrentMarket}
              disabled={currentRows.length === 0}
              className="rounded-lg border border-blue-500/50 bg-blue-500/15 px-4 py-1.5 text-[13px] font-semibold text-blue-600 transition hover:bg-blue-500/25 disabled:opacity-40 dark:text-blue-300"
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
        <div className="space-y-4">
          <ConfigTab league={LEAGUE} focus={configFocus} onSaved={loadConfig} />
          <RetentionConfig sport="football_msm" league={LEAGUE} />
        </div>
      ) : tab === "fixtures" ? (
        <FixtureIdTab league={LEAGUE} isAdmin={isAdmin} onSaved={() => fetchFixtureInputs(LEAGUE).then(setFixtureInputs)} />
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
      ) : tab === "gsheet" && canGSheet ? (
        <GSheetTab league={LEAGUE} />
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
              {logoFor(homeSlug) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoFor(homeSlug)!} alt="" referrerPolicy="no-referrer" className="h-72 w-72 max-w-[42%] object-contain opacity-[0.06] dark:opacity-[0.09] sm:h-96 sm:w-96" />
              )}
              {logoFor(awaySlug) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoFor(awaySlug)!} alt="" referrerPolicy="no-referrer" className="h-72 w-72 max-w-[42%] object-contain opacity-[0.06] dark:opacity-[0.09] sm:h-96 sm:w-96" />
              )}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,0.85fr)]">
            {/* ═══ 1. KOLON: seçimler + expectancy + hesaplama + 26/27 penceresi + donut ═══ */}
            <div className="min-w-0 space-y-4">
          {/* Kontroller */}
          <div className="rounded-xl border border-line bg-card p-4">
            {/* Fixture + 1X2 (salt-okunur, hemen yanında; oranlar Fixture sekmesinden girilir) */}
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1 space-y-3">
                <div>
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
                  <label className={`${lblCls} flex items-center gap-1`}>
                    {t("msm.market")}
                    <ConfigGear onClick={() => goConfig("markets")} title={t("msm.cfgMarkets")} />
                  </label>
                  <select className={`${selCls} w-full`} value={market} onChange={(e) => setMarket(e.target.value)}>
                    {MARKETS.map((m) => (
                      <option key={m} value={m} className="bg-field text-ink">{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={lblCls}>1X2</label>
                <div className="flex items-start gap-4 rounded-md border border-line bg-card-2 px-3 py-2">
                  <div className="flex flex-col items-center gap-1">
                    <span className="relative">
                      <TeamCrest logo={logoFor(homeSlug)} name={homeName} size="lg" />
                      <TeamNoteBadge notes={teamNotes[homeSlug] ?? []} />
                    </span>
                    <b className="text-sm tabular-nums text-ink">{oddsHome || "—"}</b>
                    <span className="text-[10px] tabular-nums text-ink-3">{impliedPct(oddsHome)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[13px] font-semibold text-ink-3">X</span>
                    <b className="text-sm tabular-nums text-ink">{oddsDraw || "—"}</b>
                    <span className="text-[10px] tabular-nums text-ink-3">{impliedPct(oddsDraw)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="relative">
                      <TeamCrest logo={logoFor(awaySlug)} name={awayName} size="lg" />
                      <TeamNoteBadge notes={teamNotes[awaySlug] ?? []} />
                    </span>
                    <b className="text-sm tabular-nums text-ink">{oddsAway || "—"}</b>
                    <span className="text-[10px] tabular-nums text-ink-3">{impliedPct(oddsAway)}</span>
                  </div>
                </div>
              </div>
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

            {/* Hakem özeti (sadece Card/Foul): seçilen hakemin istatistikleri + önerilen toplam */}
            {showReferee && (
              <div className="mt-3 rounded-md border border-line bg-card-2 p-2.5">
                <div className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-ink-3">
                  {t("msm.referee")}
                  <ConfigGear onClick={() => goConfig("model")} title={t("msm.refereeWeight")} />
                </div>
                {(() => {
                  const rf = referees.find((r) => r.referee_name === refereeName);
                  if (!rf) return <div className="text-[11px] text-ink-3">{t("msm.refPick")}</div>;
                  const res = resolveReferee(rf, modelCfg?.refereeMinMatches ?? 5);
                  if (!res) return <div className="text-[11px] text-ink-3">{t("msm.refNoData")}</div>;
                  const seasonBadge = res.used === "current" ? t("msm.refSeasonCurrent") : t("msm.refSeasonPrev");
                  return (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                      <span className="rounded bg-veil px-1.5 py-0.5 text-[10px] font-medium text-ink-2">{seasonBadge}</span>
                      <span className="text-ink-2">{t("msm.refPlayed")} <b className="tabular-nums text-ink">{res.stat.apps}</b></span>
                      <span className="text-ink-2">{t("msm.refCards")} <b className="tabular-nums text-ink">{res.stat.cards_pg != null ? res.stat.cards_pg.toFixed(2) : "—"}</b></span>
                      <span className="text-ink-2">{t("msm.refFouls")} <b className="tabular-nums text-ink">{res.stat.fouls_pg != null ? res.stat.fouls_pg.toFixed(2) : "—"}</b></span>
                      {exp?.refereeSuggestedTotal != null && (
                        <span className="ml-auto flex items-center gap-1.5">
                          <span className="text-ink-2">{t("msm.refereeSuggestion")}: <b className="tabular-nums text-ink">{exp.refereeSuggestedTotal.toFixed(2)}</b></span>
                          <button onClick={() => setManTotal(exp.refereeSuggestedTotal!.toFixed(3))}
                            className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-ink hover:opacity-90">{t("msm.apply")}</button>
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Nihai beklenti (expectancy) — büyük */}
          {exp && (
            <div className={`grid gap-2 ${market === "Card" || market === "Corner" ? "grid-cols-4" : "grid-cols-3"}`}>
              {([
                [t("msm.homeExp"), exp.ft.homeMean, exp.h1.homeMean, exp.h2.homeMean],
                [t("msm.awayExp"), exp.ft.awayMean, exp.h1.awayMean, exp.h2.awayMean],
                [t("msm.totalExp"), exp.ft.totalMean, exp.h1.totalMean, exp.h2.totalMean],
                ...((market === "Card" || market === "Corner")
                  ? [[t("msm.supremacy"), exp.ft.homeMean - exp.ft.awayMean, exp.h1.homeMean - exp.h1.awayMean, exp.h2.homeMean - exp.h2.awayMean]] as const
                  : []),
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

            {/* Hesaplama: Weighted (geçmiş) + Son-x (26/27) → Etki% → Calculated (Excel R10/W6) */}
            {exp && (
              <div className="rounded-xl border border-line bg-card p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{t("msm.calcTitle")}</div>
                <div className="flex gap-3 overflow-x-auto">
                  <MiniHFAA
                    title={t("msm.weighted")}
                    homeName={homeName || t("msm.home")}
                    awayName={awayName || t("msm.away")}
                    rows={[
                      ["HF", exp.homeWeighted.hf, exp.awayWeighted.hf, false],
                      ["HA", exp.homeWeighted.ha, exp.awayWeighted.ha, false],
                      ["AF", exp.homeWeighted.af, exp.awayWeighted.af, false],
                      ["AA", exp.homeWeighted.aa, exp.awayWeighted.aa, false],
                    ] as const}
                  />
                  <MiniHFAA
                    title={t("msm.lastXTable")}
                    homeName={homeName || t("msm.home")}
                    awayName={awayName || t("msm.away")}
                    rows={[
                      ["HF", exp.homeLastX?.hf ?? NaN, exp.awayLastX?.hf ?? NaN, false],
                      ["HA", exp.homeLastX?.ha ?? NaN, exp.awayLastX?.ha ?? NaN, false],
                      ["AF", exp.homeLastX?.af ?? NaN, exp.awayLastX?.af ?? NaN, false],
                      ["AA", exp.homeLastX?.aa ?? NaN, exp.awayLastX?.aa ?? NaN, false],
                    ] as const}
                  />
                  <MiniHFAA
                    title={t("msm.calculated")}
                    homeName={homeName || t("msm.home")}
                    awayName={awayName || t("msm.away")}
                    rows={[
                      ["HF", exp.homeStats.hf, exp.awayStats.hf, false],
                      ["HA", exp.homeStats.ha, exp.awayStats.ha, false],
                      ["AF", exp.homeStats.af, exp.awayStats.af, false],
                      ["AA", exp.homeStats.aa, exp.awayStats.aa, false],
                      ["Eq", exp.homeEq, exp.awayEq, false],
                      ["xS", exp.homeXs, exp.awayXs, true],
                    ] as const}
                  />
                </div>
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
                  {/* Etki % (Excel W6): son-x harman ağırlığı. 0 → weighted, 100 → son-x bypass */}
                  <span className="flex items-center gap-1">
                    <label className="text-[10px] uppercase text-ink-3">{t("msm.impact")}</label>
                    <input className={oddCls} type="number" min={0} max={100} step={5}
                      value={Math.round(etki * 100)}
                      onChange={(e) => setEtki(Math.min(1, Math.max(0, (parseInt(e.target.value) || 0) / 100)))} />
                    <span className="text-[10px] text-ink-3">%</span>
                  </span>
                </div>
              </div>
              {/* Yıl dağılımı (dikey barlar) */}
              <div className="border-t border-line/60 pt-3">
                <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-ink-3">
                  {t("msm.cfgWeighting")}
                  <ConfigGear onClick={() => goConfig("weighting")} title={t("msm.cfgWeighting")} />
                </div>
                <WeightBars
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
                      <TeamCrest logo={logoFor(slug)} name={name} size="xs" />
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
