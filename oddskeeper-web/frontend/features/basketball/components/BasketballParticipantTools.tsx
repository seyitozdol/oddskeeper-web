"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import BasketballTools, { type HistorySnapEntry } from "./BasketballTools";
import RetentionConfig from "@/features/model-history/RetentionConfig";
import RefreshNowButton from "@/features/upcoming-events/components/RefreshNowButton";
import { TenText } from "@/components/TenBadge";
import { postModelHistory, exportFileName, type ModelHistoryDraft } from "@/lib/model-history";
import { confirmPermanentSave } from "@/lib/confirm-save";
import { configLabel, METRIC_LABELS, metricLabel } from "../marketConfig";
import { ALL_ROLES, roleBadgeClass, roleLabelKey, roleDescKey, formatMatchDate } from "../lib";
import {
  fetchPmFixtures, insertFixture, updateFixture, deleteFixture, PmFixture,
  fetchBets10Links, BbBets10Link,
  fetchPlayerIds, savePlayerIds,
  savePlayerMerges, PmMerge,
  fetchMarketConfig, upsertMarketConfig, deleteMarketConfig, PmMarketConfig,
  fetchModelConfig, saveModelConfig, PmModelConfig,
} from "../pmQueries";
import type {
  BktHomeAwaySplitRow, BktTeamMetricFormRow, BktPlayerWindowRow,
  BktTeamLogRow, BktPlayerListRow, BktInputRow, BktPlayerRoleRow, BktRosterMode,
} from "../types";

type Props = {
  splits: BktHomeAwaySplitRow[];
  forms: BktTeamMetricFormRow[];
  windows: BktPlayerWindowRow[];
  teamLogs: BktTeamLogRow[];
  players: BktPlayerListRow[];
  roles?: BktPlayerRoleRow[];   // BSL oyuncu rol+pozisyon (Player Dist etiketi); EL/EC'de yok
  rosterMode?: BktRosterMode | null;   // BSL sezon kadrosu modu (yeni sezon başı); yoksa maç-güdümlü
  league?: string;          // 'basketball' (BSL) | 'euroleague' | 'eurocup'
  toolsBase?: string;       // takım/oyuncu profil linkleri için kök (örn /dashboard/euro/euroleague)
  isAdmin?: boolean;        // Fixtures sekmesinde "oranları şimdi yenile" (Bets10 yakalama) butonu
};

type Tab = "model" | "players" | "fixtures" | "config" | "input";
type InputType = "player" | "team";

const btnSave = "rounded-md border border-accent bg-accent px-3 py-1.5 text-[12px] font-semibold text-on-accent hover:opacity-90";
const btnGhost = "rounded-md border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:text-ink";

export default function BasketballParticipantTools({ splits, forms, windows, teamLogs, players, roles = [], rosterMode = null, league = "basketball", toolsBase, isAdmin = false }: Props) {
  const { t, locale } = useI18n();
  // Profil linkleri: BSL /dashboard/basketball/{player|team}/<slug>; EL/EC toolsBase/{player|team}/<code>.
  const profileBase = toolsBase ?? "/dashboard/basketball";
  const [tab, setTab] = useState<Tab>("model");
  const [fixtures, setFixtures] = useState<PmFixture[]>([]);
  const [playerIds, setPlayerIds] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<PmMarketConfig[]>([]);
  const [modelConfig, setModelConfig] = useState<PmModelConfig[]>([]);
  const [inputType, setInputType] = useState<InputType>("player");
  const [inputRows, setInputRows] = useState<BktInputRow[]>([]);
  // Export gecmisi: Add aninda snapshot toplanir (key -> entry), export'ta yazilir.
  const [snapshotByKey, setSnapshotByKey] = useState<Record<string, HistorySnapEntry>>({});
  const [historyReloadKey, setHistoryReloadKey] = useState(0);

  // Add: satirlari ekle + (varsa) restore snapshot'ini sakla.
  const handleAdd = (rows: BktInputRow[], snap?: HistorySnapEntry) => {
    setInputRows((p) => [...p, ...rows]);
    if (snap) setSnapshotByKey((m) => ({ ...m, [snap.key]: snap }));
  };

  // Export gecmisi: yazdirilan tip (player/team) satirlarini fixture bazinda yaz.
  const handleExported = async (type: InputType) => {
    const seen = new Set<string>();
    const entries: ModelHistoryDraft[] = [];
    for (const r of inputRows.filter((x) => x.kind === type)) {
      const key = `${r.fixtureExtId}::${type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const snap = snapshotByKey[key];
      entries.push({
        kind: type,
        fixtureExtId: r.fixtureExtId || null,
        matchLabel: snap?.matchLabel ?? (r.teamName || r.playerName || "—"),
        market: snap?.market ?? type,
        snapshot: snap?.snapshot ?? null,
      });
    }
    if (entries.length > 0) {
      await postModelHistory("basketball", league, entries);
      setHistoryReloadKey((k) => k + 1);
    }
  };

  const reloadFixtures = () => fetchPmFixtures(league).then(setFixtures);
  const reloadConfig = () => fetchMarketConfig(league).then(setConfig);
  const reloadModelConfig = () => fetchModelConfig().then(setModelConfig);
  useEffect(() => { reloadFixtures(); reloadConfig(); reloadModelConfig(); fetchPlayerIds(league).then(setPlayerIds); }, [league]);

  const teams = useMemo(() => [...splits].map((s) => ({ slug: s.team_slug, name: s.team_name })).sort((a, b) => a.name.localeCompare(b.name, "tr")), [splits]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "model", label: t("basketball.tabModel") },
    { id: "players", label: t("basketball.tabPlayerList") },
    { id: "fixtures", label: t("basketball.tabFixtures") },
    { id: "config", label: t("basketball.tabConfig") },
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

      {/* Model her zaman mount kalır → sekme değişince fixture/takım seçimi kaybolmaz */}
      <div className={tab === "model" ? "" : "hidden"}>
        <BasketballTools pmFixtures={fixtures} splits={splits} forms={forms} windows={windows} teamLogs={teamLogs}
          playerIds={playerIds} config={config} inputRows={inputRows} roles={roles} rosterMode={rosterMode} modelConfig={modelConfig}
          competition={league === "euroleague" ? "E" : league === "eurocup" ? "U" : undefined}
          historyLeague={league} historyReloadKey={historyReloadKey}
          onAdd={handleAdd} />
      </div>
      {tab === "players" && <PlayerListTab players={players} playerIds={playerIds} onSaved={setPlayerIds} league={league} profileBase={profileBase} t={t} />}
      {tab === "fixtures" && <FixturesTab fixtures={fixtures} teams={teams} reload={reloadFixtures} league={league} isAdmin={isAdmin} locale={locale} t={t} />}
      {tab === "config" && (
        <div className="space-y-4">
          <ConfigTab config={config} reload={reloadConfig} modelConfig={modelConfig} reloadModelConfig={reloadModelConfig} inputType={inputType} setInputType={setInputType} league={league} locale={locale} t={t} />
          <RetentionConfig sport="basketball" league={league} />
        </div>
      )}
      {tab === "input" && <InputTab allRows={inputRows} setRows={setInputRows} initialType={inputType} onExported={handleExported} t={t} />}
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

function PlayerListTab({ players, playerIds, onSaved, league, profileBase, t }: { players: BktPlayerListRow[]; playerIds: Record<string, string>; onSaved: (m: Record<string, string>) => void; league: string; profileBase: string; t: (k: string) => string }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [canon, setCanon] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState<string | null>(null);
  // Arama: oyuncu VEYA takım adı (Türkçe/aksan katlanmış, kısmi eşleşme). Kayıt düzenlemeleri
  // (edits) slug anahtarlı olduğu için süzme/kaydetme birbirini etkilemez.
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const f = foldName(q);
    if (!f) return players;
    return players.filter((p) => foldName(p.player_name).includes(f) || foldName(p.team_name ?? "").includes(f));
  }, [players, q]);
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
    const ok = await savePlayerMerges(rows, league);
    setMerging(null);
    if (ok) router.refresh();
  };
  const val = (slug: string) => edits[slug] ?? playerIds[slug] ?? "";
  const save = async () => {
    setSaving(true);
    const ok = await savePlayerIds(edits, league);
    setSaving(false);
    if (ok) { const merged = { ...playerIds, ...edits }; onSaved(merged); setEdits({}); }
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving || Object.keys(edits).length === 0} className={`${btnSave} disabled:opacity-50`}>{t("basketball.save")}</button>
        <div className="relative">
          <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-3"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("basketball.searchPlayers")}
            className="w-64 rounded-md border border-line bg-field py-1.5 pl-7 pr-7 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-line-strong" />
          {q ? <button onClick={() => setQ("")} aria-label={t("basketball.clear")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-ink-3 hover:text-ink">×</button> : null}
        </div>
        <span className="text-[11px] tabular-nums text-ink-3">{q ? t("basketball.searchCount").replace("{n}", String(filtered.length)).replace("{total}", String(players.length)) : players.length}</span>
      </div>
      {dupGroups.length > 0 && (
        <div className="mb-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5">
          <div className="text-[12px] font-semibold text-warn">⚠ {t("basketball.dupTitle")} ({dupGroups.length})</div>
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
                    className="rounded-md border border-warn/40 bg-warn/15 px-2.5 py-0.5 text-[11px] font-semibold text-warn hover:bg-warn/25 disabled:opacity-50">
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
            {filtered.map((p) => (
              <tr key={p.player_slug} className={`border-t border-line hover:bg-veil ${dupSlugs.has(p.player_slug) ? "bg-warn/5" : ""}`}>
                <td className="px-2 py-1 text-ink whitespace-nowrap">
                  {dupSlugs.has(p.player_slug) && <span className="mr-1 text-warn" title={t("basketball.dupTitle")}>⚠</span>}
                  <Link href={`${profileBase}/player/${encodeURIComponent(p.player_slug)}`} title={t("basketball.openProfile")} className="hover:text-accent-ink hover:underline">{p.player_name}</Link>
                </td>
                <td className="px-2 py-1 text-ink-2 whitespace-nowrap">
                  {p.team_slug
                    ? <Link href={`${profileBase}/team/${encodeURIComponent(p.team_slug)}`} title={t("basketball.openProfile")} className="hover:text-accent-ink hover:underline">{p.team_name}</Link>
                    : p.team_name}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-ink-3">{p.games}</td>
                <td className="px-2 py-1"><input value={val(p.player_slug)} onChange={(e) => setEdits((s) => ({ ...s, [p.player_slug]: e.target.value }))}
                  className="w-40 rounded border border-line bg-field px-2 py-0.5 text-[12px] text-ink outline-none focus:border-line-strong" /></td>
              </tr>
            ))}
            {filtered.length === 0 ? <tr><td colSpan={4} className="px-2 py-3 text-[12px] text-ink-3">—</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Fixtures ---------- */
// Bets10 bağı (futboldaki MSM Fixture ID kalıbı): resolver'ın yazdığı bb_fixture_bets10_link
// EVENT bazlı (takım slug'ları bizim uzayda). Basketbolda 1X2 yok → toplam sayı + handikap
// kutuları. Fikstür satırı ↔ link eşleşmesi: external_id == bets10_event_id, ya da
// external_id BOŞ + aynı ev/dep slug çifti (başlamamış). Otomatik YAZMAZ: "Bets10'da var,
// fikstürde yok" listesi + "Bets10'dan doldur" / satır başı Ekle + mevcut satırda Uygula.
// Başlamış maçta öneri/Ekle kapalı (deadline donması; canlı oran/çizgi sızmasın).
const linkStarted = (lk: BbBets10Link) => !!lk.start_ts && new Date(lk.start_ts).getTime() <= Date.now();
const fmtLine = (v: number | null | undefined, signed = false) => (v == null ? "—" : signed && v > 0 ? `+${v}` : String(v));
const fmtOdds = (v: number | null | undefined) => (v == null ? "-" : v.toFixed(2));
const numOrNull = (s: string): number | null => {
  if (s.trim() === "") return null;
  const v = parseFloat(s.replace(",", "."));
  return Number.isNaN(v) ? null : v;
};
const intOrNull = (s: string): number | null => {
  const v = numOrNull(s);
  return v == null ? null : Math.round(v);
};
type FixEdit = { external_id?: string; total_line?: string; hcp_line?: string; week?: string };
type WeekSel = number | "all";

function FixturesTab({ fixtures, teams, reload, league, isAdmin, locale, t }: {
  fixtures: PmFixture[]; teams: { slug: string; name: string }[]; reload: () => void; league: string;
  isAdmin: boolean; locale: "tr" | "en"; t: (k: string) => string;
}) {
  const [h, setH] = useState(teams[0]?.slug ?? "");
  const [a, setA] = useState(teams[1]?.slug ?? "");
  const [ext, setExt] = useState("");
  const [newWeek, setNewWeek] = useState("");
  const [links, setLinks] = useState<BbBets10Link[]>([]);
  // Satır düzenlemeleri (ext id / toplam / handikap / hafta): local state; Kaydet DB'ye yazar + reload.
  const [edits, setEdits] = useState<Record<number, FixEdit>>({});
  const [busy, setBusy] = useState(false);
  const reloadLinks = () => fetchBets10Links(league).then(setLinks);
  useEffect(() => { reloadLinks(); }, [league]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = (slug: string, fallback?: string | null) => teams.find((x) => x.slug === slug)?.name ?? fallback ?? slug;
  const linkFor = (f: PmFixture): BbBets10Link | undefined => {
    if (f.external_id) return links.find((l) => l.bets10_event_id === f.external_id);
    return links.find((l) => l.home_team_slug === f.home_team_slug && l.away_team_slug === f.away_team_slug && !linkStarted(l));
  };
  const matchedEvents = useMemo(() => {
    const s = new Set<number>();
    for (const f of fixtures) { const l = linkFor(f); if (l) s.add(l.event_id); }
    return s;
  }, [fixtures, links]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hafta (futboldaki Round dropdown karşılığı) ──
  // Hafta kaynağı: link.week (SofaScore 'Round N') ve fixture.week. Bir hafta "bitti" = o haftanın
  // tüm maçları başlamış ve tarihli fikstürlerinin hiçbiri gelecekte değil. Aktif haftalar üstte,
  // bitenler altta; açılış = ilk aktif hafta (bir kez). Haftasız satırlar (kupa/manuel) her seçimde görünür.
  const [week, setWeek] = useState<WeekSel>("all");
  const weekInitRef = useRef(false);
  const { weekOptions, completedWeeks } = useMemo(() => {
    const future = new Map<number, boolean>();
    const today = new Date().toISOString().slice(0, 10);
    for (const l of links) if (l.week != null) future.set(l.week, (future.get(l.week) ?? false) || !linkStarted(l));
    for (const f of fixtures) if (f.week != null) future.set(f.week, (future.get(f.week) ?? false) || !f.match_date || f.match_date >= today);
    const weeks = [...future.keys()].sort((x, y) => x - y);
    const completed = new Set(weeks.filter((w) => !future.get(w)));
    return { weekOptions: [...weeks.filter((w) => !completed.has(w)), ...weeks.filter((w) => completed.has(w))], completedWeeks: completed };
  }, [links, fixtures]);
  useEffect(() => {
    if (weekInitRef.current || weekOptions.length === 0) return;
    weekInitRef.current = true;
    const first = weekOptions.find((w) => !completedWeeks.has(w));
    if (first != null) setWeek(first);
  }, [weekOptions, completedWeeks]);
  const inWeek = (w: number | null | undefined) => week === "all" || w == null || w === week;
  const weekLabel = (w: number) => `${t("basketball.week")} ${w}${completedWeeks.has(w) ? ` (${t("basketball.weekDone")})` : ""}`;

  const pendingAll = links.filter((l) => !linkStarted(l) && !matchedEvents.has(l.event_id));
  const pending = pendingAll
    .filter((l) => inWeek(l.week))
    .sort((x, y) => (x.week ?? 0) - (y.week ?? 0) || String(x.start_ts ?? "").localeCompare(String(y.start_ts ?? "")));
  const pendingWithId = pending.filter((l) => !!l.bets10_event_id);
  const visibleFixtures = fixtures.filter((f) => inWeek(f.week));

  const add = async () => {
    if (!h || !a || h === a) return;
    await insertFixture({ home_team_slug: h, away_team_slug: a, home_team_name: nameOf(h), away_team_name: nameOf(a), external_id: ext.trim() || null, match_date: null, note: null, total_line: null, hcp_line: null, week: intOrNull(newWeek) }, league);
    setExt(""); reload();
  };
  const addFromLink = (l: BbBets10Link) => insertFixture({
    home_team_slug: l.home_team_slug, away_team_slug: l.away_team_slug,
    home_team_name: nameOf(l.home_team_slug, l.home_team_name), away_team_name: nameOf(l.away_team_slug, l.away_team_name),
    external_id: l.bets10_event_id, match_date: l.start_ts ? l.start_ts.slice(0, 10) : null, note: null,
    total_line: l.total_line, hcp_line: l.hcp_line, week: l.week,
  }, league);
  const addOne = async (l: BbBets10Link) => { setBusy(true); await addFromLink(l); setBusy(false); reload(); };
  // "Bets10'dan doldur": görünen (seçili hafta) + Bets10 id'si olan maçlar.
  const fillAll = async () => { setBusy(true); for (const l of pendingWithId) await addFromLink(l); setBusy(false); reload(); };

  const val = (f: PmFixture, k: keyof FixEdit): string => {
    const e = edits[f.id]?.[k];
    if (e !== undefined) return e;
    if (k === "external_id") return f.external_id ?? "";
    const v = f[k];
    return v == null ? "" : String(v);
  };
  const patch = (id: number, p: FixEdit) => setEdits((s) => ({ ...s, [id]: { ...s[id], ...p } }));
  const applyLink = (f: PmFixture, l: BbBets10Link) => patch(f.id, {
    external_id: l.bets10_event_id ?? "",
    total_line: l.total_line == null ? "" : String(l.total_line),
    hcp_line: l.hcp_line == null ? "" : String(l.hcp_line),
    ...(l.week != null && val(f, "week") === "" ? { week: String(l.week) } : {}),
  });
  // Öneri, satırdaki (düzenlenmiş/kaydedilmiş) değerden farklı mı → Uygula göster (Bets10 id'si varsa).
  const suggestDiff = (f: PmFixture, l: BbBets10Link) =>
    !!l.bets10_event_id && (val(f, "external_id") !== l.bets10_event_id || numOrNull(val(f, "total_line")) !== l.total_line || numOrNull(val(f, "hcp_line")) !== l.hcp_line);
  const save = async () => {
    const entries = Object.entries(edits);
    if (entries.length === 0) return;
    setBusy(true);
    for (const [id, p] of entries) {
      const row: Partial<PmFixture> = {};
      if (p.external_id !== undefined) row.external_id = p.external_id.trim() || null;
      if (p.total_line !== undefined) row.total_line = numOrNull(p.total_line);
      if (p.hcp_line !== undefined) row.hcp_line = numOrNull(p.hcp_line);
      if (p.week !== undefined) row.week = intOrNull(p.week);
      await updateFixture(Number(id), row);
    }
    setBusy(false); setEdits({}); reload();
  };

  const inp = "rounded border border-line bg-field px-2 py-0.5 text-[12px] text-ink outline-none focus:border-line-strong";
  const sel = "rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink";
  const linkSummary = (l: BbBets10Link) => l.bets10_event_id
    ? `H ${fmtLine(l.hcp_line, true)} (${fmtOdds(l.hcp_home_odds)}/${fmtOdds(l.hcp_away_odds)}) · T ${fmtLine(l.total_line)}${l.total_line != null ? ` (${fmtOdds(l.total_over_odds)}/${fmtOdds(l.total_under_odds)})` : ""} · ML ${fmtOdds(l.home_odds)}/${fmtOdds(l.away_odds)}`
    : t("basketball.betsNone");
  const weekBadge = (w: number | null | undefined) => (w != null && week === "all")
    ? <span className="rounded bg-veil px-1.5 py-0.5 text-[10px] font-semibold text-ink-3">{t("basketball.week")} {w}</span>
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.week")}</span>
          <select value={String(week)} onChange={(e) => setWeek(e.target.value === "all" ? "all" : Number(e.target.value))} className={sel}>
            <option value="all">{t("basketball.allWeeks")}</option>
            {weekOptions.map((w) => <option key={w} value={w}>{weekLabel(w)}</option>)}
          </select>
        </label>
        <span className="mx-1 self-stretch border-l border-line" />
        <select value={h} onChange={(e) => setH(e.target.value)} className={sel}>{teams.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}</select>
        <span className="pb-2 text-ink-3">vs</span>
        <select value={a} onChange={(e) => setA(e.target.value)} className={sel}>{teams.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}</select>
        <input placeholder={t("basketball.extId")} value={ext} onChange={(e) => setExt(e.target.value)} className="w-28 rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink" />
        <input type="number" min={1} placeholder={t("basketball.week")} value={newWeek} onChange={(e) => setNewWeek(e.target.value)} className="w-16 rounded-md border border-line bg-field px-2 py-1.5 text-[13px] text-ink" />
        <button onClick={add} className={btnSave}>{t("basketball.addFixture")}</button>
        <button onClick={save} disabled={busy || Object.keys(edits).length === 0} className={`${btnGhost} disabled:opacity-50`}>{t("basketball.save")}{Object.keys(edits).length ? ` (${Object.keys(edits).length})` : ""}</button>
        {isAdmin ? <div className="ml-auto" title={t("basketball.betsRefreshHint")}><RefreshNowButton kind="bets10_odds" onDone={reloadLinks} /></div> : null}
      </div>

      {/* Yaklaşan maçlar (SofaScore hafta + varsa Bets10 id/çizgi): otomatik görünür, yazma yalnız butonla */}
      <div className="rounded-lg border border-line bg-card-2/40 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3"><TenText text={t("basketball.betsPending")} /> ({pending.length})</span>
          <button onClick={fillAll} disabled={busy || pendingWithId.length === 0} title={t("basketball.betsHint")}
            className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1 text-[12px] font-semibold text-accent-ink hover:bg-accent/20 disabled:opacity-40">
            <TenText text={t("basketball.betsFill")} />{pendingWithId.length ? ` (${pendingWithId.length})` : ""}
          </button>
          <span className="text-[11px] text-ink-3"><TenText text={t("basketball.betsTotalNote")} /></span>
        </div>
        {pending.length > 0 ? (
          <ul className="mt-2 divide-y divide-line/60">
            {pending.map((l) => (
              <li key={l.event_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1 text-[12px]">
                <span className="w-24 shrink-0 tabular-nums text-ink-3">{l.start_ts ? formatMatchDate(l.start_ts, locale) : "—"}</span>
                {weekBadge(l.week)}
                <span className="text-ink">{nameOf(l.home_team_slug, l.home_team_name)} <span className="text-ink-3">-</span> {nameOf(l.away_team_slug, l.away_team_name)}</span>
                <span className="font-mono text-[11px] text-ink-2">{l.bets10_event_id ?? "—"}</span>
                <span className="tabular-nums text-ink-3">{linkSummary(l)}</span>
                <button onClick={() => addOne(l)} disabled={busy} className="ml-auto rounded border border-line px-2 py-0.5 text-[11px] font-semibold text-ink-2 hover:text-ink disabled:opacity-40">{t("basketball.betsAdd")}</button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-[11px] text-ink-3"><TenText text={t("basketball.betsPendingNone")} /></p>}
      </div>

      <table className="min-w-full border-collapse text-[13px]">
        <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.1em] text-ink-3">
          <th className="px-2 py-1.5 text-right">{t("basketball.week")}</th>
          <th className="px-2 py-1.5 text-left">{t("basketball.fixHome")}</th><th className="px-2 py-1.5 text-left">{t("basketball.fixAway")}</th>
          <th className="px-2 py-1.5 text-left">{t("basketball.extId")}</th>
          <th className="px-2 py-1.5 text-right">{t("basketball.fixTotal")}</th>
          <th className="px-2 py-1.5 text-right">{t("basketball.fixHcp")}</th>
          <th className="px-2 py-1.5 text-left"><TenText text={t("basketball.betsHint")} /></th>
          <th className="px-2 py-1.5"></th>
        </tr></thead>
        <tbody>
          {visibleFixtures.map((f) => {
            const l = linkFor(f);
            const started = l ? linkStarted(l) : false;
            return (
              <tr key={f.id} className="border-t border-line hover:bg-veil">
                <td className="px-2 py-1 text-right"><input type="number" min={1} value={val(f, "week")} onChange={(e) => patch(f.id, { week: e.target.value })} className={`${inp} w-14 text-right tabular-nums`} /></td>
                <td className="px-2 py-1 text-ink whitespace-nowrap">{f.home_team_name}</td><td className="px-2 py-1 text-ink whitespace-nowrap">{f.away_team_name}</td>
                <td className="px-2 py-1"><input value={val(f, "external_id")} onChange={(e) => patch(f.id, { external_id: e.target.value })} className={`${inp} w-44 font-mono text-[11px]`} /></td>
                <td className="px-2 py-1 text-right"><input type="number" step="0.5" value={val(f, "total_line")} onChange={(e) => patch(f.id, { total_line: e.target.value })} className={`${inp} w-20 text-right tabular-nums`} /></td>
                <td className="px-2 py-1 text-right"><input type="number" step="0.5" value={val(f, "hcp_line")} onChange={(e) => patch(f.id, { hcp_line: e.target.value })} className={`${inp} w-20 text-right tabular-nums`} /></td>
                <td className="px-2 py-1 text-[11px] whitespace-nowrap">
                  {l ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="tabular-nums text-ink-3" title={l.bets10_event_id ?? undefined}>{linkSummary(l)}</span>
                      {started
                        ? <span className="rounded bg-veil px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-3">{t("basketball.betsStarted")}</span>
                        : suggestDiff(f, l)
                          ? <button onClick={() => applyLink(f, l)} className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-ink hover:bg-accent/20">{t("basketball.betsApply")}</button>
                          : null}
                    </span>
                  ) : <span className="text-ink-3">—</span>}
                </td>
                <td className="px-2 py-1 text-right"><button onClick={async () => { await deleteFixture(f.id); reload(); }} className="text-[12px] text-neg hover:underline">×</button></td>
              </tr>
            );
          })}
          {visibleFixtures.length === 0 ? <tr><td colSpan={8} className="px-2 py-3 text-[12px] text-ink-3">—</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Player Roles sekmesi: rol eşikleri + roller listesi + lider toggle'ları ---------- */
// Açıklamalar i18n'den (EN/TR ayrı); model_config.note KULLANILMAZ (dil karışmasın).
function cfgKeyLabel(key: string, t: (k: string) => string): string {
  const lbl = t(`basketball.cfgKey_${key}`);
  return lbl === `basketball.cfgKey_${key}` ? key : lbl; // i18n yoksa ham anahtar
}

function PlayerRolesConfig({ modelConfig, reload, t }: {
  modelConfig: PmModelConfig[]; reload: () => void; t: (k: string) => string;
}) {
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const roleRows = modelConfig.filter((x) => x.key.startsWith("role_"));
  const leaderRows = modelConfig.filter((x) => x.key.startsWith("leader_"));
  const val = (k: string, v: number) => edits[k] ?? v;
  const save = async () => {
    const payload = Object.entries(edits).map(([key, value]) => ({ key, value }));
    if (payload.length === 0) return;
    if (!(await confirmPermanentSave())) return;
    setSaving(true);
    const ok = await saveModelConfig(payload);
    setSaving(false);
    if (ok) { setEdits({}); reload(); }
  };
  const roleBadge = (role: string) =>
    `inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${roleBadgeClass(role)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving || Object.keys(edits).length === 0} className={`${btnSave} disabled:opacity-50`}>{t("basketball.save")}</button>
        <p className="text-[11px] text-ink-3">{t("basketball.cfgRoleHint")}</p>
      </div>

      {/* Roller listesi + açıklama (i18n) */}
      <div className="rounded-lg border border-line bg-card-2/40 px-3 py-2.5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{t("basketball.cfgRolesListTitle")}</div>
        <ul className="space-y-1.5">
          {ALL_ROLES.map((role) => (
            <li key={role} className="flex items-start gap-2 text-[12px]">
              <span className={roleBadge(role)}>{t(roleLabelKey(role) as string)}</span>
              <span className="text-ink-3">{t(roleDescKey(role))}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Eşikler (i18n açıklamalı) */}
      {roleRows.length > 0 && (
        <div className="rounded-lg border border-line bg-card-2/40 px-3 py-2.5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{t("basketball.cfgRoleTitle")}</div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {roleRows.map((r) => (
              <label key={r.key} className="flex items-center gap-1.5 text-[11px] text-ink-2">
                <span className="text-ink-3">{cfgKeyLabel(r.key, t)}</span>
                <input type="number" step="any" value={val(r.key, r.value)}
                  onChange={(e) => setEdits((s) => ({ ...s, [r.key]: parseFloat(e.target.value) }))}
                  className="w-16 rounded border border-line bg-field px-1 py-0.5 text-right text-[11px] text-ink outline-none focus:border-line-strong" />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Takım-lideri rozet toggle'ları */}
      {leaderRows.length > 0 && (
        <div className="rounded-lg border border-line bg-card-2/40 px-3 py-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{t("basketball.cfgLeaderTitle")}</div>
          <p className="mb-2 text-[11px] text-ink-3">{t("basketball.cfgLeaderHint")}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {leaderRows.map((r) => (
              <label key={r.key} className="flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-2">
                <input type="checkbox" checked={val(r.key, r.value) === 1}
                  onChange={(e) => setEdits((s) => ({ ...s, [r.key]: e.target.checked ? 1 : 0 }))}
                  className="accent-[var(--accent)]" />
                <span className="text-ink-3">{cfgKeyLabel(r.key, t)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Model ağırlıkları: Team Models + Player Models ---------- */
// Team Metrics "L10 WTD" = sezon*wall + son10*w10 + son5*w5 karışımı (Excel TeamProps F);
// "Model" = sayı uplift'i × bu karışım. Player Dist "Model" = son10*w10 + son5*w5 +
// sezon*wall (saf). BasketballTools bu anahtarları okur.
function ModelWeightsConfig({ modelConfig, reload, t }: {
  modelConfig: PmModelConfig[]; reload: () => void; t: (k: string) => string;
}) {
  const [tEdits, setTEdits] = useState<Record<string, number>>({});
  const [pEdits, setPEdits] = useState<Record<string, number>>({});
  const [savingT, setSavingT] = useState(false);
  const [savingP, setSavingP] = useState(false);
  const dbVal = (k: string, d: number) => {
    const c = modelConfig.find((x) => x.key === k);
    return c ? c.value : d;
  };
  const tv = (k: string, d: number) => tEdits[k] ?? dbVal(k, d);
  const pv = (k: string, d: number) => pEdits[k] ?? dbVal(k, d);
  const tTotal = tv("team_model_wall", 50) + tv("team_model_w10", 20) + tv("team_model_w5", 30);
  const pTotal = pv("player_model_w10", 20) + pv("player_model_w5", 30) + pv("player_model_wall", 50);

  const saveTeam = async () => {
    if (!(await confirmPermanentSave())) return;
    setSavingT(true);
    const ok = await saveModelConfig([
      { key: "team_model_wall", value: tv("team_model_wall", 50) },
      { key: "team_model_w10", value: tv("team_model_w10", 20) },
      { key: "team_model_w5", value: tv("team_model_w5", 30) },
    ]);
    setSavingT(false);
    if (ok) { setTEdits({}); reload(); }
  };
  const savePlayer = async () => {
    if (!(await confirmPermanentSave())) return;
    setSavingP(true);
    const ok = await saveModelConfig([
      { key: "player_model_w10", value: pv("player_model_w10", 20) },
      { key: "player_model_w5", value: pv("player_model_w5", 30) },
      { key: "player_model_wall", value: pv("player_model_wall", 50) },
    ]);
    setSavingP(false);
    if (ok) { setPEdits({}); reload(); }
  };

  const field = (label: string, value: number, onChange: (v: number) => void) => (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.12em] text-ink-3">{label}</span>
      <input type="number" min={0} max={100} step={1} value={value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))}
        className="w-20 rounded border border-line bg-field px-2 py-1 text-right text-[13px] text-ink outline-none focus:border-line-strong" />
    </div>
  );
  const totalCell = (total: number) => (
    <div className="flex flex-col gap-1 pb-0.5">
      <span className="text-[10px] uppercase tracking-[0.12em] text-ink-3">{t("basketball.modelTotal")}</span>
      <span className={`text-[15px] font-semibold tabular-nums ${total > 100 ? "text-neg" : "text-ink"}`}>{total}</span>
    </div>
  );
  const box = "rounded-lg border border-line bg-card-2/40 px-4 py-3";
  const saveBtn = `${btnSave} disabled:opacity-50`;

  return (
    <div className="space-y-4">
      {/* Team Models */}
      <div className={box}>
        <div className="mb-2 flex items-center gap-3">
          <button onClick={saveTeam} disabled={savingT || tTotal > 100} className={saveBtn}>{t("basketball.save")}</button>
          <span className="text-[13px] font-semibold text-ink">{t("basketball.modelTeamTitle")}</span>
          {tTotal > 100 ? <span className="text-[12px] text-neg">{t("basketball.modelWarn")}</span> : null}
        </div>
        <p className="mb-3 max-w-2xl text-[11px] text-ink-3">{t("basketball.modelTeamHint")}</p>
        <div className="flex flex-wrap items-end gap-4">
          {field(t("basketball.modelWSeason"), tv("team_model_wall", 50), (v) => setTEdits((s) => ({ ...s, team_model_wall: v })))}
          {field(t("basketball.modelWLast10"), tv("team_model_w10", 20), (v) => setTEdits((s) => ({ ...s, team_model_w10: v })))}
          {field(t("basketball.modelWLast5"), tv("team_model_w5", 30), (v) => setTEdits((s) => ({ ...s, team_model_w5: v })))}
          {totalCell(tTotal)}
        </div>
      </div>

      {/* Player Models */}
      <div className={box}>
        <div className="mb-2 flex items-center gap-3">
          <button onClick={savePlayer} disabled={savingP || pTotal > 100} className={saveBtn}>{t("basketball.save")}</button>
          <span className="text-[13px] font-semibold text-ink">{t("basketball.modelPlayerTitle")}</span>
          {pTotal > 100 ? <span className="text-[12px] text-neg">{t("basketball.modelWarn")}</span> : null}
        </div>
        <p className="mb-3 max-w-2xl text-[11px] text-ink-3">{t("basketball.modelPlayerHint")}</p>
        <div className="flex flex-wrap items-end gap-4">
          {field(t("basketball.modelWLast10"), pv("player_model_w10", 20), (v) => setPEdits((s) => ({ ...s, player_model_w10: v })))}
          {field(t("basketball.modelWLast5"), pv("player_model_w5", 30), (v) => setPEdits((s) => ({ ...s, player_model_w5: v })))}
          {field(t("basketball.modelWSeason"), pv("player_model_wall", 50), (v) => setPEdits((s) => ({ ...s, player_model_wall: v })))}
          {totalCell(pTotal)}
        </div>
      </div>
    </div>
  );
}

/* ---------- Config: alt sekmeler — Player Roles / Model / Market Templates ---------- */
function ConfigTab({ config, reload, modelConfig, reloadModelConfig, inputType, setInputType, league, locale, t }: {
  config: PmMarketConfig[]; reload: () => void;
  modelConfig: PmModelConfig[]; reloadModelConfig: () => void;
  inputType: "player" | "team"; setInputType: (t: "player" | "team") => void;
  league: string; locale: string; t: (k: string) => string;
}) {
  const [sub, setSub] = useState<"roles" | "model" | "markets">("roles");
  const [edits, setEdits] = useState<Record<string, Partial<PmMarketConfig>>>({});
  const [saving, setSaving] = useState(false);
  const [nm, setNm] = useState<{ name: string; base: string; side: string; template: string; std: string }>({ name: "", base: "manual", side: "home", template: "", std: "" });
  // Dropdown: hali hazırda açık base'ler HARİÇ (data olup eklenmemiş / silinip geri eklenecek) + "manual" (data yok).
  // Team'de base taraf-bazlı kullanılır (Home/Away/Total ayrı satır) → sadece SEÇİLİ tarafta kullanılanları çıkar,
  // yoksa bir marketi home'a ekleyince away/total'e ekleyemez oluyorduk.
  const usedBases = new Set(
    config
      .filter((c) => c.market_group === inputType && c.base_metric && (inputType !== "team" || c.side === nm.side))
      .map((c) => c.base_metric)
  );
  const availBases = Object.keys(METRIC_LABELS).filter((k) => !usedBases.has(k));
  const rk = (c: PmMarketConfig) => `${c.market_group}:${c.market_key}`;
  const patch = (c: PmMarketConfig, p: Partial<PmMarketConfig>) => setEdits((s) => ({ ...s, [rk(c)]: { ...s[rk(c)], ...p } }));
  const v = <K extends keyof PmMarketConfig>(c: PmMarketConfig, key: K): PmMarketConfig[K] =>
    (edits[rk(c)]?.[key] ?? c[key]) as PmMarketConfig[K];

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
    if (!(await confirmPermanentSave())) return;
    setSaving(true);
    const ok = await upsertMarketConfig(rows, league);
    setSaving(false);
    if (ok) { setEdits({}); reload(); }
  };

  // Yeni market ekle. base="manual" → data yok (dağıtılmaz, elle). İsim elle girilebilir.
  const addMarket = async () => {
    const isTeam = inputType === "team";
    const manual = nm.base === "manual";
    const base = manual ? null : nm.base;
    const auto = manual ? "market" : metricLabel(nm.base, "en");
    const label = nm.name.trim() || (isTeam && !manual ? `${nm.side} ${auto}` : auto);
    const key = `${isTeam ? nm.side + "_" : ""}custom_${base ?? "x"}_${Date.now() % 1000000}`;
    const ok = await upsertMarketConfig([{
      market_group: inputType, market_key: key, label, base_metric: base,
      side: isTeam ? nm.side : null, template_id: nm.template.trim() || null,
      std: nm.std ? parseFloat(nm.std) : null, in_model: true, sort_order: 999,
    }]);
    if (ok) { setNm({ name: "", base: "manual", side: "home", template: "", std: "" }); reload(); }
  };
  const removeMarket = async (c: PmMarketConfig) => {
    if (!window.confirm(t("basketball.confirmDelete"))) return;
    if (await deleteMarketConfig(c.market_group, c.market_key, league)) reload();
  };

  const numCell = (c: PmMarketConfig, key: keyof PmMarketConfig, w = "w-12", nullable = false, ph = "") => (
    <input type="number" step="any" placeholder={ph}
      value={(v(c, key) as number | null) ?? ""}
      onChange={(e) => patch(c, { [key]: e.target.value === "" ? (nullable ? null : 0) : parseFloat(e.target.value) } as Partial<PmMarketConfig>)}
      className={`${w} rounded border border-line bg-field px-1 py-0 text-right text-[11px] text-ink outline-none focus:border-line-strong`} />
  );

  const th = "px-1.5 py-1 text-[9px] uppercase tracking-[0.1em] text-ink-3";
  const td = "px-1.5 py-0.5";
  const Section = ({ grp }: { grp: string }) => (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-[11px]">
        <thead><tr className="border-b border-line">
          <th className={`${th} text-center`}>{t("basketball.colModelFlag")}</th>
          <th className={`${th} text-left`}>{t("basketball.colMarket")}</th>
          <th className={`${th} text-left`}>{t("basketball.marketTemplate")}</th>
          <th className={`${th} text-right`}>{t("basketball.colStd")}</th>
          <th className={`${th} text-right`}>{t("basketball.cfgLines")}</th>
          <th className={`${th} text-right`}>{t("basketball.cfgUnder")}</th>
          <th className={`${th} text-right`}>{t("basketball.cfgSkipAfter")}</th>
          <th className={`${th} text-right`}>{t("basketball.cfgSkipStep")}</th>
          <th className={`${th} text-right`}>{t("basketball.cfgMaxLines")}</th>
          <th className={`${th} text-right`}>{t("basketball.cfgCap")}</th>
          <th className={`${th} text-right`}>{t("basketball.cfgPayback")}</th>
          <th className={`${th} text-center`}>{t("basketball.cfgRound")}</th>
          <th className={`${th} text-center`}></th>
        </tr></thead>
        <tbody>
          {bySection(grp).map((c) => {
            const isCustom = c.market_key.includes("custom_");
            return (
            <tr key={rk(c)} className="border-t border-line hover:bg-veil">
              <td className={`${td} text-center`}><input type="checkbox" checked={!!v(c, "in_model")} onChange={(e) => patch(c, { in_model: e.target.checked })} className="accent-[var(--accent)]" /></td>
              <td className={`${td} text-ink whitespace-nowrap`}>
                {isCustom
                  ? <input value={(v(c, "label") ?? "").toString()} onChange={(e) => patch(c, { label: e.target.value })} className="w-24 rounded border border-line bg-field px-1 py-0 text-[11px] text-ink outline-none focus:border-line-strong" />
                  : configLabel({ ...c, ...edits[rk(c)] }, locale)}
              </td>
              <td className={td}><input value={(v(c, "template_id") ?? "").toString()} onChange={(e) => patch(c, { template_id: e.target.value || null })}
                className="w-24 rounded border border-line bg-field px-1 py-0 text-[11px] text-ink outline-none focus:border-line-strong" placeholder="—" /></td>
              <td className={`${td} text-right`}>{numCell(c, "std", "w-12")}</td>
              <td className={`${td} text-right`}>{numCell(c, "lines", "w-10")}</td>
              <td className={`${td} text-right`}>{numCell(c, "under_lines", "w-10")}</td>
              <td className={`${td} text-right`}>{numCell(c, "skip_after", "w-10")}</td>
              <td className={`${td} text-right`}>{numCell(c, "skip_step", "w-10")}</td>
              <td className={`${td} text-right`}>{numCell(c, "max_lines", "w-10")}</td>
              <td className={`${td} text-right`}>{numCell(c, "odds_cap", "w-12")}</td>
              <td className={`${td} text-right`}>{numCell(c, "payback", "w-14", true, t("basketball.cfgDefault"))}</td>
              <td className={`${td} text-center`}><input type="checkbox" checked={!!v(c, "round_odds")} onChange={(e) => patch(c, { round_odds: e.target.checked })} className="accent-[var(--accent)]" /></td>
              <td className={`${td} text-center`}><button onClick={() => removeMarket(c)} title={t("basketball.remove")} className="text-[13px] text-neg hover:opacity-70">×</button></td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const inp = "rounded border border-line bg-field px-2 py-1 text-[12px] text-ink outline-none focus:border-line-strong";
  const subBtn = (id: "roles" | "model" | "markets", label: string) => (
    <button onClick={() => setSub(id)} className={`rounded-lg px-4 py-1.5 text-[13px] ${sub === id ? "bg-veil font-semibold text-ink" : "text-ink-3 hover:text-ink-2"}`}>{label}</button>
  );
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-line pb-2">
        {subBtn("roles", t("basketball.cfgTabRoles"))}
        {subBtn("model", t("basketball.cfgTabModel"))}
        {subBtn("markets", t("basketball.cfgTabMarkets"))}
      </div>

      {sub === "roles" ? (
        <PlayerRolesConfig modelConfig={modelConfig} reload={reloadModelConfig} t={t} />
      ) : sub === "model" ? (
        <ModelWeightsConfig modelConfig={modelConfig} reload={reloadModelConfig} t={t} />
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[12px] text-ink-2">
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.colType")}</span>
              <select value={inputType} onChange={(e) => setInputType(e.target.value as "player" | "team")} className={inp}>
                <option value="player">Player</option>
                <option value="team">Team</option>
              </select>
            </label>
            <button onClick={save} disabled={saving || Object.keys(edits).length === 0} className={`${btnSave} disabled:opacity-50`}>{t("basketball.save")}</button>
            <p className="text-[11px] text-ink-3">{t("basketball.cfgHint")}</p>
          </div>

          {/* yeni market ekleme — isim elle; base "manual"=data yok (dağıtılmaz) */}
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-card-2/40 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{t("basketball.cfgNewMarket")}</span>
            <input value={nm.name} onChange={(e) => setNm((s) => ({ ...s, name: e.target.value }))} placeholder={t("basketball.cfgMarketName")} className={`${inp} w-28`} />
            <select value={nm.base} onChange={(e) => setNm((s) => ({ ...s, base: e.target.value }))} className={inp}>
              <option value="manual">{t("basketball.cfgManualNoData")}</option>
              {availBases.map((k) => <option key={k} value={k}>{metricLabel(k, locale)}</option>)}
            </select>
            {inputType === "team" && (
              <select value={nm.side} onChange={(e) => setNm((s) => ({ ...s, side: e.target.value }))} className={inp}>
                <option value="home">Home</option><option value="away">Away</option><option value="total">Total</option>
              </select>
            )}
            <input value={nm.template} onChange={(e) => setNm((s) => ({ ...s, template: e.target.value }))} placeholder={t("basketball.marketTemplate")} className={`${inp} w-32`} />
            <input value={nm.std} onChange={(e) => setNm((s) => ({ ...s, std: e.target.value }))} placeholder={t("basketball.colStd")} className={`${inp} w-16`} />
            <button onClick={addMarket} className={btnGhost}>{t("basketball.add")}</button>
          </div>

          <Section grp={inputType} />
        </div>
      )}
    </div>
  );
}

/* ---------- Input ---------- */
// Selection_1 hep Over, Selection_2_Name hep Under. Under KAPALI line'da (Config'teki
// under_lines disinda kalan, under = null) Selection_2_Price BOS BIRAKILMAZ, 1 yazilir:
// kural tum config icin gecerli (player + team, BSL/EuroLeague/EuroCup), tek cikis noktasi
// exportXlsx. Market Status kural yoksa boş. Player'da participant + sort order kolonları
// var, team'de yok.
const UNDER_CLOSED_PRICE = 1;
const exportUnder = (r: BktInputRow) => r.under ?? UNDER_CLOSED_PRICE;
const PLAYER_IN_HEADERS = ["Fixture ID", "Market Template", "Market Participant", "Market Participant Sort Order", "Line", "Market Status", "Selection_1_Name", "Selection_1_Price", "Selection_2_Name", "Selection_2_Price"];
const TEAM_IN_HEADERS = ["Fixture ID", "Market Template", "Line", "Market Status", "Selection_1_Name", "Selection_1_Price", "Selection_2_Name", "Selection_2_Price"];

function InputTab({ allRows, setRows, initialType, onExported, t }: {
  allRows: BktInputRow[]; setRows: (r: BktInputRow[]) => void;
  initialType: "player" | "team"; onExported?: (type: "player" | "team") => void; t: (k: string) => string;
}) {
  const [type, setType] = useState<"player" | "team">(initialType);
  const isTeam = type === "team";
  const rows = allRows.filter((r) => r.kind === type);
  const rowName = (r: BktInputRow) => (r.kind === "team" ? r.teamName : r.playerName);
  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const headers = isTeam ? TEAM_IN_HEADERS : PLAYER_IN_HEADERS;
    const aoa = [headers, ...rows.map((r) => isTeam
      ? [r.fixtureExtId, r.template, r.line, "", "Over", r.over, "Under", exportUnder(r)]
      : [r.fixtureExtId, r.template, r.participant, r.side, r.line, "", "Over", r.over, "Under", exportUnder(r)])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "input");
    XLSX.writeFile(wb, `${exportFileName(`basketbol_input_${type}`)}.xlsx`);
    // Export gecmisi: sadece yazdirilan tip kaydedilir.
    onExported?.(type);
  };
  // Temizle sadece aktif tipteki satırları siler; sil belirli satırı allRows'tan çıkarır.
  const clear = () => setRows(allRows.filter((r) => r.kind !== type));
  const removeRow = (r: BktInputRow) => setRows(allRows.filter((x) => x !== r));
  const cnt = (k: "player" | "team") => allRows.filter((r) => r.kind === k).length;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(["player", "team"] as const).map((k) => (
          <button key={k} onClick={() => setType(k)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${type === k ? "bg-accent text-on-accent" : "bg-card-2 text-ink-2 hover:text-ink"}`}>
            {k === "team" ? "Team" : "Player"}{cnt(k) ? ` (${cnt(k)})` : ""}
          </button>
        ))}
        <button onClick={exportXlsx} disabled={rows.length === 0} className={`ml-3 ${btnSave} disabled:opacity-50`}>{t("basketball.printXlsx")}</button>
        <button onClick={clear} disabled={rows.length === 0} className={`${btnGhost} disabled:opacity-50`}>{t("basketball.clear")}</button>
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
                  <td className="px-2 py-0.5 text-right tabular-nums text-ink-2">{exportUnder(r).toFixed(2)}</td>
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
