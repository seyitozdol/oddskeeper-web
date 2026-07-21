"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import {
  fetchUpcomingFixtures,
  fetchTeamPlayers,
  fetchPlayerRecentMatches,
  fetchPlayerMetricStats,
  fetchPlayerLast5Avg,
  fetchLatestMetricSeason,
  fetchStoredMarkets,
  fetchPlayerSeasonAppearances,
  MARKET_OPTIONS,
  type UpcomingFixture,
  type PlayerRow,
  type PlayerMetricStat,
  type MarketOption,
  type StoredMarket,
} from "./queries";
import { previousSeasonLabel } from "@/lib/season";
import { PlayerListTab, MarketListTab, FixtureIdTab } from "./list-tabs";
import {
  inferPlayerStatus,
  distributeExpectation,
  calcOddsLines,
  type InferredStatus,
} from "./compute";
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
      className={`px-2 py-2 cursor-pointer select-none hover:text-ink-2 ${className}`}
      onClick={() => onSort(col)}
    >
      {label}
      <span className="ml-1 opacity-50">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    </th>
  );
}

function TeamPlayerTable({
  teamName,
  players,
  distExp,
  distributeEnabled,
  paybackPct,
  onStatusChange,
  onManualChange,
  onCheckedChange,
}: {
  teamName: string;
  players: PlayerState[];
  distExp: number;
  distributeEnabled: boolean;
  paybackPct: number;
  onStatusChange: (id: string, s: InferredStatus) => void;
  onManualChange: (id: string, v: string) => void;
  onCheckedChange: (id: string, v: boolean) => void;
}) {
  const { t } = useI18n();
  const [sortCol, setSortCol] = useState<SortCol>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  // Elle duzenlenen oranlar; anahtar "<player_key>:<line>". Fixture veya market
  // degisince parent key prop'uyla bileseni sifirlar.
  const [oddsEdit, setOddsEdit] = useState<Record<string, string>>({});

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
              manualValue: p.manualValue,
            })),
            distExp
          )
        : {},
    [players, distExp, distributeEnabled]
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
        <table className="min-w-full border-collapse text-[12px]">
          <thead className="bg-card-2">
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
              <th className="px-2 py-2 w-6"></th>
              <SortTh col="player" label={t("common.player")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="min-w-[110px]" />
              <SortTh col="pos" label={t("common.position")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="apps" label={t("playerMarket.appearancesLabel")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh col="status" label={t("playerMarket.columnStatus")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="avg" label={t("playerMarket.avgLabel")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh col="last5" label={t("playerMarket.last5AvgLabel")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh col="lyavg" label={t("playerMarket.lyAvgLabel")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh col="distexp" label={t("playerMarket.distExpLabel")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh col="manual" label={t("playerMarket.manualLabel")} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right w-14" />
              <th className="px-1.5 py-2 min-w-[168px]">{t("playerMarket.oddsOverHeader")}</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((p) => {
              const effExp = expMap[p.player_source_id] ?? 0;
              const manNum = parseFloat(p.manualValue);
              const finalExp = !isNaN(manNum) && manNum > 0 ? manNum : effExp;
              const oddsLines = p.status !== "Out" && finalExp > 0
                ? calcOddsLines(finalExp, paybackPct)
                : [];

              return (
                <tr
                  key={p.player_source_id}
                  className={`border-t border-line transition hover:bg-veil
                    ${p.status === "Out" ? "opacity-40" : ""}`}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={p.checked}
                      onChange={(e) => onCheckedChange(p.player_source_id, e.target.checked)}
                      className={`cursor-pointer ${STATUS_ACCENT[p.status]}`}
                    />
                  </td>

                  <td
                    className="px-2 py-1.5 font-medium text-ink whitespace-nowrap overflow-hidden text-ellipsis max-w-[175px]"
                    title={p.player_name}
                  >
                    {p.player_name}
                  </td>

                  <td className="px-2 py-1.5 text-ink-3">{p.primary_position_code}</td>

                  {/* Bu sezon mac sayisi (parantezde gecen sezon) */}
                  <td className="px-2 py-1.5 text-right text-ink-2 tabular-nums whitespace-nowrap">
                    {p.appearances} <span className="text-ink-3">({p.lyAppearances ?? "—"})</span>
                  </td>

                  <td className="px-2 py-1.5">
                    <StatusBadge
                      status={p.status}
                      onChange={(s) => onStatusChange(p.player_source_id, s)}
                    />
                  </td>

                  <td className="px-2 py-1.5 text-right text-ink-2 tabular-nums">
                    {fmt(p.seasonAvg)}
                  </td>

                  <td className="px-2 py-1.5 text-right text-ink-2 tabular-nums">
                    {p.last5Avg !== null && p.last5Avg >= 0 ? fmt(p.last5Avg) : "—"}
                  </td>

                  <td className="px-2 py-1.5 text-right text-ink-2 tabular-nums">
                    {fmt(p.lyAvg)}
                  </td>

                  <td className="px-2 py-1.5 text-right tabular-nums text-teal-400/80">
                    {distributeEnabled && p.status !== "Out" ? fmt(effExp) : "—"}
                  </td>

                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={p.manualValue}
                      onChange={(e) => onManualChange(p.player_source_id, e.target.value)}
                      className={`w-12 rounded border border-line bg-field px-1 py-0.5 text-right text-[11px] text-ink placeholder-ink-3 focus:border-teal-500/50 focus:outline-none ${NO_SPINNER}`}
                    />
                  </td>

                  {/* Odds - over only, 2x2 kompakt grid, satir basina tik + line + oran */}
                  <td className="px-1.5 py-1">
                    {oddsLines.length > 0 ? (
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
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
                                className={`cursor-pointer ${STATUS_ACCENT[p.status]}`}
                              />
                              <span className="text-ink-3 text-[10px] w-6 text-right tabular-nums">
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
                                  onChange={(e) =>
                                    setOddsEdit((prev) => ({ ...prev, [editKey]: e.target.value }))
                                  }
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
  const [distributeEnabled, setDistributeEnabled] = useState(true);

  // ── Data ──
  const [homePlayers, setHomePlayers] = useState<PlayerState[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<PlayerState[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"model" | "players" | "markets" | "fixtures" | "input">("model");
  // Avg bu sezondan, LY Avg bir onceki sezondan okunur.
  const [currentSeason, setCurrentSeason] = useState<string | null>(null);
  // pm_markets kayitlari: ozel marketler + template id'ler.
  const [storedMarkets, setStoredMarkets] = useState<StoredMarket[]>([]);

  // ── On mount: load fixtures + latest metric season + stored markets ──
  useEffect(() => {
    fetchUpcomingFixtures().then(setFixtures);
    fetchLatestMetricSeason().then(setCurrentSeason);
    fetchStoredMarkets().then(setStoredMarkets);
  }, []);

  const refreshStoredMarkets = () => fetchStoredMarkets().then(setStoredMarkets);

  // Yerlesik marketler + Yeni ile eklenen ozel marketler (istatistiksiz, en altta).
  const allMarkets: MarketOption[] = useMemo(
    () => [
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
    ],
    [storedMarkets]
  );

  const selectedFixture = fixtures.find((f) => f.fixture_id === selectedFixtureId) ?? null;
  const selectedMarket = allMarkets.find((m) => m.key === selectedMarketKey) ?? MARKET_OPTIONS[0];

  // ── Load players when fixture changes ──
  useEffect(() => {
    if (!selectedFixture || !currentSeason) return;
    setLoading(true);
    setHomePlayers([]);
    setAwayPlayers([]);

    const season = currentSeason;
    const prevSeason = previousSeasonLabel(season);

    async function load() {
      const [homeRaw, awayRaw] = await Promise.all([
        fetchTeamPlayers(selectedFixture!.home_source_team_id),
        fetchTeamPlayers(selectedFixture!.away_source_team_id),
      ]);

      const allIds = [...homeRaw, ...awayRaw].map((p) => p.player_source_id);

      const [recentMatches, metricStats, last5AvgMap, lyStats, lyApps] = await Promise.all([
        fetchPlayerRecentMatches(allIds, season),
        fetchPlayerMetricStats(allIds, selectedMarket.metricKey, season),
        fetchPlayerLast5Avg(allIds, selectedMarket.logField, season),
        prevSeason
          ? fetchPlayerMetricStats(allIds, selectedMarket.metricKey, prevSeason)
          : Promise.resolve({} as Record<string, PlayerMetricStat>),
        prevSeason
          ? fetchPlayerSeasonAppearances(allIds, prevSeason)
          : Promise.resolve({} as Record<string, number>),
      ]);

      function buildStates(rawPlayers: PlayerRow[]): PlayerState[] {
        const states = rawPlayers.map((p) => {
          const matches = recentMatches[p.player_source_id] ?? [];
          const stat: PlayerMetricStat | undefined = metricStats[p.player_source_id];
          const status = inferPlayerStatus(matches, p.appearances, p.last_match_datetime);

          return {
            player_source_id: p.player_source_id,
            player_name: p.player_name,
            player_slug: p.player_slug,
            primary_position_code: p.primary_position_code,
            appearances: p.appearances,
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

        // GK dedup: only the GK with most appearances can be Pos. Starter
        const gkStarters = states
          .filter((p) => p.primary_position_code === "GK" && p.status === "Pos. Starter")
          .sort((a, b) => b.appearances - a.appearances);

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

      setHomePlayers(buildStates(homeRaw));
      setAwayPlayers(buildStates(awayRaw));
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFixtureId, currentSeason]);

  // ── Refresh metric stats when market changes (keep players) ──
  useEffect(() => {
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
      const update = (prev: PlayerState[]) =>
        prev.map((p) => ({
          ...p,
          seasonAvg: metricStats[p.player_source_id]?.per_match_value ?? null,
          last5Avg: last5AvgMap[p.player_source_id] ?? null,
          lyAvg: lyStats[p.player_source_id]?.per_match_value ?? null,
          manualValue: "",
        }));
      setHomePlayers(update);
      setAwayPlayers(update);
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

  const TABS = [
    { id: "model" as const, label: t("playerMarket.tabModel") },
    { id: "players" as const, label: t("playerMarket.tabPlayerList") },
    { id: "markets" as const, label: t("playerMarket.tabMarketList") },
    { id: "fixtures" as const, label: t("playerMarket.tabFixtureIds") },
    { id: "input" as const, label: t("playerMarket.tabInput") },
  ];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-4 px-1">
      {/* Tabs */}
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
      </div>

      {activeTab === "players" && <PlayerListTab teamLogos={teamLogos} />}
      {activeTab === "markets" && (
        <MarketListTab storedMarkets={storedMarkets} onChanged={refreshStoredMarkets} />
      )}
      {activeTab === "fixtures" && <FixtureIdTab fixtures={fixtures} />}
      {activeTab === "input" && (
        <div className="rounded-xl border border-line bg-card px-5 py-10 text-center text-sm text-ink-3">
          {t("playerMarket.comingSoon")}
        </div>
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

          {/* Ekle: gorevi sonra tanimlanacak */}
          <button
            type="button"
            className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-[13px] font-semibold text-teal-300 transition hover:bg-teal-500/20"
          >
            {t("playerMarket.addLabel")}
          </button>
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
          <div className="flex gap-6 flex-wrap xl:flex-nowrap">
            <TeamPlayerTable
              key={`${selectedFixtureId}:${selectedMarketKey}:home`}
              teamName={selectedFixture.home_team_name}
              players={visibleHome}
              distExp={homeDistExpNum}
              distributeEnabled={distributeEnabled}
              paybackPct={paybackNum}
              onStatusChange={makeStatusHandler(setHomePlayers)}
              onManualChange={makeManualHandler(setHomePlayers)}
              onCheckedChange={makeCheckedHandler(setHomePlayers)}
            />
            <TeamPlayerTable
              key={`${selectedFixtureId}:${selectedMarketKey}:away`}
              teamName={selectedFixture.away_team_name}
              players={visibleAway}
              distExp={awayDistExpNum}
              distributeEnabled={distributeEnabled}
              paybackPct={paybackNum}
              onStatusChange={makeStatusHandler(setAwayPlayers)}
              onManualChange={makeManualHandler(setAwayPlayers)}
              onCheckedChange={makeCheckedHandler(setAwayPlayers)}
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
    </div>
  );
}
