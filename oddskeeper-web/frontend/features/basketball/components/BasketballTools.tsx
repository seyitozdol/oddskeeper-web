"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { buildLadder, moneyline } from "../odds";
import { PLAYER_MARKETS, TEAM_MARKETS, teamStd } from "../marketConfig";
import { fetchBasketballPlayerLog } from "../clientQueries";
import { TeamCrest } from "./ui";
import type { PmFixture } from "../pmQueries";
import type {
  BktHomeAwaySplitRow, BktTeamMetricFormRow, BktPlayerWindowRow,
  BktTeamLogRow, BktPlayerLogRow, BktInputRow,
} from "../types";

type Props = {
  pmFixtures: PmFixture[];
  splits: BktHomeAwaySplitRow[];
  forms: BktTeamMetricFormRow[];
  windows: BktPlayerWindowRow[];
  teamLogs: BktTeamLogRow[];
  playerIds: Record<string, string>;
  onAdd: (rows: BktInputRow[]) => void;
};

const PROP_PAYBACK = 0.915;

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

export default function BasketballTools({ pmFixtures, splits, forms, windows, teamLogs, playerIds, onAdd }: Props) {
  const { t } = useI18n();
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
    const target = teamTrader(slug, mk, effPts);
    return Math.round((target * w.total / tickedTotal(slug, mk, list)) * 10) / 10;
  };

  // Export
  const exportPlayers = () => {
    const rows = [["Team", "Player", "Market", "Template", "Line", "Over", "Under", "Value", "Std"]];
    for (const slug of [homeSlug, awaySlug]) {
      const effPts = slug === homeSlug ? effHome : effAway;
      for (const met of PLAYER_MARKETS) {
        const list = winBy.get(slug)?.get(met.key) ?? [];
        for (const w of list) {
          if (!isTicked(slug, met.key, w)) continue;
          const val = playerValue(slug, met.key, w, list, effPts);
          const mid = buildLadder(val, met.std, PROP_PAYBACK).find((r) => r.isMid)!;
          rows.push([w.team_name, w.player_name, met.label, met.tpl, mid.line.toFixed(1), mid.overPrice.toFixed(2), mid.underPrice.toFixed(2), val.toFixed(1), met.std.toFixed(2)]);
        }
      }
    }
    download(`basketbol_oyuncu_${homeSlug}_${awaySlug}.csv`, rows.map((r) => r.join(",")).join("\n"));
  };
  const exportTeams = () => {
    const rows = [["Team", "Side", "Market", "Line", "Over", "Under", "Value", "Std"]];
    for (const slug of [homeSlug, awaySlug]) {
      const effPts = slug === homeSlug ? effHome : effAway;
      const side = slug === homeSlug ? "Home" : "Away";
      const name = splitBy.get(slug)?.team_name ?? slug;
      for (const met of TEAM_MARKETS) {
        const val = teamTrader(slug, met.key, effPts);
        const mid = buildLadder(val, teamStd(met.key), 0.96).find((r) => r.isMid)!;
        rows.push([name, side, met.label, mid.line.toFixed(1), mid.overPrice.toFixed(2), mid.underPrice.toFixed(2), val.toFixed(1), teamStd(met.key).toFixed(2)]);
      }
    }
    download(`basketbol_takim_${homeSlug}_${awaySlug}.csv`, rows.map((r) => r.join(",")).join("\n"));
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
            <div className="flex items-center gap-2"><TeamCrest slug={homeSlug} name={home.team_name} size={22} />
              <NumInput value={effHome} onChange={(v) => setPtsOv((p) => ({ ...p, h: v }))} /></div>
            <span className="text-ink-3">–</span>
            <div className="flex items-center gap-2"><NumInput value={effAway} onChange={(v) => setPtsOv((p) => ({ ...p, a: v }))} />
              <TeamCrest slug={awaySlug} name={away.team_name} size={22} /></div>
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
            <div className="grid gap-6 lg:grid-cols-2">
              {[{ slug: homeSlug, eff: effHome, s: home }, { slug: awaySlug, eff: effAway, s: away }].map(({ slug, eff, s }) => (
                <TeamPanel key={slug} slug={slug} name={s.team_name} eff={eff} formBy={formBy} teamTrader={teamTrader}
                  setTrader={(mk, v) => setTraderMetric((p) => ({ ...p, [`${slug}:${mk}`]: v }))} teamModel={teamModel} logs={logsBy.get(slug) ?? []} t={t} />
              ))}
            </div>
          ) : (
            <PlayerDistPanel homeSlug={homeSlug} awaySlug={awaySlug} homeName={home.team_name} awayName={away.team_name}
              effHome={effHome} effAway={effAway} winBy={winBy} isTicked={isTicked} setTick={(k, v) => setTicks((p) => ({ ...p, [k]: v }))}
              playerValue={playerValue} setVal={(k, v) => setPlayerVal((p) => ({ ...p, [k]: v }))} expRef={expRef}
              teamTarget={(slug, mk) => teamTrader(slug, mk, slug === homeSlug ? effHome : effAway)}
              onAdd={onAdd} playerIds={playerIds} fixExtId={fixExtId} t={t} />
          )}

          {/* export */}
          <div className="flex flex-wrap gap-3 border-t border-line pt-4">
            <button onClick={exportPlayers} className="rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90">{t("basketball.exportPlayers")}</button>
            <button onClick={exportTeams} className="rounded-md border border-line px-4 py-2 text-[13px] font-semibold text-ink-2 hover:text-ink">{t("basketball.exportTeams")}</button>
          </div>
        </>
      ) : (<p className="text-sm text-ink-3">{t("basketball.matchPickTeams")}</p>)}
    </div>
  );
}

/* ---------- Team panel: metrik tablosu + son maçlar ---------- */
function TeamPanel({ slug, name, eff, formBy, teamTrader, setTrader, teamModel, logs, t }: {
  slug: string; name: string; eff: number;
  formBy: Map<string, Map<string, BktTeamMetricFormRow>>;
  teamTrader: (s: string, mk: string, e: number) => number;
  setTrader: (mk: string, v: number) => void;
  teamModel: (s: string, mk: string, e: number) => number;
  logs: BktTeamLogRow[]; t: (k: string) => string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-ink"><TeamCrest slug={slug} name={name} size={18} />{name}</div>
      <table className="min-w-full border-collapse text-[13px]">
        <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
          <th className="px-2 py-1.5 text-left">{t("basketball.colMarket")}</th>
          <th className="px-2 py-1.5 text-right">{t("basketball.colAvg")}</th>
          <th className="px-2 py-1.5 text-right">{t("basketball.colLast10")}</th>
          <th className="px-2 py-1.5 text-right">{t("basketball.colModel")}</th>
          <th className="px-2 py-1.5 text-right">{t("basketball.colStd")}</th>
          <th className="px-2 py-1.5 text-right">{t("basketball.colTrader")}</th>
        </tr></thead>
        <tbody>
          {TEAM_MARKETS.map((met) => {
            const f = formBy.get(slug)?.get(met.key);
            return (
              <tr key={met.key} className="border-t border-line">
                <td className="px-2 py-1 text-ink">{met.label}</td>
                <td className="px-2 py-1 text-right tabular-nums text-ink-3">{fmt(f?.season_avg)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-ink-3">{fmt(f?.last10_avg)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-ink-2">{fmt(teamModel(slug, met.key, eff))}</td>
                <td className="px-2 py-1 text-right tabular-nums text-ink-3">{teamStd(met.key).toFixed(2)}</td>
                <td className="px-2 py-1 text-right"><NumInput value={Math.round(teamTrader(slug, met.key, eff) * 10) / 10} onChange={(v) => setTrader(met.key, v)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* son maçlar */}
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{t("basketball.recentMatches")}</div>
      <div className="mt-1 overflow-x-auto">
        <table className="min-w-full border-collapse text-[12px]">
          <thead><tr className="text-[9px] uppercase tracking-[0.1em] text-ink-3">
            <th className="px-1.5 py-1 text-left">{t("basketball.opponent")}</th>
            <th className="px-1.5 py-1 text-right">Sayı</th><th className="px-1.5 py-1 text-right">Rib</th><th className="px-1.5 py-1 text-right">As</th>
            <th className="px-1.5 py-1 text-right">3S</th><th className="px-1.5 py-1 text-right">TÇ</th><th className="px-1.5 py-1 text-right">Blk</th><th className="px-1.5 py-1 text-right">TK</th>
          </tr></thead>
          <tbody>
            {logs.slice(0, 10).map((m) => (
              <tr key={m.match_key + m.match_date} className="border-t border-line">
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
function PlayerDistPanel({ homeSlug, awaySlug, homeName, awayName, effHome, effAway, winBy, isTicked, setTick, playerValue, setVal, expRef, teamTarget, onAdd, playerIds, fixExtId, t }: {
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
  fixExtId: string;
  t: (k: string) => string;
}) {
  const [side, setSide] = useState<"home" | "away">("home");
  const [mk, setMk] = useState("points");
  const [selPlayer, setSelPlayer] = useState<string | null>(null);
  const [log, setLog] = useState<BktPlayerLogRow[]>([]);
  const slug = side === "home" ? homeSlug : awaySlug;
  const eff = side === "home" ? effHome : effAway;
  const met = PLAYER_MARKETS.find((m) => m.key === mk)!;
  const allList = winBy.get(slug)?.get(mk) ?? [];
  const players = allList.filter((w) => w.avg_minutes >= 5 || w.season_avg >= 1);
  const target = teamTarget(slug, mk);
  const distributed = allList.filter((w) => isTicked(slug, mk, w)).reduce((a, w) => a + playerValue(slug, mk, w, allList, eff), 0);

  // Ekle: bu takım+market'in tikli oyuncularının mid±2 çizgilerini Input'a gönder
  const addCurrent = () => {
    const rows: BktInputRow[] = [];
    const sideNum = side === "home" ? 1 : 2;
    const teamNm = side === "home" ? homeName : awayName;
    for (const w of allList) {
      if (!isTicked(slug, mk, w)) continue;
      const val = playerValue(slug, mk, w, allList, eff);
      const ladder = buildLadder(val, met.std, PROP_PAYBACK);
      const midIdx = Math.max(0, ladder.findIndex((r) => r.isMid));
      for (let i = Math.max(0, midIdx - 2); i <= Math.min(ladder.length - 1, midIdx + 2); i++) {
        const r = ladder[i];
        rows.push({ fixtureExtId: fixExtId, template: met.tpl, participant: playerIds[w.player_slug] || w.player_slug, side: sideNum, line: r.line, over: r.overPrice, under: r.underPrice, marketLabel: met.label, playerName: w.player_name, teamName: teamNm });
      }
    }
    if (rows.length) onAdd(rows);
  };

  useEffect(() => {
    if (!selPlayer) return;
    let alive = true;
    fetchBasketballPlayerLog(selPlayer).then((r) => { if (alive) setLog(r); });
    return () => { alive = false; };
  }, [selPlayer]);

  const logVal = (m: BktPlayerLogRow): number => {
    switch (mk) {
      case "points": return m.points ?? 0; case "rebounds": return m.treb ?? 0; case "assists": return m.assists ?? 0;
      case "threes": return m.fg3m ?? 0; case "twos": return m.fg2m ?? 0; case "ftm": return m.ftm ?? 0;
      case "steals": return m.steals ?? 0; case "blocks": return m.blocks ?? 0; case "turnovers": return m.turnovers ?? 0;
      case "pra": return m.pra ?? 0; case "pa": return m.pa ?? 0; case "pr": return m.pr ?? 0; default: return 0;
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {(["home", "away"] as const).map((sd) => (
            <button key={sd} onClick={() => { setSide(sd); setSelPlayer(null); }} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${side === sd ? "bg-accent text-white" : "bg-card-2 text-ink-3 hover:text-ink"}`}>{sd === "home" ? homeName : awayName}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PLAYER_MARKETS.map((m) => (
            <button key={m.key} onClick={() => { setMk(m.key); setSelPlayer(null); }} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${m.key === mk ? "bg-accent-soft text-accent-ink" : "bg-card-2 text-ink-3 hover:text-ink"}`}>{m.label}</button>
          ))}
        </div>
        <span className="ml-auto text-[12px] text-ink-3">
          {t("basketball.distTarget")}: <span className="font-semibold text-accent-ink">{fmt(target)}</span>
          {" · "}{t("basketball.distSum")}: <span className={`font-semibold ${Math.abs(distributed - target) <= target * 0.03 ? "text-pos" : "text-neg"}`}>{fmt(distributed)}</span>
          {" · Std "}{met.std}
        </span>
        <button onClick={addCurrent} className="rounded-md border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-[12px] font-semibold text-teal-300 hover:bg-teal-500/20">
          {t("basketball.addToInput")}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[13px]">
          <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
            <th className="px-2 py-1.5 text-center">{t("basketball.colInclude")}</th>
            <th className="px-2 py-1.5 text-left">{t("basketball.player")}</th>
            <th className="px-2 py-1.5 text-right">{t("basketball.minutesShort")}</th>
            <th className="px-2 py-1.5 text-right">{t("basketball.w5")}</th>
            <th className="px-2 py-1.5 text-right">{t("basketball.w10")}</th>
            <th className="px-2 py-1.5 text-right">{t("basketball.wAll")}</th>
            <th className="px-2 py-1.5 text-right">{t("basketball.expShort")}</th>
            <th className="px-2 py-1.5 text-right">{t("basketball.colValue")}</th>
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

      {/* seçili oyuncunun son maçları */}
      {selPlayer ? (
        <div className="mt-4 rounded-lg border border-line bg-veil p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{t("basketball.recentMatches")} — {met.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {log.map((m) => (
              <div key={m.match_key + m.match_date} className="rounded border border-line bg-card px-2 py-1 text-center">
                <div className="text-[9px] text-ink-3">{m.opponent_name?.slice(0, 10)}</div>
                <div className="text-sm font-semibold tabular-nums text-ink">{logVal(m)}</div>
              </div>
            ))}
            {log.length === 0 ? <span className="text-[11px] text-ink-3">…</span> : null}
          </div>
        </div>
      ) : (<p className="mt-3 text-[11px] text-ink-3">{t("basketball.selectPlayerHint")}</p>)}
    </div>
  );
}
