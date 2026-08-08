"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import HistoryDropdown from "@/features/model-history/HistoryDropdown";
import RetentionConfig from "@/features/model-history/RetentionConfig";
import {
  postModelHistory,
  type ModelHistoryDraft,
  type ModelHistoryRecord,
} from "@/lib/model-history";
import {
  fetchUpcomingFixtures,
  fetchTeamPlayers,
  fetchPlayerRecentMatches,
  fetchPlayerMetricStats,
  fetchPlayerLast5Avg,
  fetchLatestMetricSeason,
  fetchStoredMarkets,
  fetchPlayerSeasonAppearances,
  fetchFixtureInputs,
  fetchPlayerIds,
  fetchDistWeights,
  saveDistWeights,
  DEFAULT_DIST_WEIGHTS,
  fetchStatusConfig,
  saveStatusConfig,
  MARKET_OPTIONS,
  type UpcomingFixture,
  type PlayerRow,
  type PlayerMetricStat,
  type MarketOption,
  type StoredMarket,
  type MarketType,
  type DistWeights,
  type StatusConfig,
} from "./queries";
import { DEFAULT_STATUS_CONFIG } from "./compute";
import { previousSeasonLabel, currentSeasonLabel, latestSeasonLabel } from "@/lib/season";
import {
  PlayerListTab,
  MarketListTab,
  FixtureIdTab,
  InputTab,
  type StaticInputRow,
  type DynamicInputRow,
  type DynamicSelection,
} from "./list-tabs";
import {
  inferPlayerStatusV2,
  distributeExpectation,
  calcOddsLines,
  type InferredStatus,
} from "./compute";
import PlayerProfileDrawer from "./player-profile-drawer";
import type { Translator } from "@/lib/i18n/messages";

const STATUS_LABEL_KEYS: Record<InferredStatus, string> = {
  "Pos. Starter": "playerMarket.statusPosStarter",
  "Pos. Sub": "playerMarket.statusPosSub",
  "Out": "playerMarket.statusOut",
};

function statusLabel(t: Translator, status: InferredStatus): string {
  return t(STATUS_LABEL_KEYS[status]);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerState = {
  player_source_id: string;
  player_name: string;
  player_slug: string;
  primary_position_code: string;
  appearances: number;
  lyAppearances: number | null;
  last_match_datetime: string | null;
  checked: boolean;
  status: InferredStatus;
  seasonAvg: number | null;
  last5Avg: number | null;
  lyAvg: number | null;
  manualValue: string;
};

// Export gecmisi: bu kopya Super Lig (tsl). 1. Lig kopyasi "tff1" kullanir.
const HISTORY_LEAGUE = "tsl";

// Restore snapshot'i: bir maci Excel'e export ettigimizde o anki tum kullanici
// girdileri. player_source_id -> {tik, durum, elle deger}; ayrica line tikleri,
// elle oranlar ve fikstur/market/dagitim ayarlari. Sadece export'ta yazilir.
type PsmSnapshot = {
  fixtureId: number;
  marketKey: string;
  homeDistExp: string;
  awayDistExp: string;
  paybackPct: string;
  distributeEnabled: boolean;
  players: Record<
    string,
    { checked: boolean; status: InferredStatus; manualValue: string }
  >;
  lineTicks: Record<string, boolean>;
  oddsEdit: Record<string, string>;
};

// Number input'larda tarayici spinner'lari tema renkleriyle uyusmuyor; gizle.
const NO_SPINNER =
  "appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const STATUS_OPTIONS: InferredStatus[] = ["Pos. Starter", "Pos. Sub", "Out"];

const STATUS_COLORS: Record<InferredStatus, string> = {
  "Pos. Starter": "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "Pos. Sub": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "Out": "bg-red-500/20 text-red-400 border-red-500/30",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null, digits = 2): string {
  if (v === null || isNaN(v)) return "—";
  return v.toFixed(digits);
}

function fmtOdds(v: number): string {
  if (!v || v <= 0 || !isFinite(v)) return "—";
  return v.toFixed(2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({
  status,
  onChange,
}: {
  status: InferredStatus;
  onChange: (s: InferredStatus) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="relative inline-block">
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as InferredStatus)}
        className={`cursor-pointer appearance-none rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide pr-4
          ${STATUS_COLORS[status]} bg-field focus:outline-none`}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt} value={opt} className="bg-field text-ink">
            {statusLabel(t, opt)}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-ink-3 text-[10px]">▾</span>
    </div>
  );
}

const STATUS_ACCENT: Record<InferredStatus, string> = {
  "Pos. Starter": "accent-teal-400",
  "Pos. Sub":     "accent-yellow-400",
  "Out":          "accent-red-400",
};

const STATUS_ORDER: Record<InferredStatus, number> = { "Pos. Starter": 0, "Pos. Sub": 1, "Out": 2 };

// ─── Player table for one team ────────────────────────────────────────────────

type SortCol = "player" | "pos" | "apps" | "status" | "avg" | "last5" | "lyavg" | "distexp" | "manual";
type SortDir = "asc" | "desc";

function SortTh({
  col, label, sortCol, sortDir, onSort, className = "",
}: {
  col: SortCol; label: string; sortCol: SortCol; sortDir: SortDir;
  onSort: (c: SortCol) => void; className?: string;
}) {
  const active = sortCol === col;
  return (
    <th
      className={`px-1 py-1.5 cursor-pointer select-none hover:text-ink-2 ${className}`}
      onClick={() => onSort(col)}
    >
      {label}
      <span className="ml-0.5 opacity-50">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    </th>
  );
}

// ─── Config > Model: dagitim agirliklari (LY Avg / Last 5 / Avg yuzde) ────────
function DistributeConfig({
  weights,
  onSaved,
}: {
  weights: DistWeights;
  onSaved: (w: DistWeights) => void;
}) {
  const { t } = useI18n();
  const [ly, setLy] = useState(String(weights.ly));
  const [last5, setLast5] = useState(String(weights.last5));
  const [avg, setAvg] = useState(String(weights.avg));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Yeniden yuklenen agirliklarla alanlari senkronla.
  useEffect(() => {
    setLy(String(weights.ly));
    setLast5(String(weights.last5));
    setAvg(String(weights.avg));
  }, [weights]);

  const num = (s: string) => {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const total = num(ly) + num(last5) + num(avg);
  const over = total > 100;

  async function handleSave() {
    if (over) return;
    setSaving(true);
    const w: DistWeights = { ly: num(ly), last5: num(last5), avg: num(avg) };
    const ok = await saveDistWeights(w);
    setSaving(false);
    if (ok) {
      setSavedAt(Date.now());
      onSaved(w);
    }
  }

  const weightField = (
    label: string,
    value: string,
    setValue: (v: string) => void
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-[0.12em] text-ink-3">{label}</label>
      <input
        type="number"
        min="0"
        max="100"
        step="1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 rounded-lg border border-line bg-field px-3 py-2 text-[13px] text-ink focus:border-teal-500/50 focus:outline-none"
      />
    </div>
  );

  return (
    <div className="rounded-xl border border-line bg-card px-5 py-4">
      {/* Save yukarida */}
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || over}
          className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-[13px] font-semibold text-teal-300 transition hover:bg-teal-500/20 disabled:opacity-50"
        >
          {saving ? t("playerMarket.sendingLabel") : t("playerMarket.saveLabel")}
        </button>
        {savedAt !== null && !saving && (
          <span className="text-[12px] text-teal-400">{t("playerMarket.savedLabel")}</span>
        )}
        <span className="text-[13px] font-semibold text-ink">{t("playerMarket.distConfigTitle")}</span>
      </div>

      <p className="mb-3 max-w-2xl text-[12px] leading-5 text-ink-3">
        {t("playerMarket.distConfigHint")}
      </p>

      <div className="flex flex-wrap items-end gap-4">
        {weightField(t("playerMarket.distWeightLy"), ly, setLy)}
        {weightField(t("playerMarket.distWeightLast5"), last5, setLast5)}
        {weightField(t("playerMarket.distWeightAvg"), avg, setAvg)}
        <div className="flex flex-col gap-1 pb-0.5">
          <span className="text-[10px] uppercase tracking-[0.12em] text-ink-3">
            {t("playerMarket.distWeightTotal")}
          </span>
          <span className={`text-[15px] font-semibold tabular-nums ${over ? "text-rose-400" : "text-ink"}`}>
            {total}
          </span>
        </div>
        {over && (
          <span className="pb-1 text-[12px] text-rose-400">{t("playerMarket.distWeightWarn")}</span>
        )}
      </div>
    </div>
  );
}

// ─── Config > Model: Status kurallari (son N mac + en az K kez) ───────────────
function StatusConfigCard({
  config,
  onSaved,
}: {
  config: StatusConfig;
  onSaved: (c: StatusConfig) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<StatusConfig>(config);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Yeniden yuklenen config ile taslagi senkronla.
  useEffect(() => {
    setDraft(config);
  }, [config]);

  const setNum = (key: keyof StatusConfig) => (v: string) => {
    const n = parseInt(v, 10);
    setDraft((d) => ({ ...d, [key]: isNaN(n) ? 0 : Math.max(0, n) }));
  };

  async function handleSave() {
    setSaving(true);
    const ok = await saveStatusConfig(draft);
    setSaving(false);
    if (ok) {
      setSavedAt(Date.now());
      onSaved(draft);
    }
  }

  const numBox = (value: number, onChange: (v: string) => void) => (
    <input
      type="number"
      min="0"
      step="1"
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      className="w-14 rounded-md border border-line bg-field px-2 py-1 text-right text-[13px] text-ink focus:border-teal-500/50 focus:outline-none"
    />
  );

  const roleBadge = (label: string, cls: string) => (
    <span className={`inline-block w-16 rounded px-2 py-0.5 text-center text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );

  // Bir kural satiri: [rol] Son [N] maç · ≥ [K] kez · [koşul]
  const ruleRow = (
    badge: ReactNode,
    nKey: keyof StatusConfig,
    kKey: keyof StatusConfig,
    cond: string,
    disabled: boolean
  ) => (
    <div className={`flex flex-wrap items-center gap-2 text-[13px] text-ink-2 ${disabled ? "opacity-40" : ""}`}>
      {badge}
      <span className="text-ink-3">Son</span>
      {numBox(draft[nKey] as number, disabled ? () => {} : setNum(nKey))}
      <span className="text-ink-3">{t("playerMarket.statusWindowUnit")} · ≥</span>
      {numBox(draft[kKey] as number, disabled ? () => {} : setNum(kKey))}
      <span className="text-ink-3">{t("playerMarket.statusTimesUnit")} ·</span>
      <span className="text-ink">{cond}</span>
    </div>
  );

  const off = draft.lastOnly;

  return (
    <div className="rounded-xl border border-line bg-card px-5 py-4">
      {/* Save yukarida */}
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-[13px] font-semibold text-teal-300 transition hover:bg-teal-500/20 disabled:opacity-50"
        >
          {saving ? t("playerMarket.sendingLabel") : t("playerMarket.saveLabel")}
        </button>
        {savedAt !== null && !saving && (
          <span className="text-[12px] text-teal-400">{t("playerMarket.savedLabel")}</span>
        )}
        <span className="text-[13px] font-semibold text-ink">{t("playerMarket.statusConfigTitle")}</span>
      </div>

      <p className="mb-3 max-w-2xl text-[12px] leading-5 text-ink-3">
        {t("playerMarket.statusConfigHint")}
      </p>

      {/* Kurallar alt alta (oncelik: Out > Starter > Sub) */}
      <div className="space-y-2.5">
        {ruleRow(
          roleBadge(t("playerMarket.statusRoleOut"), "bg-rose-500/15 text-rose-300"),
          "outN", "outK", t("playerMarket.statusCondOut"), off
        )}
        {ruleRow(
          roleBadge(t("playerMarket.statusRoleStarter"), "bg-emerald-500/15 text-emerald-300"),
          "starterN", "starterK", t("playerMarket.statusCondStarter"), off
        )}
        {ruleRow(
          roleBadge(t("playerMarket.statusRoleSub"), "bg-amber-500/15 text-amber-300"),
          "subN", "subK", t("playerMarket.statusCondSub"), off
        )}
      </div>

      {/* Override: sadece son maca gore */}
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
        <input
          type="checkbox"
          checked={draft.lastOnly}
          onChange={(e) => setDraft((d) => ({ ...d, lastOnly: e.target.checked }))}
          className="cursor-pointer accent-teal-400"
        />
        {t("playerMarket.statusLastOnly")}
      </label>
    </div>
  );
}

function TeamPlayerTable({
  teamName,
  players,
  distExp,
  distributeEnabled,
  distWeights,
  paybackPct,
  dynamicMode,
  lineTicks,
  oddsEdit,
  onLineTick,
  onOddsEdit,
  onStatusChange,
  onManualChange,
  onCheckedChange,
  onPlayerClick,
}: {
  teamName: string;
  players: PlayerState[];
  distExp: number;
  distributeEnabled: boolean;
  distWeights: DistWeights;
  paybackPct: number;
  // Dynamic markette line'lar yerine oyuncu basina tek deger girilir
  // (anahtar "<player_key>:dyn"); Ekle bu degeri fiyat olarak yazar.
  dynamicMode: boolean;
  // Line tikleri ve elle duzenlenen oranlar parent'ta tutulur (Ekle akisi okur);
  // anahtar "<player_key>:<line>". Fixture/market degisince parent sifirlar.
  lineTicks: Record<string, boolean>;
  oddsEdit: Record<string, string>;
  onLineTick: (key: string, v: boolean) => void;
  onOddsEdit: (key: string, v: string) => void;
  onStatusChange: (id: string, s: InferredStatus) => void;
  onManualChange: (id: string, v: string) => void;
  onCheckedChange: (id: string, v: boolean) => void;
  onPlayerClick: (slug: string, name: string, sourceId: string) => void;
}) {
  const { t } = useI18n();
  const [sortCol, setSortCol] = useState<SortCol>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  // Beklenti Dagit kapaliyken dagitim yapilmaz; sadece manuel degerler kalir.
  const expMap = useMemo(
    () =>
      distributeEnabled
        ? distributeExpectation(
            players.map((p) => ({
              player_source_id: p.player_source_id,
              status: p.status,
              seasonAvg: p.seasonAvg,
              last5Avg: p.last5Avg,
              lyAvg: p.lyAvg,
              manualValue: p.manualValue,
            })),
            distExp,
            distWeights
          )
        : {},
    [players, distExp, distributeEnabled, distWeights]
  );

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "player") cmp = a.player_name.localeCompare(b.player_name);
      else if (sortCol === "pos") cmp = a.primary_position_code.localeCompare(b.primary_position_code);
      else if (sortCol === "apps") cmp = a.appearances - b.appearances;
      else if (sortCol === "status") cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      else if (sortCol === "avg") cmp = (a.seasonAvg ?? -1) - (b.seasonAvg ?? -1);
      else if (sortCol === "last5") cmp = (a.last5Avg ?? -1) - (b.last5Avg ?? -1);
      else if (sortCol === "lyavg") cmp = (a.lyAvg ?? -1) - (b.lyAvg ?? -1);
      else if (sortCol === "distexp") cmp = (expMap[a.player_source_id] ?? 0) - (expMap[b.player_source_id] ?? 0);
      else if (sortCol === "manual") {
        const ma = parseFloat(a.manualValue) || 0;
        const mb = parseFloat(b.manualValue) || 0;
        cmp = ma - mb;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [players, sortCol, sortDir, expMap]);

  return (
    <div className="flex-1 min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">{t("common.team")}</span>
        <span className="text-[15px] font-bold text-ink">{teamName}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full border-collapse text-[11px]">
          <thead className="bg-card-2">
            <tr className="text-left text-[9px] uppercase tracking-[0.08em] text-ink-3">
              <th className="px-1 py-1.5 w-5"></th>
              <SortTh col="player" label={t("common.player")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="min-w-[90px]" />
              <SortTh col="pos" label={t("common.position")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="apps" label={t("playerMarket.appearancesLabel")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh col="status" label={t("playerMarket.columnStatus")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="avg" label={t("playerMarket.avgLabel")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh col="last5" label={t("playerMarket.last5AvgLabel")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh col="lyavg" label={t("playerMarket.lyAvgLabel")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh col="distexp" label={t("playerMarket.distExpLabel")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh col="manual" label={t("playerMarket.manualLabel")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right w-12" />
              <th className="px-1 py-1.5 min-w-[148px]">{t("playerMarket.oddsOverHeader")}</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((p) => {
              const effExp = expMap[p.player_source_id] ?? 0;
              const manNum = parseFloat(p.manualValue);
              const finalExp = !isNaN(manNum) && manNum > 0 ? manNum : effExp;
              const oddsLines = !dynamicMode && p.status !== "Out" && finalExp > 0
                ? calcOddsLines(finalExp, paybackPct)
                : [];
              const dynKey = `${p.player_source_id}:dyn`;

              return (
                <tr
                  key={p.player_source_id}
                  className={`border-t border-line transition hover:bg-veil
                    ${p.status === "Out" ? "opacity-40" : ""}`}
                >
                  <td className="px-1 py-1">
                    <input
                      type="checkbox"
                      checked={p.checked}
                      onChange={(e) => onCheckedChange(p.player_source_id, e.target.checked)}
                      className={`cursor-pointer ${STATUS_ACCENT[p.status]}`}
                    />
                  </td>

                  <td
                    className="px-1 py-1 max-w-[140px]"
                    title={p.player_name}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onPlayerClick(p.player_slug, p.player_name, p.player_source_id)
                      }
                      className="block w-full truncate text-left font-medium text-ink underline-offset-2 transition hover:text-teal-300 hover:underline"
                    >
                      {p.player_name}
                    </button>
                  </td>

                  <td className="px-1 py-1 text-ink-3">{p.primary_position_code}</td>

                  {/* Bu sezon mac sayisi (parantezde gecen sezon) */}
                  <td className="px-1 py-1 text-right text-ink-2 tabular-nums whitespace-nowrap">
                    {p.appearances} <span className="text-ink-3">({p.lyAppearances ?? "—"})</span>
                  </td>

                  <td className="px-1 py-1">
                    <StatusBadge
                      status={p.status}
                      onChange={(s) => onStatusChange(p.player_source_id, s)}
                    />
                  </td>

                  <td className="px-1 py-1 text-right text-ink-2 tabular-nums">
                    {fmt(p.seasonAvg)}
                  </td>

                  <td className="px-1 py-1 text-right text-ink-2 tabular-nums">
                    {p.last5Avg !== null && p.last5Avg >= 0 ? fmt(p.last5Avg) : "—"}
                  </td>

                  <td className="px-1 py-1 text-right text-ink-2 tabular-nums">
                    {fmt(p.lyAvg)}
                  </td>

                  <td className="px-1 py-1 text-right tabular-nums text-teal-400/80">
                    {distributeEnabled && p.status !== "Out" ? fmt(effExp) : "—"}
                  </td>

                  <td className="px-1 py-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={p.manualValue}
                      onChange={(e) => onManualChange(p.player_source_id, e.target.value)}
                      className={`w-11 rounded border border-line bg-field px-1 py-0.5 text-right text-[11px] text-ink placeholder-ink-3 focus:border-teal-500/50 focus:outline-none ${NO_SPINNER}`}
                    />
                  </td>

                  {/* Odds - over only, 2x2 kompakt grid, satir basina tik + line + oran.
                      Dynamic markette line yok: tek tik + tek deger. */}
                  <td className="px-1 py-1">
                    {dynamicMode ? (
                      p.status !== "Out" ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={!!lineTicks[dynKey]}
                            onChange={(e) => onLineTick(dynKey, e.target.checked)}
                            className={`cursor-pointer ${STATUS_ACCENT[p.status]}`}
                          />
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            placeholder="0"
                            value={oddsEdit[dynKey] ?? ""}
                            onChange={(e) => onOddsEdit(dynKey, e.target.value)}
                            className={`w-14 rounded bg-veil px-1 py-0.5 text-right text-[11px] font-semibold text-teal-300 border border-transparent focus:border-teal-500/50 focus:outline-none ${NO_SPINNER}`}
                          />
                        </div>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )
                    ) : oddsLines.length > 0 ? (
                      <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5">
                        {oddsLines.map((ol) => {
                          const editKey = `${p.player_source_id}:${ol.line}`;
                          const computed = fmtOdds(ol.overOdds);
                          return (
                            <div
                              key={editKey}
                              className="flex items-center gap-1"
                              title={t("playerMarket.overLineLabel", { line: ol.line.toFixed(1) })}
                            >
                              <input
                                type="checkbox"
                                checked={!!lineTicks[editKey]}
                                onChange={(e) => onLineTick(editKey, e.target.checked)}
                                className={`cursor-pointer ${STATUS_ACCENT[p.status]}`}
                              />
                              <span className="text-ink-3 text-[10px] w-5 text-right tabular-nums">
                                {ol.line.toFixed(1)}
                              </span>
                              {computed === "—" ? (
                                <span className="text-ink-3">—</span>
                              ) : (
                                <input
                                  type="number"
                                  min="1"
                                  step="0.01"
                                  value={oddsEdit[editKey] ?? computed}
                                  onChange={(e) => onOddsEdit(editKey, e.target.value)}
                                  className={`w-12 rounded bg-veil px-1 py-0.5 text-right text-[11px] font-semibold text-teal-300 border border-transparent focus:border-teal-500/50 focus:outline-none ${NO_SPINNER}`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlayerMarketPredictionPage({
  teamLogos = {},
}: {
  teamLogos?: Record<string, string>;
}) {
  const { t } = useI18n();
  // ── Inputs ──
  const [fixtures, setFixtures] = useState<UpcomingFixture[]>([]);
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | null>(null);
  const [selectedMarketKey, setSelectedMarketKey] = useState<string>("shots_on_target");
  const [homeDistExp, setHomeDistExp] = useState<string>("23");
  const [awayDistExp, setAwayDistExp] = useState<string>("23");
  const [paybackPct, setPaybackPct] = useState<string>("93");
  // Beklenti Dagit: kapaliyken dagitilan beklenti bos kalir, oranlar manuelle calisir.
  // Varsayilan kapali: sezon basinda guncel sezon verisi olmadigindan dagitim
  // yerine manuel calisilir.
  const [distributeEnabled, setDistributeEnabled] = useState(false);
  // Dagitim agirliklari (Config > Model): LY Avg / Last 5 / Avg yuzdeleri.
  const [distWeights, setDistWeights] = useState<DistWeights>(DEFAULT_DIST_WEIGHTS);
  // Status kurallari (Config > Model): durum cikarimi esikleri.
  const [statusConfig, setStatusConfig] = useState<StatusConfig>(DEFAULT_STATUS_CONFIG);

  // ── Data ──
  const [homePlayers, setHomePlayers] = useState<PlayerState[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<PlayerState[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"model" | "players" | "config" | "fixtures" | "input">("model");
  // Config sekmesi alt sekmeleri: Market (template'ler) / Model (dagitim ayari).
  const [configSub, setConfigSub] = useState<"market" | "model">("market");
  // Avg bu sezondan, LY Avg bir onceki sezondan okunur.
  const [currentSeason, setCurrentSeason] = useState<string | null>(null);
  // pm_markets kayitlari: ozel marketler + template id'ler + turler.
  const [storedMarkets, setStoredMarkets] = useState<StoredMarket[]>([]);
  // Line tikleri ve elle duzenlenen oranlar; anahtar "<player_key>:<line>".
  const [lineTicks, setLineTicks] = useState<Record<string, boolean>>({});
  const [oddsEdit, setOddsEdit] = useState<Record<string, string>>({});
  // Ekle ile uretilen input satirlari (Input sekmesindeki iki segment).
  const [staticRows, setStaticRows] = useState<StaticInputRow[]>([]);
  const [dynamicRows, setDynamicRows] = useState<DynamicInputRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [addedCount, setAddedCount] = useState<number | null>(null);
  const [dupWarning, setDupWarning] = useState<string | null>(null);

  // ── Export gecmisi ──
  // Add aninda mac+market bazinda snapshot toplanir; SADECE export'ta yazilir.
  const [snapshotByKey, setSnapshotByKey] = useState<Record<string, PsmSnapshot>>({});
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  // Restore sirasinda: pendingRestore loader'larin snapshot'i bindirmesini
  // saglar; restoreNonce ayni fikstur secilse bile yeniden yuklemeyi zorlar;
  // skipMarketRef market-effect'in restore'u ezmesini engeller.
  const [pendingRestore, setPendingRestore] = useState<PsmSnapshot | null>(null);
  const [restoreNonce, setRestoreNonce] = useState(0);
  const skipMarketRef = useRef(false);
  // Oyuncu adina tiklaninca sagda acilan profil paneli.
  const [selectedPlayer, setSelectedPlayer] = useState<{
    slug: string;
    name: string;
    sourceId: string;
  } | null>(null);

  // ── On mount: load fixtures + current season + stored markets ──
  // Guncel sezon takvimden turetilir (Temmuz'da yeni sezona doner); veri henuz
  // gelmemis yeni sezonda bile dogru anah­tar kullanilir. Yine de takvim veri
  // sezonunun gerisinde kalmasin diye en yeni veri sezonuyla max alinir.
  useEffect(() => {
    fetchUpcomingFixtures().then(setFixtures);
    fetchLatestMetricSeason().then((dataSeason) =>
      setCurrentSeason(latestSeasonLabel(currentSeasonLabel(), dataSeason))
    );
    fetchStoredMarkets().then(setStoredMarkets);
    fetchDistWeights().then(setDistWeights);
    fetchStatusConfig().then(setStatusConfig);
  }, []);

  const refreshStoredMarkets = () => fetchStoredMarkets().then(setStoredMarkets);

  // Market Listesi'nde Model tiki kaldirilan marketler dropdown'da gizlenir.
  const excludedMarketKeys = useMemo(
    () =>
      new Set(
        storedMarkets.filter((m) => m.in_model === false).map((m) => m.market_key)
      ),
    [storedMarkets]
  );

  // Yerlesik marketler + Yeni ile eklenen ozel marketler (istatistiksiz, en altta),
  // Model tiki kaldirilanlar cikarilarak.
  const allMarkets: MarketOption[] = useMemo(
    () =>
      [
        ...MARKET_OPTIONS,
        ...storedMarkets
          .filter((m) => m.is_custom)
          .map((m) => ({
            key: m.market_key,
            label: m.label,
            metricKey: "",
            logField: "",
            includeGk: false,
          })),
      ].filter((m) => !excludedMarketKeys.has(m.key)),
    [storedMarkets, excludedMarketKeys]
  );

  // Secili market Model listesinden cikarilirsa ilk uygun markete gec.
  useEffect(() => {
    if (allMarkets.length === 0) return;
    if (!allMarkets.some((m) => m.key === selectedMarketKey)) {
      setSelectedMarketKey(allMarkets[0].key);
    }
  }, [allMarkets, selectedMarketKey]);

  const selectedFixture = fixtures.find((f) => f.fixture_id === selectedFixtureId) ?? null;
  const selectedMarket = allMarkets.find((m) => m.key === selectedMarketKey) ?? MARKET_OPTIONS[0];
  // Market Listesi'ndeki behavior; dynamic ise Model'de line yerine tek deger girilir.
  const selectedMarketType: MarketType =
    storedMarkets.find((m) => m.market_key === selectedMarketKey)?.market_type ?? "static";
  const dynamicMode = selectedMarketType === "dynamic";

  // ── Load players when fixture changes ──
  useEffect(() => {
    if (!selectedFixture || !currentSeason) return;
    setLoading(true);
    setHomePlayers([]);
    setAwayPlayers([]);
    setLineTicks({});
    setOddsEdit({});
    setAddedCount(null);

    const season = currentSeason;
    const prevSeason = previousSeasonLabel(season);

    async function load() {
      const [homeRaw, awayRaw] = await Promise.all([
        fetchTeamPlayers(selectedFixture!.home_source_team_id),
        fetchTeamPlayers(selectedFixture!.away_source_team_id),
      ]);

      const allIds = [...homeRaw, ...awayRaw].map((p) => p.player_source_id);

      const [recentMatches, metricStats, last5AvgMap, lyStats, curApps, lyApps] = await Promise.all([
        fetchPlayerRecentMatches(allIds, season),
        fetchPlayerMetricStats(allIds, selectedMarket.metricKey, season),
        fetchPlayerLast5Avg(allIds, selectedMarket.logField, season),
        prevSeason
          ? fetchPlayerMetricStats(allIds, selectedMarket.metricKey, prevSeason)
          : Promise.resolve({} as Record<string, PlayerMetricStat>),
        fetchPlayerSeasonAppearances(allIds, season),
        prevSeason
          ? fetchPlayerSeasonAppearances(allIds, prevSeason)
          : Promise.resolve({} as Record<string, number>),
      ]);

      function buildStates(rawPlayers: PlayerRow[]): PlayerState[] {
        // Takimin son fiksturleri: bu takimin tum oyuncularinin mac log'undaki
        // distinct datetime'lar (DESC). "Kadroda yok/oynamadi" bu listeye gore.
        const teamFixtures = [
          ...new Set(
            rawPlayers.flatMap((p) =>
              (recentMatches[p.player_source_id] ?? []).map((m) => m.match_datetime)
            )
          ),
        ].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

        const states = rawPlayers.map((p) => {
          const matches = recentMatches[p.player_source_id] ?? [];
          const stat: PlayerMetricStat | undefined = metricStats[p.player_source_id];
          // Durum cikarimi Config > Model'deki Status kurallariyla; takimin son N
          // fikstur? uzerinden. Sezon basinda (fikstur yok) profil gorunme sayisina
          // duser. Goruntulenen "mac sayisi" secili (guncel) sezona aittir.
          const status = inferPlayerStatusV2(
            matches,
            teamFixtures,
            statusConfig,
            p.appearances
          );

          return {
            player_source_id: p.player_source_id,
            player_name: p.player_name,
            player_slug: p.player_slug,
            primary_position_code: p.primary_position_code,
            appearances: curApps[p.player_source_id] ?? 0,
            lyAppearances: lyApps[p.player_source_id] ?? null,
            last_match_datetime: p.last_match_datetime ?? null,
            checked: false,
            status,
            seasonAvg: stat?.per_match_value ?? null,
            last5Avg: last5AvgMap[p.player_source_id] ?? null,
            lyAvg: lyStats[p.player_source_id]?.per_match_value ?? null,
            manualValue: "",
          };
        });

        // GK dedup: only the GK with most appearances can be Pos. Starter.
        // Guncel sezon (appearances) sezon basinda 0 oldugundan gecen sezona
        // (lyAppearances) gore siralanir; ikisi de yoksa 0 sayilir.
        const gkStarters = states
          .filter((p) => p.primary_position_code === "GK" && p.status === "Pos. Starter")
          .sort(
            (a, b) =>
              (b.lyAppearances ?? b.appearances) - (a.lyAppearances ?? a.appearances)
          );

        if (gkStarters.length > 1) {
          const keepId = gkStarters[0].player_source_id;
          return states.map((p) => {
            if (p.primary_position_code === "GK" && p.status === "Pos. Starter" && p.player_source_id !== keepId) {
              return { ...p, status: "Pos. Sub" as InferredStatus };
            }
            return p;
          });
        }

        return states;
      }

      // Geçmişten restore: bu fikstür için snapshot varsa oyuncu
      // tik/durum/elle-değerlerini bindir, line tik + oranları geri yükle.
      const snap =
        pendingRestore && pendingRestore.fixtureId === selectedFixture!.fixture_id
          ? pendingRestore
          : null;
      const overlay = (states: PlayerState[]) =>
        snap
          ? states.map((p) => {
              const o = snap.players[p.player_source_id];
              return o
                ? { ...p, checked: o.checked, status: o.status, manualValue: o.manualValue }
                : p;
            })
          : states;

      setHomePlayers(overlay(buildStates(homeRaw)));
      setAwayPlayers(overlay(buildStates(awayRaw)));
      if (snap) {
        setLineTicks(snap.lineTicks);
        setOddsEdit(snap.oddsEdit);
        setPendingRestore(null);
      }
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFixtureId, currentSeason, statusConfig, restoreNonce]);

  // ── Refresh metric stats when market changes (keep players) ──
  useEffect(() => {
    // Restore market'i de değiştiriyor; bu tek seferi atla (fixture-load zaten
    // doğru market verisini yükleyip snapshot'ı bindiriyor, aksi halde ezerdi).
    if (skipMarketRef.current) {
      skipMarketRef.current = false;
      return;
    }
    if (!selectedFixture || !currentSeason || (homePlayers.length === 0 && awayPlayers.length === 0)) return;

    const allIds = [...homePlayers, ...awayPlayers].map((p) => p.player_source_id);
    if (allIds.length === 0) return;

    const prevSeason = previousSeasonLabel(currentSeason);

    Promise.all([
      fetchPlayerMetricStats(allIds, selectedMarket.metricKey, currentSeason),
      fetchPlayerLast5Avg(allIds, selectedMarket.logField, currentSeason),
      prevSeason
        ? fetchPlayerMetricStats(allIds, selectedMarket.metricKey, prevSeason)
        : Promise.resolve({} as Record<string, PlayerMetricStat>),
    ]).then(([metricStats, last5AvgMap, lyStats]) => {
      // Market degisince oyuncu tikleri de otomatik kalkar.
      const update = (prev: PlayerState[]) =>
        prev.map((p) => ({
          ...p,
          checked: false,
          seasonAvg: metricStats[p.player_source_id]?.per_match_value ?? null,
          last5Avg: last5AvgMap[p.player_source_id] ?? null,
          lyAvg: lyStats[p.player_source_id]?.per_match_value ?? null,
          manualValue: "",
        }));
      setHomePlayers(update);
      setAwayPlayers(update);
      setLineTicks({});
      setOddsEdit({});
      setAddedCount(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarketKey]);

  // ── State updaters ──
  function makeStatusHandler(setter: typeof setHomePlayers) {
    return (id: string, s: InferredStatus) =>
      setter((prev) => prev.map((p) => (p.player_source_id === id ? { ...p, status: s } : p)));
  }

  function makeManualHandler(setter: typeof setHomePlayers) {
    return (id: string, v: string) =>
      setter((prev) => prev.map((p) => (p.player_source_id === id ? { ...p, manualValue: v } : p)));
  }

  function makeCheckedHandler(setter: typeof setHomePlayers) {
    return (id: string, v: boolean) =>
      setter((prev) => prev.map((p) => (p.player_source_id === id ? { ...p, checked: v } : p)));
  }

  const homeDistExpNum = parseFloat(homeDistExp) || 0;
  const awayDistExpNum = parseFloat(awayDistExp) || 0;
  const paybackNum = parseFloat(paybackPct) || 93;

  // Kaleci iceren marketler disinda GK satirlari gizlenir; dagitim da
  // gorunen oyunculara gore hesaplanir.
  const gkVisible = (ps: PlayerState[]) =>
    selectedMarket.includeGk ? ps : ps.filter((p) => p.primary_position_code !== "GK");
  const visibleHome = gkVisible(homePlayers);
  const visibleAway = gkVisible(awayPlayers);

  // ── Ekle: tikli oyuncu + tikli line'lardan input satirlari uretir ──
  // Satirlar secili marketin turune gore Input sekmesindeki segmente duser.
  // Static: secim basina bir satir. Dynamic: TEK satir, secimler sagda
  // Selection_1..N seklinde uzar. Oyuncu tikli ama hicbir line'i tikli
  // degilse yazilmaz; line'lar kucukten buyuge, ev (1) once deplasman (2).
  // Ayni mac + oyuncu + line hedef tabloda zaten varsa uyari verilir ve
  // hicbir sey eklenmez; once tablodaki satir silinmeli.
  async function handleAdd() {
    if (!selectedFixture || adding) return;
    setAdding(true);
    setDupWarning(null);
    setAddedCount(null);

    const [fixtureInputs, playerIds] = await Promise.all([
      fetchFixtureInputs(),
      fetchPlayerIds(),
    ]);
    const fixtureKey = selectedFixture.fixture_id;
    const fixtureIdValue = fixtureInputs[fixtureKey] ?? "";
    const stored = storedMarkets.find((m) => m.market_key === selectedMarketKey);
    const marketTemplate = stored?.template_id ?? "";
    const marketType: MarketType = stored?.market_type ?? "static";

    const selections: DynamicSelection[] = [];

    // Dynamic markette line yok: oyuncu basina tek girilen deger yazilir.
    function buildDynamic(players: PlayerState[], sortOrder: number) {
      for (const p of players) {
        if (!p.checked || p.status === "Out") continue;
        if (!lineTicks[`${p.player_source_id}:dyn`]) continue;
        const price = (oddsEdit[`${p.player_source_id}:dyn`] ?? "").trim();
        if (!price || !(parseFloat(price) > 0)) continue;
        selections.push({
          price,
          participantId: playerIds[p.player_slug] ?? "",
          sortOrder,
          playerSlug: p.player_slug,
          playerName: p.player_name,
          line: "",
        });
      }
    }

    function build(players: PlayerState[], distExp: number, sortOrder: number) {
      const expMap = distributeEnabled
        ? distributeExpectation(
            players.map((p) => ({
              player_source_id: p.player_source_id,
              status: p.status,
              seasonAvg: p.seasonAvg,
              last5Avg: p.last5Avg,
              lyAvg: p.lyAvg,
              manualValue: p.manualValue,
            })),
            distExp,
            distWeights
          )
        : {};

      for (const p of players) {
        if (!p.checked || p.status === "Out") continue;
        const manNum = parseFloat(p.manualValue);
        const finalExp =
          !isNaN(manNum) && manNum > 0 ? manNum : (expMap[p.player_source_id] ?? 0);
        if (finalExp <= 0) continue;
        const ticked = calcOddsLines(finalExp, paybackNum)
          .filter((ol) => lineTicks[`${p.player_source_id}:${ol.line}`])
          .sort((a, b) => a.line - b.line);
        if (ticked.length === 0) continue;

        for (const ol of ticked) {
          const price =
            oddsEdit[`${p.player_source_id}:${ol.line}`] ?? fmtOdds(ol.overOdds);
          if (price === "—" || !price.trim()) continue;
          selections.push({
            price: price.trim(),
            participantId: playerIds[p.player_slug] ?? "",
            sortOrder,
            playerSlug: p.player_slug,
            playerName: p.player_name,
            line: ol.line.toFixed(1),
          });
        }
      }
    }

    if (marketType === "dynamic") {
      buildDynamic(visibleHome, 1);
      buildDynamic(visibleAway, 2);
    } else {
      build(visibleHome, homeDistExpNum, 1);
      build(visibleAway, awayDistExpNum, 2);
    }

    // Mukerrer kontrolu: ayni mac + oyuncu + line hedef tabloda var mi?
    const existingKeys = new Set(
      marketType === "dynamic"
        ? dynamicRows.flatMap((r) =>
            r.selections.map((s) => `${r.fixtureKey}:${s.playerSlug}:${s.line}`)
          )
        : staticRows.map((r) => `${r.fixtureKey}:${r.playerSlug}:${r.line}`)
    );
    const dups = selections.filter((s) =>
      existingKeys.has(`${fixtureKey}:${s.playerSlug}:${s.line}`)
    );
    if (dups.length > 0) {
      const info = dups
        .slice(0, 3)
        .map((s) => `${s.playerName} ${s.line}`.trim())
        .join(", ");
      setDupWarning(
        t("playerMarket.duplicateWarning", {
          info: dups.length > 3 ? `${info} +${dups.length - 3}` : info,
        })
      );
      setAdding(false);
      return;
    }

    if (selections.length > 0) {
      // Restore snapshot'i (mac+market bazinda). Yalnizca export'ta yazilir.
      const snapPlayers: PsmSnapshot["players"] = {};
      for (const p of [...homePlayers, ...awayPlayers]) {
        snapPlayers[p.player_source_id] = {
          checked: p.checked,
          status: p.status,
          manualValue: p.manualValue,
        };
      }
      const snap: PsmSnapshot = {
        fixtureId: selectedFixture.fixture_id,
        marketKey: selectedMarketKey,
        homeDistExp,
        awayDistExp,
        paybackPct,
        distributeEnabled,
        players: snapPlayers,
        lineTicks: { ...lineTicks },
        oddsEdit: { ...oddsEdit },
      };
      setSnapshotByKey((m) => ({
        ...m,
        [`${fixtureKey}::${selectedMarket.label}`]: snap,
      }));

      if (marketType === "dynamic") {
        setDynamicRows((prev) => [
          ...prev,
          {
            fixtureKey,
            fixtureLabel: selectedFixture!.label,
            fixtureId: fixtureIdValue,
            marketTemplate,
            marketLabel: selectedMarket.label,
            selections,
          },
        ]);
      } else {
        setStaticRows((prev) => [
          ...prev,
          ...selections.map((s) => ({
            fixtureKey,
            fixtureLabel: selectedFixture!.label,
            fixtureId: fixtureIdValue,
            marketTemplate,
            marketLabel: selectedMarket.label,
            participant: s.participantId,
            playerSlug: s.playerSlug,
            playerName: s.playerName,
            sortOrder: s.sortOrder,
            line: s.line,
            price: s.price,
          })),
        ]);
      }
    }
    setAdding(false);
    setAddedCount(selections.length);
  }

  // ── Export gecmisi: yazdirilan segment kayitlarini mac+market bazinda yaz ──
  async function handleExported(type: MarketType) {
    const rows = type === "dynamic" ? dynamicRows : staticRows;
    const seen = new Set<string>();
    const entries: ModelHistoryDraft[] = [];
    for (const r of rows) {
      const key = `${r.fixtureKey}::${r.marketLabel}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        kind: "player",
        fixtureExtId: r.fixtureId || null,
        matchLabel: r.fixtureLabel,
        market: r.marketLabel,
        snapshot: snapshotByKey[key] ?? null,
      });
    }
    if (entries.length > 0) {
      await postModelHistory("football_psm", HISTORY_LEAGUE, entries);
      setHistoryReloadKey((k) => k + 1);
    }
  }

  // ── Geçmişten restore: fixture hâlâ listede olmalı ──
  function restoreFromHistory(rec: ModelHistoryRecord) {
    const snap = rec.snapshot as PsmSnapshot | null;
    if (!snap || !fixtures.some((f) => f.fixture_id === snap.fixtureId)) {
      setRestoreNotice(t("modelHistory.fixtureGone"));
      setTimeout(() => setRestoreNotice(null), 3000);
      return;
    }
    // Market-effect'i atla; snapshot'i loader'a bindir; aynı fixture olsa bile
    // restoreNonce ile yeniden yükle. Ayarlar doğrudan set edilir.
    skipMarketRef.current = true;
    setPendingRestore(snap);
    setSelectedMarketKey(snap.marketKey);
    setSelectedFixtureId(snap.fixtureId);
    setHomeDistExp(snap.homeDistExp);
    setAwayDistExp(snap.awayDistExp);
    setPaybackPct(snap.paybackPct);
    setDistributeEnabled(snap.distributeEnabled);
    setActiveTab("model");
    setRestoreNonce((n) => n + 1);
    // Güvenlik ağı: aynı market restore edilirse market-effect hiç tetiklenmez;
    // takılı kalan ref'i tick sonunda temizle.
    setTimeout(() => {
      skipMarketRef.current = false;
    }, 0);
    setRestoreNotice(t("modelHistory.restored"));
    setTimeout(() => setRestoreNotice(null), 3000);
  }

  const TABS = [
    { id: "model" as const, label: t("playerMarket.tabModel") },
    { id: "players" as const, label: t("playerMarket.tabPlayerList") },
    { id: "config" as const, label: t("playerMarket.tabConfig") },
    { id: "fixtures" as const, label: t("playerMarket.tabFixtureIds") },
    { id: "input" as const, label: t("playerMarket.tabInput") },
  ];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-4 px-1">
      {/* Tabs (en sagda: dinamik makrolu Excel indir) */}
      <div className="flex items-center gap-1 rounded-xl border border-line bg-card px-2 py-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-1.5 text-[13px] transition
              ${activeTab === tab.id
                ? "bg-veil font-semibold text-ink"
                : "text-ink-3 hover:text-ink-2"}`}
          >
            {tab.label}
          </button>
        ))}
        {/* TSL dinamik makrolu Excel; dosya frontend/public/downloads altinda */}
        <a
          href="/downloads/tsl-dinamik-model.xlsm"
          download
          className="ml-auto rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-[13px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
        >
          {t("playerMarket.openExcelLabel")}
        </a>
      </div>

      {activeTab === "players" && <PlayerListTab teamLogos={teamLogos} />}
      {activeTab === "config" && (
        <div className="space-y-4">
          {/* Config alt sekmeleri: Market (template'ler) / Model (dagitim ayari) */}
          <div className="flex items-center gap-1 rounded-xl border border-line bg-card px-2 py-1.5">
            {([
              { id: "market" as const, label: t("playerMarket.cfgSubMarket") },
              { id: "model" as const, label: t("playerMarket.cfgSubModel") },
            ]).map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setConfigSub(sub.id)}
                className={`rounded-lg px-4 py-1.5 text-[13px] transition
                  ${configSub === sub.id
                    ? "bg-veil font-semibold text-ink"
                    : "text-ink-3 hover:text-ink-2"}`}
              >
                {sub.label}
              </button>
            ))}
          </div>
          {configSub === "market" ? (
            <MarketListTab storedMarkets={storedMarkets} onChanged={refreshStoredMarkets} />
          ) : (
            <div className="space-y-4">
              <DistributeConfig weights={distWeights} onSaved={setDistWeights} />
              <StatusConfigCard config={statusConfig} onSaved={setStatusConfig} />
              <RetentionConfig sport="football_psm" league={HISTORY_LEAGUE} />
            </div>
          )}
        </div>
      )}
      {activeTab === "fixtures" && <FixtureIdTab fixtures={fixtures} />}
      {activeTab === "input" && (
        <InputTab
          staticRows={staticRows}
          dynamicRows={dynamicRows}
          onExported={handleExported}
          onClear={(type) =>
            type === "dynamic" ? setDynamicRows([]) : setStaticRows([])
          }
          onDeleteRow={(type, index) => {
            if (type === "dynamic")
              setDynamicRows((prev) => prev.filter((_, i) => i !== index));
            else setStaticRows((prev) => prev.filter((_, i) => i !== index));
          }}
        />
      )}

      {activeTab === "model" && (
      <>
      {/* Controls */}
      <div className="rounded-xl border border-line bg-card px-5 py-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Fixture select */}
          <div className="flex flex-col gap-1 min-w-[260px]">
            <label className="text-[10px] uppercase tracking-[0.12em] text-ink-3">{t("playerMarket.fixtureLabel")}</label>
            <select
              value={selectedFixtureId ?? ""}
              onChange={(e) => setSelectedFixtureId(e.target.value ? Number(e.target.value) : null)}
              className="rounded-lg border border-line bg-field px-3 py-2 text-[13px] text-ink focus:border-teal-500/50 focus:outline-none"
            >
              <option value="">{t("playerMarket.selectFixturePlaceholder")}</option>
              {fixtures.map((f) => (
                <option key={f.fixture_id} value={f.fixture_id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Market select */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-[10px] uppercase tracking-[0.12em] text-ink-3">{t("playerMarket.marketLabel")}</label>
            <select
              value={selectedMarketKey}
              onChange={(e) => setSelectedMarketKey(e.target.value)}
              className="rounded-lg border border-line bg-field px-3 py-2 text-[13px] text-ink focus:border-teal-500/50 focus:outline-none"
            >
              {allMarkets.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Beklenti Dagit tick */}
          <label className="flex cursor-pointer items-center gap-2 pb-2.5">
            <input
              type="checkbox"
              checked={distributeEnabled}
              onChange={(e) => setDistributeEnabled(e.target.checked)}
              className="cursor-pointer accent-teal-400"
            />
            <span className="text-[12px] text-ink-2">{t("playerMarket.distributeExpToggle")}</span>
          </label>

          {/* Home Dist. Exp */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.12em] text-ink-3">
              {t("playerMarket.homeExpLabel")}
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={homeDistExp}
              onChange={(e) => setHomeDistExp(e.target.value)}
              className="w-24 rounded-lg border border-line bg-field px-3 py-2 text-[13px] text-ink focus:border-teal-500/50 focus:outline-none"
            />
          </div>

          {/* Away Dist. Exp */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.12em] text-ink-3">
              {t("playerMarket.awayExpLabel")}
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={awayDistExp}
              onChange={(e) => setAwayDistExp(e.target.value)}
              className="w-24 rounded-lg border border-line bg-field px-3 py-2 text-[13px] text-ink focus:border-teal-500/50 focus:outline-none"
            />
          </div>

          {/* Payback */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.12em] text-ink-3">
              {t("playerMarket.paybackLabel")}
            </label>
            <input
              type="number"
              min="80"
              max="100"
              step="1"
              value={paybackPct}
              onChange={(e) => setPaybackPct(e.target.value)}
              className="w-24 rounded-lg border border-line bg-field px-3 py-2 text-[13px] text-ink focus:border-teal-500/50 focus:outline-none"
            />
          </div>

          {/* Geçmiş dropdown'u: Ekle'nin hemen solunda */}
          <div className="pb-0.5">
            <HistoryDropdown
              sport="football_psm"
              league={HISTORY_LEAGUE}
              reloadKey={historyReloadKey}
              onRestore={restoreFromHistory}
            />
          </div>

          {/* Ekle: tikli oyuncu/line'lardan input satirlari uretir */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !selectedFixture}
            className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-[13px] font-semibold text-teal-300 transition hover:bg-teal-500/20 disabled:opacity-50"
          >
            {t("playerMarket.addLabel")}
          </button>
          {restoreNotice && (
            <span className="pb-2.5 text-[12px] text-teal-400">{restoreNotice}</span>
          )}
          {addedCount !== null && !dupWarning && (
            <span className="pb-2.5 text-[12px] text-teal-400">
              {t("playerMarket.addedLabel", { count: String(addedCount) })}
            </span>
          )}
          {dupWarning && (
            <span className="pb-2.5 text-[12px] text-red-400">{dupWarning}</span>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-line bg-card px-5 py-8 text-center text-sm text-ink-3">
          {t("common.loading")}
        </div>
      )}

      {/* Player tables */}
      {!loading && selectedFixture && (visibleHome.length > 0 || visibleAway.length > 0) && (
        <div className="rounded-xl border border-line bg-card px-5 py-4">
          {/* Market info bar */}
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-[12px] font-semibold text-teal-300">
              {selectedMarket.label}
            </span>
            <span className="text-[12px] text-ink-3">
              {t("playerMarket.homeExpLabel")}: <span className="text-ink-2 font-medium">{homeDistExpNum.toFixed(1)}</span>
            </span>
            <span className="text-[12px] text-ink-3">
              {t("playerMarket.awayExpLabel")}: <span className="text-ink-2 font-medium">{awayDistExpNum.toFixed(1)}</span>
            </span>
            <span className="text-[12px] text-ink-3">
              {t("playerMarket.paybackLabel")}: <span className="text-ink-2 font-medium">{paybackNum}%</span>
            </span>
          </div>

          {/* Two-column layout */}
          <div className="flex gap-3 flex-wrap xl:flex-nowrap">
            <TeamPlayerTable
              key={`${selectedFixtureId}:${selectedMarketKey}:home`}
              teamName={selectedFixture.home_team_name}
              players={visibleHome}
              distExp={homeDistExpNum}
              distributeEnabled={distributeEnabled}
              distWeights={distWeights}
              paybackPct={paybackNum}
              dynamicMode={dynamicMode}
              lineTicks={lineTicks}
              oddsEdit={oddsEdit}
              onLineTick={(key, v) => setLineTicks((prev) => ({ ...prev, [key]: v }))}
              onOddsEdit={(key, v) => setOddsEdit((prev) => ({ ...prev, [key]: v }))}
              onStatusChange={makeStatusHandler(setHomePlayers)}
              onManualChange={makeManualHandler(setHomePlayers)}
              onCheckedChange={makeCheckedHandler(setHomePlayers)}
              onPlayerClick={(slug, name, sourceId) => setSelectedPlayer({ slug, name, sourceId })}
            />
            <TeamPlayerTable
              key={`${selectedFixtureId}:${selectedMarketKey}:away`}
              teamName={selectedFixture.away_team_name}
              players={visibleAway}
              distExp={awayDistExpNum}
              distributeEnabled={distributeEnabled}
              distWeights={distWeights}
              paybackPct={paybackNum}
              dynamicMode={dynamicMode}
              lineTicks={lineTicks}
              oddsEdit={oddsEdit}
              onLineTick={(key, v) => setLineTicks((prev) => ({ ...prev, [key]: v }))}
              onOddsEdit={(key, v) => setOddsEdit((prev) => ({ ...prev, [key]: v }))}
              onStatusChange={makeStatusHandler(setAwayPlayers)}
              onManualChange={makeManualHandler(setAwayPlayers)}
              onCheckedChange={makeCheckedHandler(setAwayPlayers)}
              onPlayerClick={(slug, name, sourceId) => setSelectedPlayer({ slug, name, sourceId })}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !selectedFixture && (
        <div className="rounded-xl border border-line bg-card px-5 py-10 text-center text-sm text-ink-3">
          {t("playerMarket.selectFixturePrompt")}
        </div>
      )}
      </>
      )}

      {selectedPlayer && (
        <PlayerProfileDrawer
          key={selectedPlayer.slug}
          playerSlug={selectedPlayer.slug}
          playerName={selectedPlayer.name}
          playerSourceId={selectedPlayer.sourceId}
          seasonLabel={currentSeason}
          marketLabel={selectedMarket.label}
          metricKey={selectedMarket.metricKey}
          teamLogos={teamLogos}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
