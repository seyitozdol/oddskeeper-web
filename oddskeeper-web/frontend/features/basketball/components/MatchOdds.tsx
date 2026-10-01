"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { matchTotalsLadder, moneyline, normalCdf } from "../odds";
import { blendSeasonSplits, leagueAvgPpg, seasonPercents, type SeasonWeights } from "../seasonBlend";
import type { BktTeamSeasonRow, BktHomeAwaySplitRow } from "../types";

// İki sezonun split'i + Config'teki sezon ağırlığı (Match-Player Tools maç sayılarıyla aynı girdi).
export type PointsModelData = {
  cur: BktHomeAwaySplitRow[];
  prev: BktHomeAwaySplitRow[];
  weights: SeasonWeights;
  prevSeason: string;
};

type Props = {
  standings: BktTeamSeasonRow[];
  pointsModel: PointsModelData;
  season: string;
};

function price(payback: number, prob: number): number {
  if (prob <= 0) return 999;
  return Math.min(999, Math.round((payback / prob) * 100) / 100);
}

export default function MatchOdds({ standings, pointsModel, season }: Props) {
  const { t } = useI18n();
  // Takım girdileri: geçen sezon / bu sezon ağırlıklı karışım (Config > Model). Geçen sezonu
  // olmayan takım (ya da geçmiş sezon görünümü) yalnız kendi sezonuyla hesaplanır.
  const teams = useMemo(
    () => blendSeasonSplits(standings, pointsModel.cur, pointsModel.prev, pointsModel.weights)
      .sort((a, b) => a.team_name.localeCompare(b.team_name, "tr")),
    [standings, pointsModel]
  );
  const hasPrev = pointsModel.prev.length > 0;
  const seasonPct = seasonPercents(pointsModel.weights);

  const lgAvg = useMemo(() => leagueAvgPpg(teams), [teams]);

  const [homeSlug, setHomeSlug] = useState(teams[0]?.team_slug ?? "");
  const [awaySlug, setAwaySlug] = useState(teams[1]?.team_slug ?? "");
  const [payback, setPayback] = useState(0.96);

  const home = teams.find((x) => x.team_slug === homeSlug);
  const away = teams.find((x) => x.team_slug === awaySlug);

  const calc = useMemo(() => {
    if (!home || !away || home.team_slug === away.team_slug) return null;
    // Rakibe göre ayarlı beklenen sayı (log5): off × opp_def / lig_ort
    // 1 ondalığa yuvarlanır: Match-Player Tools maç sayılarıyla birebir aynı değer.
    const muHome = Math.round(((Number(home.ppg) * Number(away.oppg)) / lgAvg) * 10) / 10;
    const muAway = Math.round(((Number(away.ppg) * Number(home.oppg)) / lgAvg) * 10) / 10;
    // Std: ev sahibinin iç saha, deplasmanın dış saha sayı std'si (Match-Player Tools ile aynı).
    const stdHome = home.home_pf_std ?? 11;
    const stdAway = away.away_pf_std ?? 11;
    const { total, totalMean } = matchTotalsLadder(muHome, stdHome, muAway, stdAway, payback);
    const ml = moneyline(muHome, stdHome, muAway, stdAway, 0.915);
    const diffMean = muHome - muAway;
    const diffStd = Math.sqrt(stdHome * stdHome + stdAway * stdAway);
    // handikap ladder: home -L kapatır ⇔ margin > L
    const hcStart = Math.round(diffMean) - 6;
    const handicap = Array.from({ length: 13 }, (_, i) => {
      const line = hcStart + i + 0.5;
      const homeCover = 1 - normalCdf(line, diffMean, diffStd);
      return { line, homePrice: price(0.915, homeCover), awayPrice: price(0.915, 1 - homeCover), isMid: false };
    });
    let best = 0, bd = Infinity;
    handicap.forEach((h, i) => {
      const d = Math.abs(1 - normalCdf(h.line, diffMean, diffStd) - 0.5);
      if (d < bd) { bd = d; best = i; }
    });
    if (handicap[best]) handicap[best].isMid = true;
    return { muHome, muAway, totalMean, total, ml, handicap };
  }, [home, away, lgAvg, payback]);

  return (
    <div>
      {/* takım seçiciler */}
      <div className="mb-5 flex flex-wrap items-end gap-4">
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
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.oddsPayback")}</span>
          <input type="number" step={0.005} value={payback} onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) setPayback(v); }} className="w-20 rounded-md border border-line bg-field px-2 py-1.5 text-right text-[13px] tabular-nums text-ink outline-none focus:border-line-strong" />
        </label>
      </div>

      {!calc ? (
        <p className="text-sm text-ink-3">{t("basketball.matchPickTeams")}</p>
      ) : (
        <div className="space-y-6">
          {hasPrev ? (
            /* sayı modelinin sezon ağırlığı (Config > Model) + tek sezonu olan takım notu */
            <div className="-mb-4 text-[11px] leading-relaxed text-ink-3">
              <span title={t("basketball.seasonWHint")}>
                {t("basketball.seasonWLine")}:{" "}
                <span className="font-semibold text-ink-2">{pointsModel.prevSeason} {t("basketball.pctFmt").replace("{n}", String(seasonPct.prev))}</span>
                {" · "}
                <span className="font-semibold text-ink-2">{season} {t("basketball.pctFmt").replace("{n}", String(seasonPct.cur))}</span>
              </span>
              {[home, away].map((tm) => {
                if (!tm) return null;
                const one = tm.blend === "current" && seasonPct.cur < 100 ? { key: "seasonWOnlyCur", has: season, miss: pointsModel.prevSeason }
                  : tm.blend === "previous" && seasonPct.prev < 100 ? { key: "seasonWOnlyPrev", has: pointsModel.prevSeason, miss: season }
                  : null;
                return one ? (
                  <span key={tm.team_slug} className="block">
                    {t(`basketball.${one.key}`).replace("{team}", tm.team_name).replace("{has}", one.has).replace("{miss}", one.miss)}
                  </span>
                ) : null;
              })}
            </div>
          ) : null}
          {/* beklenen skor */}
          <div className="flex flex-wrap gap-6 rounded-lg border border-line bg-veil px-4 py-3 text-sm">
            <div><span className="text-ink-3">{t("basketball.matchExpected")}: </span>
              <span className="font-semibold text-ink">{home?.team_name} {calc.muHome.toFixed(1)}</span>
              <span className="text-ink-3"> – </span>
              <span className="font-semibold text-ink">{calc.muAway.toFixed(1)} {away?.team_name}</span>
            </div>
            <div><span className="text-ink-3">{t("basketball.matchTotal")}: </span><span className="font-semibold text-accent-ink">{calc.totalMean.toFixed(1)}</span></div>
            <div><span className="text-ink-3">{t("basketball.matchMoneyline")}: </span>
              <span className="font-semibold text-ink">{calc.ml.homePrice.toFixed(2)}</span>
              <span className="text-ink-3"> / </span>
              <span className="font-semibold text-ink">{calc.ml.awayPrice.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* total ladder */}
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.matchTotal")}</h3>
              <table className="min-w-full border-collapse text-[13px]">
                <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
                  <th className="px-3 py-2 text-left">{t("basketball.oddsLine")}</th>
                  <th className="px-3 py-2 text-right">{t("basketball.oddsProb")}</th>
                  <th className="px-3 py-2 text-right">{t("basketball.oddsOver")}</th>
                  <th className="px-3 py-2 text-right">{t("basketball.oddsUnder")}</th>
                </tr></thead>
                <tbody>
                  {calc.total.map((r) => (
                    <tr key={r.line} className={`border-t border-line ${r.isMid ? "bg-accent-soft" : "hover:bg-veil"}`}>
                      <td className={`px-3 py-1.5 tabular-nums ${r.isMid ? "font-semibold text-accent-ink" : "text-ink"}`}>{r.line.toFixed(1)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-ink-3">{(r.overProb * 100).toFixed(1)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-ink">{r.overPrice.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-ink-2">{r.underPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* handicap ladder */}
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.matchHandicap")} ({home?.team_name})</h3>
              <table className="min-w-full border-collapse text-[13px]">
                <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
                  <th className="px-3 py-2 text-left">{t("basketball.oddsLine")}</th>
                  <th className="px-3 py-2 text-right">{home?.team_name}</th>
                  <th className="px-3 py-2 text-right">{away?.team_name}</th>
                </tr></thead>
                <tbody>
                  {calc.handicap.map((r) => (
                    <tr key={r.line} className={`border-t border-line ${r.isMid ? "bg-accent-soft" : "hover:bg-veil"}`}>
                      <td className={`px-3 py-1.5 tabular-nums ${r.isMid ? "font-semibold text-accent-ink" : "text-ink"}`}>{r.line > 0 ? "-" : "+"}{Math.abs(r.line).toFixed(1)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-ink">{r.homePrice.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-ink-2">{r.awayPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="max-w-2xl text-[11px] leading-relaxed text-ink-3">{t("basketball.oddsNote")}</p>
        </div>
      )}
    </div>
  );
}
