"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { buildLadder, buildConfiguredLines, moneyline, type LineConfig } from "../odds";
import { PLAYER_MARKETS, TEAM_MARKETS, teamStd, playerStd, metricLabel, isDistributable } from "../marketConfig";
import { formatMatchDate, normalizePositionCode, positionLabel, roleLabelKey, roleBadgeClass, LEADER_METRICS } from "../lib";
import { TeamCrest } from "./ui";
import BasketballPlayerDrawer from "./BasketballPlayerDrawer";
import type { PmFixture, PmMarketConfig, PmModelConfig } from "../pmQueries";
import type {
  BktHomeAwaySplitRow, BktTeamMetricFormRow, BktPlayerWindowRow,
  BktTeamLogRow, BktInputRow, BktPlayerRoleRow,
} from "../types";

type Props = {
  pmFixtures: PmFixture[];
  splits: BktHomeAwaySplitRow[];
  forms: BktTeamMetricFormRow[];
  windows: BktPlayerWindowRow[];
  teamLogs: BktTeamLogRow[];
  playerIds: Record<string, string>;
  config: PmMarketConfig[];
  inputRows: BktInputRow[];
  roles?: BktPlayerRoleRow[];   // BSL oyuncu rol+pozisyon (Player Dist etiketi)
  modelConfig?: PmModelConfig[];   // lider rozet toggle'ları (leader_*)
  competition?: "E" | "U";   // EL/EC ise drawer euro veriye bağlanır
  onAdd: (rows: BktInputRow[]) => void;
};

const PROP_PAYBACK = 0.915;
const TEAM_PAYBACK = 0.96;

// Config satırı yoksa kullanılacak varsayılan line kuralı (mevcut mid±2 davranışı).
const DEFAULT_LINE_CFG: LineConfig = {
  lines: 5, under_lines: 5, payback: null, round_odds: false,
  max_lines: 15, odds_cap: 999, skip_after: 5, skip_step: 2,
};

// Input mükerrer kontrolü: aynı tip+template+katılımcı+taraf+line = aynı satır.
const rowKey = (r: BktInputRow) => `${r.kind}|${r.template}|${r.participant}|${r.side}|${r.line}`;

// Futbol tarzı özet: kaç market gönderildi / atlandı (neden).
function addStatusMsg(t: (k: string) => string, sent: number, dup: number, noTpl: number, zero: number): string {
  if (sent + dup + noTpl + zero === 0) return t("basketball.statNone");
  const parts = [t("basketball.statSent").replace("{n}", String(sent))];
  if (dup) parts.push(t("basketball.statDup").replace("{n}", String(dup)));
  if (noTpl) parts.push(t("basketball.statNoTpl").replace("{n}", String(noTpl)));
  if (zero) parts.push(t("basketball.statZero").replace("{n}", String(zero)));
  return parts.join(" · ");
}

function fmt(v: number | null | undefined, d = 1) {
  if (v == null || Number.isNaN(v)) return "-";
  return Number(v).toFixed(d);
}
function download(name: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
// Klavyeyle silme/yazma için string tampon (boş bırakılabilir; blur'da değere döner).
function NumInput({ value, onChange, step = 0.1, w = "w-16", warn = false }: { value: number; onChange: (v: number) => void; step?: number; w?: string; warn?: boolean }) {
  const [buf, setBuf] = useState<string | null>(null);
  return (
    <input type="number" value={buf ?? String(value)} step={step}
      onChange={(e) => { const s = e.target.value; setBuf(s); const v = parseFloat(s); if (!Number.isNaN(v)) onChange(v); }}
      onBlur={() => setBuf(null)}
      className={`${w} rounded-md border bg-field px-2 py-1 text-right text-[13px] tabular-nums text-ink outline-none focus:border-line-strong ${warn ? "border-amber-500/70" : "border-line"}`} />
  );
}

export default function BasketballTools({ pmFixtures, splits, forms, windows, teamLogs, playerIds, config, inputRows, roles = [], modelConfig = [], competition, onAdd }: Props) {
  const { t, locale } = useI18n();
  // rol+pozisyon aramas: "team_slug:player_slug" → satır (Player Dist etiketi).
  const roleBy = useMemo(() => new Map(roles.map((r) => [`${r.team_slug}:${r.player_slug}`, r])), [roles]);
  const euroTeamSlugs = useMemo(() => new Set(roles.filter((r) => r.euro_team).map((r) => r.team_slug)), [roles]);
  // Takım-lideri rozetleri: "team_slug:player_slug" → [labelKey,...]. leader_* toggle=1 metrikler.
  const leaderBy = useMemo(() => {
    const enabled = new Set(modelConfig.filter((c) => c.key.startsWith("leader_") && Number(c.value) === 1).map((c) => c.key));
    const byTeam = new Map<string, BktPlayerWindowRow[]>();
    for (const w of windows) { if (!byTeam.has(w.team_slug)) byTeam.set(w.team_slug, []); byTeam.get(w.team_slug)!.push(w); }
    const map = new Map<string, string[]>();
    for (const lm of LEADER_METRICS) {
      if (!enabled.has(lm.cfg)) continue;
      for (const [team, rows] of byTeam) {
        let bestSlug: string | null = null, bestVal = 0;
        if (lm.market === "__minutes") {
          const seen = new Map<string, number>();
          for (const w of rows) if (!seen.has(w.player_slug)) seen.set(w.player_slug, (w.avg_minutes ?? 0) * (w.games ?? 0));
          for (const [ps, tot] of seen) if (tot > bestVal) { bestVal = tot; bestSlug = ps; }
        } else {
          for (const w of rows) { if (w.market_key !== lm.market) continue; const v = w.total ?? 0; if (v > bestVal) { bestVal = v; bestSlug = w.player_slug; } }
        }
        if (bestSlug && bestVal > 0) {
          const k = `${team}:${bestSlug}`;
          if (!map.has(k)) map.set(k, []);
          map.get(k)!.push(lm.labelKey);
        }
      }
    }
    return map;
  }, [windows, modelConfig]);
  // Input'ta zaten olan satır anahtarları (mükerrer engelleme) + oyuncu+market seti (uyarı).
  const existingKeys = useMemo(() => new Set(inputRows.map(rowKey)), [inputRows]);
  const existingPlayerMkt = useMemo(() => new Set(inputRows.filter((r) => r.kind === "player").map((r) => `${r.template}|${r.participant}`)), [inputRows]);
  const [totalOverride, setTotalOverride] = useState<Record<string, number>>({});
  const [teamStatus, setTeamStatus] = useState<string>("");
  // market_key → config (oyuncu / takım ayrı). Takım key'i "{side}_{metric}".
  const playerCfg = useMemo(() => new Map(config.filter((c) => c.market_group === "player").map((c) => [c.market_key, c])), [config]);
  const teamCfg = useMemo(() => config.filter((c) => c.market_group === "team"), [config]);
  // Oyuncu market listesi CONFIG'ten (standart 14 + custom). base_metric = veri anahtarı.
  const playerMarkets = useMemo(() => {
    const rows = config.filter((c) => c.market_group === "player");
    if (rows.length === 0) return PLAYER_MARKETS.map((m) => ({ key: m.key, base: m.key, label: m.label, std: m.std, tpl: m.tpl, distributable: m.distributable }));
    return [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((c) => ({
      key: c.market_key, base: c.base_metric ?? c.market_key, label: metricLabel(c.base_metric ?? c.market_key, locale, c.label ?? c.market_key),
      std: (c.std ?? playerStd(c.market_key)) as number, tpl: c.template_id ?? "", distributable: isDistributable(c.base_metric ?? c.market_key),
    }));
  }, [config, locale]);
  const playerMarketBy = useMemo(() => new Map(playerMarkets.map((m) => [m.key, m])), [playerMarkets]);
  const [teamTicks, setTeamTicks] = useState<Record<string, boolean>>({});
  const isTeamTicked = (metricKey: string) => teamTicks[metricKey] !== false; // varsayılan açık
  const teams = useMemo(() => [...splits].sort((a, b) => a.team_name.localeCompare(b.team_name, "tr")), [splits]);
  const splitBy = useMemo(() => new Map(splits.map((s) => [s.team_slug, s])), [splits]);
  const formBy = useMemo(() => {
    const m = new Map<string, Map<string, BktTeamMetricFormRow>>();
    for (const f of forms) { if (!m.has(f.team_slug)) m.set(f.team_slug, new Map()); m.get(f.team_slug)!.set(f.market_key, f); }
    return m;
  }, [forms]);
  const winBy = useMemo(() => {
    const m = new Map<string, Map<string, BktPlayerWindowRow[]>>();
    for (const w of windows) {
      if (!m.has(w.team_slug)) m.set(w.team_slug, new Map());
      const tm = m.get(w.team_slug)!;
      if (!tm.has(w.market_key)) tm.set(w.market_key, []);
      tm.get(w.market_key)!.push(w);
    }
    for (const tm of m.values()) for (const arr of tm.values()) arr.sort((a, b) => b.season_avg - a.season_avg);
    return m;
  }, [windows]);
  const logsBy = useMemo(() => {
    const m = new Map<string, BktTeamLogRow[]>();
    for (const l of teamLogs) { if (!m.has(l.team_slug)) m.set(l.team_slug, []); m.get(l.team_slug)!.push(l); }
    return m;
  }, [teamLogs]);
  const lgAvg = useMemo(() => { const v = splits.map((s) => s.ppg).filter((x) => x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 80; }, [splits]);

  const [homeSlug, setHomeSlug] = useState(teams[0]?.team_slug ?? "");
  const [awaySlug, setAwaySlug] = useState(teams[1]?.team_slug ?? "");
  const [tab, setTab] = useState<"team" | "player">("team");
  const [fixSel, setFixSel] = useState("");
  const fixExtId = pmFixtures.find((f) => String(f.id) === fixSel)?.external_id ?? "";

  const home = splitBy.get(homeSlug);
  const away = splitBy.get(awaySlug);

  // Adım 1: maç sayıları — PM Pts Model ile AYNI (log5: off × rakip_def / lig_ort).
  // Fixture/takım seçilince ptsOv sıfırlanır → PM Pts Model değeri gelir; elle override edilebilir.
  const modelHome = home && away ? (Number(home.ppg) * Number(away.oppg)) / lgAvg : 0;
  const modelAway = home && away ? (Number(away.ppg) * Number(home.oppg)) / lgAvg : 0;
  const [ptsOv, setPtsOv] = useState<{ h: number | null; a: number | null }>({ h: null, a: null });
  const effHome = ptsOv.h ?? Math.round(modelHome * 10) / 10;
  const effAway = ptsOv.a ?? Math.round(modelAway * 10) / 10;
  const ml = useMemo(() => moneyline(effHome, home?.home_pf_std ?? 11, effAway, away?.away_pf_std ?? 11, PROP_PAYBACK), [effHome, effAway, home, away]);

  // Adım 2: takım metrik trader değerleri
  const [traderMetric, setTraderMetric] = useState<Record<string, number>>({});
  const teamModel = (slug: string, mk: string, effPts: number) => {
    const fm = formBy.get(slug);
    const ptsAvg = fm?.get("points")?.season_avg ?? 1;
    const last10 = fm?.get(mk)?.last10_avg ?? fm?.get(mk)?.season_avg ?? 0;
    return mk === "points" ? effPts : Math.round(((effPts / (ptsAvg || 1)) * last10) * 10) / 10;
  };
  const teamTrader = (slug: string, mk: string, effPts: number) => traderMetric[`${slug}:${mk}`] ?? teamModel(slug, mk, effPts);

  // Bir takım-maç logundan metriğin değeri (min/max + last10-weighted için).
  const metricLogVal = (m: BktTeamLogRow, key: string): number | null => {
    switch (key) {
      case "points": return m.points;
      case "rebounds": return m.treb;
      case "assists": return m.assists;
      case "threes": return m.fg3m;
      case "steals": return m.steals;
      case "blocks": return m.blocks;
      case "turnovers": return m.turnovers;
      case "twos": return m.fgm != null && m.fg3m != null ? m.fgm - m.fg3m : null;
      default: return null; // ftm/oreb/dreb log'da yok
    }
  };
  // Historic min/max (eldeki tüm maçlar). null = veri yok (uyarı yapılmaz).
  const teamMinMax = (slug: string, key: string): { min: number; max: number } | null => {
    const vals = (logsBy.get(slug) ?? []).map((m) => metricLogVal(m, key)).filter((v): v is number => v != null);
    return vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : null;
  };
  // Son-10 ağırlıklı ort: en yeni maç en yüksek ağırlık (10,9,...,1) / ağırlık toplamı.
  const teamLast10Weighted = (slug: string, key: string): number | null => {
    const seq = [...(logsBy.get(slug) ?? [])]
      .sort((a, b) => (b.week ?? 0) - (a.week ?? 0) || String(b.match_date ?? "").localeCompare(String(a.match_date ?? "")))
      .map((m) => metricLogVal(m, key)).filter((v): v is number => v != null).slice(0, 10);
    if (!seq.length) return null;
    let num = 0, den = 0;
    seq.forEach((v, i) => { const w = seq.length - i; num += v * w; den += w; });
    return Math.round((num / den) * 10) / 10;
  };
  // Trader değeri şüpheli mi (0/negatif VEYA historic aralık dışı).
  const teamValueWarn = (slug: string, key: string, value: number): boolean => {
    if (value <= 0) return true;
    const mm = teamMinMax(slug, key);
    return mm ? value < mm.min || value > mm.max : false;
  };

  // Adım 3: oyuncu dağıtımı — takım hedefi TİKLİ oyunculara tarihsel toplama göre
  // dağıtılır (yukarıdan-aşağı, hedefe toplanır). 5G/10G/ALL/EXP referans sütunlar.
  const [playerVal, setPlayerVal] = useState<Record<string, number>>({});
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const isTicked = (slug: string, mk: string, w: BktPlayerWindowRow) => {
    const k = `${slug}:${mk}:${w.player_slug}`;
    if (ticks[k] != null) return ticks[k];
    // prime oyuncu: yeterli dakika + yeterli maç örneği (küçük-örnek transferleri ele)
    return w.avg_minutes >= 12 && w.games >= 10 && w.season_avg >= (mk === "points" ? 4 : 1);
  };
  const tickedTotal = (slug: string, mk: string, list: BktPlayerWindowRow[]) =>
    list.filter((w) => isTicked(slug, mk, w)).reduce((a, w) => a + w.total, 0) || 1;
  // EXP referansı: oyuncu sezon ort × (takım hedefi / takım sezon ort)
  const expRef = (slug: string, mk: string, w: BktPlayerWindowRow, effPts: number) => {
    const teamAvg = formBy.get(slug)?.get(mk)?.season_avg ?? 0;
    const factor = teamAvg > 0 ? teamTrader(slug, mk, effPts) / teamAvg : 1;
    return Math.round(w.season_avg * factor * 10) / 10;
  };
  const playerValue = (slug: string, mk: string, w: BktPlayerWindowRow, list: BktPlayerWindowRow[], effPts: number, distribute: boolean) => {
    const k = `${slug}:${mk}:${w.player_slug}`;
    if (playerVal[k] != null) return playerVal[k];                              // elle override
    if (!isTicked(slug, mk, w)) return 0;
    // kombine + yüzde marketleri dağıtılmaz: oyuncunun kendi ortalaması (elle düzeltilir)
    if (!(playerMarketBy.get(mk)?.distributable ?? true)) return Math.round((w.season_avg ?? 0) * 10) / 10;
    // Dağıt kapalı (varsayılan): oyuncunun rakip-ayarlı beklentisi (toplama zorlanmaz).
    if (!distribute) return expRef(slug, mk, w, effPts);
    // Dağıt açık: takım hedefi tikli oyunculara tarihsel paya göre dağıtılır (topla=hedef).
    const target = teamTrader(slug, mk, effPts);
    return Math.round((target * w.total / tickedTotal(slug, mk, list)) * 10) / 10;
  };

  // Takım metriklerini Config kurallarıyla Input'a ekle. teamCfg config satırlarını gezer
  // (custom dahil); tikli olmayan metrik + template'siz/model-dışı satır atlanır.
  const totalValue = (base: string) => totalOverride[base] ?? (teamTrader(homeSlug, base, effHome) + teamTrader(awaySlug, base, effAway));
  // Sıfırla: elle girilen maç-sayısı + trader/total değerlerini temizle (model'e döner).
  const resetTeam = () => { setPtsOv({ h: null, a: null }); setTraderMetric({}); setTotalOverride({}); };
  const resetPlayer = () => setPlayerVal({});
  // Tümünü tikle/kaldır (panel bazında: slug ya da "total").
  const setTeamAll = (prefix: string, on: boolean) =>
    setTeamTicks((p) => { const n = { ...p }; for (const m of TEAM_MARKETS) n[`${prefix}:${m.key}`] = on; return n; });
  // Takım metriği Input'ta zaten var mı (dedup uyarısı).
  const existingTeamTpl = useMemo(() => new Set(inputRows.filter((r) => r.kind === "team").map((r) => r.template)), [inputRows]);
  const teamInInput = (side: string, base: string) => {
    const tpl = teamCfg.find((c) => c.side === side && c.base_metric === base)?.template_id;
    return tpl ? existingTeamTpl.has(tpl) : false;
  };
  const addTeams = () => {
    if (!home || !away) return;
    const rows: BktInputRow[] = [];
    let sent = 0, dup = 0, noTpl = 0, zero = 0;
    for (const cfg of teamCfg) {
      const base = cfg.base_metric ?? "";
      if (!cfg.in_model) continue; // model dışı → sessiz atla
      const isPct = base === "fgmadepct" || base === "ftpct";
      let value: number, sideNum: number, teamName: string, ticked: boolean;
      if (cfg.side === "away") { ticked = isTeamTicked(`${awaySlug}:${base}`); value = teamTrader(awaySlug, base, effAway); sideNum = 2; teamName = away.team_name; }
      else if (cfg.side === "total") {
        ticked = !isPct && isTeamTicked(`total:${base}`) && isTeamTicked(`${homeSlug}:${base}`) && isTeamTicked(`${awaySlug}:${base}`);
        value = totalValue(base); sideNum = 0; teamName = `${home.team_name} + ${away.team_name}`;
      } else { ticked = isTeamTicked(`${homeSlug}:${base}`); value = teamTrader(homeSlug, base, effHome); sideNum = 1; teamName = home.team_name; }
      if (!ticked) continue;                                          // tiksiz → sessiz
      if (!cfg.template_id) { noTpl++; continue; }                    // şablon yok → say + atla
      if (existingTeamTpl.has(cfg.template_id)) { dup++; continue; }  // template Input'ta → say + atla
      if (!(value > 0)) { zero++; continue; }                        // 0/negatif → say + atla
      const std = (cfg.std ?? teamStd(base)) as number;
      for (const r of buildConfiguredLines(value, std, cfg, TEAM_PAYBACK)) {
        rows.push({ kind: "team", fixtureExtId: fixExtId, template: cfg.template_id, participant: "", side: sideNum, line: r.line, over: r.overPrice, under: r.underPrice, marketLabel: cfg.label ?? cfg.market_key, playerName: "", teamName });
      }
      sent++;
    }
    if (rows.length) onAdd(rows);
    setTeamStatus(addStatusMsg(t, sent, dup, noTpl, zero));
  };

  return (
    <div className="space-y-6">
      {/* seçim satırı */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.fixtureLabel")}</span>
          <select
            value={fixSel}
            onChange={(e) => { setFixSel(e.target.value); setPtsOv({ h: null, a: null }); const f = pmFixtures.find((x) => String(x.id) === e.target.value); if (f) { setHomeSlug(f.home_team_slug); setAwaySlug(f.away_team_slug); } }}
            className="rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink outline-none focus:border-line-strong">
            <option value="">{t("basketball.fixtureManual")}…</option>
            {pmFixtures.map((f) => (<option key={f.id} value={f.id}>{(f.home_team_name || f.home_team_slug)} — {(f.away_team_name || f.away_team_slug)}{f.external_id ? ` [${f.external_id}]` : ""}</option>))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.matchHome")}</span>
          <select value={homeSlug} onChange={(e) => { setHomeSlug(e.target.value); setPtsOv({ h: null, a: null }); }} className="rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink outline-none focus:border-line-strong">
            {teams.map((tm) => (<option key={tm.team_slug} value={tm.team_slug}>{tm.team_name}</option>))}
          </select>
        </label>
        <span className="pb-2 text-ink-3">vs</span>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.matchAway")}</span>
          <select value={awaySlug} onChange={(e) => { setAwaySlug(e.target.value); setPtsOv({ h: null, a: null }); }} className="rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink outline-none focus:border-line-strong">
            {teams.map((tm) => (<option key={tm.team_slug} value={tm.team_slug}>{tm.team_name}</option>))}
          </select>
        </label>
      </div>

      {home && away && homeSlug !== awaySlug ? (
        <>
          {/* maç sayıları özeti */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-veil px-4 py-3 text-sm">
            <div className="flex items-center gap-2"><TeamCrest slug={homeSlug} name={home.team_name} size={30} url={home.crest_url} />
              <NumInput value={effHome} onChange={(v) => setPtsOv((p) => ({ ...p, h: v }))} /></div>
            <span className="text-ink-3">–</span>
            <div className="flex items-center gap-2"><NumInput value={effAway} onChange={(v) => setPtsOv((p) => ({ ...p, a: v }))} />
              <TeamCrest slug={awaySlug} name={away.team_name} size={30} url={away.crest_url} /></div>
            <div><span className="text-ink-3">{t("basketball.matchTotal")}: </span><span className="font-semibold text-accent-ink">{fmt(effHome + effAway)}</span></div>
            <div><span className="text-ink-3">{t("basketball.matchMoneyline")}: </span><span className="font-semibold text-ink">{ml.homePrice.toFixed(2)} / {ml.awayPrice.toFixed(2)}</span></div>
          </div>

          {/* tab bar */}
          <div className="flex gap-1.5">
            {([["team", t("basketball.tabTeamMetrics")], ["player", t("basketball.tabPlayerDist")]] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-xs font-semibold ${tab === k ? "bg-accent text-white" : "bg-card-2 text-ink-2 hover:text-ink"}`}>{lbl}</button>
            ))}
          </div>

          {tab === "team" ? (
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="text-[11px] text-ink-3">{t("basketball.addTeamHint")}</span>
                {teamStatus ? <span className="rounded-md bg-veil px-2 py-1 text-[11px] font-semibold text-ink-2">{teamStatus}</span> : null}
                <button onClick={resetTeam} className="ml-auto rounded-md border border-line px-3 py-2 text-[12px] font-semibold text-ink-2 hover:text-ink">{t("basketball.reset")}</button>
                <button onClick={addTeams} className="rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:opacity-90">{t("basketball.addToInput")}</button>
              </div>
              {/* Home | Away | Total yan yana (compact) */}
              <div className="grid gap-4 lg:grid-cols-3">
                {[{ slug: homeSlug, side: "home", eff: effHome, s: home }, { slug: awaySlug, side: "away", eff: effAway, s: away }].map(({ slug, side, eff, s }) => (
                  <TeamMetricTable key={slug} slug={slug} side={side} name={s.team_name} crestUrl={s.crest_url} eff={eff} formBy={formBy} teamTrader={teamTrader}
                    setTrader={(mk, v) => setTraderMetric((p) => ({ ...p, [`${slug}:${mk}`]: v }))} teamModel={teamModel} last10w={teamLast10Weighted}
                    valueWarn={teamValueWarn} inInput={teamInInput} isTeamTicked={isTeamTicked} setTeamTick={(key, v) => setTeamTicks((p) => ({ ...p, [key]: v }))}
                    setAll={(on) => setTeamAll(slug, on)} locale={locale} t={t} />
                ))}
                <TotalMetricTable totalValue={totalValue} setTotalOverride={(mk, v) => setTotalOverride((p) => ({ ...p, [mk]: v }))}
                  isTeamTicked={isTeamTicked} setTeamTick={(key, v) => setTeamTicks((p) => ({ ...p, [key]: v }))} setAll={(on) => setTeamAll("total", on)} locale={locale} t={t} />
              </div>
              {/* sezon maçları (home / away) */}
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {[{ slug: homeSlug, s: home }, { slug: awaySlug, s: away }].map(({ slug, s }) => (
                  <TeamRecent key={slug} name={s.team_name} logs={logsBy.get(slug) ?? []} locale={locale} t={t} />
                ))}
              </div>
            </div>
          ) : (
            <PlayerDistPanel homeSlug={homeSlug} awaySlug={awaySlug} homeName={home.team_name} awayName={away.team_name}
              effHome={effHome} effAway={effAway} winBy={winBy} isTicked={isTicked} setTick={(k, v) => setTicks((p) => ({ ...p, [k]: v }))}
              playerValue={playerValue} setVal={(k, v) => setPlayerVal((p) => ({ ...p, [k]: v }))} expRef={expRef}
              teamTarget={(slug, mk) => teamTrader(slug, mk, slug === homeSlug ? effHome : effAway)}
              onAdd={onAdd} playerIds={playerIds} playerCfg={playerCfg} playerMarkets={playerMarkets}
              existingKeys={existingKeys} existingPlayerMkt={existingPlayerMkt} onReset={resetPlayer} competition={competition} fixExtId={fixExtId}
              roleBy={roleBy} euroTeamSlugs={euroTeamSlugs} leaderBy={leaderBy} locale={locale} t={t} />
          )}
        </>
      ) : (<p className="text-sm text-ink-3">{t("basketball.matchPickTeams")}</p>)}
    </div>
  );
}

// Tümünü tikle/kaldır başlık kutusu.
function TickAllHead({ allOn, setAll }: { allOn: boolean; setAll: (on: boolean) => void }) {
  return <input type="checkbox" checked={allOn} onChange={(e) => setAll(e.target.checked)} className="accent-[var(--accent)]" title="tümü" />;
}
// Model (i) info metni.
const MODEL_INFO_KEY = "basketball.modelInfo";

/* ---------- Team metrik tablosu (compact; Home / Away) ---------- */
function TeamMetricTable({ slug, side, name, crestUrl, eff, formBy, teamTrader, setTrader, teamModel, last10w, valueWarn, inInput, isTeamTicked, setTeamTick, setAll, locale, t }: {
  slug: string; side: string; name: string; crestUrl?: string | null; eff: number;
  formBy: Map<string, Map<string, BktTeamMetricFormRow>>;
  teamTrader: (s: string, mk: string, e: number) => number;
  setTrader: (mk: string, v: number) => void;
  teamModel: (s: string, mk: string, e: number) => number;
  last10w: (s: string, mk: string) => number | null;
  valueWarn: (s: string, mk: string, v: number) => boolean;
  inInput: (side: string, base: string) => boolean;
  isTeamTicked: (key: string) => boolean; setTeamTick: (key: string, v: boolean) => void;
  setAll: (on: boolean) => void;
  locale: "tr" | "en"; t: (k: string) => string;
}) {
  const allOn = TEAM_MARKETS.every((m) => isTeamTicked(`${slug}:${m.key}`));
  return (
    <div className="overflow-x-auto">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-ink"><TeamCrest slug={slug} name={name} size={22} url={crestUrl} /><span className="truncate">{name}</span></div>
      <table className="min-w-full border-collapse text-[11px]">
        <thead><tr className="border-b border-line text-[9px] uppercase tracking-[0.1em] text-ink-3">
          <th className="px-1 py-1 text-center"><TickAllHead allOn={allOn} setAll={setAll} /></th>
          <th className="px-1 py-1 text-left">{t("basketball.colMarket")}</th>
          <th className="px-1 py-1 text-right">{t("basketball.colAvg")}</th>
          <th className="px-1 py-1 text-right">{t("basketball.colLast10w")}</th>
          <th className="px-1 py-1 text-right">
            <span className="inline-flex items-center gap-1">{t("basketball.colModel")}
              <span title={t(MODEL_INFO_KEY)} className="inline-flex h-3 w-3 cursor-help items-center justify-center rounded-full border border-current text-[8px] font-bold leading-none normal-case">i</span>
            </span>
          </th>
          <th className="px-1 py-1 text-right">{t("basketball.colTrader")}</th>
        </tr></thead>
        <tbody>
          {TEAM_MARKETS.map((met) => {
            const f = formBy.get(slug)?.get(met.key);
            const key = `${slug}:${met.key}`;
            const on = isTeamTicked(key);
            const tv = Math.round(teamTrader(slug, met.key, eff) * 10) / 10;
            const l10w = last10w(slug, met.key);
            return (
              <tr key={met.key} className={`border-t border-line ${on ? "" : "opacity-45"}`}>
                <td className="px-1 py-0.5 text-center"><input type="checkbox" checked={on} onChange={(e) => setTeamTick(key, e.target.checked)} className="accent-[var(--accent)]" /></td>
                <td className="px-1 py-0.5 text-ink whitespace-nowrap">
                  {metricLabel(met.key, locale, met.label)}
                  {inInput(side, met.key) ? <span title={t("basketball.alreadyAdded")} className="ml-1 text-[10px] font-bold text-amber-400">⚠</span> : null}
                </td>
                <td className="px-1 py-0.5 text-right tabular-nums text-ink-3">{fmt(f?.season_avg)}</td>
                <td className="px-1 py-0.5 text-right tabular-nums text-ink-3">{l10w == null ? "-" : fmt(l10w)}</td>
                <td className="px-1 py-0.5 text-right tabular-nums text-ink-2">{fmt(teamModel(slug, met.key, eff))}</td>
                <td className="px-1 py-0.5 text-right"><NumInput value={tv} onChange={(v) => setTrader(met.key, v)} w="w-16" warn={on && valueWarn(slug, met.key, tv)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Toplam (home + away) tablosu — DÜZENLENEBİLİR ---------- */
function TotalMetricTable({ totalValue, setTotalOverride, isTeamTicked, setTeamTick, setAll, locale, t }: {
  totalValue: (mk: string) => number; setTotalOverride: (mk: string, v: number) => void;
  isTeamTicked: (key: string) => boolean; setTeamTick: (key: string, v: boolean) => void;
  setAll: (on: boolean) => void;
  locale: "tr" | "en"; t: (k: string) => string;
}) {
  const allOn = TEAM_MARKETS.every((m) => isTeamTicked(`total:${m.key}`));
  return (
    <div className="overflow-x-auto">
      <div className="mb-2 text-[12px] font-medium text-ink">{t("basketball.totalSection")}</div>
      <table className="min-w-full border-collapse text-[11px]">
        <thead><tr className="border-b border-line text-[9px] uppercase tracking-[0.1em] text-ink-3">
          <th className="px-1 py-1 text-center"><TickAllHead allOn={allOn} setAll={setAll} /></th>
          <th className="px-1 py-1 text-left">{t("basketball.colMarket")}</th>
          <th className="px-1 py-1 text-right">{t("basketball.colTrader")}</th>
        </tr></thead>
        <tbody>
          {TEAM_MARKETS.map((met) => {
            const key = `total:${met.key}`;
            const on = isTeamTicked(key);
            return (
              <tr key={met.key} className={`border-t border-line ${on ? "" : "opacity-45"}`}>
                <td className="px-1 py-0.5 text-center"><input type="checkbox" checked={on} onChange={(e) => setTeamTick(key, e.target.checked)} className="accent-[var(--accent)]" /></td>
                <td className="px-1 py-0.5 text-ink whitespace-nowrap">{metricLabel(met.key, locale, met.label)}</td>
                <td className="px-1 py-0.5 text-right"><NumInput value={Math.round(totalValue(met.key) * 10) / 10} onChange={(v) => setTotalOverride(met.key, v)} w="w-16" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Takım sezon maçları ---------- */
function TeamRecent({ name, logs, locale, t }: { name: string; logs: BktTeamLogRow[]; locale: "tr" | "en"; t: (k: string) => string }) {
  const sortedLogs = [...logs].sort((a, b) => (b.week ?? 0) - (a.week ?? 0) || String(b.match_date ?? "").localeCompare(String(a.match_date ?? "")));
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{name} · {t("basketball.recentMatches")}</div>
      <div className="max-h-72 overflow-auto">
        <table className="min-w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-card-2"><tr className="text-[9px] uppercase tracking-[0.1em] text-ink-3">
            <th className="px-1.5 py-1 text-left">{t("basketball.date")}</th>
            <th className="px-1.5 py-1 text-left">{t("basketball.opponent")}</th>
            <th className="px-1.5 py-1 text-right">Sayı</th><th className="px-1.5 py-1 text-right">Rib</th><th className="px-1.5 py-1 text-right">As</th>
            <th className="px-1.5 py-1 text-right">3S</th><th className="px-1.5 py-1 text-right">TÇ</th><th className="px-1.5 py-1 text-right">Blk</th><th className="px-1.5 py-1 text-right">TK</th>
          </tr></thead>
          <tbody>
            {sortedLogs.map((m, i) => (
              <tr key={`${m.match_key}-${m.match_date}-${i}`} className="border-t border-line">
                <td className="px-1.5 py-0.5 text-ink-3 whitespace-nowrap">{formatMatchDate(m.match_date, locale)}</td>
                <td className="px-1.5 py-0.5 text-ink-2 whitespace-nowrap">{m.opponent_name} <span className={m.result === "W" ? "text-pos" : "text-neg"}>{m.result}</span></td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink">{m.points}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-2">{m.treb}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-2">{m.assists}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-2">{m.fg3m}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-2">{m.steals}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-2">{m.blocks}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-2">{m.turnovers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Player distribution panel ---------- */
function PlayerDistPanel({ homeSlug, awaySlug, homeName, awayName, effHome, effAway, winBy, isTicked, setTick, playerValue, setVal, expRef, teamTarget, onAdd, playerIds, playerCfg, playerMarkets, existingKeys, existingPlayerMkt, onReset, competition, fixExtId, roleBy, euroTeamSlugs, leaderBy, locale, t }: {
  homeSlug: string; awaySlug: string; homeName: string; awayName: string; effHome: number; effAway: number;
  winBy: Map<string, Map<string, BktPlayerWindowRow[]>>;
  isTicked: (s: string, mk: string, w: BktPlayerWindowRow) => boolean;
  setTick: (k: string, v: boolean) => void;
  playerValue: (s: string, mk: string, w: BktPlayerWindowRow, list: BktPlayerWindowRow[], e: number, distribute: boolean) => number;
  setVal: (k: string, v: number) => void;
  expRef: (s: string, mk: string, w: BktPlayerWindowRow, e: number) => number;
  teamTarget: (s: string, mk: string) => number;
  onAdd: (rows: BktInputRow[]) => void;
  playerIds: Record<string, string>;
  playerCfg: Map<string, PmMarketConfig>;
  playerMarkets: { key: string; base: string; label: string; std: number; tpl: string; distributable: boolean }[];
  existingKeys: Set<string>;
  existingPlayerMkt: Set<string>;
  onReset: () => void;
  competition?: "E" | "U";
  fixExtId: string;
  roleBy: Map<string, BktPlayerRoleRow>;
  euroTeamSlugs: Set<string>;
  leaderBy: Map<string, string[]>;
  locale: "tr" | "en";
  t: (k: string) => string;
}) {
  const [side, setSide] = useState<"home" | "away">("home");
  const [distribute, setDistribute] = useState(false); // futbol gibi: varsayılan kapalı
  const [mk, setMk] = useState(playerMarkets[0]?.key ?? "points");
  const [selPlayer, setSelPlayer] = useState<string | null>(null);
  const [preview, setPreview] = useState<BktPlayerWindowRow | null>(null); // göz → line önizleme drawer
  const [playerStatus, setPlayerStatus] = useState<string>("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "all", dir: "desc" });
  const slug = side === "home" ? homeSlug : awaySlug;
  const eff = side === "home" ? effHome : effAway;
  const met = playerMarkets.find((m) => m.key === mk) ?? playerMarkets[0];
  const allList = winBy.get(slug)?.get(met?.base ?? mk) ?? [];
  if (!met) return null;
  const roleOf = (w: BktPlayerWindowRow) => roleBy.get(`${slug}:${w.player_slug}`);
  const ROLE_ORDER: Record<string, number> = { starter: 0, rotation: 1, limited: 2, garbage: 3, departed: 4 };
  const sortVal = (w: BktPlayerWindowRow): number | string => {
    switch (sort.key) {
      case "player": return w.player_name;
      case "pos": return normalizePositionCode(roleOf(w)?.position) ?? "zzz";
      case "role": return ROLE_ORDER[roleOf(w)?.role ?? ""] ?? 9;
      case "min": return w.avg_minutes ?? 0;
      case "matches": return w.games ?? 0;
      case "w5": return w.last5_avg ?? 0;
      case "w10": return w.last10_avg ?? 0;
      case "all": return w.season_avg ?? 0;
      case "exp": return expRef(slug, mk, w, eff);
      case "value": return playerValue(slug, mk, w, allList, eff, distribute);
      default: return w.season_avg ?? 0;
    }
  };
  const dir = sort.dir === "asc" ? 1 : -1;
  const players = allList
    .filter((w) => w.avg_minutes >= 5 || w.season_avg >= 1)
    .slice()
    .sort((a, b) => {
      const va = sortVal(a), vb = sortVal(b);
      if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb), "tr") * dir;
      return (va - vb) * dir;
    });
  const toggleSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "player" ? "asc" : "desc" }));
  const arrow = (key: string) => (sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "");
  const target = teamTarget(slug, mk);
  const distributed = allList.filter((w) => isTicked(slug, mk, w)).reduce((a, w) => a + playerValue(slug, mk, w, allList, eff, distribute), 0);

  // Config kuralları: bu market için std/template/line-cfg + oyuncu için katılımcı id.
  const cfgCur = playerCfg.get(mk);
  const stdCur = (cfgCur?.std ?? met.std) as number;
  const tplCur = cfgCur?.template_id ?? met.tpl;
  const lineCfgCur: LineConfig = cfgCur ?? DEFAULT_LINE_CFG;
  const participantOf = (w: BktPlayerWindowRow) => playerIds[w.player_slug] || w.player_slug;
  const ladderFor = (w: BktPlayerWindowRow) => buildConfiguredLines(playerValue(slug, mk, w, allList, eff, distribute), stdCur, lineCfgCur, PROP_PAYBACK);
  // Oyuncu bu market için Input'ta zaten var mı (uyarı).
  const alreadyIn = (w: BktPlayerWindowRow) => existingPlayerMkt.has(`${tplCur}|${participantOf(w)}`);

  // Ekle: tikli oyuncuların çizgilerini Input'a gönder — Input'ta ZATEN olan satırlar atlanır (mükerrer engel)
  const addCurrent = () => {
    const rows: BktInputRow[] = [];
    const sideNum = side === "home" ? 1 : 2;
    const teamNm = side === "home" ? homeName : awayName;
    let sent = 0, dup = 0, noTpl = 0, zero = 0;
    for (const w of allList) {
      if (!isTicked(slug, mk, w)) continue;
      if (!(tplCur ?? met.tpl)) { noTpl++; continue; }                  // şablon yok
      if (alreadyIn(w)) { dup++; continue; }                            // oyuncu+market zaten Input'ta
      if (!(playerValue(slug, mk, w, allList, eff, distribute) > 0)) { zero++; continue; } // 0/negatif
      for (const r of ladderFor(w)) {
        rows.push({ kind: "player", fixtureExtId: fixExtId, template: tplCur ?? met.tpl, participant: participantOf(w), side: sideNum, line: r.line, over: r.overPrice, under: r.underPrice, marketLabel: met.label, playerName: w.player_name, teamName: teamNm });
      }
      sent++;
    }
    if (rows.length) onAdd(rows);
    setPlayerStatus(addStatusMsg(t, sent, dup, noTpl, zero));
  };

  return (
    <div>
      <div className="mb-3 space-y-2">
        {/* takım seçimi + özet */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{t("basketball.pickTeam")}</span>
            <div className="flex gap-1.5">
              {(["home", "away"] as const).map((sd) => (
                <button key={sd} onClick={() => { setSide(sd); setSelPlayer(null); }} className={`rounded-md px-3.5 py-1 text-[12px] font-semibold transition-colors ${side === sd ? "bg-accent text-white shadow-sm" : "bg-card-2 text-ink-3 hover:text-ink"}`}>{sd === "home" ? homeName : awayName}</button>
              ))}
            </div>
            {euroTeamSlugs.has(slug) ? (
              <span title={t("basketball.euroTeamNote")} className="inline-flex cursor-help items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                ⚠ {t("basketball.euroTeamBadge")}
              </span>
            ) : null}
          </div>
          <span className="ml-auto text-[12px] text-ink-3">
            {met.distributable ? (
              <>
                {t("basketball.distTarget")}: <span className="font-semibold text-accent-ink">{fmt(target)}</span>
                {" · "}{t("basketball.distSum")}: <span className={`font-semibold ${Math.abs(distributed - target) <= target * 0.03 ? "text-pos" : "text-neg"}`}>{fmt(distributed)}</span>
              </>
            ) : (
              <span className="text-ink-2">{t("basketball.manualValues")}</span>
            )}
            {" · Std "}{met.std}
          </span>
          {/* Dağıt toggle (belirgin) + info (i) */}
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition ${distribute ? "border-accent/50 bg-accent-soft text-accent-ink" : "border-line bg-card-2 text-ink-2 hover:text-ink"}`}>
            <input type="checkbox" checked={distribute} onChange={(e) => setDistribute(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            {t("basketball.distribute")}
            <span title={t("basketball.distributeInfo")} className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-current text-[10px] font-bold leading-none">i</span>
          </label>
          {playerStatus ? <span className="rounded-md bg-veil px-2 py-1 text-[11px] font-semibold text-ink-2">{playerStatus}</span> : null}
          <button onClick={onReset} className="rounded-md border border-line px-3 py-2 text-[12px] font-semibold text-ink-2 hover:text-ink">{t("basketball.reset")}</button>
          <button onClick={addCurrent} className="rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:opacity-90">
            {t("basketball.addToInput")}
          </button>
        </div>
        {/* market seçimi — ayrı kutu */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-card-2/40 px-2.5 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{t("basketball.pickMarket")}</span>
          <div className="flex flex-wrap gap-1.5">
            {playerMarkets.map((m) => (
              <button key={m.key} onClick={() => { setMk(m.key); setSelPlayer(null); }} className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${m.key === mk ? "bg-accent-soft text-accent-ink ring-1 ring-accent/40" : "bg-veil text-ink-3 hover:text-ink"}`}>{m.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[13px]">
          <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
            <th className="px-2 py-1.5 text-center"><input type="checkbox" title={t("basketball.tickAll")} checked={players.length > 0 && players.every((w) => isTicked(slug, mk, w))} onChange={(e) => players.forEach((w) => setTick(`${slug}:${mk}:${w.player_slug}`, e.target.checked))} className="accent-[var(--accent)]" /></th>
            <th className="px-2 py-1.5 text-left"><button onClick={() => toggleSort("player")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.player")}{arrow("player")}</button></th>
            <th className="px-2 py-1.5 text-center" title={t("basketball.posInfo")}><button onClick={() => toggleSort("pos")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.position")}{arrow("pos")}</button></th>
            <th className="px-2 py-1.5 text-left" title={t("basketball.roleInfo")}><button onClick={() => toggleSort("role")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.colRole")}{arrow("role")}</button></th>
            <th className="px-2 py-1.5 text-right" title={t("basketball.minInfo")}><button onClick={() => toggleSort("min")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.colAvgMin")}{arrow("min")}</button></th>
            <th className="px-2 py-1.5 text-right"><button onClick={() => toggleSort("matches")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.colMatches")}{arrow("matches")}</button></th>
            <th className="px-2 py-1.5 text-right" title={t("basketball.w5Info")}><button onClick={() => toggleSort("w5")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.w5")}{arrow("w5")}</button></th>
            <th className="px-2 py-1.5 text-right" title={t("basketball.w10Info")}><button onClick={() => toggleSort("w10")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.w10")}{arrow("w10")}</button></th>
            <th className="px-2 py-1.5 text-right" title={t("basketball.allInfo")}><button onClick={() => toggleSort("all")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.wAll")}{arrow("all")}</button></th>
            <th className="px-2 py-1.5 text-right" title={t("basketball.expInfo")}><button onClick={() => toggleSort("exp")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.expShort")}{arrow("exp")}</button></th>
            <th className="px-2 py-1.5 text-right"><button onClick={() => toggleSort("value")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.colValue")}{arrow("value")}</button></th>
            <th className="px-2 py-1.5 text-right">{t("basketball.colLineShort")}</th>
          </tr></thead>
          <tbody>
            {players.map((w) => {
              const on = isTicked(slug, mk, w);
              const k = `${slug}:${mk}:${w.player_slug}`;
              const val = playerValue(slug, mk, w, allList, eff, distribute);
              const mid = on ? buildLadder(val, met.std, PROP_PAYBACK).find((r) => r.isMid) : null;
              return (
                <tr key={w.player_slug} className={`border-t border-line ${on ? "" : "opacity-45"} ${selPlayer === w.player_slug ? "bg-veil" : ""}`}>
                  <td className="px-2 py-1 text-center"><input type="checkbox" checked={on} onChange={(e) => setTick(k, e.target.checked)} className="accent-[var(--accent)]" /></td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <button onClick={() => setSelPlayer(w.player_slug === selPlayer ? null : w.player_slug)} className="text-ink hover:text-accent-ink">{w.player_name}</button>
                    {alreadyIn(w) ? <span title={t("basketball.alreadyAdded")} className="ml-1.5 text-[11px] font-bold text-amber-400">⚠</span> : null}
                    {(leaderBy.get(`${slug}:${w.player_slug}`) ?? []).map((lk) => (
                      <span key={lk} title={`${t("basketball.leaderTitle")}: ${t(lk)}`} className="ml-1 inline-block rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-bold text-amber-300">★{t(lk)}</span>
                    ))}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {normalizePositionCode(roleOf(w)?.position) ? (
                      <span title={positionLabel(roleOf(w)?.position, locale)} className="inline-block rounded bg-veil px-1.5 py-0.5 text-[10px] font-semibold text-ink-2">{normalizePositionCode(roleOf(w)?.position)}</span>
                    ) : <span className="text-ink-3">-</span>}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {roleLabelKey(roleOf(w)?.role) ? (
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${roleBadgeClass(roleOf(w)?.role)}`}>{t(roleLabelKey(roleOf(w)?.role) as string)}</span>
                    ) : <span className="text-ink-3">-</span>}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-3">{fmt(w.avg_minutes)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-3">{w.games}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-3">{fmt(w.last5_avg)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-3">{fmt(w.last10_avg)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-2">{fmt(w.season_avg)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-2">{fmt(expRef(slug, mk, w, eff))}</td>
                  <td className="px-2 py-1 text-right">{on ? <NumInput value={val} onChange={(v) => setVal(k, v)} /> : <span className="text-ink-3">-</span>}</td>
                  <td className="px-2 py-1 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="tabular-nums text-accent-ink">{mid ? `${mid.line.toFixed(1)} ${mid.overPrice.toFixed(2)}/${mid.underPrice.toFixed(2)}` : "-"}</span>
                      {on ? (
                        <button onClick={() => setPreview(w)} title={t("basketball.viewLines")} className="text-ink-3 hover:text-accent-ink">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-ink-3">{t("basketball.selectPlayerHint")}</p>
      {selPlayer ? <BasketballPlayerDrawer key={selPlayer} slug={selPlayer} competition={competition} onClose={() => setSelPlayer(null)} /> : null}

      {/* Göz → Config kurallarına göre üretilen line'lar + oranlar */}
      {preview ? (
        <div className="fixed inset-0 z-[90] flex justify-end" onClick={() => setPreview(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative h-full w-full max-w-sm overflow-auto bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">{preview.player_name}</h3>
                <p className="mt-0.5 text-[11px] text-ink-3">{met.label} · {t("basketball.colValue")} <span className="font-semibold text-accent-ink">{fmt(playerValue(slug, mk, preview, allList, eff, distribute))}</span> · Std {stdCur}</p>
              </div>
              <button onClick={() => setPreview(null)} className="text-[12px] text-ink-3 hover:text-ink">{t("basketball.close")}</button>
            </div>
            <table className="mt-4 min-w-full border-collapse text-[12px]">
              <thead><tr className="border-b border-line text-[9px] uppercase tracking-[0.1em] text-ink-3">
                <th className="px-2 py-1 text-right">{t("basketball.colLineShort")}</th>
                <th className="px-2 py-1 text-right">{t("basketball.oddsOver")}</th>
                <th className="px-2 py-1 text-right">{t("basketball.oddsUnder")}</th>
              </tr></thead>
              <tbody>
                {ladderFor(preview).map((r, i) => (
                  <tr key={i} className={`border-t border-line ${r.isMid ? "bg-veil font-semibold" : ""}`}>
                    <td className="px-2 py-1 text-right tabular-nums text-ink">{r.line.toFixed(1)}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-ink">{r.overPrice.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-ink-2">{r.underPrice == null ? "—" : r.underPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
