"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { fmt } from "@/features/basketball/lib";
import type { EuroTeamRow, EuroLeaderRow } from "../types";
import type { EuroCompKey } from "../config";

type Tab = "standings" | "players" | "teams";

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

// Uzak crest logosu (EL/EC CDN) — düz (beyaz çip yok).
function Crest({ url, name, size = 26 }: { url?: string | null; name?: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name ?? ""} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded bg-veil text-[9px] font-semibold text-ink-2" style={{ width: size, height: size }}>
      {(name ?? "").slice(0, 3).toUpperCase()}
    </span>
  );
}

export default function EuroExplorer({
  comp, standings, leaderboard,
}: {
  comp: EuroCompKey;
  standings: EuroTeamRow[];
  leaderboard: EuroLeaderRow[];
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("standings");
  const base = `/dashboard/euro/${comp}`;

  const tabs: { key: Tab; label: string }[] = [
    { key: "standings", label: t("basketball.tabStandings") },
    { key: "players", label: t("basketball.tabPlayers") },
    { key: "teams", label: t("basketball.tabTeams") },
  ];

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${tab === tb.key ? "bg-accent text-white" : "bg-card-2 text-ink-2 hover:bg-veil hover:text-ink"}`}>
            {tb.label}
          </button>
        ))}
        <Link href={`${base}/tools`} className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-veil">
          {t("basketball.toolsNav")}
        </Link>
      </div>

      {tab === "standings" && <Standings rows={standings} base={base} />}
      {tab === "players" && <PlayerLeaders rows={leaderboard} comp={comp} base={base} />}
      {tab === "teams" && <TeamLeaders rows={standings} base={base} />}
    </div>
  );
}

/* ---------------- Standings ---------------- */
function Standings({ rows, base }: { rows: EuroTeamRow[]; base: string }) {
  const { t } = useI18n();
  if (rows.length === 0) return <p className="text-sm text-ink-3">{t("basketball.noData")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line">
            <Th>{t("basketball.rank")}</Th><Th>{t("basketball.team")}</Th>
            <Th right>{t("basketball.played")}</Th><Th right>{t("basketball.wins")}</Th><Th right>{t("basketball.losses")}</Th>
            <Th right>{t("basketball.winPct")}</Th><Th right>{t("basketball.ppg")}</Th><Th right>{t("basketball.oppg")}</Th>
            <Th right>{t("basketball.diff")}</Th><Th right>{t("basketball.netRtg")}</Th>
            <Th right>{t("basketball.offRtg")}</Th><Th right>{t("basketball.defRtg")}</Th><Th right>{t("basketball.pace")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team_code} className="border-t border-line hover:bg-veil">
              <td className="px-2 py-2 text-ink-3 tabular-nums">{r.standings_rank}</td>
              <td className="px-2 py-2">
                <Link href={`${base}/team/${r.team_code}`} className="flex items-center gap-2 font-medium text-ink hover:text-accent-ink">
                  <Crest url={r.crest_url} name={r.team_name} size={28} />
                  <span className="whitespace-nowrap">{r.team_name}</span>
                </Link>
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-2">{r.games}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink">{r.wins}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-2">{r.losses}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(r.win_pct, 0)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink">{fmt(r.ppg)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(r.oppg)}</td>
              <td className={`px-2 py-2 text-right tabular-nums ${(r.point_diff ?? 0) >= 0 ? "text-pos" : "text-neg"}`}>
                {(r.point_diff ?? 0) >= 0 ? "+" : ""}{fmt(r.point_diff)}
              </td>
              <td className={`px-2 py-2 text-right tabular-nums ${(r.net_rtg ?? 0) >= 0 ? "text-pos" : "text-neg"}`}>{fmt(r.net_rtg)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(r.off_rtg)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(r.def_rtg)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-3">{fmt(r.pace)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Player leaders ---------------- */
type PMetric = { key: string; labelKey: string; get: (r: EuroLeaderRow) => number | null };
const P_METRICS: PMetric[] = [
  { key: "ppg", labelKey: "basketball.metricPoints", get: (r) => r.ppg },
  { key: "rpg", labelKey: "basketball.metricRebounds", get: (r) => r.rpg },
  { key: "apg", labelKey: "basketball.metricAssists", get: (r) => r.apg },
  { key: "spg", labelKey: "basketball.metricSteals", get: (r) => r.spg },
  { key: "bpg", labelKey: "basketball.metricBlocks", get: (r) => r.bpg },
  { key: "fg3m_pg", labelKey: "basketball.metricThrees", get: (r) => r.fg3m_pg },
  { key: "val_pg", labelKey: "basketball.valuation", get: (r) => r.val_pg },
];

function PlayerLeaders({ rows, comp, base }: { rows: EuroLeaderRow[]; comp: EuroCompKey; base: string }) {
  const { t } = useI18n();
  const [metricKey, setMetricKey] = useState("ppg");
  const [qualifiedOnly, setQualifiedOnly] = useState(true);
  const metric = P_METRICS.find((m) => m.key === metricKey) ?? P_METRICS[0];
  const sorted = useMemo(() => {
    const b = qualifiedOnly ? rows.filter((r) => r.is_qualified) : rows;
    return [...b].sort((a, c) => (metric.get(c) ?? -Infinity) - (metric.get(a) ?? -Infinity)).slice(0, 100);
  }, [rows, metric, qualifiedOnly]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {P_METRICS.map((m) => (
            <button key={m.key} onClick={() => setMetricKey(m.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${m.key === metricKey ? "bg-accent-soft text-accent-ink" : "bg-card-2 text-ink-3 hover:text-ink"}`}>
              {t(m.labelKey)}
            </button>
          ))}
        </div>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-[11px] text-ink-2">
          <input type="checkbox" checked={qualifiedOnly} onChange={(e) => setQualifiedOnly(e.target.checked)} className="accent-[var(--accent)]" />
          {t("basketball.qualifiedOnly")}
        </label>
      </div>
      {sorted.length === 0 ? <p className="text-sm text-ink-3">{t("basketball.noData")}</p> : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line">
                <Th>{t("basketball.rank")}</Th><Th>{t("basketball.player")}</Th><Th>{t("basketball.team")}</Th>
                <Th right>{t("basketball.games")}</Th><Th right>{t("basketball.min")}</Th><Th right>{t("basketball.ppg")}</Th>
                <Th right>{t("basketball.rpg")}</Th><Th right>{t("basketball.apg")}</Th><Th right>{t("basketball.tsPct")}</Th>
                <Th right>{t("basketball.valuation")}</Th><Th right>{t(metric.labelKey)}</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.person_code} className="border-t border-line hover:bg-veil">
                  <td className="px-2 py-2 text-ink-3 tabular-nums">{i + 1}</td>
                  <td className="px-2 py-2">
                    <Link href={`${base}/player/${r.person_code}`} className="font-medium text-ink hover:text-accent-ink whitespace-nowrap">
                      {r.player_name}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <Link href={`${base}/team/${r.team_code}`} className="text-ink-2 hover:text-accent-ink whitespace-nowrap text-[12px]">{r.team_name}</Link>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{r.games}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(r.mpg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(r.ppg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(r.rpg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(r.apg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(r.ts_pct)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(r.val_pg)}</td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-accent-ink">{fmt(metric.get(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Team leaders ---------------- */
type TMetric = { key: string; labelKey: string; get: (r: EuroTeamRow) => number | null; asc?: boolean };
const T_METRICS: TMetric[] = [
  { key: "ppg", labelKey: "basketball.ppg", get: (r) => r.ppg },
  { key: "oppg", labelKey: "basketball.oppg", get: (r) => r.oppg, asc: true },
  { key: "net_rtg", labelKey: "basketball.netRtg", get: (r) => r.net_rtg },
  { key: "off_rtg", labelKey: "basketball.offRtg", get: (r) => r.off_rtg },
  { key: "def_rtg", labelKey: "basketball.defRtg", get: (r) => r.def_rtg, asc: true },
  { key: "efg_pct", labelKey: "basketball.efgPct", get: (r) => r.efg_pct },
  { key: "fg3_pct", labelKey: "basketball.threePct", get: (r) => r.fg3_pct },
  { key: "pace", labelKey: "basketball.pace", get: (r) => r.pace },
];

function TeamLeaders({ rows, base }: { rows: EuroTeamRow[]; base: string }) {
  const { t } = useI18n();
  const [metricKey, setMetricKey] = useState("net_rtg");
  const metric = T_METRICS.find((m) => m.key === metricKey) ?? T_METRICS[0];
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const av = metric.get(a) ?? (metric.asc ? Infinity : -Infinity);
    const bv = metric.get(b) ?? (metric.asc ? Infinity : -Infinity);
    return metric.asc ? av - bv : bv - av;
  }), [rows, metric]);
  if (rows.length === 0) return <p className="text-sm text-ink-3">{t("basketball.noData")}</p>;
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {T_METRICS.map((m) => (
          <button key={m.key} onClick={() => setMetricKey(m.key)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${m.key === metricKey ? "bg-accent-soft text-accent-ink" : "bg-card-2 text-ink-3 hover:text-ink"}`}>
            {t(m.labelKey)}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[13px]">
          <thead><tr className="border-b border-line"><Th>{t("basketball.rank")}</Th><Th>{t("basketball.team")}</Th><Th right>{t(metric.labelKey)}</Th></tr></thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.team_code} className="border-t border-line hover:bg-veil">
                <td className="px-2 py-2 text-ink-3 tabular-nums">{i + 1}</td>
                <td className="px-2 py-2">
                  <Link href={`${base}/team/${r.team_code}`} className="flex items-center gap-2 font-medium text-ink hover:text-accent-ink">
                    <Crest url={r.crest_url} name={r.team_name} size={28} />
                    <span className="whitespace-nowrap">{r.team_name}</span>
                  </Link>
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums text-accent-ink">{fmt(metric.get(r), 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
