"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchUpcomingFixtures,
  fetchBothTeamsStats,
  type UpcomingFixture,
  type Market,
  type StatsCache,
} from "./queries";
import { computePrediction, type PredictionResult, type PredictionParams } from "./compute";

const MARKETS: { value: Market; label: string }[] = [
  { value: "shot",       label: "Shot" },
  { value: "sot",        label: "SOT" },
  { value: "corner",     label: "Corner" },
  { value: "foul",       label: "Foul" },
  { value: "card",       label: "Card" },
  { value: "saves",      label: "Saves" },
  { value: "tackle",     label: "Tackle" },
  { value: "offside",    label: "Offside" },
  { value: "possession", label: "Possession" },
  { value: "throwin",    label: "Throw ins" },
  { value: "goalkick",   label: "Goal kick" },
];

const CURRENT_SEASON = "2025-2026";
const PREV_SEASON    = "2024-2025";

const LEVEL_STYLES = [
  "bg-gray-100 text-gray-600",
  "bg-blue-100 text-blue-800",
  "bg-teal-100 text-teal-800",
  "bg-orange-100 text-orange-800",
];

function f2(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(2);
}

function SliderRow({
  label, id, min, max, step, value, onChange, displayVal,
}: {
  label: string; id: string; min: number; max: number;
  step: number; value: number; onChange: (v: number) => void; displayVal: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2 w-full overflow-hidden">
      <label htmlFor={id} className="text-xs text-white/60 w-[90px] shrink-0">{label}</label>
      <input
        id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 min-w-0 accent-teal-400"
      />
      <span className="text-xs font-medium text-white/80 w-[34px] text-right shrink-0">{displayVal}</span>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-xs text-white/70">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-[18px] rounded-full transition-colors ${checked ? "bg-teal-500" : "bg-white/20"}`}
      >
        <span className={`absolute top-[3px] w-3 h-3 rounded-full bg-white transition-transform ${checked ? "translate-x-[14px]" : "translate-x-[3px]"}`} />
      </button>
    </div>
  );
}

function StatsTable({
  title, badge, homeSlug, awaySlug, homeData, awayData, homeEq, awayEq,
}: {
  title: string; badge?: React.ReactNode;
  homeSlug: string; awaySlug: string;
  homeData: { hf: number; ha: number; af: number; aa: number } | null;
  awayData: { hf: number; ha: number; af: number; aa: number } | null;
  homeEq: number | null; awayEq: number | null;
}) {
  const rows = [
    ["HF", homeData?.hf, awayData?.hf],
    ["HA", homeData?.ha, awayData?.ha],
    ["AF", homeData?.af, awayData?.af],
    ["AA", homeData?.aa, awayData?.aa],
  ] as [string, number | undefined, number | undefined][];

  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-white/10">
        <span className="text-[11px] font-medium text-white/60">{title}</span>
        {badge}
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr>
            <th className="text-left pb-1 text-white/40 font-normal"></th>
            <th className="text-center pb-1 text-white/40 font-normal truncate max-w-[60px]">{homeSlug.slice(0,8)}</th>
            <th className="text-center pb-1 text-white/40 font-normal truncate max-w-[60px]">{awaySlug.slice(0,8)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, hv, av]) => (
            <tr key={label} className="border-t border-white/5">
              <td className="py-1 text-white/40 text-[10px]">{label}</td>
              <td className="py-1 text-center text-white/70">{f2(hv ?? null)}</td>
              <td className="py-1 text-center text-white/70">{f2(av ?? null)}</td>
            </tr>
          ))}
          <tr className="border-t border-white/20 bg-white/[0.03]">
            <td className="py-1 text-white/60 text-[10px] font-medium">Eq</td>
            <td className="py-1 text-center font-medium text-white/90">{f2(homeEq)}</td>
            <td className="py-1 text-center font-medium text-white/90">{f2(awayEq)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function SmartPredictionPage() {
  const [fixtures, setFixtures]     = useState<UpcomingFixture[]>([]);
  const [fixtureId, setFixtureId]   = useState<number | null>(null);
  const [market, setMarket]         = useState<Market>("shot");
  const [loading, setLoading]       = useState(false);

  const [nMatches, setNMatches]     = useState(10);
  const [tableW, setTableW]         = useState(60);
  const [effPct, setEffPct]         = useState(65);
  const [levelOn, setLevelOn]       = useState(true);
  const [refOn, setRefOn]           = useState(false);

  const [oddsH, setOddsH] = useState("2.10");
  const [oddsX, setOddsX] = useState("3.50");
  const [oddsA, setOddsA] = useState("3.60");

  const [refCard, setRefCard]     = useState("3.2");
  const [refFoul, setRefFoul]     = useState("22.5");
  const [refHCard, setRefHCard]   = useState("1.4");
  const [refACard, setRefACard]   = useState("1.8");

  const [prevHome, setPrevHome] = useState<StatsCache | null>(null);
  const [prevAway, setPrevAway] = useState<StatsCache | null>(null);
  const [currHome, setCurrHome] = useState<StatsCache | null>(null);
  const [currAway, setCurrAway] = useState<StatsCache | null>(null);

  const [result, setResult] = useState<PredictionResult | null>(null);

  useEffect(() => {
    fetchUpcomingFixtures().then(setFixtures);
  }, []);

  const selectedFixture = fixtures.find((f) => f.fixture_id === fixtureId);

  const loadStats = useCallback(async () => {
    if (!selectedFixture) return;
    setLoading(true);
    const { curr, prev } = await fetchBothTeamsStats(
      selectedFixture.home_team_slug,
      selectedFixture.away_team_slug,
      CURRENT_SEASON,
      PREV_SEASON,
      market,
      nMatches
    );
    setCurrHome(curr.home);
    setCurrAway(curr.away);
    setPrevHome(prev.home);
    setPrevAway(prev.away);
    setLoading(false);
  }, [selectedFixture, market, nMatches]);

  useEffect(() => {
    if (selectedFixture) loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!selectedFixture || loading) return;
    const params: PredictionParams = {
      nMatches,
      pastSeasonWeight: (100 - tableW) / 100,
      tableWeight: tableW / 100,
      effPct: effPct / 100,
      levelEnabled: levelOn,
      refEnabled: refOn,
      oddsHome: parseFloat(oddsH) || 2.10,
      oddsAway: parseFloat(oddsA) || 3.60,
      refStats: refOn ? {
        cardAvg:     parseFloat(refCard)  || 3.2,
        homeCardAvg: parseFloat(refHCard) || 1.4,
        awayCardAvg: parseFloat(refACard) || 1.8,
        foulAvg:     parseFloat(refFoul)  || 22.5,
      } : undefined,
    };
    setResult(computePrediction(market, params, prevHome, prevAway, currHome, currAway));
  }, [market, nMatches, tableW, effPct, levelOn, refOn, oddsH, oddsA, refCard, refFoul, refHCard, refACard, prevHome, prevAway, currHome, currAway, selectedFixture, loading]);

  const probH = selectedFixture ? 1 / (parseFloat(oddsH) || 2.10) : 0;
  const probA = selectedFixture ? 1 / (parseFloat(oddsA) || 3.60) : 0;
  const probSum = probH + probA;
  const pHpct = probSum ? Math.round((probH / probSum) * 100) : 0;
  const pApct = 100 - pHpct;

  const halfR = result?.halfRatio ?? [0.45, 0.55];

  // Over/under lines
  const ouLines = result ? (() => {
    const base = Math.round(result.total * 2) / 2;
    return [-1, -0.5, 0, 0.5, 1].map((offset, i) => {
      const line = base + offset;
      const d = result.total - line;
      const op = Math.min(95, Math.max(5, Math.round(50 + d * 9)));
      const h1l = (line * halfR[0]).toFixed(1);
      const h2l = (line * halfR[1]).toFixed(1);
      const h1t = (result.predHome + result.predAway) * halfR[0];
      const h2t = (result.predHome + result.predAway) * halfR[1];
      const h1op = Math.min(95, Math.max(5, Math.round(50 + (h1t - parseFloat(h1l)) * 12)));
      const h2op = Math.min(95, Math.max(5, Math.round(50 + (h2t - parseFloat(h2l)) * 12)));
      return { line: line.toFixed(1), op, up: 100 - op, h1l, h1op, h2l, h2op, mid: i === 2 };
    });
  })() : [];

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-4">
      <div className="max-w-[1400px] mx-auto">

        <div className="mb-4">
          <h1 className="text-lg font-medium text-white/90">Smart Prediction</h1>
          <p className="text-xs text-white/40 mt-0.5">Hibrit model — kural + istatistik</p>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "210px minmax(0, 1fr)" }}>

          {/* Sol panel */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col gap-1 min-w-0 overflow-hidden">

            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Fixture</div>
            <select
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 mb-2"
              style={{ backgroundColor: "#0f1923", colorScheme: "dark" }}
              value={fixtureId ?? ""}
              onChange={(e) => setFixtureId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="" style={{ background: "#0f1923", color: "rgba(255,255,255,0.5)" }}>— Fixture seç —</option>
              {fixtures.map((f) => (
                <option key={f.fixture_id} value={f.fixture_id} style={{ background: "#0f1923", color: "rgba(255,255,255,0.85)" }}>
                  {f.home_team_name} - {f.away_team_name} (H.{f.round_number})
                </option>
              ))}
            </select>

            {selectedFixture && (
              <div className="text-[10px] text-white/40 bg-white/[0.03] rounded-md px-2 py-1 mb-2">
                {selectedFixture.home_team_name} (ev) vs {selectedFixture.away_team_name} · Hafta {selectedFixture.round_number}
              </div>
            )}

            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Market</div>
            <select
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 mb-2"
              style={{ backgroundColor: "#0f1923", colorScheme: "dark" }}
              value={market}
              onChange={(e) => setMarket(e.target.value as Market)}
            >
              {MARKETS.map((m) => (
                <option key={m.value} value={m.value} style={{ background: "#0f1923", color: "rgba(255,255,255,0.85)" }}>{m.label}</option>
              ))}
            </select>

            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">1x2 Oranları</div>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {[
                { label: "1", val: oddsH, set: setOddsH },
                { label: "X", val: oddsX, set: setOddsX },
                { label: "2", val: oddsA, set: setOddsA },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <div className="text-[10px] text-white/40 text-center mb-1">{label}</div>
                  <input
                    type="number" step="0.05" value={val}
                    onChange={(e) => set(e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-md px-1 py-1 text-xs text-white/80 text-center"
                  />
                </div>
              ))}
            </div>

            <div className="mb-2 w-full overflow-hidden">
              <div className="flex items-center gap-2 mb-1 w-full">
                <span className="text-[10px] text-white/40 w-[60px] shrink-0">Ev sahibi</span>
                <div className="flex-1 min-w-0 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pHpct}%` }} />
                </div>
                <span className="text-[10px] font-medium text-white/70 w-[28px] text-right shrink-0">{pHpct}%</span>
              </div>
              <div className="flex items-center gap-2 w-full">
                <span className="text-[10px] text-white/40 w-[60px] shrink-0">Deplasman</span>
                <div className="flex-1 min-w-0 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pApct}%` }} />
                </div>
                <span className="text-[10px] font-medium text-white/70 w-[28px] text-right shrink-0">{pApct}%</span>
              </div>
            </div>

            <div className="h-px bg-white/10 my-1" />
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Parametreler</div>

            <SliderRow label="Son N maç" id="n" min={3} max={20} step={1} value={nMatches} onChange={setNMatches} displayVal={String(nMatches)} />
            <SliderRow label="Tablo ağırlık w" id="w" min={0} max={100} step={5} value={tableW} onChange={setTableW} displayVal={`${tableW}%`} />
            <SliderRow label="Etki yüzdesi" id="eff" min={0} max={100} step={5} value={effPct} onChange={setEffPct} displayVal={`${effPct}%`} />

            <div className="h-px bg-white/10 my-1" />
            <ToggleRow label="Level etkisi" checked={levelOn} onChange={setLevelOn} />
            <ToggleRow label="Hakem etkisi" checked={refOn} onChange={setRefOn} />

            {refOn && (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {[
                  { label: "Card ort.", val: refCard, set: setRefCard },
                  { label: "Foul ort.", val: refFoul, set: setRefFoul },
                  { label: "Home card", val: refHCard, set: setRefHCard },
                  { label: "Away card", val: refACard, set: setRefACard },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <div className="text-[10px] text-white/40 mb-1">{label}</div>
                    <input
                      type="number" step="0.1" value={val}
                      onChange={(e) => set(e.target.value)}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-md px-1 py-1 text-xs text-white/80 text-center"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="h-px bg-white/10 mt-2 mb-2" />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-white/40">Level</span>
              {result ? (
                <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${LEVEL_STYLES[result.level]}`}>
                  Level {result.level}
                </span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-white/30">—</span>
              )}
            </div>
          </div>

          {/* Sağ panel */}
          <div className="flex flex-col gap-3">

            {/* 3 tablo */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              {!selectedFixture ? (
                <p className="text-sm text-white/30 text-center py-4">Fixture seçin</p>
              ) : loading ? (
                <p className="text-sm text-white/30 text-center py-4">Yükleniyor...</p>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-medium text-white/70">
                      {selectedFixture.home_team_name} vs {selectedFixture.away_team_name} — {market.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-white/30">{CURRENT_SEASON}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <StatsTable
                      title="Geçmiş sezon"
                      badge={<span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40">w: {100 - tableW}%</span>}
                      homeSlug={selectedFixture.home_team_name}
                      awaySlug={selectedFixture.away_team_name}
                      homeData={result?.table1.home ?? null}
                      awayData={result?.table1.away ?? null}
                      homeEq={result?.table1.homeEq ?? null}
                      awayEq={result?.table1.awayEq ?? null}
                    />
                    <StatsTable
                      title={`Son ${nMatches} maç`}
                      badge={<span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40">w: {tableW}%</span>}
                      homeSlug={selectedFixture.home_team_name}
                      awaySlug={selectedFixture.away_team_name}
                      homeData={result?.table2.home ?? null}
                      awayData={result?.table2.away ?? null}
                      homeEq={result?.table2.homeEq ?? null}
                      awayEq={result?.table2.awayEq ?? null}
                    />
                    <StatsTable
                      title="Ağırlıklı"
                      badge={<span className="text-[10px] text-white/40">Eq'ya giren</span>}
                      homeSlug={selectedFixture.home_team_name}
                      awaySlug={selectedFixture.away_team_name}
                      homeData={result?.table3.home ?? null}
                      awayData={result?.table3.away ?? null}
                      homeEq={result?.table3.homeEq ?? null}
                      awayEq={result?.table3.awayEq ?? null}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Tahmin sonuçları */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              {!result ? (
                <p className="text-sm text-white/30 text-center py-4">Fixture seçin</p>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-medium text-white/70">Tahmin sonuçları</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${LEVEL_STYLES[result.level]}`}>
                      Level {result.level}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[
                      { label: "Home tahmin", val: f2(result.predHome), sub: "Eq × lvl" },
                      { label: "Away tahmin", val: f2(result.predAway), sub: "Eq × lvl" },
                      { label: "Total", val: f2(result.total), sub: "Home + Away" },
                    ].map(({ label, val, sub }) => (
                      <div key={label} className="bg-white/[0.04] rounded-lg p-2.5 text-center">
                        <div className="text-[10px] text-white/40 mb-1">{label}</div>
                        <div className="text-xl font-medium text-white/90">{val}</div>
                        <div className="text-[10px] text-white/30 mt-1">{sub}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "1. Yarı", h: result.predHome * halfR[0], a: result.predAway * halfR[0], pct: Math.round(halfR[0] * 100) },
                      { label: "2. Yarı", h: result.predHome * halfR[1], a: result.predAway * halfR[1], pct: Math.round(halfR[1] * 100) },
                    ].map(({ label, h, a, pct }) => (
                      <div key={label} className="bg-white/[0.04] rounded-lg p-2.5">
                        <div className="text-[10px] text-white/40 mb-1">{label}</div>
                        <div className="text-base font-medium text-white/90">{f2(h)} / {f2(a)}</div>
                        <div className="text-[10px] text-white/30 mt-1">Oran: {pct}%</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Over/Under tablosu */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              {!result ? (
                <p className="text-sm text-white/30 text-center py-4">Fixture seçin</p>
              ) : (
                <>
                  <div className="text-xs font-medium text-white/70 mb-3">Over / Under önerileri</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]" style={{ tableLayout: "fixed", minWidth: "560px" }}>
                      <thead>
                        <tr className="text-white/30 font-normal">
                          <th className="text-left pb-2 w-[50px]">Line</th>
                          <th className="text-center pb-2 w-[52px]">Over%</th>
                          <th className="text-center pb-2 w-[52px]">Under%</th>
                          <th className="text-center pb-2 w-[55px]">1H line</th>
                          <th className="text-center pb-2 w-[52px]">1H ov%</th>
                          <th className="text-center pb-2 w-[52px]">1H un%</th>
                          <th className="text-center pb-2 w-[55px]">2H line</th>
                          <th className="text-center pb-2 w-[52px]">2H ov%</th>
                          <th className="text-center pb-2 w-[52px]">2H un%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ouLines.map((row, i) => (
                          <tr
                            key={i}
                            className={row.mid
                              ? "bg-teal-500/10 text-teal-300"
                              : "border-t border-white/5 text-white/60"}
                          >
                            <td className="py-1.5 font-medium">{row.line}</td>
                            <td className="py-1.5 text-center">{row.op}%</td>
                            <td className="py-1.5 text-center">{row.up}%</td>
                            <td className="py-1.5 text-center">{row.h1l}</td>
                            <td className="py-1.5 text-center">{row.h1op}%</td>
                            <td className="py-1.5 text-center">{100 - row.h1op}%</td>
                            <td className="py-1.5 text-center">{row.h2l}</td>
                            <td className="py-1.5 text-center">{row.h2op}%</td>
                            <td className="py-1.5 text-center">{100 - row.h2op}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
