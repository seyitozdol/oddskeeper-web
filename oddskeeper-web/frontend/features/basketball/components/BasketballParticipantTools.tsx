"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import BasketballTools from "./BasketballTools";
import { TEAM_MARKETS, teamStd } from "../marketConfig";
import {
  fetchPmFixtures, insertFixture, updateFixture, deleteFixture, PmFixture,
  fetchPlayerIds, savePlayerIds,
  savePlayerMerges, PmMerge,
  fetchMarketConfig, upsertMarketConfig, PmMarketConfig,
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

type Tab = "model" | "players" | "std" | "fixtures" | "config" | "input";
type InputType = "player" | "team";

const btnSave = "rounded-md border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-[12px] font-semibold text-teal-300 hover:bg-teal-500/20";
const btnGhost = "rounded-md border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:text-ink";

export default function BasketballParticipantTools({ splits, forms, windows, teamLogs, players }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("model");
  const [fixtures, setFixtures] = useState<PmFixture[]>([]);
  const [playerIds, setPlayerIds] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<PmMarketConfig[]>([]);
  const [inputType, setInputType] = useState<InputType>("player");
  const [inputRows, setInputRows] = useState<BktInputRow[]>([]);

  const reloadFixtures = () => fetchPmFixtures().then(setFixtures);
  const reloadConfig = () => fetchMarketConfig().then(setConfig);
  useEffect(() => { reloadFixtures(); reloadConfig(); fetchPlayerIds().then(setPlayerIds); }, []);

  const teams = useMemo(() => [...splits].map((s) => ({ slug: s.team_slug, name: s.team_name })).sort((a, b) => a.name.localeCompare(b.name, "tr")), [splits]);

  const shownRows = inputRows.filter((r) => r.kind === inputType);
  const TABS: { id: Tab; label: string }[] = [
    { id: "model", label: t("basketball.tabModel") },
    { id: "players", label: t("basketball.tabPlayerList") },
    { id: "std", label: t("basketball.tabStdList") },
    { id: "fixtures", label: t("basketball.tabFixtures") },
    { id: "config", label: t("basketball.tabConfig") },
    { id: "input", label: `${t("basketball.tabInput")}${shownRows.length ? ` (${shownRows.length})` : ""}` },
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
          playerIds={playerIds} config={config} onAdd={(rows) => setInputRows((p) => [...p, ...rows])} />
      )}
      {tab === "players" && <PlayerListTab players={players} playerIds={playerIds} onSaved={setPlayerIds} t={t} />}
      {tab === "std" && <TeamStdListTab t={t} />}
      {tab === "fixtures" && <FixturesTab fixtures={fixtures} teams={teams} reload={reloadFixtures} t={t} />}
      {tab === "config" && <ConfigTab config={config} reload={reloadConfig} inputType={inputType} setInputType={setInputType} t={t} />}
      {tab === "input" && <InputTab rows={shownRows} allRows={inputRows} setRows={setInputRows} inputType={inputType} t={t} />}
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

/* ---------- Config (line üretim kuralları) ---------- */
function ConfigTab({ config, reload, inputType, setInputType, t }: {
  config: PmMarketConfig[]; reload: () => void;
  inputType: "player" | "team"; setInputType: (t: "player" | "team") => void;
  t: (k: string) => string;
}) {
  const [edits, setEdits] = useState<Record<string, Partial<PmMarketConfig>>>({});
  const [saving, setSaving] = useState(false);
  const rk = (c: PmMarketConfig) => `${c.market_group}:${c.market_key}`;
  const patch = (c: PmMarketConfig, p: Partial<PmMarketConfig>) => setEdits((s) => ({ ...s, [rk(c)]: { ...s[rk(c)], ...p } }));
  const v = <K extends keyof PmMarketConfig>(c: PmMarketConfig, key: K): PmMarketConfig[K] =>
    (edits[rk(c)]?.[key] ?? c[key]) as PmMarketConfig[K];

  // template'e göre sıralı (boş template en sona), sonra sort_order
  const bySection = (grp: string) =>
    config.filter((c) => c.market_group === grp).sort((a, b) => {
      const ta = (v(a, "template_id") ?? "").toString(), tb = (v(b, "template_id") ?? "").toString();
      if (!ta && tb) return 1; if (ta && !tb) return -1;
      if (ta !== tb) return ta.localeCompare(tb);
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

  const save = async () => {
    const rows = Object.entries(edits).map(([key, p]) => {
      const [market_group, market_key] = key.split(":");
      return { market_group, market_key, ...p };
    });
    if (rows.length === 0) return;
    setSaving(true);
    const ok = await upsertMarketConfig(rows);
    setSaving(false);
    if (ok) { setEdits({}); reload(); }
  };

  const numCell = (c: PmMarketConfig, key: keyof PmMarketConfig, w = "w-12", nullable = false, ph = "") => (
    <input type="number" step="any" placeholder={ph}
      value={(v(c, key) as number | null) ?? ""}
      onChange={(e) => patch(c, { [key]: e.target.value === "" ? (nullable ? null : 0) : parseFloat(e.target.value) } as Partial<PmMarketConfig>)}
      className={`${w} rounded border border-line bg-field px-1.5 py-0.5 text-right text-[12px] text-ink outline-none focus:border-line-strong`} />
  );

  const Section = ({ grp }: { grp: string }) => (
    <div className="mb-6 overflow-x-auto">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        {t(grp === "player" ? "basketball.cfgSectionPlayer" : "basketball.cfgSectionTeam")}
      </h3>
      <table className="min-w-full border-collapse text-[12px]">
        <thead><tr className="border-b border-line text-[9px] uppercase tracking-[0.1em] text-ink-3">
          <th className="px-1.5 py-1 text-center">{t("basketball.colModelFlag")}</th>
          <th className="px-1.5 py-1 text-left">{t("basketball.colMarket")}</th>
          <th className="px-1.5 py-1 text-left">{t("basketball.marketTemplate")}</th>
          <th className="px-1.5 py-1 text-right">{t("basketball.colStd")}</th>
          <th className="px-1.5 py-1 text-right">{t("basketball.cfgLines")}</th>
          <th className="px-1.5 py-1 text-right">{t("basketball.cfgUnder")}</th>
          <th className="px-1.5 py-1 text-right">{t("basketball.cfgSkipAfter")}</th>
          <th className="px-1.5 py-1 text-right">{t("basketball.cfgSkipStep")}</th>
          <th className="px-1.5 py-1 text-right">{t("basketball.cfgMaxLines")}</th>
          <th className="px-1.5 py-1 text-right">{t("basketball.cfgCap")}</th>
          <th className="px-1.5 py-1 text-right">{t("basketball.cfgPayback")}</th>
          <th className="px-1.5 py-1 text-center">{t("basketball.cfgRound")}</th>
        </tr></thead>
        <tbody>
          {bySection(grp).map((c) => (
            <tr key={rk(c)} className="border-t border-line hover:bg-veil">
              <td className="px-1.5 py-1 text-center"><input type="checkbox" checked={!!v(c, "in_model")} onChange={(e) => patch(c, { in_model: e.target.checked })} className="accent-[var(--accent)]" /></td>
              <td className="px-1.5 py-1 text-ink whitespace-nowrap">{c.label}</td>
              <td className="px-1.5 py-1"><input value={(v(c, "template_id") ?? "").toString()} onChange={(e) => patch(c, { template_id: e.target.value || null })}
                className="w-28 rounded border border-line bg-field px-1.5 py-0.5 text-[12px] text-ink outline-none focus:border-line-strong" placeholder="—" /></td>
              <td className="px-1.5 py-1 text-right">{numCell(c, "std", "w-14")}</td>
              <td className="px-1.5 py-1 text-right">{numCell(c, "lines")}</td>
              <td className="px-1.5 py-1 text-right">{numCell(c, "under_lines")}</td>
              <td className="px-1.5 py-1 text-right">{numCell(c, "skip_after")}</td>
              <td className="px-1.5 py-1 text-right">{numCell(c, "skip_step")}</td>
              <td className="px-1.5 py-1 text-right">{numCell(c, "max_lines")}</td>
              <td className="px-1.5 py-1 text-right">{numCell(c, "odds_cap", "w-14")}</td>
              <td className="px-1.5 py-1 text-right">{numCell(c, "payback", "w-16", true, t("basketball.cfgDefault"))}</td>
              <td className="px-1.5 py-1 text-center"><input type="checkbox" checked={!!v(c, "round_odds")} onChange={(e) => patch(c, { round_odds: e.target.checked })} className="accent-[var(--accent)]" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] text-ink-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.colType")}</span>
          <select value={inputType} onChange={(e) => setInputType(e.target.value as "player" | "team")}
            className="rounded-md border border-line bg-field px-2 py-1 text-[13px] text-ink outline-none focus:border-line-strong">
            <option value="player">Player</option>
            <option value="team">Team</option>
          </select>
        </label>
        <button onClick={save} disabled={saving || Object.keys(edits).length === 0} className={`${btnSave} disabled:opacity-50`}>{t("basketball.save")}</button>
        <p className="text-[11px] text-ink-3">{t("basketball.cfgHint")}</p>
      </div>
      <Section grp={inputType} />
    </div>
  );
}

/* ---------- Input ---------- */
// Selection_1 hep Over, Selection_2_Name hep Under; Selection_2_Price under yoksa boş.
// Market Status kural yoksa boş. Player'da participant + sort order kolonları var, team'de yok.
const PLAYER_IN_HEADERS = ["Fixture ID", "Market Template", "Market Participant", "Market Participant Sort Order", "Line", "Market Status", "Selection_1_Name", "Selection_1_Price", "Selection_2_Name", "Selection_2_Price"];
const TEAM_IN_HEADERS = ["Fixture ID", "Market Template", "Line", "Market Status", "Selection_1_Name", "Selection_1_Price", "Selection_2_Name", "Selection_2_Price"];

function InputTab({ rows, allRows, setRows, inputType, t }: {
  rows: BktInputRow[]; allRows: BktInputRow[]; setRows: (r: BktInputRow[]) => void;
  inputType: "player" | "team"; t: (k: string) => string;
}) {
  const isTeam = inputType === "team";
  const rowName = (r: BktInputRow) => (r.kind === "team" ? r.teamName : r.playerName);
  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const headers = isTeam ? TEAM_IN_HEADERS : PLAYER_IN_HEADERS;
    const aoa = [headers, ...rows.map((r) => isTeam
      ? [r.fixtureExtId, r.template, r.line, "", "Over", r.over, "Under", r.under ?? ""]
      : [r.fixtureExtId, r.template, r.participant, r.side, r.line, "", "Over", r.over, "Under", r.under ?? ""])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "input");
    XLSX.writeFile(wb, `basketbol_input_${inputType}.xlsx`);
  };
  // Temizle sadece aktif tipteki satırları siler; sil belirli satırı allRows'tan çıkarır.
  const clear = () => setRows(allRows.filter((r) => r.kind !== inputType));
  const removeRow = (r: BktInputRow) => setRows(allRows.filter((x) => x !== r));
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button onClick={exportXlsx} disabled={rows.length === 0} className={`${btnSave} disabled:opacity-50`}>{t("basketball.printXlsx")}</button>
        <button onClick={clear} disabled={rows.length === 0} className={`${btnGhost} disabled:opacity-50`}>{t("basketball.clear")}</button>
        <span className="text-[11px] text-ink-3">{inputType === "team" ? "Team" : "Player"} · {t("basketball.inputCount").replace("{n}", String(rows.length))}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-3">{t("basketball.inputEmpty")}</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full border-collapse text-[12px]">
            <thead className="sticky top-0 bg-card-2"><tr className="text-[9px] uppercase tracking-[0.1em] text-ink-3">
              <th className="px-2 py-1 text-left">Fixture</th><th className="px-2 py-1 text-left">Template</th>
              {!isTeam && <><th className="px-2 py-1 text-left">Participant</th><th className="px-2 py-1 text-right">Sort</th></>}
              <th className="px-2 py-1 text-right">Line</th><th className="px-2 py-1 text-right">Over</th><th className="px-2 py-1 text-right">Under</th>
              <th className="px-2 py-1 text-left">{isTeam ? t("basketball.team") : t("basketball.player")}</th><th className="px-2 py-1"></th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line hover:bg-veil">
                  <td className="px-2 py-0.5 text-ink-3">{r.fixtureExtId || "—"}</td>
                  <td className="px-2 py-0.5 text-ink-2">{r.template || "—"}</td>
                  {!isTeam && <><td className="px-2 py-0.5 text-ink-3">{r.participant}</td><td className="px-2 py-0.5 text-right tabular-nums text-ink-3">{r.side}</td></>}
                  <td className="px-2 py-0.5 text-right tabular-nums text-ink">{r.line.toFixed(1)}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums text-ink">{r.over.toFixed(2)}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums text-ink-2">{r.under == null ? "—" : r.under.toFixed(2)}</td>
                  <td className="px-2 py-0.5 text-ink whitespace-nowrap">{rowName(r)}</td>
                  <td className="px-2 py-0.5 text-right"><button onClick={() => removeRow(r)} className="text-neg hover:underline">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
