"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { buildLadder, moneyline } from "../odds";
import { TeamCrest } from "./ui";
import type { BktHomeAwaySplitRow, BktTeamMetricFormRow, BktPlayerShareRow } from "../types";

type Props = {
  splits: BktHomeAwaySplitRow[];
  forms: BktTeamMetricFormRow[];
  shares: BktPlayerShareRow[];
};

// dağıtılacak / gösterilecek metrikler + platform şablon kodu (oyuncu)
const METRICS: { key: string; label: string; tpl: string }[] = [
  { key: "points", label: "Sayı", tpl: "PPOINTS" },
  { key: "rebounds", label: "Ribaund", tpl: "PREB" },
  { key: "assists", label: "Asist", tpl: "PAST" },
  { key: "threes", label: "3 Sayı", tpl: "P3PTM" },
  { key: "twos", label: "2 Sayı", tpl: "P2PTSM" },
  { key: "ftm", label: "Serbest Atış", tpl: "PFTRWM" },
  { key: "steals", label: "Top Çalma", tpl: "PSTL" },
  { key: "blocks", label: "Blok", tpl: "PBLCK" },
  { key: "turnovers", label: "Top Kaybı", tpl: "PTURNOVR" },
];
const PROP_PAYBACK = 0.915;

function num(v: number | null | undefined, d = 1) {
  if (v == null || Number.isNaN(v)) return "-";
  return Number(v).toFixed(d);
}

function download(name: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Modül seviyesinde (render'da yeniden tanımlanmasın → input focus kaybı olmasın)
function NumInput({ value, onChange, step = 0.1, w = "w-20" }: { value: number; onChange: (v: number) => void; step?: number; w?: string }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onChange(v); }}
      className={`${w} rounded-md border border-line bg-field px-2 py-1 text-right text-[13px] tabular-nums text-ink outline-none focus:border-line-strong`}
    />
  );
}
function TeamSelect({ value, onChange, label, teams }: { value: string; onChange: (v: string) => void; label: string; teams: BktHomeAwaySplitRow[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink outline-none focus:border-line-strong">
        {teams.map((tm) => (<option key={tm.team_slug} value={tm.team_slug}>{tm.team_name}</option>))}
      </select>
    </label>
  );
}

export default function BasketballTools({ splits, forms, shares }: Props) {
  const { t } = useI18n();

  const teams = useMemo(
    () => [...splits].sort((a, b) => a.team_name.localeCompare(b.team_name, "tr")),
    [splits]
  );
  const splitBy = useMemo(() => new Map(splits.map((s) => [s.team_slug, s])), [splits]);
  const formBy = useMemo(() => {
    const m = new Map<string, Map<string, BktTeamMetricFormRow>>();
    for (const f of forms) {
      if (!m.has(f.team_slug)) m.set(f.team_slug, new Map());
      m.get(f.team_slug)!.set(f.market_key, f);
    }
    return m;
  }, [forms]);
  const sharesBy = useMemo(() => {
    const m = new Map<string, Map<string, BktPlayerShareRow[]>>();
    for (const s of shares) {
      if (!m.has(s.team_slug)) m.set(s.team_slug, new Map());
      const tm = m.get(s.team_slug)!;
      if (!tm.has(s.market_key)) tm.set(s.market_key, []);
      tm.get(s.market_key)!.push(s);
    }
    for (const tm of m.values()) for (const arr of tm.values()) arr.sort((a, b) => b.share - a.share);
    return m;
  }, [shares]);
  const lgAvg = useMemo(() => {
    const v = splits.map((s) => s.ppg).filter((x) => x > 0);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 80;
  }, [splits]);

  const [homeSlug, setHomeSlug] = useState(teams[0]?.team_slug ?? "");
  const [awaySlug, setAwaySlug] = useState(teams[1]?.team_slug ?? "");

  const home = splitBy.get(homeSlug);
  const away = splitBy.get(awaySlug);

  // ---- Adım 1: maç sayıları (ev/deplasman + rakip ayarlı) ----
  const modelHome = home && away && home.home_pf && away.away_pa ? (home.home_pf * away.away_pa) / lgAvg : 0;
  const modelAway = home && away && away.away_pf && home.home_pa ? (away.away_pf * home.home_pa) / lgAvg : 0;
  const [ptsOv, setPtsOv] = useState<{ h: number | null; a: number | null }>({ h: null, a: null });
  const effHome = ptsOv.h ?? Math.round(modelHome * 10) / 10;
  const effAway = ptsOv.a ?? Math.round(modelAway * 10) / 10;
  const ml = useMemo(() => {
    const hs = home?.home_pf_std ?? 11;
    const as = away?.away_pf_std ?? 11;
    return moneyline(effHome, hs, effAway, as, PROP_PAYBACK);
  }, [effHome, effAway, home, away]);

  // ---- Adım 2: takım metrik projeksiyonu ----
  const [traderMetric, setTraderMetric] = useState<Record<string, number>>({});
  const teamProjection = (slug: string, effPts: number) => {
    const fm = formBy.get(slug);
    const ptsAvg = fm?.get("points")?.season_avg ?? 1;
    return METRICS.map((met) => {
      const f = fm?.get(met.key);
      const avg = f?.season_avg ?? 0;
      const last10 = f?.last10_avg ?? avg;
      const model = met.key === "points" ? effPts : (effPts / (ptsAvg || 1)) * last10;
      const key = `${slug}:${met.key}`;
      const trader = traderMetric[key] ?? Math.round(model * 10) / 10;
      return { met, avg, last10, model, trader, std: f?.std ?? 0 };
    });
  };
  const setTrader = (slug: string, mk: string, v: number) =>
    setTraderMetric((p) => ({ ...p, [`${slug}:${mk}`]: v }));
  const traderVal = (slug: string, mk: string, fallbackEffPts: number) => {
    const key = `${slug}:${mk}`;
    if (traderMetric[key] != null) return traderMetric[key];
    const fm = formBy.get(slug);
    const ptsAvg = fm?.get("points")?.season_avg ?? 1;
    const last10 = fm?.get(mk)?.last10_avg ?? fm?.get(mk)?.season_avg ?? 0;
    return mk === "points" ? fallbackEffPts : Math.round(((fallbackEffPts / (ptsAvg || 1)) * last10) * 10) / 10;
  };

  // ---- Adım 3: oyuncu dağıtımı ----
  const [distTeam, setDistTeam] = useState<"home" | "away">("home");
  const [distMetric, setDistMetric] = useState("points");
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [playerVal, setPlayerVal] = useState<Record<string, number>>({});
  const distSlug = distTeam === "home" ? homeSlug : awaySlug;
  const distEffPts = distTeam === "home" ? effHome : effAway;
  const distTargetVal = traderVal(distSlug, distMetric, distEffPts);
  const distPlayers = sharesBy.get(distSlug)?.get(distMetric) ?? [];

  const isTicked = (pslug: string) => {
    const k = `${distSlug}:${distMetric}:${pslug}`;
    if (ticks[k] != null) return ticks[k];
    // varsayılan: dakika>=12 ve pay>=%4 olan prime oyuncular
    const row = distPlayers.find((x) => x.player_slug === pslug);
    return !!row && row.avg_minutes >= 12 && row.share >= 0.04;
  };
  const tickedShareSum = distPlayers.filter((p) => isTicked(p.player_slug)).reduce((a, p) => a + p.share, 0) || 1;
  const suggestedFor = (p: BktPlayerShareRow) =>
    isTicked(p.player_slug) ? (distTargetVal * p.share) / tickedShareSum : 0;
  const valueFor = (p: BktPlayerShareRow) => {
    const k = `${distSlug}:${distMetric}:${p.player_slug}`;
    return playerVal[k] ?? Math.round(suggestedFor(p) * 10) / 10;
  };
  const distributed = distPlayers.filter((p) => isTicked(p.player_slug)).reduce((a, p) => a + valueFor(p), 0);

  // ---- Adım 4: export ----
  // tick durumunu takım/metrik bağımsız hesapla (export için)
  const isTickedFor = (slug: string, mk: string, p: BktPlayerShareRow) => {
    const k = `${slug}:${mk}:${p.player_slug}`;
    if (ticks[k] != null) return ticks[k];
    return p.avg_minutes >= 12 && p.share >= 0.04;
  };
  const exportPlayers = () => {
    const rows = [["Team", "Player", "Market", "Template", "Line", "Over", "Under", "Value", "Std"]];
    for (const slug of [homeSlug, awaySlug]) {
      const effPts = slug === homeSlug ? effHome : effAway;
      for (const met of METRICS) {
        const target = traderVal(slug, met.key, effPts);
        const players = sharesBy.get(slug)?.get(met.key) ?? [];
        const tickedSum = players.filter((p) => isTickedFor(slug, met.key, p)).reduce((a, p) => a + p.share, 0) || 1;
        for (const p of players) {
          if (!isTickedFor(slug, met.key, p)) continue;
          const k = `${slug}:${met.key}:${p.player_slug}`;
          const val = playerVal[k] ?? Math.round(((target * p.share) / tickedSum) * 10) / 10;
          const ladder = buildLadder(val, p.std || 1, PROP_PAYBACK);
          const mid = ladder.find((r) => r.isMid) ?? ladder[0];
          rows.push([p.team_name, p.player_name, met.label, met.tpl, mid.line.toFixed(1), mid.overPrice.toFixed(2), mid.underPrice.toFixed(2), val.toFixed(1), (p.std || 0).toFixed(2)]);
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
      for (const met of METRICS) {
        const val = traderVal(slug, met.key, effPts);
        const std = formBy.get(slug)?.get(met.key)?.std ?? 1;
        const ladder = buildLadder(val, std || 1, 0.96);
        const mid = ladder.find((r) => r.isMid) ?? ladder[0];
        rows.push([name, side, met.label, mid.line.toFixed(1), mid.overPrice.toFixed(2), mid.underPrice.toFixed(2), val.toFixed(1), (std || 0).toFixed(2)]);
      }
    }
    download(`basketbol_takim_${homeSlug}_${awaySlug}.csv`, rows.map((r) => r.join(",")).join("\n"));
  };

  return (
    <div className="space-y-8">
      {/* takım seçimi */}
      <div className="flex flex-wrap items-end gap-4">
        <TeamSelect value={homeSlug} onChange={setHomeSlug} label={t("basketball.matchHome")} teams={teams} />
        <span className="pb-2 text-ink-3">vs</span>
        <TeamSelect value={awaySlug} onChange={setAwaySlug} label={t("basketball.matchAway")} teams={teams} />
      </div>

      {home && away && homeSlug !== awaySlug ? (
        <>
          {/* ADIM 1 */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.step1")}</h2>
            <div className="flex flex-wrap gap-4">
              {[{ s: home, eff: effHome, isH: true }, { s: away, eff: effAway, isH: false }].map(({ s, eff, isH }) => (
                <div key={s.team_slug} className="flex items-center gap-3 rounded-lg border border-line bg-veil px-4 py-3">
                  <TeamCrest slug={s.team_slug} name={s.team_name} size={28} />
                  <div>
                    <div className="text-[11px] text-ink-3">{s.team_name} · {isH ? t("basketball.matchHome") : t("basketball.matchAway")}</div>
                    <div className="flex items-center gap-2">
                      <NumInput value={eff} onChange={(v) => setPtsOv((p) => (isH ? { ...p, h: v } : { ...p, a: v }))} />
                      <span className="text-[10px] text-ink-3">({t("basketball.colModel")} {num(isH ? modelHome : modelAway)})</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex flex-col justify-center gap-1 rounded-lg border border-line bg-veil px-4 py-3 text-sm">
                <div><span className="text-ink-3">{t("basketball.matchTotal")}: </span><span className="font-semibold text-accent-ink">{num(effHome + effAway)}</span></div>
                <div><span className="text-ink-3">{t("basketball.matchMoneyline")}: </span><span className="font-semibold text-ink">{ml.homePrice.toFixed(2)} / {ml.awayPrice.toFixed(2)}</span></div>
              </div>
            </div>
          </section>

          {/* ADIM 2 */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.step2")}</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              {[{ slug: homeSlug, eff: effHome, s: home }, { slug: awaySlug, eff: effAway, s: away }].map(({ slug, eff, s }) => (
                <div key={slug}>
                  <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-ink"><TeamCrest slug={slug} name={s.team_name} size={18} />{s.team_name}</div>
                  <table className="min-w-full border-collapse text-[13px]">
                    <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
                      <th className="px-2 py-1.5 text-left">{t("basketball.colMarket")}</th>
                      <th className="px-2 py-1.5 text-right">{t("basketball.colAvg")}</th>
                      <th className="px-2 py-1.5 text-right">{t("basketball.colLast10")}</th>
                      <th className="px-2 py-1.5 text-right">{t("basketball.colModel")}</th>
                      <th className="px-2 py-1.5 text-right">{t("basketball.colTrader")}</th>
                    </tr></thead>
                    <tbody>
                      {teamProjection(slug, eff).map((r) => (
                        <tr key={r.met.key} className="border-t border-line">
                          <td className="px-2 py-1 text-ink">{r.met.label}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-ink-3">{num(r.avg)}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-ink-3">{num(r.last10)}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-ink-2">{num(r.model)}</td>
                          <td className="px-2 py-1 text-right"><NumInput value={Math.round(r.trader * 10) / 10} onChange={(v) => setTrader(slug, r.met.key, v)} w="w-16" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>

          {/* ADIM 3 */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.step3")}</h2>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="flex gap-1.5">
                {(["home", "away"] as const).map((sd) => (
                  <button key={sd} onClick={() => setDistTeam(sd)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${distTeam === sd ? "bg-accent text-white" : "bg-card-2 text-ink-3 hover:text-ink"}`}>
                    {sd === "home" ? home.team_name : away.team_name}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {METRICS.map((m) => (
                  <button key={m.key} onClick={() => setDistMetric(m.key)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${m.key === distMetric ? "bg-accent-soft text-accent-ink" : "bg-card-2 text-ink-3 hover:text-ink"}`}>{m.label}</button>
                ))}
              </div>
            </div>
            <div className="mb-2 flex flex-wrap gap-4 text-[12px]">
              <span className="text-ink-3">{t("basketball.distTarget")}: <span className="font-semibold text-accent-ink">{num(distTargetVal)}</span></span>
              <span className="text-ink-3">{t("basketball.distSum")}: <span className={`font-semibold ${Math.abs(distributed - distTargetVal) <= distTargetVal * 0.05 ? "text-pos" : "text-neg"}`}>{num(distributed)}</span></span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full max-w-2xl border-collapse text-[13px]">
                <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
                  <th className="px-2 py-1.5 text-center">{t("basketball.colInclude")}</th>
                  <th className="px-2 py-1.5 text-left">{t("basketball.player")}</th>
                  <th className="px-2 py-1.5 text-right">{t("basketball.minutesShort")}</th>
                  <th className="px-2 py-1.5 text-right">{t("basketball.colShare")}</th>
                  <th className="px-2 py-1.5 text-right">{t("basketball.colSuggested")}</th>
                  <th className="px-2 py-1.5 text-right">{t("basketball.colValue")}</th>
                </tr></thead>
                <tbody>
                  {distPlayers.filter((p) => p.avg_minutes >= 5 || p.share >= 0.02).map((p) => {
                    const on = isTicked(p.player_slug);
                    const k = `${distSlug}:${distMetric}:${p.player_slug}`;
                    return (
                      <tr key={p.player_slug} className={`border-t border-line ${on ? "" : "opacity-45"}`}>
                        <td className="px-2 py-1 text-center">
                          <input type="checkbox" checked={on} onChange={(e) => setTicks((pr) => ({ ...pr, [k]: e.target.checked }))} className="accent-[var(--accent)]" />
                        </td>
                        <td className="px-2 py-1 text-ink whitespace-nowrap">{p.player_name}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-ink-3">{num(p.avg_minutes)}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-ink-3">{(p.share * 100).toFixed(1)}%</td>
                        <td className="px-2 py-1 text-right tabular-nums text-ink-2">{num(suggestedFor(p))}</td>
                        <td className="px-2 py-1 text-right">{on ? <NumInput value={valueFor(p)} onChange={(v) => setPlayerVal((pr) => ({ ...pr, [k]: v }))} w="w-16" /> : <span className="text-ink-3">-</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ADIM 4 */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.step4")}</h2>
            <div className="flex flex-wrap gap-3">
              <button onClick={exportPlayers} className="rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90">{t("basketball.exportPlayers")}</button>
              <button onClick={exportTeams} className="rounded-md border border-line px-4 py-2 text-[13px] font-semibold text-ink-2 hover:text-ink">{t("basketball.exportTeams")}</button>
            </div>
            <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-ink-3">{t("basketball.exportNote")}</p>
          </section>
        </>
      ) : (
        <p className="text-sm text-ink-3">{t("basketball.matchPickTeams")}</p>
      )}
    </div>
  );
}
