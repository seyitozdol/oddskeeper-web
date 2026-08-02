"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { buildConfiguredLines, buildLadder, type LineConfig } from "@/features/basketball/odds";
import {
  fetchPmFixtures, insertFixture, deleteFixture, type PmFixture,
  fetchMarketConfig, upsertMarketConfig, deleteMarketConfig, type PmMarketConfig,
  fetchPlayerIds, savePlayerIds,
} from "@/features/basketball/pmQueries";
import { VB_MARKETS, vbMarketStd } from "../toolsMarkets";
import { vbwPhotoUrl } from "../lib";
import type { VbTeamMatch, VbPlayerMatch, VbToolsPlayer, VbTeam } from "../server/getVolleyballTools";

const LEAGUE = "volleyball";
const PROP_PAYBACK = 0.915;
const TEAM_PAYBACK = 0.96;
const DEFAULT_CFG: LineConfig = { lines: 5, under_lines: 5, payback: null, round_odds: false, max_lines: 15, odds_cap: 999, skip_after: 5, skip_step: 2 };

type Tab = "model" | "players" | "fixtures" | "config" | "input";
type Side = "home" | "away" | "total";

type VbInputRow = { kind: "team" | "player"; fixtureExtId: string; template: string; participant: string; side: number; line: number; over: number; under: number | null; label: string; name: string };

const btnSave = "rounded-md border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-[12px] font-semibold text-teal-300 hover:bg-teal-500/20";
const btnGhost = "rounded-md border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:text-ink";
const accentBtn = "rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:opacity-90";

function fmt(v: number | null | undefined, d = 1) { if (v == null || Number.isNaN(v)) return "-"; return Number(v).toFixed(d); }
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
// son-N agirlikli ort (en yeni en yuksek agirlik)
function weighted(a: number[]): number { if (!a.length) return NaN; let n = 0, d = 0; a.forEach((v, i) => { const w = a.length - i; n += v * w; d += w; }); return n / d; }

const teamVal = (r: VbTeamMatch, k: string): number | null => (r as unknown as Record<string, number | null>)[k];
const playerVal = (r: VbPlayerMatch, k: string): number | null => {
  if (k === "rec_pct") return r.rec_att && r.rec_att > 0 ? Math.round(((r.rec_succ ?? 0) / r.rec_att) * 10000) / 100 : null;
  return (r as unknown as Record<string, number | null>)[k];
};

const photoUrl = (sid: number | null | undefined) => (sid ? `https://img.sofascore.com/api/v1/player/${sid}/image` : null);
const cleanName = (s: string | null) => (s ?? "").replace(/\s+[A-Z]{3}$/, "").trim();

function NumInput({ value, onChange, w = "w-16" }: { value: number; onChange: (v: number) => void; w?: string }) {
  const [buf, setBuf] = useState<string | null>(null);
  return (
    <input type="number" value={buf ?? String(value)} step={0.1}
      onChange={(e) => { const s = e.target.value; setBuf(s); const v = parseFloat(s); if (!Number.isNaN(v)) onChange(v); }}
      onBlur={() => setBuf(null)}
      className={`${w} rounded-md border border-line bg-field px-2 py-1 text-right text-[13px] tabular-nums text-ink outline-none focus:border-line-strong`} />
  );
}

export default function VolleyballTools({ teamMatches, playerMatches, players, teams }: { teamMatches: VbTeamMatch[]; playerMatches: VbPlayerMatch[]; players: VbToolsPlayer[]; teams: VbTeam[] }) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Tab>("model");
  const [fixtures, setFixtures] = useState<PmFixture[]>([]);
  const [config, setConfig] = useState<PmMarketConfig[]>([]);
  const [playerIds, setPlayerIds] = useState<Record<string, string>>({});
  const [inputRows, setInputRows] = useState<VbInputRow[]>([]);

  const reloadFixtures = () => fetchPmFixtures(LEAGUE).then(setFixtures);
  const reloadConfig = () => fetchMarketConfig(LEAGUE).then(setConfig);
  useEffect(() => { reloadFixtures(); reloadConfig(); fetchPlayerIds(LEAGUE).then(setPlayerIds); }, []);

  const TABS: { id: Tab; label: string }[] = [
    { id: "model", label: t("volleyball.tabModel") },
    { id: "players", label: t("volleyball.tabPlayerList") },
    { id: "fixtures", label: t("volleyball.tabFixtures") },
    { id: "config", label: t("volleyball.tabConfig") },
    { id: "input", label: `${t("volleyball.tabInput")}${inputRows.length ? ` (${inputRows.length})` : ""}` },
  ];

  const onAdd = (rows: VbInputRow[]) => setInputRows((p) => [...p, ...rows]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`rounded-lg px-4 py-1.5 text-[13px] ${tab === tb.id ? "bg-veil font-semibold text-ink" : "text-ink-3 hover:text-ink-2"}`}>{tb.label}</button>
        ))}
      </div>

      <div className={tab === "model" ? "" : "hidden"}>
        <ModelTab teamMatches={teamMatches} playerMatches={playerMatches} players={players} teams={teams} fixtures={fixtures} config={config} playerIds={playerIds} onAdd={onAdd} inputRows={inputRows} t={t} locale={locale} />
      </div>
      {tab === "players" && <PlayerListTab players={players} playerIds={playerIds} onSaved={setPlayerIds} t={t} />}
      {tab === "fixtures" && <FixturesTab fixtures={fixtures} teams={teams} reload={reloadFixtures} t={t} />}
      {tab === "config" && <ConfigTab config={config} reload={reloadConfig} t={t} />}
      {tab === "input" && <InputTab rows={inputRows} setRows={setInputRows} t={t} />}
    </div>
  );
}

/* ================= MODEL ================= */
function ModelTab({ teamMatches, playerMatches, players, teams, fixtures, config, playerIds, onAdd, inputRows, t, locale }: {
  teamMatches: VbTeamMatch[]; playerMatches: VbPlayerMatch[]; players: VbToolsPlayer[]; teams: VbTeam[];
  fixtures: PmFixture[]; config: PmMarketConfig[]; playerIds: Record<string, string>;
  onAdd: (r: VbInputRow[]) => void; inputRows: VbInputRow[]; t: (k: string) => string; locale: string;
}) {
  const [sub, setSub] = useState<"team" | "player">("team");
  const [fixSel, setFixSel] = useState("");
  const [trader, setTrader] = useState<Record<string, number>>({});       // `${code}:${mk}`
  const [totalOv, setTotalOv] = useState<Record<string, number>>({});     // `${mk}`
  const [teamTicks, setTeamTicks] = useState<Record<string, boolean>>({}); // `${col}:${mk}` col=code|total
  const [teamStatus, setTeamStatus] = useState("");

  const teamNameOf = useMemo(() => new Map(teams.map((tm) => [tm.team_code, tm.team_name ?? tm.team_code])), [teams]);
  const fixture = fixtures.find((f) => String(f.id) === fixSel);
  const homeCode = fixture?.home_team_slug ?? null;
  const awayCode = fixture?.away_team_slug ?? null;
  const fixExtId = fixture?.external_id ?? "";

  const teamCfg = useMemo(() => new Map(config.filter((c) => c.market_group === "team").map((c) => [c.market_key, c])), [config]);
  const playerCfg = useMemo(() => new Map(config.filter((c) => c.market_group === "player").map((c) => [c.market_key, c])), [config]);
  const stdOf = (grp: "team" | "player", mk: string) => ((grp === "team" ? teamCfg : playerCfg).get(mk)?.std ?? vbMarketStd(mk)) as number;
  const tplOf = (grp: "team" | "player", mk: string) => (grp === "team" ? teamCfg : playerCfg).get(mk)?.template_id ?? VB_MARKETS.find((m) => m.key === mk)?.tpl ?? "";

  const rowsForTeam = (code: string | null): VbTeamMatch[] =>
    code ? [...teamMatches].filter((r) => r.team_code === code).sort((a, b) => String(b.match_date).localeCompare(String(a.match_date))) : [];
  const teamAgg = (code: string | null, mk: string) => {
    const vals = rowsForTeam(code).map((r) => teamVal(r, mk)).filter((v): v is number => v != null);
    return { avg: mean(vals), l5: mean(vals.slice(0, 5)), l10: mean(vals.slice(0, 10)), model: weighted(vals.slice(0, 10)), n: vals.length };
  };
  const traderVal = (code: string | null, mk: string) => (code && trader[`${code}:${mk}`] != null) ? trader[`${code}:${mk}`] : Math.round(teamAgg(code, mk).model * 10) / 10;
  const totalValue = (mk: string) => totalOv[mk] ?? Math.round((traderVal(homeCode, mk) + traderVal(awayCode, mk)) * 10) / 10;
  const isTeamTicked = (col: string, mk: string) => teamTicks[`${col}:${mk}`] !== false;

  const addTeam = () => {
    if (!homeCode || !awayCode) return;
    const rows: VbInputRow[] = [];
    let sent = 0, dup = 0, noTpl = 0, zero = 0;
    const existing = new Set(inputRows.filter((r) => r.kind === "team").map((r) => r.template));
    const cols: { col: string; sideNum: number; label: string; value: (mk: string) => number }[] = [
      { col: homeCode, sideNum: 1, label: "home", value: (mk) => traderVal(homeCode, mk) },
      { col: awayCode, sideNum: 2, label: "away", value: (mk) => traderVal(awayCode, mk) },
      { col: "total", sideNum: 0, label: "total", value: (mk) => totalValue(mk) },
    ];
    for (const c of cols) {
      for (const m of VB_MARKETS) {
        if (!isTeamTicked(c.col, m.key)) continue;
        const tpl = tplOf("team", m.key);
        if (!tpl) { noTpl++; continue; }
        const sideTpl = `${tpl}_${c.label}`;
        if (existing.has(sideTpl)) { dup++; continue; }
        const val = c.value(m.key);
        if (!(val > 0)) { zero++; continue; }
        for (const r of buildConfiguredLines(val, stdOf("team", m.key), teamCfg.get(m.key) ?? DEFAULT_CFG, TEAM_PAYBACK)) {
          rows.push({ kind: "team", fixtureExtId: fixExtId, template: sideTpl, participant: "", side: c.sideNum, line: r.line, over: r.overPrice, under: r.underPrice, label: `${c.label} ${m.label}`, name: c.col === "total" ? "Total" : (teamNameOf.get(c.col) ?? c.col) });
        }
        sent++;
      }
    }
    if (rows.length) onAdd(rows);
    setTeamStatus(`${t("volleyball.statSent").replace("{n}", String(sent))}${dup ? " · " + t("volleyball.statDup").replace("{n}", String(dup)) : ""}${noTpl ? " · " + t("volleyball.statNoTpl").replace("{n}", String(noTpl)) : ""}`);
  };
  const resetTeam = () => { setTrader({}); setTotalOv({}); setTeamTicks({}); };

  const homeName = homeCode ? (teamNameOf.get(homeCode) ?? homeCode) : "";
  const awayName = awayCode ? (teamNameOf.get(awayCode) ?? awayCode) : "";

  return (
    <div className="space-y-6">
      {/* fixture secimi */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("volleyball.fixtureLabel")}</span>
          <select value={fixSel} onChange={(e) => setFixSel(e.target.value)}
            className="rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink outline-none focus:border-line-strong">
            <option value="">{t("volleyball.pickFixture")}…</option>
            {fixtures.map((f) => (
              <option key={f.id} value={f.id}>
                {f.home_team_name || f.home_team_slug} — {f.away_team_name || f.away_team_slug}{f.external_id ? ` [${f.external_id}]` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!fixture ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-3">{t("volleyball.needFixture")}</p>
      ) : (
        <>
          <div className="flex gap-1.5">
            {([["team", t("volleyball.tabTeamMetrics")], ["player", t("volleyball.tabPlayerDist")]] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setSub(k)} className={`rounded-full px-4 py-1.5 text-xs font-semibold ${sub === k ? "bg-accent text-white" : "bg-card-2 text-ink-2 hover:text-ink"}`}>{lbl}</button>
            ))}
          </div>

          {sub === "team" ? (
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="text-[11px] text-ink-3">{t("volleyball.addTeamHint")}</span>
                {teamStatus ? <span className="rounded-md bg-veil px-2 py-1 text-[11px] font-semibold text-ink-2">{teamStatus}</span> : null}
                <button onClick={resetTeam} className="ml-auto rounded-md border border-line px-3 py-2 text-[12px] font-semibold text-ink-2 hover:text-ink">{t("volleyball.reset")}</button>
                <button onClick={addTeam} className={accentBtn}>{t("volleyball.addToInput")}</button>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <TeamMetricTable title={homeName} agg={(mk) => teamAgg(homeCode, mk)} traderVal={(mk) => traderVal(homeCode, mk)}
                  setTrader={(mk, v) => setTrader((p) => ({ ...p, [`${homeCode}:${mk}`]: v }))}
                  isTicked={(mk) => isTeamTicked(homeCode ?? "", mk)} setTick={(mk, v) => setTeamTicks((p) => ({ ...p, [`${homeCode}:${mk}`]: v }))} t={t} />
                <TeamMetricTable title={awayName} agg={(mk) => teamAgg(awayCode, mk)} traderVal={(mk) => traderVal(awayCode, mk)}
                  setTrader={(mk, v) => setTrader((p) => ({ ...p, [`${awayCode}:${mk}`]: v }))}
                  isTicked={(mk) => isTeamTicked(awayCode ?? "", mk)} setTick={(mk, v) => setTeamTicks((p) => ({ ...p, [`${awayCode}:${mk}`]: v }))} t={t} />
                <TotalMetricTable title={t("volleyball.side_total")} totalValue={totalValue} setOverride={(mk, v) => setTotalOv((p) => ({ ...p, [mk]: v }))}
                  isTicked={(mk) => isTeamTicked("total", mk)} setTick={(mk, v) => setTeamTicks((p) => ({ ...p, [`total:${mk}`]: v }))} t={t} />
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <TeamRecent title={homeName} rows={rowsForTeam(homeCode)} locale={locale} t={t} />
                <TeamRecent title={awayName} rows={rowsForTeam(awayCode)} locale={locale} t={t} />
              </div>
            </div>
          ) : (
            <PlayerDist playerMatches={playerMatches} players={players} playerCfg={playerCfg} playerIds={playerIds}
              homeCode={homeCode} awayCode={awayCode} homeName={homeName} awayName={awayName}
              stdOf={(mk) => stdOf("player", mk)} tplOf={(mk) => tplOf("player", mk)} fixExtId={fixExtId}
              onAdd={onAdd} inputRows={inputRows} t={t} />
          )}
        </>
      )}
    </div>
  );
}

function TeamMetricTable({ title, agg, traderVal, setTrader, isTicked, setTick, t }: {
  title: string;
  agg: (mk: string) => { avg: number; l5: number; l10: number; model: number; n: number };
  traderVal: (mk: string) => number; setTrader: (mk: string, v: number) => void;
  isTicked: (mk: string) => boolean; setTick: (mk: string, v: boolean) => void; t: (k: string) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="mb-2 text-[12px] font-semibold text-ink">{title}</div>
      <table className="min-w-full border-collapse text-[11px]">
        <thead><tr className="border-b border-line text-[9px] uppercase tracking-[0.1em] text-ink-3">
          <th className="px-1 py-1"></th>
          <th className="px-1 py-1 text-left">{t("volleyball.colMarket")}</th>
          <th className="px-1 py-1 text-right">{t("volleyball.colAvg")}</th>
          <th className="px-1 py-1 text-right">L5</th>
          <th className="px-1 py-1 text-right">L10</th>
          <th className="px-1 py-1 text-right">{t("volleyball.colModel")}</th>
          <th className="px-1 py-1 text-right">{t("volleyball.colTrader")}</th>
        </tr></thead>
        <tbody>
          {VB_MARKETS.map((m) => {
            const a = agg(m.key);
            const on = isTicked(m.key);
            const tv = Math.round(traderVal(m.key) * 10) / 10;
            return (
              <tr key={m.key} className={`border-t border-line ${on ? "" : "opacity-45"}`}>
                <td className="px-1 py-0.5 text-center"><input type="checkbox" checked={on} onChange={(e) => setTick(m.key, e.target.checked)} className="accent-[var(--accent)]" /></td>
                <td className="px-1 py-0.5 text-ink whitespace-nowrap" title={m.label}>{m.label}</td>
                <td className="px-1 py-0.5 text-right tabular-nums text-ink-3">{fmt(a.avg)}</td>
                <td className="px-1 py-0.5 text-right tabular-nums text-ink-3">{fmt(a.l5)}</td>
                <td className="px-1 py-0.5 text-right tabular-nums text-ink-3">{fmt(a.l10)}</td>
                <td className="px-1 py-0.5 text-right tabular-nums text-ink-2">{fmt(a.model)}</td>
                <td className="px-1 py-0.5 text-right"><NumInput value={tv} onChange={(v) => setTrader(m.key, v)} w="w-20" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TotalMetricTable({ title, totalValue, setOverride, isTicked, setTick, t }: {
  title: string; totalValue: (mk: string) => number; setOverride: (mk: string, v: number) => void;
  isTicked: (mk: string) => boolean; setTick: (mk: string, v: boolean) => void; t: (k: string) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="mb-2 text-[12px] font-semibold text-ink">{title}</div>
      <table className="min-w-full border-collapse text-[11px]">
        <thead><tr className="border-b border-line text-[9px] uppercase tracking-[0.1em] text-ink-3">
          <th className="px-1 py-1"></th>
          <th className="px-1 py-1 text-left">{t("volleyball.colMarket")}</th>
          <th className="px-1 py-1 text-right">{t("volleyball.colTrader")}</th>
        </tr></thead>
        <tbody>
          {VB_MARKETS.map((m) => {
            const on = isTicked(m.key);
            return (
              <tr key={m.key} className={`border-t border-line ${on ? "" : "opacity-45"}`}>
                <td className="px-1 py-0.5 text-center"><input type="checkbox" checked={on} onChange={(e) => setTick(m.key, e.target.checked)} className="accent-[var(--accent)]" /></td>
                <td className="px-1 py-0.5 text-ink whitespace-nowrap" title={m.label}>{m.label}</td>
                <td className="px-1 py-0.5 text-right"><NumInput value={Math.round(totalValue(m.key) * 10) / 10} onChange={(v) => setOverride(m.key, v)} w="w-24" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TeamRecent({ title, rows, locale, t }: { title: string; rows: VbTeamMatch[]; locale: string; t: (k: string) => string }) {
  const fmtDate = (d: string | null) => { if (!d) return "-"; const dt = new Date(d); return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "2-digit", month: "short", year: "2-digit" }); };
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{title} · {t("volleyball.recentMatches")}</div>
      <div className="max-h-80 overflow-auto">
        <table className="min-w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-card-2"><tr className="text-[9px] uppercase tracking-[0.1em] text-ink-3">
            <th className="px-1.5 py-1 text-left">{t("volleyball.thDate")}</th>
            <th className="px-1.5 py-1 text-left">{t("volleyball.opponent")}</th>
            <th className="px-1.5 py-1 text-center">H/A</th>
            <th className="px-1.5 py-1 text-right">Pts</th><th className="px-1.5 py-1 text-right">Atk</th>
            <th className="px-1.5 py-1 text-right">Blk</th><th className="px-1.5 py-1 text-right">Ace</th>
            <th className="px-1.5 py-1 text-right">Dig</th><th className="px-1.5 py-1 text-right">Rec%</th>
          </tr></thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-1.5 py-0.5 text-ink-3 whitespace-nowrap">{fmtDate(m.match_date)}</td>
                <td className="px-1.5 py-0.5 text-ink-2 whitespace-nowrap">{cleanName(m.opponent)} <span className={m.result === "W" ? "text-pos" : "text-neg"}>{m.result}</span></td>
                <td className="px-1.5 py-0.5 text-center text-ink-3">{m.side}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink">{fmt(m.points, 0)}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-2">{fmt(m.attack, 0)}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-2">{fmt(m.block, 0)}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-2">{fmt(m.ace, 0)}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-2">{fmt(m.digs, 0)}</td>
                <td className="px-1.5 py-0.5 text-right tabular-nums text-ink-2">{fmt(m.rec_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= PLAYER DIST ================= */
function PlayerDist({ playerMatches, players, playerCfg, playerIds, stdOf, tplOf, fixExtId, homeCode, awayCode, homeName, awayName, onAdd, inputRows, t }: {
  playerMatches: VbPlayerMatch[]; players: VbToolsPlayer[]; playerCfg: Map<string, PmMarketConfig>; playerIds: Record<string, string>;
  stdOf: (mk: string) => number; tplOf: (mk: string) => string; fixExtId: string;
  homeCode: string | null; awayCode: string | null; homeName: string; awayName: string;
  onAdd: (r: VbInputRow[]) => void; inputRows: VbInputRow[]; t: (k: string) => string;
}) {
  const [side, setSide] = useState<"home" | "away">("home");
  const teamCode = side === "home" ? homeCode : awayCode;
  const teamSideNum = side === "home" ? 1 : 2;
  const [mk, setMk] = useState(VB_MARKETS[0].key);
  const [vals, setVals] = useState<Record<string, number>>({});
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<{ k: string; d: "asc" | "desc" }>({ k: "avg", d: "desc" });
  const market = VB_MARKETS.find((m) => m.key === mk)!;
  const pById = useMemo(() => new Map(players.map((p) => [p.fivb_id, p])), [players]);

  // oyuncu -> secili taraf/market ort
  const agg = useMemo(() => {
    const byPlayer = new Map<number, number[]>();
    const matched = [...playerMatches]
      .filter((r) => r.team_code === teamCode)
      .sort((a, b) => String(b.match_date).localeCompare(String(a.match_date)));
    for (const r of matched) {
      const v = playerVal(r, mk);
      if (v == null) continue;
      if (!byPlayer.has(r.fivb_id)) byPlayer.set(r.fivb_id, []);
      byPlayer.get(r.fivb_id)!.push(v);
    }
    return byPlayer;
  }, [playerMatches, teamCode, mk]);

  // Katilim: takimin toplam maci + oyuncu basina oynadigi mac (market bagimsiz) -> rol.
  const { teamTotal, matchCount } = useMemo(() => {
    const teamDates = new Set<string>();
    const perPlayer = new Map<number, Set<string>>();
    for (const r of playerMatches) {
      if (r.team_code !== teamCode) continue;
      const d = r.match_date ?? "";
      teamDates.add(d);
      if (!perPlayer.has(r.fivb_id)) perPlayer.set(r.fivb_id, new Set());
      perPlayer.get(r.fivb_id)!.add(d);
    }
    return { teamTotal: teamDates.size, matchCount: perPlayer };
  }, [playerMatches, teamCode]);

  const rows = useMemo(() => {
    const out = [...agg.entries()].map(([fivb_id, vs]) => {
      const p = pById.get(fivb_id);
      const played = matchCount.get(fivb_id)?.size ?? vs.length;
      const ratio = teamTotal > 0 ? played / teamTotal : 0;
      return { fivb_id, name: cleanName(p?.full_name ?? p?.short_name ?? String(fivb_id)), position: p?.position ?? null, sid: p?.sofascore_player_id ?? null, vbw: p?.vbw_photo ?? null, games: vs.length, played, roleKey: roleKeyOf(ratio), avg: mean(vs), l5: mean(vs.slice(0, 5)), l10: mean(vs.slice(0, 10)) };
    }).filter((r) => r.games > 0);
    const dir = sort.d === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const va = (a as unknown as Record<string, number | string>)[sort.k] ?? 0;
      const vb = (b as unknown as Record<string, number | string>)[sort.k] ?? 0;
      if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb), "tr") * dir;
      return ((va as number) - (vb as number)) * dir;
    });
    return out;
  }, [agg, pById, sort, teamTotal, matchCount]);

  const valueOf = (fivb_id: number, def: number) => vals[`${fivb_id}`] ?? Math.round(def * 10) / 10;
  const isTicked = (fivb_id: number, avg: number) => (ticks[`${fivb_id}`] != null ? ticks[`${fivb_id}`] : avg > 0);
  const participantOf = (fivb_id: number) => playerIds[String(fivb_id)] || String(fivb_id);
  const cfg = playerCfg.get(mk) ?? DEFAULT_CFG;
  const ladder = (v: number) => buildConfiguredLines(v, stdOf(mk), cfg, PROP_PAYBACK);

  const add = () => {
    const out: VbInputRow[] = [];
    let sent = 0, dup = 0, zero = 0, noTpl = 0;
    const tpl = tplOf(mk);
    const existing = new Set(inputRows.filter((r) => r.kind === "player").map((r) => `${r.template}|${r.participant}`));
    for (const r of rows) {
      if (!isTicked(r.fivb_id, r.avg)) continue;
      if (!tpl) { noTpl++; continue; }
      if (existing.has(`${tpl}|${participantOf(r.fivb_id)}`)) { dup++; continue; }
      const v = valueOf(r.fivb_id, r.l10 || r.avg);
      if (!(v > 0)) { zero++; continue; }
      for (const ln of ladder(v)) out.push({ kind: "player", fixtureExtId: fixExtId, template: tpl, participant: participantOf(r.fivb_id), side: teamSideNum, line: ln.line, over: ln.overPrice, under: ln.underPrice, label: market.label, name: r.name });
      sent++;
    }
    if (out.length) onAdd(out);
    setStatus(`${t("volleyball.statSent").replace("{n}", String(sent))}${dup ? " · " + t("volleyball.statDup").replace("{n}", String(dup)) : ""}${noTpl ? " · " + t("volleyball.statNoTpl").replace("{n}", String(noTpl)) : ""}`);
  };
  const toggleSort = (k: string) => setSort((s) => (s.k === k ? { k, d: s.d === "asc" ? "desc" : "asc" } : { k, d: k === "name" ? "asc" : "desc" }));
  const arrow = (k: string) => (sort.k === k ? (sort.d === "asc" ? " ▲" : " ▼") : "");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{t("volleyball.pickTeam")}</span>
          {(["home", "away"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)} className={`rounded-md px-3 py-1 text-[12px] font-semibold ${side === s ? "bg-accent text-white" : "bg-card-2 text-ink-3 hover:text-ink"}`}>{s === "home" ? homeName : awayName}</button>
          ))}
        </div>
        {status ? <span className="rounded-md bg-veil px-2 py-1 text-[11px] font-semibold text-ink-2">{status}</span> : null}
        <button onClick={() => setVals({})} className="ml-auto rounded-md border border-line px-3 py-2 text-[12px] font-semibold text-ink-2 hover:text-ink">{t("volleyball.reset")}</button>
        <button onClick={add} className={accentBtn}>{t("volleyball.addToInput")}</button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-card-2/40 px-2.5 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{t("volleyball.pickMarket")}</span>
        {VB_MARKETS.map((m) => (
          <button key={m.key} onClick={() => setMk(m.key)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${m.key === mk ? "bg-accent-soft text-accent-ink ring-1 ring-accent/40" : "bg-veil text-ink-3 hover:text-ink"}`}>{m.label}</button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[13px]">
          <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
            <th className="px-2 py-1.5 text-center"><input type="checkbox" checked={rows.length > 0 && rows.every((r) => isTicked(r.fivb_id, r.avg))} onChange={(e) => rows.forEach((r) => setTicks((p) => ({ ...p, [`${r.fivb_id}`]: e.target.checked })))} className="accent-[var(--accent)]" /></th>
            <th className="px-2 py-1.5 text-left"><button onClick={() => toggleSort("name")} className="uppercase tracking-[0.12em] hover:text-ink">{t("volleyball.thPlayer")}{arrow("name")}</button></th>
            <th className="px-2 py-1.5 text-center">{t("volleyball.thPos")}</th>
            <th className="px-2 py-1.5 text-left" title={t("volleyball.roleInfo")}><button onClick={() => toggleSort("roleKey")} className="uppercase tracking-[0.12em] hover:text-ink">{t("volleyball.colRole")}{arrow("roleKey")}</button></th>
            <th className="px-2 py-1.5 text-right" title={t("volleyball.matchesInfo")}><button onClick={() => toggleSort("games")} className="uppercase tracking-[0.12em] hover:text-ink">{t("volleyball.colMatches")}{arrow("games")}</button></th>
            <th className="px-2 py-1.5 text-right"><button onClick={() => toggleSort("l5")} className="uppercase tracking-[0.12em] hover:text-ink">L5{arrow("l5")}</button></th>
            <th className="px-2 py-1.5 text-right"><button onClick={() => toggleSort("l10")} className="uppercase tracking-[0.12em] hover:text-ink">L10{arrow("l10")}</button></th>
            <th className="px-2 py-1.5 text-right"><button onClick={() => toggleSort("avg")} className="uppercase tracking-[0.12em] hover:text-ink">{t("volleyball.colAvg")}{arrow("avg")}</button></th>
            <th className="px-2 py-1.5 text-right">{t("volleyball.colTrader")}</th>
            <th className="px-2 py-1.5 text-right">{t("volleyball.colLineShort")}</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const on = isTicked(r.fivb_id, r.avg);
              const v = valueOf(r.fivb_id, r.l10 || r.avg);
              const mid = on ? buildLadder(v, stdOf(mk), PROP_PAYBACK).find((x) => x.isMid) : null;
              const url = vbwPhotoUrl(r.vbw) ?? photoUrl(r.sid);
              return (
                <tr key={r.fivb_id} className={`border-t border-line ${on ? "" : "opacity-45"}`}>
                  <td className="px-2 py-1 text-center"><input type="checkbox" checked={on} onChange={(e) => setTicks((p) => ({ ...p, [`${r.fivb_id}`]: e.target.checked }))} className="accent-[var(--accent)]" /></td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2 align-middle">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" width={24} height={24} loading="lazy" className="h-6 w-6 shrink-0 rounded-full border border-line bg-card-2 object-cover" />
                      ) : <span className="h-6 w-6 shrink-0 rounded-full border border-line bg-card-2" />}
                      <span className="text-ink">{r.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1 text-center">{r.position ? <span className="inline-block rounded bg-veil px-1.5 py-0.5 text-[10px] font-semibold text-ink-2">{shortPos(r.position)}</span> : <span className="text-ink-3">-</span>}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{r.roleKey !== "none" ? <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${roleBadgeClass(r.roleKey)}`} title={`${r.played}/${teamTotal}`}>{t(`volleyball.role_${r.roleKey}`)}</span> : <span className="text-ink-3">-</span>}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-3">{r.games}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-3">{fmt(r.l5)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-3">{fmt(r.l10)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-2">{fmt(r.avg)}</td>
                  <td className="px-2 py-1 text-right">{on ? <NumInput value={v} onChange={(nv) => setVals((p) => ({ ...p, [`${r.fivb_id}`]: nv }))} /> : <span className="text-ink-3">-</span>}</td>
                  <td className="px-2 py-1 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="tabular-nums text-accent-ink">{mid ? `${mid.line.toFixed(1)} ${mid.overPrice.toFixed(2)}/${mid.underPrice.toFixed(2)}` : "-"}</span>
                      {on ? <button onClick={() => setPreview(preview === String(r.fivb_id) ? null : String(r.fivb_id))} className="text-ink-3 hover:text-accent-ink"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg></button> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {preview ? (() => {
        const r = rows.find((x) => String(x.fivb_id) === preview); if (!r) return null;
        const v = valueOf(r.fivb_id, r.l10 || r.avg);
        return (
          <div className="fixed inset-0 z-[90] flex justify-end" onClick={() => setPreview(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative h-full w-full max-w-sm overflow-auto bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-ink">{r.name}</h3>
              <p className="mt-0.5 text-[11px] text-ink-3">{market.label} · {t("volleyball.colTrader")} <span className="font-semibold text-accent-ink">{fmt(v)}</span> · Std {stdOf(mk)}</p>
              <table className="mt-4 min-w-full border-collapse text-[12px]">
                <thead><tr className="border-b border-line text-[9px] uppercase tracking-[0.1em] text-ink-3"><th className="px-2 py-1 text-right">{t("volleyball.colLineShort")}</th><th className="px-2 py-1 text-right">{t("volleyball.oddsOver")}</th><th className="px-2 py-1 text-right">{t("volleyball.oddsUnder")}</th></tr></thead>
                <tbody>{ladder(v).map((ln, i) => (<tr key={i} className={`border-t border-line ${ln.isMid ? "bg-veil font-semibold" : ""}`}><td className="px-2 py-1 text-right tabular-nums text-ink">{ln.line.toFixed(1)}</td><td className="px-2 py-1 text-right tabular-nums text-ink">{ln.overPrice.toFixed(2)}</td><td className="px-2 py-1 text-right tabular-nums text-ink-2">{ln.underPrice == null ? "—" : ln.underPrice.toFixed(2)}</td></tr>))}</tbody>
              </table>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}

// Katilim rolu: oynadigi mac / takim toplam maci orani. Voleybolda sure yok, oran+pozisyon yeter.
function roleKeyOf(ratio: number): "starter" | "rotation" | "limited" | "none" {
  if (ratio >= 0.7) return "starter";
  if (ratio >= 0.35) return "rotation";
  if (ratio > 0) return "limited";
  return "none";
}
function roleBadgeClass(key: string): string {
  return key === "starter" ? "bg-emerald-500/15 text-emerald-300"
    : key === "rotation" ? "bg-sky-500/15 text-sky-300"
    : key === "limited" ? "bg-amber-500/15 text-amber-300"
    : "bg-veil text-ink-3";
}

function shortPos(p: string | null): string {
  if (!p) return "-";
  const map: Record<string, string> = { "opposite spiker": "OP", "outside hitter": "OH", "middle blocker": "MB", "setter": "S", "libero": "L" };
  return map[p.toLowerCase()] ?? p.slice(0, 3).toUpperCase();
}

/* ================= PLAYER LIST ================= */
function PlayerListTab({ players, playerIds, onSaved, t }: { players: VbToolsPlayer[]; playerIds: Record<string, string>; onSaved: (m: Record<string, string>) => void; t: (k: string) => string }) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const val = (id: number) => edits[String(id)] ?? playerIds[String(id)] ?? "";
  const save = async () => { setSaving(true); const ok = await savePlayerIds(edits, LEAGUE); setSaving(false); if (ok) { onSaved({ ...playerIds, ...edits }); setEdits({}); } };
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button onClick={save} disabled={saving || Object.keys(edits).length === 0} className={`${btnSave} disabled:opacity-50`}>{t("volleyball.save")}</button>
        <span className="text-[11px] text-ink-3">{players.length}</span>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-full border-collapse text-[13px]">
          <thead className="sticky top-0 bg-card-2"><tr className="text-[10px] uppercase tracking-[0.1em] text-ink-3">
            <th className="px-2 py-1.5 text-left">{t("volleyball.thPlayer")}</th><th className="px-2 py-1.5 text-left">{t("volleyball.thPos")}</th>
            <th className="px-2 py-1.5 text-right">{t("volleyball.colMatches")}</th><th className="px-2 py-1.5 text-left">{t("volleyball.extId")}</th>
          </tr></thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.fivb_id} className="border-t border-line hover:bg-veil">
                <td className="px-2 py-1 text-ink whitespace-nowrap">{cleanName(p.full_name ?? p.short_name)}</td>
                <td className="px-2 py-1 text-ink-2 whitespace-nowrap">{p.position ?? "-"}</td>
                <td className="px-2 py-1 text-right tabular-nums text-ink-3">{p.games}</td>
                <td className="px-2 py-1"><input value={val(p.fivb_id)} onChange={(e) => setEdits((s) => ({ ...s, [String(p.fivb_id)]: e.target.value }))} className="w-40 rounded border border-line bg-field px-2 py-0.5 text-[12px] text-ink outline-none focus:border-line-strong" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= FIXTURES ================= */
function FixturesTab({ fixtures, teams, reload, t }: { fixtures: PmFixture[]; teams: VbTeam[]; reload: () => void; t: (k: string) => string }) {
  const [h, setH] = useState(teams.find((x) => x.team_code === "TUR")?.team_code ?? teams[0]?.team_code ?? "");
  const [a, setA] = useState(teams.find((x) => x.team_code !== "TUR")?.team_code ?? teams[1]?.team_code ?? "");
  const [ext, setExt] = useState("");
  const nameOf = (code: string) => teams.find((x) => x.team_code === code)?.team_name ?? code;
  const add = async () => {
    if (!h || !a || h === a) return;
    await insertFixture({ home_team_slug: h, away_team_slug: a, home_team_name: nameOf(h), away_team_name: nameOf(a), external_id: ext.trim() || null, match_date: null, note: null }, LEAGUE);
    setExt(""); reload();
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <select value={h} onChange={(e) => setH(e.target.value)} className="rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink">
          {teams.map((x) => <option key={x.team_code} value={x.team_code}>{x.team_name}</option>)}
        </select>
        <span className="pb-2 text-ink-3">vs</span>
        <select value={a} onChange={(e) => setA(e.target.value)} className="rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink">
          {teams.map((x) => <option key={x.team_code} value={x.team_code}>{x.team_name}</option>)}
        </select>
        <input placeholder={t("volleyball.extId")} value={ext} onChange={(e) => setExt(e.target.value)} className="w-28 rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink" />
        <button onClick={add} className={btnSave}>{t("volleyball.addFixture")}</button>
      </div>
      <table className="min-w-full border-collapse text-[13px]">
        <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.1em] text-ink-3">
          <th className="px-2 py-1.5 text-left">{t("volleyball.thHome")}</th><th className="px-2 py-1.5 text-left">{t("volleyball.thAway")}</th>
          <th className="px-2 py-1.5 text-left">{t("volleyball.extId")}</th><th className="px-2 py-1.5"></th>
        </tr></thead>
        <tbody>
          {fixtures.map((f) => (
            <tr key={f.id} className="border-t border-line hover:bg-veil">
              <td className="px-2 py-1 text-ink">{f.home_team_name}</td><td className="px-2 py-1 text-ink">{f.away_team_name}</td>
              <td className="px-2 py-1 text-ink-3">{f.external_id ?? "-"}</td>
              <td className="px-2 py-1 text-right"><button onClick={async () => { await deleteFixture(f.id); reload(); }} className="text-[12px] text-neg hover:underline">×</button></td>
            </tr>
          ))}
          {fixtures.length === 0 ? <tr><td colSpan={4} className="px-2 py-3 text-[12px] text-ink-3">—</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

/* ================= CONFIG (market templates) ================= */
function ConfigTab({ config, reload, t }: { config: PmMarketConfig[]; reload: () => void; t: (k: string) => string }) {
  const [grp, setGrp] = useState<"team" | "player">("team");
  const [edits, setEdits] = useState<Record<string, Partial<PmMarketConfig>>>({});
  const [saving, setSaving] = useState(false);
  const rows = config.filter((c) => c.market_group === grp);
  const missing = VB_MARKETS.filter((m) => !rows.some((c) => c.market_key === m.key));
  const rk = (c: PmMarketConfig) => `${c.market_group}:${c.market_key}`;
  const v = <K extends keyof PmMarketConfig>(c: PmMarketConfig, k: K) => (edits[rk(c)]?.[k] ?? c[k]) as PmMarketConfig[K];
  const patch = (c: PmMarketConfig, p: Partial<PmMarketConfig>) => setEdits((s) => ({ ...s, [rk(c)]: { ...s[rk(c)], ...p } }));
  const seed = async () => {
    const payload = missing.map((m, i) => ({ market_group: grp, market_key: m.key, label: m.label, base_metric: m.key, template_id: m.tpl, std: m.std, in_model: true, sort_order: i, lines: 5, under_lines: 5, max_lines: 15, odds_cap: 999, skip_after: 5, skip_step: 2, round_odds: false }));
    if (payload.length && await upsertMarketConfig(payload, LEAGUE)) reload();
  };
  const save = async () => {
    const out = Object.entries(edits).map(([k, p]) => { const [market_group, market_key] = k.split(":"); return { market_group, market_key, ...p }; });
    if (out.length === 0) return;
    setSaving(true); const ok = await upsertMarketConfig(out, LEAGUE); setSaving(false); if (ok) { setEdits({}); reload(); }
  };
  const numCell = (c: PmMarketConfig, k: keyof PmMarketConfig, w = "w-12") => (
    <input type="number" step="any" value={(v(c, k) as number | null) ?? ""} onChange={(e) => patch(c, { [k]: e.target.value === "" ? 0 : parseFloat(e.target.value) } as Partial<PmMarketConfig>)} className={`${w} rounded border border-line bg-field px-1 py-0 text-right text-[11px] text-ink outline-none focus:border-line-strong`} />
  );
  const th = "px-1.5 py-1 text-[9px] uppercase tracking-[0.1em] text-ink-3";
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select value={grp} onChange={(e) => setGrp(e.target.value as "team" | "player")} className="rounded border border-line bg-field px-2 py-1 text-[12px] text-ink"><option value="team">Team</option><option value="player">Player</option></select>
        <button onClick={save} disabled={saving || Object.keys(edits).length === 0} className={`${btnSave} disabled:opacity-50`}>{t("volleyball.save")}</button>
        {missing.length ? <button onClick={seed} className={btnGhost}>{t("volleyball.cfgSeed")} ({missing.length})</button> : null}
        <p className="text-[11px] text-ink-3">{t("volleyball.cfgHint")}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[11px]">
          <thead><tr className="border-b border-line">
            <th className={`${th} text-center`}>{t("volleyball.colModelFlag")}</th><th className={`${th} text-left`}>{t("volleyball.colMarket")}</th>
            <th className={`${th} text-left`}>{t("volleyball.marketTemplate")}</th><th className={`${th} text-right`}>{t("volleyball.colStd")}</th>
            <th className={`${th} text-right`}>{t("volleyball.cfgLines")}</th><th className={`${th} text-right`}>{t("volleyball.cfgUnder")}</th>
            <th className={`${th} text-right`}>{t("volleyball.cfgSkipAfter")}</th><th className={`${th} text-right`}>{t("volleyball.cfgSkipStep")}</th>
            <th className={`${th} text-center`}></th>
          </tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={rk(c)} className="border-t border-line hover:bg-veil">
                <td className="px-1.5 py-0.5 text-center"><input type="checkbox" checked={!!v(c, "in_model")} onChange={(e) => patch(c, { in_model: e.target.checked })} className="accent-[var(--accent)]" /></td>
                <td className="px-1.5 py-0.5 text-ink whitespace-nowrap">{c.label ?? c.market_key}</td>
                <td className="px-1.5 py-0.5"><input value={(v(c, "template_id") ?? "").toString()} onChange={(e) => patch(c, { template_id: e.target.value || null })} className="w-24 rounded border border-line bg-field px-1 py-0 text-[11px] text-ink outline-none focus:border-line-strong" placeholder="—" /></td>
                <td className="px-1.5 py-0.5 text-right">{numCell(c, "std")}</td>
                <td className="px-1.5 py-0.5 text-right">{numCell(c, "lines", "w-10")}</td>
                <td className="px-1.5 py-0.5 text-right">{numCell(c, "under_lines", "w-10")}</td>
                <td className="px-1.5 py-0.5 text-right">{numCell(c, "skip_after", "w-10")}</td>
                <td className="px-1.5 py-0.5 text-right">{numCell(c, "skip_step", "w-10")}</td>
                <td className="px-1.5 py-0.5 text-center"><button onClick={async () => { if (window.confirm(t("volleyball.confirmDelete")) && await deleteMarketConfig(c.market_group, c.market_key, LEAGUE)) reload(); }} className="text-[13px] text-neg hover:opacity-70">×</button></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={9} className="px-2 py-3 text-[12px] text-ink-3">{t("volleyball.cfgEmpty")}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= INPUT ================= */
const TEAM_HEADERS = ["Fixture ID", "Market Template", "Line", "Market Status", "Selection_1_Name", "Selection_1_Price", "Selection_2_Name", "Selection_2_Price"];
const PLAYER_HEADERS = ["Fixture ID", "Market Template", "Market Participant", "Line", "Market Status", "Selection_1_Name", "Selection_1_Price", "Selection_2_Name", "Selection_2_Price"];

function InputTab({ rows, setRows, t }: { rows: VbInputRow[]; setRows: (r: VbInputRow[]) => void; t: (k: string) => string }) {
  const [type, setType] = useState<"team" | "player">("team");
  const isTeam = type === "team";
  const shown = rows.filter((r) => r.kind === type);
  const cnt = (k: "team" | "player") => rows.filter((r) => r.kind === k).length;
  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const headers = isTeam ? TEAM_HEADERS : PLAYER_HEADERS;
    const aoa = [headers, ...shown.map((r) => isTeam
      ? [r.fixtureExtId, r.template, r.line, "", "Over", r.over, "Under", r.under ?? ""]
      : [r.fixtureExtId, r.template, r.participant, r.line, "", "Over", r.over, "Under", r.under ?? ""])];
    const ws = XLSX.utils.aoa_to_sheet(aoa); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "input"); XLSX.writeFile(wb, `voleybol_input_${type}.xlsx`);
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(["team", "player"] as const).map((k) => (
          <button key={k} onClick={() => setType(k)} className={`rounded-full px-4 py-1.5 text-xs font-semibold ${type === k ? "bg-accent text-white" : "bg-card-2 text-ink-2 hover:text-ink"}`}>{k === "team" ? "Team" : "Player"}{cnt(k) ? ` (${cnt(k)})` : ""}</button>
        ))}
        <button onClick={exportXlsx} disabled={shown.length === 0} className={`ml-3 ${btnSave} disabled:opacity-50`}>{t("volleyball.printXlsx")}</button>
        <button onClick={() => setRows(rows.filter((r) => r.kind !== type))} disabled={shown.length === 0} className={`${btnGhost} disabled:opacity-50`}>{t("volleyball.clear")}</button>
      </div>
      {shown.length === 0 ? <p className="text-sm text-ink-3">{t("volleyball.inputEmpty")}</p> : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full border-collapse text-[12px]">
            <thead className="sticky top-0 bg-card-2"><tr className="text-[9px] uppercase tracking-[0.1em] text-ink-3">
              <th className="px-2 py-1 text-left">Fixture</th><th className="px-2 py-1 text-left">Template</th>
              {!isTeam && <th className="px-2 py-1 text-left">Participant</th>}
              <th className="px-2 py-1 text-right">Line</th><th className="px-2 py-1 text-right">Over</th><th className="px-2 py-1 text-right">Under</th>
              <th className="px-2 py-1 text-left">{isTeam ? t("volleyball.thTeam") : t("volleyball.thPlayer")}</th><th className="px-2 py-1"></th>
            </tr></thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} className="border-t border-line hover:bg-veil">
                  <td className="px-2 py-0.5 text-ink-3">{r.fixtureExtId || "—"}</td>
                  <td className="px-2 py-0.5 text-ink-2">{r.template || "—"}</td>
                  {!isTeam && <td className="px-2 py-0.5 text-ink-3">{r.participant}</td>}
                  <td className="px-2 py-0.5 text-right tabular-nums text-ink">{r.line.toFixed(1)}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums text-ink">{r.over.toFixed(2)}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums text-ink-2">{r.under == null ? "—" : r.under.toFixed(2)}</td>
                  <td className="px-2 py-0.5 text-ink whitespace-nowrap">{r.name}</td>
                  <td className="px-2 py-0.5 text-right"><button onClick={() => setRows(rows.filter((x) => x !== r))} className="text-neg hover:underline">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
