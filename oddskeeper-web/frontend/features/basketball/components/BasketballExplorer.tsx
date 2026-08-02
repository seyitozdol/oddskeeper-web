"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { fmt, formatMatchDate, normalizePositionCode, positionLabel, playerPhotoUrl } from "../lib";
import { TeamCrest } from "./ui";
import PlayerAvatar from "./PlayerAvatar";
import CountryFlag from "./CountryFlag";
import MatchOdds from "./MatchOdds";
import type { BktTeamSeasonRow, BktLeaderboardRow, BktMarketModelRow, BktGameRow, BktFixtureRow } from "../types";

type Tab = "standings" | "results" | "fixtures" | "players" | "teams" | "match";

type Props = {
  standings: BktTeamSeasonRow[];
  leaderboard: BktLeaderboardRow[];
  teamPoints: BktMarketModelRow[];
  games: BktGameRow[];
  fixtures: BktFixtureRow[];
  initialTab?: Tab;
  season: string;
};

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

export default function BasketballExplorer({ standings, leaderboard, teamPoints, games, fixtures, initialTab = "standings", season }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: { key: Tab; label: string }[] = [
    { key: "standings", label: t("basketball.tabStandings") },
    { key: "results", label: t("basketball.tabResults") },
    { key: "fixtures", label: t("basketball.tabFixtures") },
    { key: "players", label: t("basketball.tabPlayers") },
    { key: "teams", label: t("basketball.tabTeams") },
    { key: "match", label: t("basketball.tabMatchOdds") },
  ];

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              tab === tb.key
                ? "bg-accent text-white"
                : "bg-card-2 text-ink-2 hover:bg-veil hover:text-ink"
            }`}
          >
            {tb.label}
          </button>
        ))}
        <Link
          href="/dashboard/basketball/tools"
          className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-veil"
        >
          {t("basketball.toolsNav")}
        </Link>
      </div>

      {tab === "standings" && <StandingsTable rows={standings} season={season} />}
      {tab === "results" && <Results rows={games} season={season} />}
      {tab === "fixtures" && <Fixtures rows={fixtures} season={season} />}
      {tab === "players" && <PlayerLeaders rows={leaderboard} season={season} />}
      {tab === "teams" && <TeamLeaders rows={standings} season={season} />}
      {tab === "match" && <MatchOdds standings={standings} teamPoints={teamPoints} />}
    </div>
  );
}

/* ---------------- Results (oynanmis maclar, tur desc) ---------------- */
function Results({ rows, season }: { rows: BktGameRow[]; season: string }) {
  const { t, locale } = useI18n();
  if (rows.length === 0) return <p className="text-sm text-ink-3">{t("basketball.noResults")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-line text-[9px] uppercase tracking-[0.1em] text-ink-3">
            <th className="px-2 py-1 text-left">{t("basketball.week")}</th>
            <th className="px-2 py-1 text-left">{t("basketball.date")}</th>
            <th className="px-2 py-1 text-right">{t("basketball.home")}</th>
            <th className="px-2 py-1 text-center">{t("basketball.score")}</th>
            <th className="px-2 py-1 text-left">{t("basketball.away")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g, idx) => {
            const hs = g.home_score, as = g.away_score;
            const done = hs != null && as != null;
            const homeWin = done && (hs as number) > (as as number);
            const awayWin = done && (as as number) > (hs as number);
            return (
              <tr key={`${g.match_key}-${idx}`} className="border-t border-line hover:bg-veil">
                <td className="px-2 py-1.5 tabular-nums text-ink-3">{g.week ?? "-"}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-[11px] text-ink-3">{formatMatchDate(g.match_date, locale)}</td>
                <td className="px-2 py-1.5 text-right">
                  <Link href={`/dashboard/basketball/team/${g.home_team_slug}?season=${season}`} className="inline-flex items-center justify-end gap-1.5 hover:text-accent-ink">
                    <span className={`whitespace-nowrap ${homeWin ? "font-semibold text-ink" : "text-ink-2"}`}>{g.home_team_name}</span>
                    <TeamCrest slug={g.home_team_slug} name={g.home_team_name} size={20} />
                  </Link>
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums font-semibold text-ink">{hs}<span className="px-1 text-ink-3">-</span>{as}</td>
                <td className="px-2 py-1.5 text-left">
                  <Link href={g.away_team_slug ? `/dashboard/basketball/team/${g.away_team_slug}?season=${season}` : "#"} className="inline-flex items-center gap-1.5 hover:text-accent-ink">
                    <TeamCrest slug={g.away_team_slug} name={g.away_team_name} size={20} />
                    <span className={`whitespace-nowrap ${awayWin ? "font-semibold text-ink" : "text-ink-2"}`}>{g.away_team_name}</span>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Fixtures (yaklasan maclar) ---------------- */
function Fixtures({ rows, season }: { rows: BktFixtureRow[]; season: string }) {
  const { t } = useI18n();
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.week ?? 0) - (b.week ?? 0) || a.fixture_id - b.fixture_id),
    [rows],
  );
  if (sorted.length === 0) return <p className="text-sm text-ink-3">{t("basketball.noFixtures")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-line text-[9px] uppercase tracking-[0.1em] text-ink-3">
            <th className="px-2 py-1 text-left">{t("basketball.week")}</th>
            <th className="px-2 py-1 text-right">{t("basketball.home")}</th>
            <th className="px-2 py-1 text-center"></th>
            <th className="px-2 py-1 text-left">{t("basketball.away")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((f) => (
            <tr key={f.fixture_id} className="border-t border-line hover:bg-veil">
              <td className="px-2 py-1.5 tabular-nums text-ink-3">{f.week ?? "-"}</td>
              <td className="px-2 py-1.5 text-right">
                <Link href={f.home_team_slug ? `/dashboard/basketball/team/${f.home_team_slug}?season=${season}` : "#"} className="inline-flex items-center justify-end gap-1.5 hover:text-accent-ink">
                  <span className="whitespace-nowrap text-ink-2">{f.home_team_name}</span>
                  <TeamCrest slug={f.home_team_slug} name={f.home_team_name} size={20} />
                </Link>
              </td>
              <td className="px-2 py-1.5 text-center text-[11px] text-ink-3">vs</td>
              <td className="px-2 py-1.5 text-left">
                <Link href={f.away_team_slug ? `/dashboard/basketball/team/${f.away_team_slug}?season=${season}` : "#"} className="inline-flex items-center gap-1.5 hover:text-accent-ink">
                  <TeamCrest slug={f.away_team_slug} name={f.away_team_name} size={20} />
                  <span className="whitespace-nowrap text-ink-2">{f.away_team_name}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Standings ---------------- */
function StandingsTable({ rows, season }: { rows: BktTeamSeasonRow[]; season: string }) {
  const { t } = useI18n();
  if (rows.length === 0) return <p className="text-sm text-ink-3">{t("basketball.noData")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line">
            <Th>{t("basketball.rank")}</Th>
            <Th>{t("basketball.team")}</Th>
            <Th right>{t("basketball.played")}</Th>
            <Th right>{t("basketball.wins")}</Th>
            <Th right>{t("basketball.losses")}</Th>
            <Th right>{t("basketball.winPct")}</Th>
            <Th right>{t("basketball.ppg")}</Th>
            <Th right>{t("basketball.oppg")}</Th>
            <Th right>{t("basketball.diff")}</Th>
            <Th right>{t("basketball.netRtg")}</Th>
            <Th right>{t("basketball.offRtg")}</Th>
            <Th right>{t("basketball.defRtg")}</Th>
            <Th right>{t("basketball.pace")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team_slug} className="border-t border-line hover:bg-veil">
              <td className="px-2 py-2 text-ink-3 tabular-nums">{r.standings_rank}</td>
              <td className="px-2 py-2">
                <Link href={`/dashboard/basketball/team/${r.team_slug}?season=${season}`} className="flex items-center gap-2 font-medium text-ink hover:text-accent-ink">
                  <TeamCrest slug={r.team_slug} name={r.team_name} size={28} />
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
type PlayerMetric = {
  key: string;
  labelKey: string;
  get: (r: BktLeaderboardRow) => number | null;
  digits: number;
};

const PLAYER_METRICS: PlayerMetric[] = [
  { key: "ppg", labelKey: "basketball.metricPoints", get: (r) => r.ppg, digits: 1 },
  { key: "rpg", labelKey: "basketball.metricRebounds", get: (r) => r.rpg, digits: 1 },
  { key: "apg", labelKey: "basketball.metricAssists", get: (r) => r.apg, digits: 1 },
  { key: "spg", labelKey: "basketball.metricSteals", get: (r) => r.spg, digits: 1 },
  { key: "bpg", labelKey: "basketball.metricBlocks", get: (r) => r.bpg, digits: 1 },
  { key: "fg3m_pg", labelKey: "basketball.metricThrees", get: (r) => r.fg3m_pg, digits: 1 },
  { key: "ts_pct", labelKey: "basketball.metricTs", get: (r) => r.ts_pct, digits: 1 },
  { key: "usage_pct", labelKey: "basketball.metricUsage", get: (r) => r.usage_pct, digits: 1 },
];

function PlayerLeaders({ rows, season }: { rows: BktLeaderboardRow[]; season: string }) {
  const { t, locale } = useI18n();
  const [metricKey, setMetricKey] = useState("ppg");
  const [qualifiedOnly, setQualifiedOnly] = useState(true);

  const metric = PLAYER_METRICS.find((m) => m.key === metricKey) ?? PLAYER_METRICS[0];

  const sorted = useMemo(() => {
    const base = qualifiedOnly ? rows.filter((r) => r.is_qualified) : rows;
    return [...base].sort((a, b) => (metric.get(b) ?? -Infinity) - (metric.get(a) ?? -Infinity)).slice(0, 100);
  }, [rows, metric, qualifiedOnly]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PLAYER_METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetricKey(m.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                m.key === metricKey ? "bg-accent-soft text-accent-ink" : "bg-card-2 text-ink-3 hover:text-ink"
              }`}
            >
              {t(m.labelKey)}
            </button>
          ))}
        </div>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-[11px] text-ink-2">
          <input type="checkbox" checked={qualifiedOnly} onChange={(e) => setQualifiedOnly(e.target.checked)} className="accent-[var(--accent)]" />
          {t("basketball.qualifiedOnly")}
        </label>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-ink-3">{t("basketball.noData")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line">
                <Th>{t("basketball.rank")}</Th>
                <Th>{t("basketball.player")}</Th>
                <Th>{t("basketball.team")}</Th>
                <Th>{t("basketball.position")}</Th>
                <Th right>{t("basketball.games")}</Th>
                <Th right>{t("basketball.min")}</Th>
                <Th right>{t("basketball.ppg")}</Th>
                <Th right>{t("basketball.rpg")}</Th>
                <Th right>{t("basketball.apg")}</Th>
                <Th right>{t("basketball.tsPct")}</Th>
                <Th right>{t("basketball.usage")}</Th>
                <Th right>{t(metric.labelKey)}</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.player_slug} className="border-t border-line hover:bg-veil">
                  <td className="px-2 py-2 text-ink-3 tabular-nums">{i + 1}</td>
                  <td className="px-2 py-2">
                    <Link href={`/dashboard/basketball/player/${r.player_slug}?season=${season}`} className="inline-flex items-center gap-2 font-medium text-ink hover:text-accent-ink whitespace-nowrap">
                      <PlayerAvatar src={playerPhotoUrl({ sofascore_player_id: r.sofascore_player_id, image_url: r.image_url })} name={r.player_name} size={26} />
                      <CountryFlag code={r.country_code} size={14} />
                      {r.player_name}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <Link href={`/dashboard/basketball/team/${r.team_slug}?season=${season}`} className="flex items-center gap-1.5 text-ink-2 hover:text-accent-ink">
                      <TeamCrest slug={r.team_slug} name={r.team_name} size={22} />
                      <span className="whitespace-nowrap text-[12px]">{r.team_name}</span>
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
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(r.usage_pct)}</td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-accent-ink">{fmt(metric.get(r), metric.digits)}</td>
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
type TeamMetric = { key: string; labelKey: string; get: (r: BktTeamSeasonRow) => number | null; asc?: boolean };
const TEAM_METRICS: TeamMetric[] = [
  { key: "ppg", labelKey: "basketball.ppg", get: (r) => r.ppg },
  { key: "oppg", labelKey: "basketball.oppg", get: (r) => r.oppg, asc: true },
  { key: "net_rtg", labelKey: "basketball.netRtg", get: (r) => r.net_rtg },
  { key: "off_rtg", labelKey: "basketball.offRtg", get: (r) => r.off_rtg },
  { key: "def_rtg", labelKey: "basketball.defRtg", get: (r) => r.def_rtg, asc: true },
  { key: "efg_pct", labelKey: "basketball.efgPct", get: (r) => r.efg_pct },
  { key: "fg3_pct", labelKey: "basketball.threePct", get: (r) => r.fg3_pct },
  { key: "pace", labelKey: "basketball.pace", get: (r) => r.pace },
  { key: "rpg", labelKey: "basketball.rpg", get: (r) => r.rpg },
  { key: "apg", labelKey: "basketball.apg", get: (r) => r.apg },
];

function TeamLeaders({ rows, season }: { rows: BktTeamSeasonRow[]; season: string }) {
  const { t } = useI18n();
  const [metricKey, setMetricKey] = useState("net_rtg");
  const metric = TEAM_METRICS.find((m) => m.key === metricKey) ?? TEAM_METRICS[0];
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = metric.get(a) ?? (metric.asc ? Infinity : -Infinity);
      const bv = metric.get(b) ?? (metric.asc ? Infinity : -Infinity);
      return metric.asc ? av - bv : bv - av;
    });
  }, [rows, metric]);

  if (rows.length === 0) return <p className="text-sm text-ink-3">{t("basketball.noData")}</p>;
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TEAM_METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetricKey(m.key)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
              m.key === metricKey ? "bg-accent-soft text-accent-ink" : "bg-card-2 text-ink-3 hover:text-ink"
            }`}
          >
            {t(m.labelKey)}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <Th>{t("basketball.rank")}</Th>
              <Th>{t("basketball.team")}</Th>
              <Th right>{t(metric.labelKey)}</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.team_slug} className="border-t border-line hover:bg-veil">
                <td className="px-2 py-2 text-ink-3 tabular-nums">{i + 1}</td>
                <td className="px-2 py-2">
                  <Link href={`/dashboard/basketball/team/${r.team_slug}?season=${season}`} className="flex items-center gap-2 font-medium text-ink hover:text-accent-ink">
                    <TeamCrest slug={r.team_slug} name={r.team_name} size={28} />
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

