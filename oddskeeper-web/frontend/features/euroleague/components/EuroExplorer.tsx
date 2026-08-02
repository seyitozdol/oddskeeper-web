"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { fmt, formatMatchDate, normalizePositionCode, positionLabel, playerPhotoUrl } from "@/features/basketball/lib";
import { normalizePlayerName } from "@/features/basketball/unified";
import PlayerAvatar from "@/features/basketball/components/PlayerAvatar";
import type { EuroTeamRow, EuroLeaderRow, EuroGameRow } from "../types";
import type { EuroCompKey } from "../config";

type Tab = "standings" | "results" | "fixtures" | "players" | "teams";

// EL/EC faz kodu → i18n etiketi.
const PHASE_KEY: Record<string, string> = {
  RS: "phaseRS", PI: "phasePI", PO: "phasePO", FF: "phaseFF",
  "8F": "phase8F", "4F": "phase4F", "2F": "phase2F", Final: "phaseFinal",
};

// Ardisik ayni-anahtarli satirlari gruplar (sirali giris varsayar).
function groupBy<T>(items: T[], keyOf: (x: T) => string): { key: string; items: T[] }[] {
  const out: { key: string; items: T[] }[] = [];
  for (const it of items) {
    const k = keyOf(it);
    const last = out[out.length - 1];
    if (last && last.key === k) last.items.push(it);
    else out.push({ key: k, items: [it] });
  }
  return out;
}

// Türk takımı ise BSL adı (Beşiktaş), değilse euro adı.
const teamDisplay = (r: { bsl_team_name?: string | null; team_name?: string | null }) =>
  r.bsl_team_name || r.team_name || "";

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
  comp, standings, leaderboard, games, season,
}: {
  comp: EuroCompKey;
  standings: EuroTeamRow[];
  leaderboard: EuroLeaderRow[];
  games: EuroGameRow[];
  season: string;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("standings");
  const base = `/dashboard/euro/${comp}`;

  const tabs: { key: Tab; label: string }[] = [
    { key: "standings", label: t("basketball.tabStandings") },
    { key: "results", label: t("basketball.tabResults") },
    { key: "fixtures", label: t("basketball.tabFixtures") },
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

      {tab === "standings" && <Standings rows={standings} base={base} season={season} />}
      {tab === "results" && <Games games={games} base={base} season={season} mode="results" />}
      {tab === "fixtures" && <Games games={games} base={base} season={season} mode="fixtures" />}
      {tab === "players" && <PlayerLeaders rows={leaderboard} comp={comp} base={base} season={season} />}
      {tab === "teams" && <TeamLeaders rows={standings} base={base} season={season} />}
    </div>
  );
}

/* ---------------- Fixtures / Results ---------------- */
// Bir mac satiri: [Ev adi+logo] [skor/tarih] [Dep logo+adi]. Kazanan koyu.
function GameRow({ g, base, season, showScore }: { g: EuroGameRow; base: string; season: string; showScore: boolean }) {
  const { locale } = useI18n();
  const hs = g.home_score, as = g.away_score;
  const done = showScore && hs != null && as != null;
  const homeWin = done && (hs as number) > (as as number);
  const awayWin = done && (as as number) > (hs as number);
  const homeName = g.home_team_name ?? g.home_team_code;
  const awayName = g.away_team_name ?? g.away_team_code;
  return (
    <tr className="border-t border-line hover:bg-veil">
      <td className="whitespace-nowrap px-2 py-1.5 text-[11px] text-ink-3">{formatMatchDate(g.game_date, locale)}</td>
      <td className="px-2 py-1.5 text-right">
        <Link href={`${base}/team/${g.home_team_code}?season=${season}`} className="inline-flex items-center justify-end gap-1.5 hover:text-accent-ink">
          <span className={`whitespace-nowrap ${homeWin ? "font-semibold text-ink" : "text-ink-2"}`}>{homeName}</span>
          <Crest url={g.home_crest} name={homeName} size={20} />
        </Link>
      </td>
      <td className="px-2 py-1.5 text-center tabular-nums">
        {done ? (
          <span className="font-semibold text-ink">{hs}<span className="px-1 text-ink-3">-</span>{as}</span>
        ) : (
          <span className="text-[11px] text-ink-3">{showScore ? "-" : "vs"}</span>
        )}
      </td>
      <td className="px-2 py-1.5 text-left">
        <Link href={`${base}/team/${g.away_team_code}?season=${season}`} className="inline-flex items-center gap-1.5 hover:text-accent-ink">
          <Crest url={g.away_crest} name={awayName} size={20} />
          <span className={`whitespace-nowrap ${awayWin ? "font-semibold text-ink" : "text-ink-2"}`}>{awayName}</span>
        </Link>
      </td>
    </tr>
  );
}

function Games({ games, base, season, mode }: { games: EuroGameRow[]; base: string; season: string; mode: "results" | "fixtures" }) {
  const { t } = useI18n();
  const rows = useMemo(() => {
    if (mode === "results") {
      return games.filter((g) => g.played).sort((a, b) => {
        const d = (b.game_date ?? "").localeCompare(a.game_date ?? "");
        return d !== 0 ? d : b.phase_order - a.phase_order;
      });
    }
    return games.filter((g) => !g.played).sort((a, b) => (a.game_date ?? "").localeCompare(b.game_date ?? ""));
  }, [games, mode]);

  if (rows.length === 0) {
    return <p className="text-sm text-ink-3">{t(mode === "results" ? "basketball.noResults" : "basketball.noFixtures")}</p>;
  }

  // Results: faza gore grupla. Fixtures: tura gore grupla.
  const groups = mode === "results"
    ? groupBy(rows, (g) => g.phase_code ?? "RS")
    : groupBy(rows, (g) => `R${g.round ?? 0}`);

  return (
    <div>
      {groups.map((gp) => {
        const first = gp.items[0];
        const label = mode === "results"
          ? t(`basketball.${PHASE_KEY[first.phase_code ?? "RS"] ?? "phaseRS"}`)
          : `${t("basketball.round")} ${first.round ?? "-"}`;
        return (
          <div key={gp.key} className="mb-6">
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</h3>
            <table className="min-w-full border-collapse">
              <tbody>
                {gp.items.map((g) => (
                  <GameRow key={g.game_code} g={g} base={base} season={season} showScore={mode === "results"} />
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Standings ---------------- */
function Standings({ rows, base, season }: { rows: EuroTeamRow[]; base: string; season: string }) {
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
                <Link href={`${base}/team/${r.team_code}?season=${season}`} className="flex items-center gap-2 font-medium text-ink hover:text-accent-ink">
                  <Crest url={r.crest_url} name={teamDisplay(r)} size={28} />
                  <span className="whitespace-nowrap">{teamDisplay(r)}</span>
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

function PlayerLeaders({ rows, comp, base, season }: { rows: EuroLeaderRow[]; comp: EuroCompKey; base: string; season: string }) {
  const { t, locale } = useI18n();
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
                <Th>{t("basketball.rank")}</Th><Th>{t("basketball.player")}</Th><Th>{t("basketball.team")}</Th><Th>{t("basketball.position")}</Th>
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
                    <Link href={`${base}/player/${r.person_code}?season=${season}`} className="inline-flex items-center gap-2 font-medium text-ink hover:text-accent-ink whitespace-nowrap">
                      <PlayerAvatar src={playerPhotoUrl({ image_url: r.image_url })} name={normalizePlayerName(r.player_name)} size={26} />
                      {normalizePlayerName(r.player_name)}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <Link href={`${base}/team/${r.team_code}?season=${season}`} className="inline-flex items-center gap-1.5 text-ink-2 hover:text-accent-ink whitespace-nowrap text-[12px]">
                      <Crest url={r.crest_url} name={teamDisplay(r)} size={22} />
                      {teamDisplay(r)}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    {normalizePositionCode(r.position) ? (
                      <span title={positionLabel(r.position, locale)} className="inline-block rounded bg-veil px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">{normalizePositionCode(r.position)}</span>
                    ) : <span className="text-ink-3">-</span>}
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

function TeamLeaders({ rows, base, season }: { rows: EuroTeamRow[]; base: string; season: string }) {
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
                  <Link href={`${base}/team/${r.team_code}?season=${season}`} className="flex items-center gap-2 font-medium text-ink hover:text-accent-ink">
                    <Crest url={r.crest_url} name={teamDisplay(r)} size={28} />
                    <span className="whitespace-nowrap">{teamDisplay(r)}</span>
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
