"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import {
  fetchUpcomingFixtures,
  fetchBothTeamsStats,
  type UpcomingFixture,
  type Market,
  type StatsCache,
  type SeasonWeight,
} from "./queries";
import { computePrediction, type PredictionResult, type PredictionParams } from "./compute";

const MARKETS: { value: Market; labelKey: string }[] = [
  { value: "shot", labelKey: "smartPrediction.marketShot" }, { value: "sot", labelKey: "smartPrediction.marketSot" },
  { value: "corner", labelKey: "smartPrediction.marketCorner" }, { value: "foul", labelKey: "smartPrediction.marketFoul" },
  { value: "card", labelKey: "smartPrediction.marketCard" }, { value: "saves", labelKey: "smartPrediction.marketSaves" },
  { value: "tackle", labelKey: "smartPrediction.marketTackle" }, { value: "offside", labelKey: "smartPrediction.marketOffside" },
  { value: "possession", labelKey: "smartPrediction.marketPossession" }, { value: "throwin", labelKey: "smartPrediction.marketThrowin" },
  { value: "goalkick", labelKey: "smartPrediction.marketGoalkick" },
];

const STD_TABLE: Record<string, { totalHome: number; totalAway: number; h1Home: number; h1Away: number; h2Home: number; h2Away: number; halfPct1: number; halfPct2: number }> = {
  card:       { totalHome: 1.449, totalAway: 1.757, h1Home: 0.964, h1Away: 0.965, h2Home: 1.215, h2Away: 1.388, halfPct1: 0.351, halfPct2: 0.649 },
  corner:     { totalHome: 2.844, totalAway: 2.598, h1Home: 1.664, h1Away: 1.604, h2Home: 2.170, h2Away: 1.954, halfPct1: 0.471, halfPct2: 0.529 },
  shot:       { totalHome: 5.532, totalAway: 4.923, h1Home: 3.031, h1Away: 2.797, h2Home: 4.104, h2Away: 3.448, halfPct1: 0.444, halfPct2: 0.556 },
  sot:        { totalHome: 2.505, totalAway: 2.553, h1Home: 1.478, h1Away: 1.476, h2Home: 1.899, h2Away: 1.867, halfPct1: 0.441, halfPct2: 0.559 },
  foul:       { totalHome: 4.421, totalAway: 3.930, h1Home: 2.836, h1Away: 2.501, h2Home: 2.912, h2Away: 2.700, halfPct1: 0.480, halfPct2: 0.520 },
  offside:    { totalHome: 1.478, totalAway: 1.435, h1Home: 0.915, h1Away: 0.975, h2Home: 1.030, h2Away: 0.985, halfPct1: 0.508, halfPct2: 0.492 },
  saves:      { totalHome: 1.936, totalAway: 2.051, h1Home: 1.219, h1Away: 1.180, h2Home: 1.451, h2Away: 1.599, halfPct1: 0.445, halfPct2: 0.555 },
  throwin:    { totalHome: 5.637, totalAway: 5.110, h1Home: 3.649, h1Away: 3.333, h2Home: 3.899, h2Away: 3.455, halfPct1: 0.512, halfPct2: 0.488 },
  tackle:     { totalHome: 4.440, totalAway: 5.216, h1Home: 2.924, h1Away: 3.391, h2Home: 2.879, h2Away: 3.363, halfPct1: 0.493, halfPct2: 0.507 },
  goalkick:   { totalHome: 3.257, totalAway: 3.442, h1Home: 1.855, h1Away: 2.164, h2Home: 2.354, h2Away: 2.414, halfPct1: 0.458, halfPct2: 0.542 },
  possession: { totalHome: 8.0,   totalAway: 8.0,   h1Home: 5.0,   h1Away: 5.0,   h2Home: 5.0,   h2Away: 5.0,   halfPct1: 0.500, halfPct2: 0.500 },
};

const CURRENT_SEASON = "2025-2026";
const ALL_PREV_SEASONS = ["2020-2021", "2021-2022", "2022-2023", "2023-2024", "2024-2025"];
const SIM_COUNT = 4000;

const LEVEL_STYLES = ["bg-gray-100 text-gray-600", "bg-blue-100 text-blue-800", "bg-teal-100 text-teal-800", "bg-orange-100 text-orange-800"];

function randNorm(mean: number, std: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function simulate(mean: number, std: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < SIM_COUNT; i++) results.push(Math.max(0, Math.round(randNorm(mean, std))));
  return results;
}

function calcLines(sims: number[], payback: number) {
  const sorted = [...sims].sort((a, b) => a - b);
  const median = sorted[Math.floor(SIM_COUNT / 2)];
  const candidates: { line: number; diff: number }[] = [];
  const scanStart = Math.max(0.5, Math.floor(median - 4) + 0.5);
  for (let i = 0; i < 20; i++) {
    const line = scanStart + i;
    const overCount = sims.filter(v => v > line).length;
    const underCount = SIM_COUNT - overCount;
    if (overCount <= 0 || underCount <= 0) continue;
    const overOdds = payback / (overCount / SIM_COUNT);
    const underOdds = payback / (underCount / SIM_COUNT);
    candidates.push({ line, diff: Math.abs(underOdds - overOdds) });
  }
  candidates.sort((a, b) => a.diff - b.diff);
  const midLine = candidates[0]?.line ?? (Math.floor(median) + 0.5);
  const lines = [];
  for (let i = -2; i <= 2; i++) {
    const line = midLine + i;
    if (line < 0.5) continue;
    const overCount = sims.filter(v => v > line).length;
    const underCount = SIM_COUNT - overCount;
    const overProb = overCount / SIM_COUNT;
    const underProb = underCount / SIM_COUNT;
    lines.push({ line, overOdds: overProb > 0 ? payback / overProb : 0, underOdds: underProb > 0 ? payback / underProb : 0 });
  }
  return { lines, midLine };
}

type OULines = ReturnType<typeof calcLines>;
type OUResult = { total: OULines; h1: OULines; h2: OULines; home: OULines; away: OULines; h1Home: OULines; h1Away: OULines; h2Home: OULines; h2Away: OULines };

function computeOU(market: Market, predHome: number, predAway: number, payback: number): OUResult {
  const std = STD_TABLE[market] ?? STD_TABLE.shot;
  const homeSims = simulate(predHome, std.totalHome);
  const awaySims = simulate(predAway, std.totalAway);
  const totalSims = homeSims.map((h, i) => h + awaySims[i]);
  const h1HomeSims = simulate(predHome * std.halfPct1, std.h1Home);
  const h1AwaySims = simulate(predAway * std.halfPct1, std.h1Away);
  const h1TotalSims = h1HomeSims.map((h, i) => h + h1AwaySims[i]);
  const h2HomeSims = simulate(predHome * std.halfPct2, std.h2Home);
  const h2AwaySims = simulate(predAway * std.halfPct2, std.h2Away);
  const h2TotalSims = h2HomeSims.map((h, i) => h + h2AwaySims[i]);
  const pb = payback / 100;
  return {
    total: calcLines(totalSims, pb), h1: calcLines(h1TotalSims, pb), h2: calcLines(h2TotalSims, pb),
    home: calcLines(homeSims, pb), away: calcLines(awaySims, pb),
    h1Home: calcLines(h1HomeSims, pb), h1Away: calcLines(h1AwaySims, pb),
    h2Home: calcLines(h2HomeSims, pb), h2Away: calcLines(h2AwaySims, pb),
  };
}

function f2(v: number | null | undefined) { return v == null ? "—" : v.toFixed(2); }
function fOdds(v: number) { return (!v || v <= 0) ? "—" : v.toFixed(2); }

function SliderRow({ label, id, min, max, step, value, onChange, displayVal }: { label: string; id: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; displayVal: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
      <label htmlFor={id} style={{ fontSize: "11px", color: "var(--ink-3)", width: "88px", flexShrink: 0 }}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1, minWidth: 0, accentColor: "var(--accent)" }} />
      <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--ink)", width: "32px", textAlign: "right", flexShrink: 0 }}>{displayVal}</span>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ width: "32px", height: "18px", borderRadius: "9px", flexShrink: 0, cursor: "pointer", background: checked ? "var(--accent)" : "var(--card-2)", position: "relative", transition: "background 0.2s" }}>
      <div style={{ position: "absolute", top: "3px", width: "12px", height: "12px", borderRadius: "50%", background: "var(--ink)", transition: "left 0.2s", left: checked ? "17px" : "3px" }} />
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: "12px", color: "var(--ink-2)" }}>{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function OUTable({ label, total, home, away }: { label: string; total: OULines; home: OULines; away: OULines }) {
  const { t } = useI18n();
  return (
    <div>
      <div style={{ fontSize: "10px", textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "var(--ink-3)", marginBottom: "6px" }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
        {[
          { title: t("smartPrediction.totalLabel"), data: total },
          { title: t("common.home"), data: home },
          { title: t("common.away"), data: away },
        ].map(({ title, data }) => (
          <div key={title}>
            <div style={{ fontSize: "10px", color: "var(--ink-3)", marginBottom: "4px", fontWeight: 500 }}>{title}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ color: "var(--ink-3)" }}>
                  <th style={{ textAlign: "left", paddingBottom: "4px", fontWeight: 400 }}>{t("smartPrediction.lineLabel")}</th>
                  <th style={{ textAlign: "center", paddingBottom: "4px", fontWeight: 400 }}>{t("smartPrediction.overLabel")}</th>
                  <th style={{ textAlign: "center", paddingBottom: "4px", fontWeight: 400 }}>{t("smartPrediction.underLabel")}</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((row, i) => {
                  const isMid = row.line === data.midLine;
                  return (
                    <tr key={i} style={isMid
                      ? { background: "var(--accent-soft)", color: "var(--accent-ink)" }
                      : { borderTop: "0.5px solid var(--line)", color: "var(--ink-2)" }}>
                      <td style={{ padding: "4px 0", fontWeight: isMid ? 500 : 400 }}>{row.line.toFixed(1)}</td>
                      <td style={{ padding: "4px 0", textAlign: "center" }}>{fOdds(row.overOdds)}</td>
                      <td style={{ padding: "4px 0", textAlign: "center" }}>{fOdds(row.underOdds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsTable({ title, badge, homeSlug, awaySlug, homeData, awayData, homeEq, awayEq }: {
  title: string; badge?: React.ReactNode; homeSlug: string; awaySlug: string;
  homeData: { hf: number; ha: number; af: number; aa: number } | null;
  awayData: { hf: number; ha: number; af: number; aa: number } | null;
  homeEq: number | null; awayEq: number | null;
}) {
  const rows: [string, number | undefined, number | undefined][] = [
    ["HF", homeData?.hf, awayData?.hf], ["HA", homeData?.ha, awayData?.ha],
    ["AF", homeData?.af, awayData?.af], ["AA", homeData?.aa, awayData?.aa],
  ];
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", paddingBottom: "5px", borderBottom: "0.5px solid var(--line)" }}>
        <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--ink-3)" }}>{title}</span>
        {badge}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", paddingBottom: "4px", color: "var(--ink-3)", fontWeight: 400 }}></th>
            <th style={{ textAlign: "center", paddingBottom: "4px", color: "var(--ink-3)", fontWeight: 400 }}>{homeSlug.slice(0,9)}</th>
            <th style={{ textAlign: "center", paddingBottom: "4px", color: "var(--ink-3)", fontWeight: 400 }}>{awaySlug.slice(0,9)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, hv, av]) => (
            <tr key={label} style={{ borderTop: "0.5px solid var(--line)" }}>
              <td style={{ padding: "3px 0", color: "var(--ink-3)", fontSize: "10px" }}>{label}</td>
              <td style={{ padding: "3px 0", textAlign: "center", color: "var(--ink-2)" }}>{f2(hv ?? null)}</td>
              <td style={{ padding: "3px 0", textAlign: "center", color: "var(--ink-2)" }}>{f2(av ?? null)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: "0.5px solid var(--line-strong)", background: "var(--card)" }}>
            <td style={{ padding: "4px 0", color: "var(--ink-2)", fontSize: "10px", fontWeight: 500 }}>Eq</td>
            <td style={{ padding: "4px 0", textAlign: "center", fontWeight: 500, color: "var(--ink)" }}>{f2(homeEq)}</td>
            <td style={{ padding: "4px 0", textAlign: "center", fontWeight: 500, color: "var(--ink)" }}>{f2(awayEq)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Geçmiş sezon ağırlıklarından ağırlıklı ortalama StatsCache hesapla
function blendPrevSeasons(prevBySeasons: { season: string; weight: number; home: StatsCache | null; away: StatsCache | null }[]): { home: StatsCache | null; away: StatsCache | null } {
  const activeHome = prevBySeasons.filter(s => s.weight > 0 && s.home);
  const activeAway = prevBySeasons.filter(s => s.weight > 0 && s.away);
  if (activeHome.length === 0 && activeAway.length === 0) return { home: null, away: null };

  const totalHomeW = activeHome.reduce((s, x) => s + x.weight, 0);
  const totalAwayW = activeAway.reduce((s, x) => s + x.weight, 0);

  const blendHome = totalHomeW > 0 ? {
    hf: activeHome.reduce((s, x) => s + (x.home!.hf ?? 0) * x.weight, 0) / totalHomeW,
    ha: activeHome.reduce((s, x) => s + (x.home!.ha ?? 0) * x.weight, 0) / totalHomeW,
    af: activeHome.reduce((s, x) => s + (x.home!.af ?? 0) * x.weight, 0) / totalHomeW,
    aa: activeHome.reduce((s, x) => s + (x.home!.aa ?? 0) * x.weight, 0) / totalHomeW,
    home_match_count: activeHome[0]?.home?.home_match_count ?? 0,
    away_match_count: activeHome[0]?.home?.away_match_count ?? 0,
  } : null;

  const blendAway = totalAwayW > 0 ? {
    hf: activeAway.reduce((s, x) => s + (x.away!.hf ?? 0) * x.weight, 0) / totalAwayW,
    ha: activeAway.reduce((s, x) => s + (x.away!.ha ?? 0) * x.weight, 0) / totalAwayW,
    af: activeAway.reduce((s, x) => s + (x.away!.af ?? 0) * x.weight, 0) / totalAwayW,
    aa: activeAway.reduce((s, x) => s + (x.away!.aa ?? 0) * x.weight, 0) / totalAwayW,
    home_match_count: activeAway[0]?.away?.home_match_count ?? 0,
    away_match_count: activeAway[0]?.away?.away_match_count ?? 0,
  } : null;

  return { home: blendHome, away: blendAway };
}

export default function SmartPredictionPage() {
  const { t } = useI18n();
  const [fixtures, setFixtures] = useState<UpcomingFixture[]>([]);
  const [fixtureId, setFixtureId] = useState<number | null>(null);
  const [market, setMarket] = useState<Market>("shot");
  const [loading, setLoading] = useState(false);
  const [maxN, setMaxN] = useState(20);

  const [nMatches, setNMatches] = useState(10);
  const [effPct, setEffPct] = useState(65);
  const [manualLevel, setManualLevel] = useState<0|1|2|3>(0);
  const [refOn, setRefOn] = useState(false);
  const [payback, setPayback] = useState(93);

  const [oddsH, setOddsH] = useState("2.10");
  const [oddsX, setOddsX] = useState("3.50");
  const [oddsA, setOddsA] = useState("3.60");

  const [refCard, setRefCard] = useState("3.2");
  const [refFoul, setRefFoul] = useState("22.5");
  const [refHCard, setRefHCard] = useState("1.4");
  const [refACard, setRefACard] = useState("1.8");

  const [seasonWeights, setSeasonWeights] = useState<SeasonWeight[]>([
    { season: "2023-2024", weight: 0 },
    { season: "2024-2025", weight: 0 },
    { season: "2025-2026", weight: 100 },
  ]);

  const [currHome, setCurrHome] = useState<StatsCache | null>(null);
  const [currAway, setCurrAway] = useState<StatsCache | null>(null);
  const [prevHome, setPrevHome] = useState<StatsCache | null>(null);
  const [prevAway, setPrevAway] = useState<StatsCache | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [ouResult, setOuResult] = useState<OUResult | null>(null);

  const upcomingFixtures = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return fixtures.filter(f => f.fixture_date >= today);
  }, [fixtures]);

  useEffect(() => { fetchUpcomingFixtures().then(setFixtures); }, []);

  const selectedFixture = fixtures.find((f) => f.fixture_id === fixtureId);

  useEffect(() => {
    if (selectedFixture?.round_number) {
      const playedWeeks = selectedFixture.round_number - 1;
      setMaxN(playedWeeks);
      if (nMatches > playedWeeks) setNMatches(playedWeeks);
    }
  }, [selectedFixture?.fixture_id]);

  const activeSeasonWeights = useMemo(() => seasonWeights.filter(s => s.weight > 0), [seasonWeights]);

  const loadStats = useCallback(async () => {
    if (!selectedFixture) return;
    setLoading(true);

    // Years Weighted: tüm sezonlar (ağırlığı sıfır olmayanlar) full season cache
    const { curr: yw, prevBySeasons } = await fetchBothTeamsStats(
      selectedFixture.home_team_slug,
      selectedFixture.away_team_slug,
      CURRENT_SEASON,
      activeSeasonWeights,
      market,
      -1  // years weighted için tüm sezon
    );

    // Years Weighted blend — güncel sezon da dahil
    const allSeasons = [...prevBySeasons];
    // 2025-2026 güncel sezon ağırlığı varsa ekle
    const currWeight = activeSeasonWeights.find(s => s.season === CURRENT_SEASON);
    if (currWeight && yw.home) allSeasons.push({ season: CURRENT_SEASON, weight: currWeight.weight, home: yw.home, away: yw.away });

    const blended = blendPrevSeasons(allSeasons);
    setPrevHome(blended.home);
    setPrevAway(blended.away);

    // Son N Hafta: sadece cari sezon, N maç
    const { curr: nw } = await fetchBothTeamsStats(
      selectedFixture.home_team_slug,
      selectedFixture.away_team_slug,
      CURRENT_SEASON,
      [{ season: CURRENT_SEASON, weight: 100 }],
      market,
      nMatches
    );
    setCurrHome(nw.home);
    setCurrAway(nw.away);

    setLoading(false);
  }, [selectedFixture, market, nMatches, activeSeasonWeights]);

  useEffect(() => { if (selectedFixture) loadStats(); }, [loadStats]);

  useEffect(() => {
    if (!selectedFixture || loading) return;
    const params: PredictionParams = {
      nMatches, effPct: effPct / 100,
      manualLevel,
      refEnabled: refOn,
      oddsHome: parseFloat(oddsH) || 2.10, oddsAway: parseFloat(oddsA) || 3.60,
      refStats: refOn ? { cardAvg: parseFloat(refCard) || 3.2, homeCardAvg: parseFloat(refHCard) || 1.4, awayCardAvg: parseFloat(refACard) || 1.8, foulAvg: parseFloat(refFoul) || 22.5 } : undefined,
    };
    const r = computePrediction(market, params, prevHome, prevAway, currHome, currAway);
    setResult(r);
    if (r) setOuResult(computeOU(market, r.predHome, r.predAway, payback));
  }, [market, nMatches, effPct, manualLevel, refOn, oddsH, oddsA, refCard, refFoul, refHCard, refACard, prevHome, prevAway, currHome, currAway, selectedFixture, loading, payback]);

  const probH = 1 / (parseFloat(oddsH) || 2.10);
  const probA = 1 / (parseFloat(oddsA) || 3.60);
  const probSum = probH + probA;
  const pHpct = probSum ? Math.round((probH / probSum) * 100) : 0;
  const pApct = 100 - pHpct;

  const homeSlug = selectedFixture?.home_team_name ?? "Ev";
  const awaySlug = selectedFixture?.away_team_name ?? "Dep";

  const card = (content: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{ borderRadius: "12px", border: "0.5px solid var(--line)", background: "var(--card)", padding: "12px 14px", ...style }}>{content}</div>
  );
  const pill = (text: string) => <span style={{ fontSize: "10px", padding: "1px 7px", borderRadius: "6px", background: "var(--veil)", color: "var(--ink-3)" }}>{text}</span>;
  const sectionLabel = (text: string) => <div style={{ fontSize: "10px", textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "var(--ink-3)", marginBottom: "4px", marginTop: "10px" }}>{text}</div>;
  const divider = () => <div style={{ height: "0.5px", background: "var(--line)", margin: "8px 0" }} />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)", color: "var(--ink)", padding: "16px" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ marginBottom: "14px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 500, color: "var(--ink)" }}>{t("nav.smartPrediction")}</h1>
          <p style={{ fontSize: "11px", color: "var(--ink-3)", marginTop: "2px" }}>{t("smartPrediction.subtitle")}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "210px minmax(0,1fr)", gap: "10px" }}>

          {/* Sol panel */}
          <div style={{ borderRadius: "12px", border: "0.5px solid var(--line)", background: "var(--card)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "2px" }}>

            {sectionLabel(t("smartPrediction.fixtureLabel"))}
            <select style={{ width: "100%", background: "var(--field)", border: "0.5px solid var(--line)", borderRadius: "8px", padding: "5px 8px", fontSize: "12px", color: "var(--ink)", marginBottom: "6px" }}
              value={fixtureId ?? ""} onChange={(e) => setFixtureId(e.target.value ? Number(e.target.value) : null)}>
              <option value="" style={{ background: "var(--field)" }}>{t("smartPrediction.selectFixturePlaceholder")}</option>
              {upcomingFixtures.map((f) => <option key={f.fixture_id} value={f.fixture_id} style={{ background: "var(--field)" }}>{t("smartPrediction.fixtureOptionLabel", { home: f.home_team_name, away: f.away_team_name, round: f.round_number })}</option>)}
            </select>

            {selectedFixture && <div style={{ fontSize: "10px", color: "var(--ink-3)", background: "var(--card)", borderRadius: "6px", padding: "4px 7px", marginBottom: "6px" }}>{t("smartPrediction.fixtureSummary", { home: selectedFixture.home_team_name, away: selectedFixture.away_team_name, round: selectedFixture.round_number })}</div>}

            {sectionLabel(t("smartPrediction.marketLabel"))}
            <select style={{ width: "100%", background: "var(--field)", border: "0.5px solid var(--line)", borderRadius: "8px", padding: "5px 8px", fontSize: "12px", color: "var(--ink)", marginBottom: "8px" }}
              value={market} onChange={(e) => setMarket(e.target.value as Market)}>
              {MARKETS.map((m) => <option key={m.value} value={m.value} style={{ background: "var(--field)" }}>{t(m.labelKey)}</option>)}
            </select>

            {sectionLabel(t("smartPrediction.oddsLabel"))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "5px", marginBottom: "8px" }}>
              {[{ label: "1", val: oddsH, set: setOddsH }, { label: "X", val: oddsX, set: setOddsX }, { label: "2", val: oddsA, set: setOddsA }].map(({ label, val, set }) => (
                <div key={label}>
                  <div style={{ fontSize: "10px", color: "var(--ink-3)", textAlign: "center", marginBottom: "2px" }}>{label}</div>
                  <input type="number" step="0.05" value={val} onChange={(e) => set(e.target.value)} style={{ width: "100%", background: "var(--field)", border: "0.5px solid var(--line)", borderRadius: "6px", padding: "4px 2px", fontSize: "11px", color: "var(--ink)", textAlign: "center" }} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "8px" }}>
              {[{ label: t("common.home"), pct: pHpct, color: "var(--accent)" }, { label: t("common.away"), pct: pApct, color: "#f97316" }].map(({ label, pct, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "10px", color: "var(--ink-3)", width: "62px", flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1, height: "5px", background: "var(--card-2)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "3px" }} />
                  </div>
                  <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--ink-2)", width: "26px", textAlign: "right", flexShrink: 0 }}>{pct}%</span>
                </div>
              ))}
            </div>

            {divider()}
            {sectionLabel(t("smartPrediction.parametersLabel"))}
            <SliderRow label={t("smartPrediction.lastNWeeksLabel")} id="n" min={1} max={maxN} step={1} value={nMatches} onChange={setNMatches} displayVal={String(nMatches)} />
            <SliderRow label={t("smartPrediction.impactPercentLabel")} id="eff" min={0} max={100} step={5} value={effPct} onChange={setEffPct} displayVal={`${effPct}%`} />
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <label style={{ fontSize: "11px", color: "var(--ink-3)", width: "88px", flexShrink: 0 }}>{t("smartPrediction.paybackLabel")}</label>
              <input type="number" min={80} max={100} step={0.5} value={payback} onChange={(e) => setPayback(parseFloat(e.target.value) || 93)} style={{ width: "64px", background: "var(--field)", border: "0.5px solid var(--line)", borderRadius: "6px", padding: "4px 6px", fontSize: "11px", color: "var(--ink)", textAlign: "center" }} />
            </div>

            {divider()}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <label style={{ fontSize: "11px", color: "var(--ink-3)", width: "88px", flexShrink: 0 }}>{t("smartPrediction.levelLabel")}</label>
              <select
                value={manualLevel}
                onChange={(e) => setManualLevel(Number(e.target.value) as 0|1|2|3)}
                style={{ flex: 1, background: "var(--field)", border: "0.5px solid var(--line)", borderRadius: "8px", padding: "5px 8px", fontSize: "12px", color: "var(--ink)" }}
              >
                <option value={0} style={{ background: "var(--field)" }}>{t("smartPrediction.levelOption", { n: 0 })}</option>
                <option value={1} style={{ background: "var(--field)" }}>{t("smartPrediction.levelOption", { n: 1 })}</option>
                <option value={2} style={{ background: "var(--field)" }}>{t("smartPrediction.levelOption", { n: 2 })}</option>
                <option value={3} style={{ background: "var(--field)" }}>{t("smartPrediction.levelOption", { n: 3 })}</option>
              </select>
            </div>
            <ToggleRow label={t("smartPrediction.refereeEffectLabel")} checked={refOn} onChange={setRefOn} />

            {refOn && (
              <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                {[{ label: t("smartPrediction.avgCardLabel"), val: refCard, set: setRefCard }, { label: t("smartPrediction.avgFoulLabel"), val: refFoul, set: setRefFoul }, { label: t("smartPrediction.homeCardLabel"), val: refHCard, set: setRefHCard }, { label: t("smartPrediction.awayCardLabel"), val: refACard, set: setRefACard }].map(({ label, val, set }) => (
                  <div key={label}>
                    <div style={{ fontSize: "10px", color: "var(--ink-3)", marginBottom: "2px" }}>{label}</div>
                    <input type="number" step="0.1" value={val} onChange={(e) => set(e.target.value)} style={{ width: "100%", background: "var(--field)", border: "0.5px solid var(--line)", borderRadius: "6px", padding: "4px 2px", fontSize: "11px", color: "var(--ink)", textAlign: "center" }} />
                  </div>
                ))}
              </div>
            )}

            {divider()}
            {sectionLabel(t("smartPrediction.yearsDistributionLabel"))}
            {seasonWeights.map((sw, idx) => (
              <div key={sw.season} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
                <span style={{ fontSize: "10px", color: sw.season === CURRENT_SEASON ? "var(--accent-ink)" : "var(--ink-3)", width: "60px", flexShrink: 0 }}>{sw.season.slice(2)}</span>
                <input type="number" min={0} max={100} step={5} value={sw.weight}
                  onChange={(e) => {
                    const newW = [...seasonWeights];
                    newW[idx] = { ...newW[idx], weight: parseFloat(e.target.value) || 0 };
                    setSeasonWeights(newW);
                  }}
                  style={{ width: "52px", background: sw.season === CURRENT_SEASON ? "var(--accent-soft)" : "var(--field)", border: `0.5px solid ${sw.season === CURRENT_SEASON ? "var(--line-strong)" : "var(--line)"}`, borderRadius: "6px", padding: "3px 4px", fontSize: "11px", color: "var(--ink)", textAlign: "center" }}
                />
                <span style={{ fontSize: "10px", color: "var(--ink-3)" }}>%</span>
              </div>
            ))}

          </div>

          {/* Sağ panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

            {/* 3 tablo */}
            {card(!selectedFixture ? (
              <p style={{ textAlign: "center", color: "var(--ink-3)", padding: "16px 0", fontSize: "13px" }}>{t("smartPrediction.selectFixturePrompt")}</p>
            ) : loading ? (
              <p style={{ textAlign: "center", color: "var(--ink-3)", padding: "16px 0", fontSize: "13px" }}>{t("common.loading")}</p>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--ink-2)" }}>{t("smartPrediction.matchupMarketLabel", { home: homeSlug, away: awaySlug, market: market.toUpperCase() })}</span>
                  <span style={{ fontSize: "10px", color: "var(--ink-3)" }}>{CURRENT_SEASON}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                  <StatsTable title={t("smartPrediction.yearsWeightedLabel")} badge={pill(`eff: ${100-effPct}%`)} homeSlug={homeSlug} awaySlug={awaySlug}
                    homeData={result?.table1.home ?? null} awayData={result?.table1.away ?? null}
                    homeEq={result?.table1.homeEq ?? null} awayEq={result?.table1.awayEq ?? null} />
                  <StatsTable title={t("smartPrediction.lastNWeeksValueLabel", { n: nMatches })} badge={pill(`eff: ${effPct}%`)} homeSlug={homeSlug} awaySlug={awaySlug}
                    homeData={result?.table2.home ?? null} awayData={result?.table2.away ?? null}
                    homeEq={result?.table2.homeEq ?? null} awayEq={result?.table2.awayEq ?? null} />
                  <StatsTable title={t("smartPrediction.weightedLabel")} badge={<span style={{ fontSize: "10px", color: "var(--ink-3)" }}>{t("smartPrediction.includedInEqLabel")}</span>} homeSlug={homeSlug} awaySlug={awaySlug}
                    homeData={result?.table3.home ?? null} awayData={result?.table3.away ?? null}
                    homeEq={result?.table3.homeEq ?? null} awayEq={result?.table3.awayEq ?? null} />
                </div>
              </>
            ))}

            {/* Tahmin sonuçları */}
            {card(!result ? (
              <p style={{ textAlign: "center", color: "var(--ink-3)", padding: "16px 0", fontSize: "13px" }}>{t("smartPrediction.selectFixturePrompt")}</p>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--ink-2)" }}>{t("smartPrediction.predictionResultsLabel")}</span>
                  <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", fontWeight: 500 }} className={LEVEL_STYLES[result.level]}>{t("smartPrediction.levelOption", { n: result.level })}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                  {[{ label: t("smartPrediction.homePredictionLabel"), val: f2(result.predHome) }, { label: t("smartPrediction.awayPredictionLabel"), val: f2(result.predAway) }, { label: t("smartPrediction.totalLabel"), val: f2(result.total) }].map(({ label, val }) => (
                    <div key={label} style={{ background: "var(--card-2)", borderRadius: "8px", padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: "10px", color: "var(--ink-3)", marginBottom: "3px" }}>{label}</div>
                      <div style={{ fontSize: "20px", fontWeight: 500, color: "var(--ink)" }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { label: t("smartPrediction.firstHalfLabel"), h: result.predHome * result.halfRatio[0], a: result.predAway * result.halfRatio[0], pct: Math.round(result.halfRatio[0] * 100) },
                    { label: t("smartPrediction.secondHalfLabel"), h: result.predHome * result.halfRatio[1], a: result.predAway * result.halfRatio[1], pct: Math.round(result.halfRatio[1] * 100) },
                  ].map(({ label, h, a, pct }) => (
                    <div key={label} style={{ background: "var(--card-2)", borderRadius: "8px", padding: "8px 10px" }}>
                      <div style={{ fontSize: "10px", color: "var(--ink-3)", marginBottom: "3px" }}>{label}</div>
                      <div style={{ fontSize: "15px", fontWeight: 500, color: "var(--ink)" }}>{f2(h)} / {f2(a)}</div>
                      <div style={{ fontSize: "10px", color: "var(--ink-3)", marginTop: "2px" }}>{t("smartPrediction.ratioLabel", { pct })}</div>
                    </div>
                  ))}
                </div>
              </>
            ))}

            {/* Over/Under — 3 blok */}
            {card(!ouResult ? (
              <p style={{ textAlign: "center", color: "var(--ink-3)", padding: "16px 0", fontSize: "13px" }}>{t("smartPrediction.selectFixturePrompt")}</p>
            ) : (
              <>
                <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--ink-2)", marginBottom: "12px" }}>{t("smartPrediction.overUnderSuggestionsLabel")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <OUTable label={t("smartPrediction.totalLabel")} total={ouResult.total} home={ouResult.home} away={ouResult.away} />
                  <OUTable label={t("smartPrediction.firstHalfLabel")} total={ouResult.h1} home={ouResult.h1Home} away={ouResult.h1Away} />
                  <OUTable label={t("smartPrediction.secondHalfLabel")} total={ouResult.h2} home={ouResult.h2Home} away={ouResult.h2Away} />
                </div>
              </>
            ))}

          </div>
        </div>
      </div>
    </div>
  );
}
