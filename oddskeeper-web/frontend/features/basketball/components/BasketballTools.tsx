"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { buildLadder, buildConfiguredLines, moneyline, type LineConfig } from "../odds";
import { PLAYER_MARKETS, TEAM_MARKETS, teamStd, playerStd, metricLabel, isDistributable } from "../marketConfig";
import { formatMatchDate } from "../lib";
import { TeamCrest } from "./ui";
import BasketballPlayerDrawer from "./BasketballPlayerDrawer";
import type { PmFixture, PmMarketConfig } from "../pmQueries";
import type {
  BktHomeAwaySplitRow, BktTeamMetricFormRow, BktPlayerWindowRow,
  BktTeamLogRow, BktInputRow,
} from "../types";

type Props = {
  pmFixtures: PmFixture[];
  splits: BktHomeAwaySplitRow[];
  forms: BktTeamMetricFormRow[];
  windows: BktPlayerWindowRow[];
  teamLogs: BktTeamLogRow[];
  playerIds: Record<string, string>;
  config: PmMarketConfig[];
  onAdd: (rows: BktInputRow[]) => void;
};

const PROP_PAYBACK = 0.915;
const TEAM_PAYBACK = 0.96;

// Config satırı yoksa kullanılacak varsayılan line kuralı (mevcut mid±2 davranışı).
const DEFAULT_LINE_CFG: LineConfig = {
  lines: 5, under_lines: 5, payback: null, round_odds: false,
  max_lines: 15, odds_cap: 999, skip_after: 5, skip_step: 2,
};

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
function NumInput({ value, onChange, step = 0.1, w = "w-16" }: { value: number; onChange: (v: number) => void; step?: number; w?: string }) {
  return (
    <input type="number" value={value} step={step}
      onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onChange(v); }}
      className={`${w} rounded-md border border-line bg-field px-2 py-1 text-right text-[13px] tabular-nums text-ink outline-none focus:border-line-strong`} />
  );
}

export default function BasketballTools({ pmFixtures, splits, forms, windows, teamLogs, playerIds, config, onAdd }: Props) {
  const { t, locale } = useI18n();
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

  // Adım 1: maç sayıları
  const modelHome = home && away && home.home_pf && away.away_pa ? (home.home_pf * away.away_pa) / lgAvg : 0;
  const modelAway = home && away && away.away_pf && home.home_pa ? (away.away_pf * home.home_pa) / lgAvg : 0;
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
  const playerValue = (slug: string, mk: string, w: BktPlayerWindowRow, list: BktPlayerWindowRow[], effPts: number) => {
    const k = `${slug}:${mk}:${w.player_slug}`;
    if (playerVal[k] != null) return playerVal[k];
    if (!isTicked(slug, mk, w)) return 0;
    // kombine + yüzde marketleri dağıtılmaz: oyuncunun kendi ortalaması (elle düzeltilir)
    if (!(playerMarketBy.get(mk)?.distributable ?? true)) return Math.round((w.season_avg ?? 0) * 10) / 10;
    const target = teamTrader(slug, mk, effPts);
    return Math.round((target * w.total / tickedTotal(slug, mk, list)) * 10) / 10;
  };

  // Takım metriklerini Config kurallarıyla Input'a ekle. teamCfg config satırlarını gezer
  // (custom dahil); tikli olmayan metrik + template'siz/model-dışı satır atlanır.
  const addTeams = () => {
    if (!home || !away) return;
    const rows: BktInputRow[] = [];
    for (const cfg of teamCfg) {
      const base = cfg.base_metric ?? "";
      if (!cfg.in_model || !cfg.template_id || !isTeamTicked(base)) continue;
      const std = (cfg.std ?? teamStd(base)) as number;
      const hv = teamTrader(homeSlug, base, effHome);
      const av = teamTrader(awaySlug, base, effAway);
      const value = cfg.side === "away" ? av : cfg.side === "total" ? hv + av : hv;
      const sideNum = cfg.side === "away" ? 2 : cfg.side === "total" ? 0 : 1;
      const teamName = cfg.side === "away" ? away.team_name : cfg.side === "total" ? `${home.team_name} + ${away.team_name}` : home.team_name;
      for (const r of buildConfiguredLines(value, std, cfg, TEAM_PAYBACK)) {
        rows.push({ kind: "team", fixtureExtId: fixExtId, template: cfg.template_id, participant: "", side: sideNum, line: r.line, over: r.overPrice, under: r.underPrice, marketLabel: cfg.label ?? cfg.market_key, playerName: "", teamName });
      }
    }
    if (rows.length) onAdd(rows);
  };

  return (
    <div className="space-y-6">
      {/* seçim satırı */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.fixtureLabel")}</span>
          <select
            value={fixSel}
            onChange={(e) => { setFixSel(e.target.value); const f = pmFixtures.find((x) => String(x.id) === e.target.value); if (f) { setHomeSlug(f.home_team_slug); setAwaySlug(f.away_team_slug); } }}
            className="rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink outline-none focus:border-line-strong">
            <option value="">{t("basketball.fixtureManual")}…</option>
            {pmFixtures.map((f) => (<option key={f.id} value={f.id}>{(f.home_team_name || f.home_team_slug)} — {(f.away_team_name || f.away_team_slug)}{f.external_id ? ` [${f.external_id}]` : ""}</option>))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.matchHome")}</span>
          <select value={homeSlug} onChange={(e) => setHomeSlug(e.target.value)} className="rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink outline-none focus:border-line-strong">
            {teams.map((tm) => (<option key={tm.team_slug} value={tm.team_slug}>{tm.team_name}</option>))}
          </select>
        </label>
        <span className="pb-2 text-ink-3">vs</span>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.matchAway")}</span>
          <select value={awaySlug} onChange={(e) => setAwaySlug(e.target.value)} className="rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink outline-none focus:border-line-strong">
            {teams.map((tm) => (<option key={tm.team_slug} value={tm.team_slug}>{tm.team_name}</option>))}
          </select>
        </label>
      </div>

      {home && away && homeSlug !== awaySlug ? (
        <>
          {/* maç sayıları özeti */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-veil px-4 py-3 text-sm">
            <div className="flex items-center gap-2"><TeamCrest slug={homeSlug} name={home.team_name} size={30} />
              <NumInput value={effHome} onChange={(v) => setPtsOv((p) => ({ ...p, h: v }))} /></div>
            <span className="text-ink-3">–</span>
            <div className="flex items-center gap-2"><NumInput value={effAway} onChange={(v) => setPtsOv((p) => ({ ...p, a: v }))} />
              <TeamCrest slug={awaySlug} name={away.team_name} size={30} /></div>
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
                <button onClick={addTeams} className="ml-auto rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:opacity-90">{t("basketball.addToInput")}</button>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                {[{ slug: homeSlug, eff: effHome, s: home }, { slug: awaySlug, eff: effAway, s: away }].map(({ slug, eff, s }) => (
                  <TeamPanel key={slug} slug={slug} name={s.team_name} eff={eff} formBy={formBy} teamTrader={teamTrader}
                    setTrader={(mk, v) => setTraderMetric((p) => ({ ...p, [`${slug}:${mk}`]: v }))} teamModel={teamModel} logs={logsBy.get(slug) ?? []}
                    isTeamTicked={isTeamTicked} setTeamTick={(mk, v) => setTeamTicks((p) => ({ ...p, [mk]: v }))} locale={locale} t={t} />
                ))}
              </div>
            </div>
          ) : (
            <PlayerDistPanel homeSlug={homeSlug} awaySlug={awaySlug} homeName={home.team_name} awayName={away.team_name}
              effHome={effHome} effAway={effAway} winBy={winBy} isTicked={isTicked} setTick={(k, v) => setTicks((p) => ({ ...p, [k]: v }))}
              playerValue={playerValue} setVal={(k, v) => setPlayerVal((p) => ({ ...p, [k]: v }))} expRef={expRef}
              teamTarget={(slug, mk) => teamTrader(slug, mk, slug === homeSlug ? effHome : effAway)}
              onAdd={onAdd} playerIds={playerIds} playerCfg={playerCfg} playerMarkets={playerMarkets} fixExtId={fixExtId} t={t} />
          )}
        </>
      ) : (<p className="text-sm text-ink-3">{t("basketball.matchPickTeams")}</p>)}
    </div>
  );
}

/* ---------- Team panel: metrik tablosu + son maçlar ---------- */
function TeamPanel({ slug, name, eff, formBy, teamTrader, setTrader, teamModel, logs, isTeamTicked, setTeamTick, locale, t }: {
  slug: string; name: string; eff: number;
  formBy: Map<string, Map<string, BktTeamMetricFormRow>>;
  teamTrader: (s: string, mk: string, e: number) => number;
  setTrader: (mk: string, v: number) => void;
  teamModel: (s: string, mk: string, e: number) => number;
  logs: BktTeamLogRow[];
  isTeamTicked: (mk: string) => boolean;
  setTeamTick: (mk: string, v: boolean) => void;
  locale: "tr" | "en";
  t: (k: string) => string;
}) {
  // Tüm sezon maçları, en yeni üstte (week desc → tarih desc; BSL tarihleri bazen bozuk).
  const sortedLogs = [...logs].sort((a, b) => (b.week ?? 0) - (a.week ?? 0) || String(b.match_date ?? "").localeCompare(String(a.match_date ?? "")));
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-ink"><TeamCrest slug={slug} name={name} size={24} />{name}</div>
      <table className="min-w-full border-collapse text-[12px]">
        <thead><tr className="border-b border-line text-[9px] uppercase tracking-[0.1em] text-ink-3">
          <th className="px-1.5 py-1 text-center"></th>
          <th className="px-1.5 py-1 text-left">{t("basketball.colMarket")}</th>
          <th className="px-1.5 py-1 text-right">{t("basketball.colAvg")}</th>
          <th className="px-1.5 py-1 text-right">{t("basketball.colLast10")}</th>
          <th className="px-1.5 py-1 text-right">{t("basketball.colModel")}</th>
          <th className="px-1.5 py-1 text-right">{t("basketball.colStd")}</th>
          <th className="px-1.5 py-1 text-right">{t("basketball.colTrader")}</th>
        </tr></thead>
        <tbody>
          {TEAM_MARKETS.map((met) => {
            const f = formBy.get(slug)?.get(met.key);
            const on = isTeamTicked(met.key);
            return (
              <tr key={met.key} className={`border-t border-line ${on ? "" : "opacity-45"}`}>
                <td className="px-1.5 py-0.5 text-center"><input type="checkbox" checked={on} onChange={(e) => setTeamTick(met.key, e.target.checked)} className="accent-[var(--accent)]" /></td>
                <td className="px-1.5 py-0.5 text-ink whitespace-nowrap">{metricLabel(met.key, locale, met.label)}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-3">{fmt(f?.season_avg)}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-3">{fmt(f?.last10_avg)}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-2">{fmt(teamModel(slug, met.key, eff))}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-3">{teamStd(met.key).toFixed(2)}</td>
                <td className="px-1.5 py-0.5 text-right"><NumInput value={Math.round(teamTrader(slug, met.key, eff) * 10) / 10} onChange={(v) => setTrader(met.key, v)} w="w-14" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* sezon maçları (en yeni üstte, tarihli) */}
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{t("basketball.recentMatches")}</div>
      <div className="mt-1 max-h-72 overflow-auto">
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
function PlayerDistPanel({ homeSlug, awaySlug, homeName, awayName, effHome, effAway, winBy, isTicked, setTick, playerValue, setVal, expRef, teamTarget, onAdd, playerIds, playerCfg, playerMarkets, fixExtId, t }: {
  homeSlug: string; awaySlug: string; homeName: string; awayName: string; effHome: number; effAway: number;
  winBy: Map<string, Map<string, BktPlayerWindowRow[]>>;
  isTicked: (s: string, mk: string, w: BktPlayerWindowRow) => boolean;
  setTick: (k: string, v: boolean) => void;
  playerValue: (s: string, mk: string, w: BktPlayerWindowRow, list: BktPlayerWindowRow[], e: number) => number;
  setVal: (k: string, v: number) => void;
  expRef: (s: string, mk: string, w: BktPlayerWindowRow, e: number) => number;
  teamTarget: (s: string, mk: string) => number;
  onAdd: (rows: BktInputRow[]) => void;
  playerIds: Record<string, string>;
  playerCfg: Map<string, PmMarketConfig>;
  playerMarkets: { key: string; base: string; label: string; std: number; tpl: string; distributable: boolean }[];
  fixExtId: string;
  t: (k: string) => string;
}) {
  const [side, setSide] = useState<"home" | "away">("home");
  const [mk, setMk] = useState(playerMarkets[0]?.key ?? "points");
  const [selPlayer, setSelPlayer] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "all", dir: "desc" });
  const slug = side === "home" ? homeSlug : awaySlug;
  const eff = side === "home" ? effHome : effAway;
  const met = playerMarkets.find((m) => m.key === mk) ?? playerMarkets[0];
  const allList = winBy.get(slug)?.get(met?.base ?? mk) ?? [];
  if (!met) return null;
  const sortVal = (w: BktPlayerWindowRow): number | string => {
    switch (sort.key) {
      case "player": return w.player_name;
      case "min": return w.avg_minutes ?? 0;
      case "matches": return w.games ?? 0;
      case "w5": return w.last5_avg ?? 0;
      case "w10": return w.last10_avg ?? 0;
      case "all": return w.season_avg ?? 0;
      case "exp": return expRef(slug, mk, w, eff);
      case "value": return playerValue(slug, mk, w, allList, eff);
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
  const distributed = allList.filter((w) => isTicked(slug, mk, w)).reduce((a, w) => a + playerValue(slug, mk, w, allList, eff), 0);

  // Ekle: bu takım+market'in tikli oyuncularının Config kurallarıyla üretilen çizgilerini Input'a gönder
  const addCurrent = () => {
    const rows: BktInputRow[] = [];
    const sideNum = side === "home" ? 1 : 2;
    const teamNm = side === "home" ? homeName : awayName;
    const cfg = playerCfg.get(mk);
    const std = (cfg?.std ?? met.std) as number;
    const tpl = cfg?.template_id ?? met.tpl;
    const lineCfg: LineConfig = cfg ?? DEFAULT_LINE_CFG;
    for (const w of allList) {
      if (!isTicked(slug, mk, w)) continue;
      const val = playerValue(slug, mk, w, allList, eff);
      for (const r of buildConfiguredLines(val, std, lineCfg, PROP_PAYBACK)) {
        rows.push({ kind: "player", fixtureExtId: fixExtId, template: tpl ?? met.tpl, participant: playerIds[w.player_slug] || w.player_slug, side: sideNum, line: r.line, over: r.overPrice, under: r.underPrice, marketLabel: met.label, playerName: w.player_name, teamName: teamNm });
      }
    }
    if (rows.length) onAdd(rows);
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
          <button onClick={addCurrent} className="ml-auto rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:opacity-90">
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
            <th className="px-2 py-1.5 text-center">{t("basketball.colInclude")}</th>
            <th className="px-2 py-1.5 text-left"><button onClick={() => toggleSort("player")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.player")}{arrow("player")}</button></th>
            <th className="px-2 py-1.5 text-right"><button onClick={() => toggleSort("min")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.minutesShort")}{arrow("min")}</button></th>
            <th className="px-2 py-1.5 text-right"><button onClick={() => toggleSort("matches")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.colMatches")}{arrow("matches")}</button></th>
            <th className="px-2 py-1.5 text-right"><button onClick={() => toggleSort("w5")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.w5")}{arrow("w5")}</button></th>
            <th className="px-2 py-1.5 text-right"><button onClick={() => toggleSort("w10")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.w10")}{arrow("w10")}</button></th>
            <th className="px-2 py-1.5 text-right"><button onClick={() => toggleSort("all")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.wAll")}{arrow("all")}</button></th>
            <th className="px-2 py-1.5 text-right"><button onClick={() => toggleSort("exp")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.expShort")}{arrow("exp")}</button></th>
            <th className="px-2 py-1.5 text-right"><button onClick={() => toggleSort("value")} className="uppercase tracking-[0.12em] hover:text-ink">{t("basketball.colValue")}{arrow("value")}</button></th>
            <th className="px-2 py-1.5 text-right">{t("basketball.colLineShort")}</th>
          </tr></thead>
          <tbody>
            {players.map((w) => {
              const on = isTicked(slug, mk, w);
              const k = `${slug}:${mk}:${w.player_slug}`;
              const val = playerValue(slug, mk, w, allList, eff);
              const mid = on ? buildLadder(val, met.std, PROP_PAYBACK).find((r) => r.isMid) : null;
              return (
                <tr key={w.player_slug} className={`border-t border-line ${on ? "" : "opacity-45"} ${selPlayer === w.player_slug ? "bg-veil" : ""}`}>
                  <td className="px-2 py-1 text-center"><input type="checkbox" checked={on} onChange={(e) => setTick(k, e.target.checked)} className="accent-[var(--accent)]" /></td>
                  <td className="px-2 py-1 whitespace-nowrap"><button onClick={() => setSelPlayer(w.player_slug === selPlayer ? null : w.player_slug)} className="text-ink hover:text-accent-ink">{w.player_name}</button></td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-3">{fmt(w.avg_minutes)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-3">{w.games}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-3">{fmt(w.last5_avg)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-3">{fmt(w.last10_avg)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-2">{fmt(w.season_avg)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-2">{fmt(expRef(slug, mk, w, eff))}</td>
                  <td className="px-2 py-1 text-right">{on ? <NumInput value={val} onChange={(v) => setVal(k, v)} /> : <span className="text-ink-3">-</span>}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-accent-ink">{mid ? `${mid.line.toFixed(1)} ${mid.overPrice.toFixed(2)}/${mid.underPrice.toFixed(2)}` : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-ink-3">{t("basketball.selectPlayerHint")}</p>
      {selPlayer ? <BasketballPlayerDrawer key={selPlayer} slug={selPlayer} onClose={() => setSelPlayer(null)} /> : null}
    </div>
  );
}
