"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { fetchMatchPredictions, type MatchPrediction } from "./queries";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function probToOdds(prob: number, payback: number): string {
  if (!prob || prob <= 0) return "—";
  const odds = (payback / 100) / prob;
  if (odds > 99 || !isFinite(odds)) return "—";
  return odds.toFixed(2);
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("tr-TR", {
    weekday: "short", day: "numeric", month: "short"
  });
}

// Group predictions by date
function groupByDate(preds: MatchPrediction[]): Record<string, MatchPrediction[]> {
  const groups: Record<string, MatchPrediction[]> = {};
  for (const p of preds) {
    if (!groups[p.fixture_date]) groups[p.fixture_date] = [];
    groups[p.fixture_date].push(p);
  }
  return groups;
}

// ─── Outcome bar ─────────────────────────────────────────────────────────────

function OutcomeBar({ home, draw, away }: { home: number; draw: number; away: number }) {
  return (
    <div className="flex w-full overflow-hidden rounded-full" style={{ height: "8px" }}>
      <div className="bg-teal-400/80"    style={{ width: `${home * 100}%` }} />
      <div className="bg-white/30"       style={{ width: `${draw * 100}%` }} />
      <div className="bg-orange-400/80"  style={{ width: `${away * 100}%` }} />
    </div>
  );
}

// ─── Over/under 2.5 via Poisson ──────────────────────────────────────────────

function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function calcOverUnder25(homeXg: number, awayXg: number): { over: number; under: number } {
  let under = 0;
  for (let h = 0; h <= 9; h++)
    for (let a = 0; a <= 9; a++)
      if (h + a <= 2) under += poissonPmf(h, homeXg) * poissonPmf(a, awayXg);
  return { over: 1 - under, under };
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ prediction: p, payback }: { prediction: MatchPrediction; payback: number }) {
  const { t } = useI18n();
  const homeOdds = probToOdds(p.home_win_prob, payback);
  const drawOdds = probToOdds(p.draw_prob, payback);
  const awayOdds = probToOdds(p.away_win_prob, payback);
  const max = Math.max(p.home_win_prob, p.draw_prob, p.away_win_prob);
  const isHomeFav = p.home_win_prob === max;
  const isDrawFav = p.draw_prob === max;
  const isAwayFav = p.away_win_prob === max;
  const { over, under } = calcOverUnder25(p.home_xg, p.away_xg);
  const overOdds  = probToOdds(over, payback);
  const underOdds = probToOdds(under, payback);
  const isOverFav = over >= under;

  const cell = (
    label: string, odds: string,
    fav: boolean, scheme: "teal" | "yellow" | "orange"
  ) => {
    const bg = {
      teal:   fav ? "border-teal-500/40 bg-teal-500/10"    : "border-white/[0.07] bg-white/[0.02]",
      yellow: fav ? "border-yellow-500/40 bg-yellow-500/10" : "border-white/[0.07] bg-white/[0.02]",
      orange: fav ? "border-orange-500/40 bg-orange-500/10" : "border-white/[0.07] bg-white/[0.02]",
    }[scheme];
    const textColor = fav
      ? scheme === "teal" ? "text-teal-300" : scheme === "yellow" ? "text-yellow-300" : "text-orange-300"
      : "text-white/60";
    return (
      <div key={label} className={`rounded-[6px] border flex flex-col items-center justify-center py-2 gap-0.5 ${bg}`}>
        <div className="text-[9px] uppercase tracking-widest text-white/35">{label}</div>
        <div className={`text-[15px] font-bold tabular-nums leading-none ${textColor}`}>{odds}</div>
      </div>
    );
  };

  return (
    <div className="rounded-[10px] border border-white/10 bg-[#0b1523] overflow-hidden">

      {/* Bar — ince, tam genişlik üstte */}
      <div className="flex h-1 w-full">
        <div className="bg-teal-400/70"   style={{ width: `${p.home_win_prob * 100}%` }} />
        <div className="bg-white/30"      style={{ width: `${p.draw_prob * 100}%` }} />
        <div className="bg-orange-400/70" style={{ width: `${p.away_win_prob * 100}%` }} />
      </div>

      {/* İçerik */}
      <div className="flex items-center gap-3 px-3 py-2.5">

        {/* Sol: takım isimleri üst üste */}
        <div className="min-w-0 w-[42%] flex flex-col gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-[13px] font-semibold truncate ${isHomeFav ? "text-white" : "text-white/65"}`}>
              {p.home_team_name}
            </span>
            <span className="text-[10px] text-white/25 shrink-0">xG {p.home_xg.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-[13px] font-semibold truncate ${isAwayFav ? "text-white" : "text-white/65"}`}>
              {p.away_team_name}
            </span>
            <span className="text-[10px] text-white/25 shrink-0">xG {p.away_xg.toFixed(2)}</span>
          </div>
        </div>

        {/* Sağ: oranlar yan yana */}
        <div className="flex items-center gap-1 shrink-0 flex-1 justify-end">

          {/* yarım kutu boşluk */}
          <div className="w-7" />

          {/* 1X2 */}
          {[
            { label: "1", odds: homeOdds, fav: isHomeFav,  color: "teal"   },
            { label: "X", odds: drawOdds, fav: isDrawFav,  color: "yellow" },
            { label: "2", odds: awayOdds, fav: isAwayFav,  color: "orange" },
          ].map(({ label, odds, fav, color }) => {
            const tc = fav
              ? color === "teal" ? "text-teal-300" : color === "yellow" ? "text-yellow-300" : "text-orange-300"
              : "text-white/60";
            const bc = fav
              ? color === "teal" ? "border-teal-500/40 bg-teal-500/10"
              : color === "yellow" ? "border-yellow-500/40 bg-yellow-500/10"
              : "border-orange-500/40 bg-orange-500/10"
              : "border-white/[0.07] bg-white/[0.02]";
            return (
              <div key={label} className={`rounded-[6px] border flex flex-col items-center justify-center w-[84px] py-1.5 ${bc}`}>
                <div className="text-[8px] uppercase tracking-wider text-white/30">{label}</div>
                <div className={`text-[14px] font-bold tabular-nums leading-tight ${tc}`}>{odds}</div>
              </div>
            );
          })}

          {/* 1 kutu boşluk */}
          <div className="w-[84px]" />

          {/* Üst / Alt */}
          {[
            { label: t("matchPredictions.overLabel"), odds: overOdds,  fav: isOverFav,  color: "teal"   },
            { label: t("matchPredictions.underLabel"), odds: underOdds, fav: !isOverFav, color: "orange" },
          ].map(({ label, odds, fav, color }) => {
            const tc = fav
              ? color === "teal" ? "text-teal-300" : "text-orange-300"
              : "text-white/60";
            const bc = fav
              ? color === "teal" ? "border-teal-500/40 bg-teal-500/10" : "border-orange-500/40 bg-orange-500/10"
              : "border-white/[0.07] bg-white/[0.02]";
            return (
              <div key={label} className={`rounded-[6px] border flex flex-col items-center justify-center w-[84px] py-1.5 ${bc}`}>
                <div className="text-[8px] uppercase tracking-wider text-white/30">{label}</div>
                <div className={`text-[14px] font-bold tabular-nums leading-tight ${tc}`}>{odds}</div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MatchPredictionsPage() {
  const { t } = useI18n();
  const [predictions, setPredictions] = useState<MatchPrediction[]>([]);
  const [loading, setLoading]         = useState(true);
  const [payback, setPayback]         = useState<string>("93");

  useEffect(() => {
    fetchMatchPredictions().then((data) => {
      setPredictions(data);
      setLoading(false);
    });
  }, []);

  const paybackNum = Math.min(100, Math.max(50, parseFloat(payback) || 93));
  const grouped    = useMemo(() => groupByDate(predictions), [predictions]);
  const dates      = Object.keys(grouped).sort();

  return (
    <div className="w-full space-y-6 px-1">

      {/* Header */}
      <div className="rounded-[14px] border border-white/10 bg-[#0d1624] px-5 py-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-[18px] font-bold text-white">{t("nav.matchPredictions")}</h1>
              <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-400 uppercase tracking-wide">
                v3
              </span>
            </div>
            <p className="text-[12px] text-white/40">
              {t("matchPredictions.modelDescriptionLabel")}
            </p>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-white/25">
              <span>{t("matchPredictions.rpsSkillLabel")} <span className="text-teal-400/70">+0.333</span></span>
              <span>·</span>
              <span>{t("matchPredictions.accuracyLabel")} <span className="text-white/40">47.4%</span></span>
              <span>·</span>
              <span>{t("matchPredictions.backtestLabel", { count: 219 })}</span>
            </div>
          </div>

          {/* Payback input */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.12em] text-white/40">
              {t("matchPredictions.paybackLabel")}
            </label>
            <input
              type="number"
              min="50"
              max="100"
              step="1"
              value={payback}
              onChange={(e) => setPayback(e.target.value)}
              className="w-24 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white focus:border-teal-500/50 focus:outline-none [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 text-[11px] text-white/30">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-teal-400/70 inline-block" />
            {t("matchPredictions.homeWinLabel")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-white/25 inline-block" />
            {t("matchPredictions.drawLabel")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-orange-400/70 inline-block" />
            {t("matchPredictions.awayWinLabel")}
          </span>
          <span className="ml-auto text-white/20">
            {t("matchPredictions.oddsFormulaLabel")}
          </span>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-[14px] border border-white/10 bg-[#0d1624] px-5 py-10 text-center text-sm text-white/30">
          {t("common.loading")}
        </div>
      )}

      {/* No data */}
      {!loading && predictions.length === 0 && (
        <div className="rounded-[14px] border border-white/10 bg-[#0d1624] px-5 py-10 text-center text-sm text-white/30">
          {t("matchPredictions.noPredictionsFound")}
        </div>
      )}

      {/* Predictions grouped by date */}
      {!loading && dates.map((date) => (
        <div key={date} className="space-y-3">

          {/* Date header */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
              {fmtDate(date)}
            </span>
            <span className="text-[11px] text-white/20">
              {grouped[date].length === 1
                ? t("matchPredictions.matchCountOne")
                : t("matchPredictions.matchesCount", { count: grouped[date].length })}
            </span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Match cards grid */}
          <div className="grid gap-2 sm:grid-cols-2">
            {grouped[date].map((p) => (
              <MatchCard key={p.id} prediction={p} payback={paybackNum} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
