"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { fmt, formatMatchDate, normalizePositionCode, positionLabel, playerPhotoUrl } from "@/features/basketball/lib";
import { normalizePlayerName } from "@/features/basketball/unified";
import PlayerAvatar from "@/features/basketball/components/PlayerAvatar";
import { CountryFlags } from "@/features/basketball/components/CountryFlag";
import type { EuroTeamRow, EuroLeaderRow, EuroGameRow } from "../types";
import type { EuroCompKey } from "../config";

type Tab = "league" | "players" | "teams" | "results" | "playerRankings" | "teamRankings";

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
  const [tab, setTab] = useState<Tab>("league");
  const base = `/dashboard/euro/${comp}`;

  const tabs: { key: Tab; label: string }[] = [
    { key: "league", label: t("basketball.tabLeague") },
    { key: "players", label: t("basketball.tabPlayersList") },
    { key: "teams", label: t("basketball.tabTeamsList") },
    { key: "results", label: t("basketball.tabResults") },
    { key: "playerRankings", label: t("basketball.tabPlayerRankings") },
    { key: "teamRankings", label: t("basketball.tabTeamRankings") },
  ];

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-line pb-2">
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${tab === tb.key ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:text-ink-2"}`}>
            {tb.label}
          </button>
        ))}
        <Link href={`${base}/tools`} className="ml-1 rounded-lg border border-accent/60 px-3.5 py-1.5 text-[13px] font-semibold text-accent-ink ring-1 ring-accent/20 transition hover:bg-accent-soft">
          {t("basketball.toolsNav")}
        </Link>
      </div>

      {tab === "league" && <League standings={standings} leaderboard={leaderboard} games={games} base={base} season={season} />}
      {tab === "players" && <EuroPlayersTable rows={leaderboard} base={base} season={season} />}
      {tab === "teams" && <Standings rows={standings} base={base} season={season} />}
      {tab === "results" && <ResultsSection games={games} base={base} season={season} />}
      {tab === "playerRankings" && <PlayerLeaders rows={leaderboard} base={base} season={season} />}
      {tab === "teamRankings" && <TeamLeaders rows={standings} base={base} season={season} />}
    </div>
  );
}

/* ---------------- League (kompakt puan durumu + Liderler) ---------------- */
const EL_LEADERS: { key: string; labelKey: string; get: (r: EuroLeaderRow) => number | null }[] = [
  { key: "ppg", labelKey: "basketball.metricPoints", get: (r) => r.ppg },
  { key: "apg", labelKey: "basketball.metricAssists", get: (r) => r.apg },
  { key: "fg3m_pg", labelKey: "basketball.metricThrees", get: (r) => r.fg3m_pg },
  { key: "bpg", labelKey: "basketball.metricBlocks", get: (r) => r.bpg },
];

function League({ standings, leaderboard, games, base, season }: {
  standings: EuroTeamRow[]; leaderboard: EuroLeaderRow[]; games: EuroGameRow[]; base: string; season: string;
}) {
  const { t } = useI18n();
  const [mk, setMk] = useState("ppg");
  const metric = EL_LEADERS.find((m) => m.key === mk) ?? EL_LEADERS[0];
  const top = useMemo(
    () => [...leaderboard.filter((r) => r.is_qualified)].sort((a, b) => (metric.get(b) ?? -Infinity) - (metric.get(a) ?? -Infinity)).slice(0, 10),
    [leaderboard, metric]
  );
  const recent = useMemo(() => games.filter((g) => g.played).sort((a, b) => (b.game_date ?? "").localeCompare(a.game_date ?? "")).slice(0, 8), [games]);
  const upcoming = useMemo(() => games.filter((g) => !g.played).sort((a, b) => (a.game_date ?? "").localeCompare(b.game_date ?? "")).slice(0, 8), [games]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">{t("basketball.tabStandings")}</h2>
          <CompactStandings rows={standings} base={base} season={season} />
        </div>
        <div className="flex flex-col rounded-2xl border border-line bg-card">
          <div className="space-y-2 border-b border-line p-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">{t("basketball.leadersTitle")}</h2>
            <div className="flex flex-wrap gap-1.5">
              {EL_LEADERS.map((m) => (
                <button key={m.key} onClick={() => setMk(m.key)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${m.key === mk ? "bg-accent-soft text-accent-ink" : "bg-card-2 text-ink-3 hover:text-ink"}`}>
                  {t(m.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-line/60">
            {top.map((r, i) => (
              <div key={r.person_code} className="flex items-center gap-3 px-3 py-2">
                <span className="w-4 shrink-0 text-center text-[12px] font-bold tabular-nums text-ink-3">{i + 1}</span>
                <PlayerAvatar src={playerPhotoUrl({ image_url: r.image_url })} name={normalizePlayerName(r.player_name)} size={34} />
                <div className="min-w-0 flex-1">
                  <Link href={`${base}/player/${r.person_code}?season=${season}`} className="block truncate text-[13px] font-medium text-accent-ink hover:text-accent">{normalizePlayerName(r.player_name)}</Link>
                  <span className="block truncate text-[11px] text-ink-3">{teamDisplay(r)}</span>
                </div>
                <div className="shrink-0 text-[15px] font-bold tabular-nums text-ink">{fmt(metric.get(r), 1)}</div>
              </div>
            ))}
            {top.length === 0 ? <p className="px-4 py-6 text-center text-[12px] text-ink-3">{t("basketball.noData")}</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <h3 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">{t("basketball.tabResults")}</h3>
          <table className="min-w-full border-collapse"><tbody>
            {recent.length ? recent.map((g) => <GameRow key={g.game_code} g={g} base={base} season={season} showScore />) : <tr><td className="px-4 py-6 text-center text-[12px] text-ink-3">{t("basketball.noResults")}</td></tr>}
          </tbody></table>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <h3 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">{t("basketball.tabFixtures")}</h3>
          <table className="min-w-full border-collapse"><tbody>
            {upcoming.length ? upcoming.map((g) => <GameRow key={g.game_code} g={g} base={base} season={season} showScore={false} />) : <tr><td className="px-4 py-6 text-center text-[12px] text-ink-3">{t("basketball.noFixtures")}</td></tr>}
          </tbody></table>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Results + Fixtures birlesik bolum ---------------- */
function ResultsSection({ games, base, season }: { games: EuroGameRow[]; base: string; season: string }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">{t("basketball.tabResults")}</h2>
        <Games games={games} base={base} season={season} mode="results" />
      </div>
      <div>
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">{t("basketball.tabFixtures")}</h2>
        <Games games={games} base={base} season={season} mode="fixtures" />
      </div>
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

function PlayerLeaders({ rows, base, season }: { rows: EuroLeaderRow[]; base: string; season: string }) {
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
                      <CountryFlags codes={[r.country_code, r.country_code2]} size={14} />
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

/* ---------------- Kompakt puan durumu (League solu) ---------------- */
function CompactStandings({ rows, base, season }: { rows: EuroTeamRow[]; base: string; season: string }) {
  const { t } = useI18n();
  if (rows.length === 0) return <p className="text-sm text-ink-3">{t("basketball.noData")}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="min-w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line bg-card-2/40">
            <Th>{t("basketball.rank")}</Th><Th>{t("basketball.team")}</Th>
            <Th right>{t("basketball.played")}</Th><Th right>{t("basketball.wins")}</Th><Th right>{t("basketball.losses")}</Th>
            <Th right>{t("basketball.ppg")}</Th><Th right>{t("basketball.diff")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team_code} className="border-t border-line hover:bg-veil">
              <td className="px-2 py-1.5 text-ink-3 tabular-nums">{r.standings_rank}</td>
              <td className="px-2 py-1.5">
                <Link href={`${base}/team/${r.team_code}?season=${season}`} className="flex items-center gap-2 font-medium text-ink hover:text-accent-ink">
                  <Crest url={r.crest_url} name={teamDisplay(r)} size={24} />
                  <span className="whitespace-nowrap">{teamDisplay(r)}</span>
                </Link>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-ink-2">{r.games}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-ink">{r.wins}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-ink-2">{r.losses}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-ink">{fmt(r.ppg)}</td>
              <td className={`px-2 py-1.5 text-right tabular-nums ${(r.point_diff ?? 0) >= 0 ? "text-pos" : "text-neg"}`}>{(r.point_diff ?? 0) >= 0 ? "+" : ""}{fmt(r.point_diff)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Players (arama + siralanabilir tam tablo) ---------------- */
function ThBtn({ label, onClick, right }: { label: string; onClick: () => void; right?: boolean }) {
  return (
    <th className={`px-2 py-2 ${right ? "text-right" : "text-left"}`}>
      <button onClick={onClick} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3 transition hover:text-ink-2">{label}</button>
    </th>
  );
}

const EPT_POS = ["ALL", "G", "GF", "F", "FC", "C"];
const EPT_COLS: { key: string; labelKey: string; get: (r: EuroLeaderRow) => number | null; d: number }[] = [
  { key: "games", labelKey: "basketball.games", get: (r) => r.games, d: 0 },
  { key: "mpg", labelKey: "basketball.min", get: (r) => r.mpg, d: 1 },
  { key: "ppg", labelKey: "basketball.ppg", get: (r) => r.ppg, d: 1 },
  { key: "rpg", labelKey: "basketball.rpg", get: (r) => r.rpg, d: 1 },
  { key: "apg", labelKey: "basketball.apg", get: (r) => r.apg, d: 1 },
  { key: "spg", labelKey: "basketball.metricSteals", get: (r) => r.spg, d: 1 },
  { key: "bpg", labelKey: "basketball.metricBlocks", get: (r) => r.bpg, d: 1 },
  { key: "fg3m_pg", labelKey: "basketball.metricThrees", get: (r) => r.fg3m_pg, d: 1 },
  { key: "ts_pct", labelKey: "basketball.tsPct", get: (r) => r.ts_pct, d: 1 },
  { key: "val_pg", labelKey: "basketball.valuation", get: (r) => r.val_pg, d: 1 },
];

function EuroPlayersTable({ rows, base, season }: { rows: EuroLeaderRow[]; base: string; season: string }) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [pos, setPos] = useState("ALL");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "ppg", dir: "desc" });

  const norm = (s: string) => s.toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/İ/g, "i");
  const filtered = useMemo(() => {
    const tokens = norm(q).split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (pos !== "ALL" && (normalizePositionCode(r.position) ?? "") !== pos) return false;
      if (!tokens.length) return true;
      const hay = norm(`${normalizePlayerName(r.player_name)} ${teamDisplay(r)}`);
      return tokens.every((tk) => hay.includes(tk));
    });
  }, [rows, q, pos]);

  const sorted = useMemo(() => {
    const col = EPT_COLS.find((c) => c.key === sort.key);
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === "player") return dir * normalizePlayerName(a.player_name).localeCompare(normalizePlayerName(b.player_name), "tr");
      const av = col?.get(a) ?? -Infinity, bv = col?.get(b) ?? -Infinity;
      return dir * (av - bv);
    });
  }, [filtered, sort]);

  const toggleSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "player" ? "asc" : "desc" }));
  const arrow = (key: string) => (sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : "");
  const chip = (active: boolean) =>
    `rounded-md border px-2.5 py-1 text-[12px] transition ${active ? "border-line-strong bg-card-2 text-ink" : "border-line bg-veil text-ink-2 hover:text-ink"}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("basketball.searchPlaceholder")}
          className="w-full max-w-[260px] rounded-lg border border-line bg-field px-3 py-1.5 text-[13px] text-ink outline-none focus:border-line-strong" />
        <div className="flex flex-wrap gap-1.5">
          {EPT_POS.map((p) => (
            <button key={p} onClick={() => setPos(p)} className={chip(pos === p)}>{p === "ALL" ? t("basketball.allPositions") : p}</button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-ink-3">{sorted.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <Th>#</Th>
              <ThBtn label={`${t("basketball.player")}${arrow("player")}`} onClick={() => toggleSort("player")} />
              <Th>{t("basketball.team")}</Th>
              <Th>{t("basketball.position")}</Th>
              {EPT_COLS.map((c) => <ThBtn key={c.key} right label={`${t(c.labelKey)}${arrow(c.key)}`} onClick={() => toggleSort(c.key)} />)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.person_code} className="border-t border-line hover:bg-veil">
                <td className="px-2 py-1.5 text-ink-3 tabular-nums">{i + 1}</td>
                <td className="px-2 py-1.5">
                  <Link href={`${base}/player/${r.person_code}?season=${season}`} className="inline-flex items-center gap-2 font-medium text-ink hover:text-accent-ink whitespace-nowrap">
                    <PlayerAvatar src={playerPhotoUrl({ image_url: r.image_url })} name={normalizePlayerName(r.player_name)} size={24} />
                    <CountryFlags codes={[r.country_code, r.country_code2]} size={14} />
                    {normalizePlayerName(r.player_name)}
                  </Link>
                </td>
                <td className="px-2 py-1.5">
                  <Link href={`${base}/team/${r.team_code}?season=${season}`} className="inline-flex items-center gap-1.5 text-ink-2 hover:text-accent-ink whitespace-nowrap text-[12px]">
                    <Crest url={r.crest_url} name={teamDisplay(r)} size={20} />
                    {teamDisplay(r)}
                  </Link>
                </td>
                <td className="px-2 py-1.5">
                  {normalizePositionCode(r.position) ? (
                    <span title={positionLabel(r.position, locale)} className="inline-block rounded bg-veil px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">{normalizePositionCode(r.position)}</span>
                  ) : <span className="text-ink-3">-</span>}
                </td>
                {EPT_COLS.map((c) => <td key={c.key} className="px-2 py-1.5 text-right tabular-nums text-ink-2">{fmt(c.get(r), c.d)}</td>)}
              </tr>
            ))}
            {sorted.length === 0 ? <tr><td colSpan={4 + EPT_COLS.length} className="px-2 py-6 text-center text-[12px] text-ink-3">{t("basketball.noData")}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
