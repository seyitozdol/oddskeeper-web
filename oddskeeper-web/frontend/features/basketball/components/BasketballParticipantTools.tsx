"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import BasketballTools from "./BasketballTools";
import { TEAM_MARKETS, teamStd } from "../marketConfig";
import {
  fetchMarkets, upsertMarket, deleteMarket, PmMarket,
  fetchPmFixtures, insertFixture, updateFixture, deleteFixture, PmFixture,
  fetchPlayerIds, savePlayerIds,
  savePlayerMerges, PmMerge,
} from "../pmQueries";
import type {
  BktHomeAwaySplitRow, BktTeamMetricFormRow, BktPlayerWindowRow,
  BktTeamLogRow, BktPlayerListRow, BktInputRow,
} from "../types";

type Props = {
  splits: BktHomeAwaySplitRow[];
  forms: BktTeamMetricFormRow[];
  windows: BktPlayerWindowRow[];
  teamLogs: BktTeamLogRow[];
  players: BktPlayerListRow[];
};

type Tab = "model" | "players" | "markets" | "std" | "fixtures" | "input";

const btnSave = "rounded-md border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-[12px] font-semibold text-teal-300 hover:bg-teal-500/20";
const btnGhost = "rounded-md border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:text-ink";

export default function BasketballParticipantTools({ splits, forms, windows, teamLogs, players }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("model");
  const [markets, setMarkets] = useState<PmMarket[]>([]);
  const [fixtures, setFixtures] = useState<PmFixture[]>([]);
  const [playerIds, setPlayerIds] = useState<Record<string, string>>({});
  const [inputRows, setInputRows] = useState<BktInputRow[]>([]);

  const reloadMarkets = () => fetchMarkets().then(setMarkets);
  const reloadFixtures = () => fetchPmFixtures().then(setFixtures);
  useEffect(() => { reloadMarkets(); reloadFixtures(); fetchPlayerIds().then(setPlayerIds); }, []);

  const teams = useMemo(() => [...splits].map((s) => ({ slug: s.team_slug, name: s.team_name })).sort((a, b) => a.name.localeCompare(b.name, "tr")), [splits]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "model", label: t("basketball.tabModel") },
    { id: "players", label: t("basketball.tabPlayerList") },
    { id: "markets", label: t("basketball.tabMarketList") },
    { id: "std", label: t("basketball.tabStdList") },
    { id: "fixtures", label: t("basketball.tabFixtures") },
    { id: "input", label: `${t("basketball.tabInput")}${inputRows.length ? ` (${inputRows.length})` : ""}` },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`rounded-lg px-4 py-1.5 text-[13px] ${tab === tb.id ? "bg-veil font-semibold text-ink" : "text-ink-3 hover:text-ink-2"}`}>{tb.label}</button>
        ))}
      </div>

      {tab === "model" && (
        <BasketballTools pmFixtures={fixtures} splits={splits} forms={forms} windows={windows} teamLogs={teamLogs}
          playerIds={playerIds} onAdd={(rows) => setInputRows((p) => [...p, ...rows])} />
      )}
      {tab === "players" && <PlayerListTab players={players} playerIds={playerIds} onSaved={setPlayerIds} t={t} />}
      {tab === "markets" && <MarketListTab markets={markets} reload={reloadMarkets} t={t} />}
      {tab === "std" && <TeamStdListTab t={t} />}
      {tab === "fixtures" && <FixturesTab fixtures={fixtures} teams={teams} reload={reloadFixtures} t={t} />}
      {tab === "input" && <InputTab rows={inputRows} setRows={setInputRows} t={t} />}
    </div>
  );
}

/* ---------- Player List ---------- */
// İsim normalize: Türkçe harfleri katla + aksanları sök → mükerrer isim tespiti için.
function foldName(s: string): string {
  return s
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/[Şş]/g, "s").replace(/[Ğğ]/g, "g").replace(/[Çç]/g, "c")
    .replace(/[Öö]/g, "o").replace(/[Üü]/g, "u")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function findDuplicatePlayers(players: BktPlayerListRow[]): BktPlayerListRow[][] {
  const groups = new Map<string, BktPlayerListRow[]>();
  for (const p of players) {
    const toks = foldName(p.player_name).split(" ").filter(Boolean);
    if (toks.length === 0) continue;
    const key = `${toks[0]}|${toks[toks.length - 1]}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const out: BktPlayerListRow[][] = [];
  for (const arr of groups.values()) {
    const distinct = new Map(arr.map((p) => [p.player_slug, p]));
    if (distinct.size > 1) out.push([...distinct.values()]);
  }
  return out;
}

function PlayerListTab({ players, playerIds, onSaved, t }: { players: BktPlayerListRow[]; playerIds: Record<string, string>; onSaved: (m: Record<string, string>) => void; t: (k: string) => string }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [canon, setCanon] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState<string | null>(null);
  const dupGroups = useMemo(() => findDuplicatePlayers(players), [players]);
  const dupSlugs = useMemo(() => new Set(dupGroups.flat().map((p) => p.player_slug)), [dupGroups]);
  const groupKey = (g: BktPlayerListRow[]) => g.map((p) => p.player_slug).sort().join("|");
  const canonSlug = (g: BktPlayerListRow[]) =>
    canon[groupKey(g)] ?? [...g].sort((a, b) => b.games - a.games)[0].player_slug;
  const mergeGroup = async (g: BktPlayerListRow[]) => {
    const key = groupKey(g);
    const keepSlug = canonSlug(g);
    const keepName = g.find((p) => p.player_slug === keepSlug)?.player_name ?? null;
    const rows: PmMerge[] = g
      .filter((p) => p.player_slug !== keepSlug)
      .map((p) => ({ alias_slug: p.player_slug, canonical_slug: keepSlug, canonical_name: keepName }));
    if (rows.length === 0) return;
    setMerging(key);
    const ok = await savePlayerMerges(rows);
    setMerging(null);
    if (ok) router.refresh();
  };
  const val = (slug: string) => edits[slug] ?? playerIds[slug] ?? "";
  const save = async () => {
    setSaving(true);
    const ok = await savePlayerIds(edits);
    setSaving(false);
    if (ok) { const merged = { ...playerIds, ...edits }; onSaved(merged); setEdits({}); }
  };
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button onClick={save} disabled={saving || Object.keys(edits).length === 0} className={`${btnSave} disabled:opacity-50`}>{t("basketball.save")}</button>
        <span className="text-[11px] text-ink-3">{players.length}</span>
      </div>
      {dupGroups.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <div className="text-[12px] font-semibold text-amber-300">⚠ {t("basketball.dupTitle")} ({dupGroups.length})</div>
          <div className="mt-0.5 text-[11px] text-ink-3">{t("basketball.dupHint")}</div>
          <ul className="mt-2 space-y-1.5">
            {dupGroups.map((g) => {
              const key = groupKey(g);
              const keep = canonSlug(g);
              return (
                <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                  {g.map((p) => (
                    <label key={p.player_slug} className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
                      <input type="radio" name={`canon-${key}`} checked={keep === p.player_slug}
                        onChange={() => setCanon((s) => ({ ...s, [key]: p.player_slug }))} className="accent-[var(--accent)]" />
                      <span className={keep === p.player_slug ? "font-semibold text-ink" : "text-ink-2"}>{p.player_name}</span>
                      <span className="text-ink-3">({p.team_name ?? "—"}, {p.games})</span>
                    </label>
                  ))}
                  <button onClick={() => mergeGroup(g)} disabled={merging === key}
                    className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-50">
                    {merging === key ? t("basketball.merging") : t("basketball.merge")}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-full border-collapse text-[13px]">
          <thead className="sticky top-0 bg-card-2"><tr className="text-[10px] uppercase tracking-[0.1em] text-ink-3">
            <th className="px-2 py-1.5 text-left">{t("basketball.player")}</th><th className="px-2 py-1.5 text-left">{t("basketball.team")}</th>
            <th className="px-2 py-1.5 text-right">{t("basketball.games")}</th><th className="px-2 py-1.5 text-left">{t("basketball.extId")}</th>
          </tr></thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.player_slug} className={`border-t border-line hover:bg-veil ${dupSlugs.has(p.player_slug) ? "bg-amber-500/5" : ""}`}>
                <td className="px-2 py-1 text-ink whitespace-nowrap">{dupSlugs.has(p.player_slug) && <span className="mr-1 text-amber-400" title={t("basketball.dupTitle")}>⚠</span>}{p.player_name}</td>
                <td className="px-2 py-1 text-ink-2 whitespace-nowrap">{p.team_name}</td>
                <td className="px-2 py-1 text-right tabular-nums text-ink-3">{p.games}</td>
                <td className="px-2 py-1"><input value={val(p.player_slug)} onChange={(e) => setEdits((s) => ({ ...s, [p.player_slug]: e.target.value }))}
                  className="w-40 rounded border border-line bg-field px-2 py-0.5 text-[12px] text-ink outline-none focus:border-line-strong" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Market List ---------- */
function MarketListTab({ markets, reload, t }: { markets: PmMarket[]; reload: () => void; t: (k: string) => string }) {
  const [edits, setEdits] = useState<Record<string, Partial<PmMarket>>>({});
  const patch = (k: string, p: Partial<PmMarket>) => setEdits((s) => ({ ...s, [k]: { ...s[k], ...p } }));
  const rowVal = <K extends keyof PmMarket>(m: PmMarket, key: K): PmMarket[K] => (edits[m.market_key]?.[key] ?? m[key]) as PmMarket[K];
  const saveAll = async () => {
    for (const [key, p] of Object.entries(edits)) {
      const m = markets.find((x) => x.market_key === key); if (!m) continue;
      await upsertMarket({ ...m, ...p });
    }
    setEdits({}); reload();
  };
  const toggleModel = async (m: PmMarket) => { await upsertMarket({ ...m, in_model: !rowVal(m, "in_model") }); reload(); };
  const addNew = async () => {
    const label = prompt("Market adı?"); if (!label) return;
    const key = "custom_" + label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    await upsertMarket({ market_key: key, label, is_custom: true, market_type: "static", in_model: true, sort_order: 100 });
    reload();
  };
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button onClick={saveAll} disabled={Object.keys(edits).length === 0} className={`${btnSave} disabled:opacity-50`}>{t("basketball.save")}</button>
        <button onClick={addNew} className={btnGhost}>{t("basketball.newRow")}</button>
      </div>
      <table className="min-w-full border-collapse text-[13px]">
        <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.1em] text-ink-3">
          <th className="px-2 py-1.5 text-center">{t("basketball.colModelFlag")}</th><th className="px-2 py-1.5 text-left">{t("basketball.colMarket")}</th>
          <th className="px-2 py-1.5 text-left">{t("basketball.marketTemplate")}</th><th className="px-2 py-1.5 text-right">{t("basketball.colStd")}</th>
          <th className="px-2 py-1.5 text-left">{t("basketball.colType")}</th><th className="px-2 py-1.5"></th>
        </tr></thead>
        <tbody>
          {markets.map((m) => (
            <tr key={m.market_key} className="border-t border-line">
              <td className="px-2 py-1 text-center"><input type="checkbox" checked={!!rowVal(m, "in_model")} onChange={() => toggleModel(m)} className="accent-[var(--accent)]" /></td>
              <td className="px-2 py-1 text-ink whitespace-nowrap">{m.label}</td>
              <td className="px-2 py-1"><input value={rowVal(m, "template_id") ?? ""} onChange={(e) => patch(m.market_key, { template_id: e.target.value })} className="w-32 rounded border border-line bg-field px-2 py-0.5 text-[12px] text-ink outline-none" /></td>
              <td className="px-2 py-1 text-right"><input type="number" step="0.01" value={rowVal(m, "std") ?? 0} onChange={(e) => patch(m.market_key, { std: parseFloat(e.target.value) })} className="w-16 rounded border border-line bg-field px-2 py-0.5 text-right text-[12px] text-ink outline-none" /></td>
              <td className="px-2 py-1"><select value={rowVal(m, "market_type")} onChange={(e) => patch(m.market_key, { market_type: e.target.value })} className="rounded border border-line bg-field px-1.5 py-0.5 text-[12px] text-ink outline-none">
                <option value="static">{t("basketball.typeStatic")}</option><option value="participant">{t("basketball.typeParticipant")}</option></select></td>
              <td className="px-2 py-1 text-right">{m.is_custom ? <button onClick={async () => { await deleteMarket(m.market_key); reload(); }} className="text-[12px] text-neg hover:underline">×</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Team Std List ---------- */
function TeamStdListTab({ t }: { t: (k: string) => string }) {
  return (
    <div>
      <p className="mb-3 text-[11px] text-ink-3">{t("basketball.stdListHint")}</p>
      <table className="min-w-full border-collapse text-[13px]">
        <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.1em] text-ink-3">
          <th className="px-2 py-1.5 text-left">{t("basketball.colMarket")}</th>
          <th className="px-2 py-1.5 text-right">{t("basketball.colStd")}</th>
        </tr></thead>
        <tbody>
          {TEAM_MARKETS.map((m) => (
            <tr key={m.key} className="border-t border-line hover:bg-veil">
              <td className="px-2 py-1 text-ink whitespace-nowrap">{m.label}</td>
              <td className="px-2 py-1 text-right tabular-nums text-ink-2">{teamStd(m.key).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Fixtures ---------- */
function FixturesTab({ fixtures, teams, reload, t }: { fixtures: PmFixture[]; teams: { slug: string; name: string }[]; reload: () => void; t: (k: string) => string }) {
  const [h, setH] = useState(teams[0]?.slug ?? "");
  const [a, setA] = useState(teams[1]?.slug ?? "");
  const [ext, setExt] = useState("");
  const [date, setDate] = useState("");
  const add = async () => {
    if (!h || !a || h === a) return;
    const hn = teams.find((x) => x.slug === h)?.name ?? h, an = teams.find((x) => x.slug === a)?.name ?? a;
    await insertFixture({ home_team_slug: h, away_team_slug: a, home_team_name: hn, away_team_name: an, external_id: ext.trim() || null, match_date: date || null, note: null });
    setExt(""); setDate(""); reload();
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <select value={h} onChange={(e) => setH(e.target.value)} className="rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink">{teams.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}</select>
        <span className="pb-2 text-ink-3">vs</span>
        <select value={a} onChange={(e) => setA(e.target.value)} className="rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink">{teams.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}</select>
        <input placeholder={t("basketball.extId")} value={ext} onChange={(e) => setExt(e.target.value)} className="w-28 rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink" />
        <button onClick={add} className={btnSave}>{t("basketball.addFixture")}</button>
      </div>
      <table className="min-w-full border-collapse text-[13px]">
        <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.1em] text-ink-3">
          <th className="px-2 py-1.5 text-left">{t("basketball.fixHome")}</th><th className="px-2 py-1.5 text-left">{t("basketball.fixAway")}</th>
          <th className="px-2 py-1.5 text-left">{t("basketball.extId")}</th><th className="px-2 py-1.5 text-left">{t("basketball.fixDate")}</th><th className="px-2 py-1.5"></th>
        </tr></thead>
        <tbody>
          {fixtures.map((f) => (
            <tr key={f.id} className="border-t border-line hover:bg-veil">
              <td className="px-2 py-1 text-ink">{f.home_team_name}</td><td className="px-2 py-1 text-ink">{f.away_team_name}</td>
              <td className="px-2 py-1"><input defaultValue={f.external_id ?? ""} onBlur={(e) => updateFixture(f.id, { external_id: e.target.value.trim() || null })} className="w-28 rounded border border-line bg-field px-2 py-0.5 text-[12px] text-ink outline-none" /></td>
              <td className="px-2 py-1 text-ink-3">{f.match_date ?? ""}</td>
              <td className="px-2 py-1 text-right"><button onClick={async () => { await deleteFixture(f.id); reload(); }} className="text-[12px] text-neg hover:underline">×</button></td>
            </tr>
          ))}
          {fixtures.length === 0 ? <tr><td colSpan={5} className="px-2 py-3 text-[12px] text-ink-3">—</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Input ---------- */
const IN_HEADERS = ["Fixture ID", "Market Template", "Market Participant", "Market Participant Sort Order", "Line", "Market Status", "Selection_1_Name", "Selection_1_Price", "Selection_2_Name", "Selection_2_Price"];
function InputTab({ rows, setRows, t }: { rows: BktInputRow[]; setRows: (r: BktInputRow[]) => void; t: (k: string) => string }) {
  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const aoa = [IN_HEADERS, ...rows.map((r) => [r.fixtureExtId, r.template, r.participant, r.side, r.line, "", "Over", r.over, "Under", r.under])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "input");
    XLSX.writeFile(wb, "basketbol_input.xlsx");
  };
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button onClick={exportXlsx} disabled={rows.length === 0} className={`${btnSave} disabled:opacity-50`}>{t("basketball.printXlsx")}</button>
        <button onClick={() => setRows([])} disabled={rows.length === 0} className={`${btnGhost} disabled:opacity-50`}>{t("basketball.clear")}</button>
        <span className="text-[11px] text-ink-3">{t("basketball.inputCount").replace("{n}", String(rows.length))}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-3">{t("basketball.inputEmpty")}</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full border-collapse text-[12px]">
            <thead className="sticky top-0 bg-card-2"><tr className="text-[9px] uppercase tracking-[0.1em] text-ink-3">
              <th className="px-2 py-1 text-left">Fixture</th><th className="px-2 py-1 text-left">Template</th><th className="px-2 py-1 text-left">Participant</th>
              <th className="px-2 py-1 text-left">{t("basketball.player")}</th><th className="px-2 py-1 text-right">Line</th><th className="px-2 py-1 text-right">Over</th><th className="px-2 py-1 text-right">Under</th><th className="px-2 py-1"></th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line hover:bg-veil">
                  <td className="px-2 py-0.5 text-ink-3">{r.fixtureExtId || "—"}</td><td className="px-2 py-0.5 text-ink-2">{r.template}</td>
                  <td className="px-2 py-0.5 text-ink-3">{r.participant}</td><td className="px-2 py-0.5 text-ink whitespace-nowrap">{r.playerName}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums text-ink">{r.line.toFixed(1)}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums text-ink">{r.over.toFixed(2)}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums text-ink-2">{r.under.toFixed(2)}</td>
                  <td className="px-2 py-0.5 text-right"><button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-neg hover:underline">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
