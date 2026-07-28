"use client";

import { useMemo } from "react";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import {
  formatMarketValue,
  formatMatchDate,
  positionLabel,
  ROLE_CHIP_CLASS,
  ROLE_LABEL_KEYS,
  squadRole,
} from "../lib";
import type {
  Tff1MarketValue,
  Tff1MatchRow,
  Tff1PlayerRow,
  Tff1TeamRow,
} from "../types";

type Tff1TeamDrawerProps = {
  team: Tff1TeamRow;
  rank: number; // secili sezondaki puan sirasi (1 bazli)
  matches: Tff1MatchRow[]; // tum sezonlarin maclari
  players: Tff1PlayerRow[]; // tum oyuncu-sezon satirlari
  marketValues: Record<string, Tff1MarketValue>;
  onClose: () => void;
  onOpenPlayer: (playerId: string) => void;
};

function n(v: number | string | null | undefined): number {
  const x = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(x as number) ? (x as number) : 0;
}

export default function Tff1TeamDrawer({
  team,
  rank,
  matches,
  players,
  marketValues,
  onClose,
  onOpenPlayer,
}: Tff1TeamDrawerProps) {
  const { t, locale } = useI18n();

  const teamMatches = useMemo(
    () =>
      matches
        .filter(
          (m) =>
            m.season_label === team.season_label &&
            (m.home_team_id === team.team_id || m.away_team_id === team.team_id)
        )
        .sort((a, b) => (b.match_datetime ?? "").localeCompare(a.match_datetime ?? "")),
    [matches, team]
  );

  const squad = useMemo(
    () =>
      players
        .filter((p) => p.season_label === team.season_label && p.team_id === team.team_id)
        .sort((a, b) => n(b.minutes) - n(a.minutes)),
    [players, team]
  );

  const squadValue = squad.reduce(
    (acc, p) => acc + n(marketValues[p.player_id]?.market_value_eur),
    0
  );

  const resultFor = (m: Tff1MatchRow): "W" | "D" | "L" | null => {
    if (m.home_score === null || m.away_score === null) return null;
    const isHome = m.home_team_id === team.team_id;
    const gf = isHome ? m.home_score : m.away_score;
    const ga = isHome ? m.away_score : m.home_score;
    return gf > ga ? "W" : gf < ga ? "L" : "D";
  };

  const RESULT_CLASS: Record<string, string> = {
    W: "bg-pos/15 text-pos",
    D: "bg-veil text-ink-2",
    L: "bg-neg/15 text-neg",
  };

  const leagueMatches = teamMatches.filter((m) => !m.competition.includes("Play-off"));
  const form = leagueMatches.slice(0, 5).map(resultFor);

  const summary: Array<[string, string]> = [
    [t("tff1.drawerRank"), `${rank}.`],
    [t("tff1.colPoints"), String(n(team.points))],
    [
      t("tff1.drawerRecord"),
      `${n(team.wins)}G ${n(team.draws)}B ${n(team.losses)}M`,
    ],
    [t("tff1.drawerGoals"), `${n(team.goals_for)}-${n(team.goals_against)}`],
    [t("tff1.colRating"), team.rating_avg === null ? "—" : String(team.rating_avg)],
    [t("tff1.drawerSquadValue"), formatMarketValue(squadValue || null)],
  ];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-line bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">{team.team_name}</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">
              {team.season_label} · {t("tff1.kicker")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-veil px-2.5 py-1 text-[13px] text-ink-2 transition hover:border-line-strong hover:text-ink"
          >
            {t("tff1.drawerClose")}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {summary.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-veil px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{label}</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">
            {t("tff1.drawerForm")}
          </span>
          {form.map((r, i) => (
            <span
              key={i}
              className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold ${
                r ? RESULT_CLASS[r] : "bg-veil text-ink-3"
              }`}
            >
              {r === "W" ? "G" : r === "L" ? "M" : r === "D" ? "B" : "—"}
            </span>
          ))}
        </div>

        <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("tff1.drawerSquad", { count: squad.length })}
        </h3>
        <div className="mt-2 overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                <th className="px-3 py-2 font-medium">{t("tff1.colPlayer")}</th>
                <th className="px-3 py-2 font-medium">{t("tff1.colPosition")}</th>
                <th className="px-3 py-2 font-medium">{t("tff1.drawerRole")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colAppearances")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colMinutes")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colGoals")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colAssists")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colRating")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colMarketValue")}</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => {
                const role = squadRole(p, n(team.played));
                return (
                  <tr
                    key={p.player_id}
                    className="cursor-pointer border-t border-line text-ink transition hover:bg-veil"
                    onClick={() => onOpenPlayer(p.player_id)}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{p.player_name}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-2">
                      {positionLabel(p, locale)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[11px] ${ROLE_CHIP_CLASS[role]}`}
                      >
                        {t(ROLE_LABEL_KEYS[role])}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(p.appearances)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(p.minutes)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(p.goals)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(p.assists)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {p.rating_avg === null ? "—" : Number(p.rating_avg).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMarketValue(marketValues[p.player_id]?.market_value_eur)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("tff1.drawerResults", { count: teamMatches.length })}
        </h3>
        <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-line">
          <table className="min-w-full border-collapse text-[13px]">
            <tbody>
              {teamMatches.map((m) => {
                const r = resultFor(m);
                return (
                  <tr key={m.match_id} className="border-t border-line first:border-t-0 text-ink">
                    <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-ink-3">
                      {formatMatchDate(m.match_datetime, locale)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <span className={m.home_team_id === team.team_id ? "font-semibold" : ""}>
                        {m.home_team_name}
                      </span>
                      <span className="mx-1.5 rounded bg-veil px-1.5 py-0.5 text-[12px] tabular-nums">
                        {m.home_score ?? "-"}:{m.away_score ?? "-"}
                      </span>
                      <span className={m.away_team_id === team.team_id ? "font-semibold" : ""}>
                        {m.away_team_name}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {m.competition.includes("Play-off") ? (
                        <span className="mr-1.5 text-[10px] uppercase text-ink-3">PO</span>
                      ) : null}
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold ${
                          r ? RESULT_CLASS[r] : "bg-veil text-ink-3"
                        }`}
                      >
                        {r === "W" ? "G" : r === "L" ? "M" : r === "D" ? "B" : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}
