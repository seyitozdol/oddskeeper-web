"use client";

import { useMemo, useState } from "react";
import TeamLink from "@/components/links/TeamLink";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Translator } from "@/lib/i18n/messages";
import type { LeagueFixtureRow } from "../types";

type LeagueFixturesPanelProps = {
  rows?: LeagueFixtureRow[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(
  t: Translator,
  kickoffTimeKnown: boolean,
  kickoffTimeText: string | null | undefined
) {
  if (!kickoffTimeKnown || !kickoffTimeText) {
    return t("leagueDetail.tbd");
  }

  return kickoffTimeText;
}

function TeamName({ teamSlug, name }: { teamSlug?: string | null; name?: string | null }) {
  const displayName = name ?? "—";

  if (!teamSlug) {
    return <span>{displayName}</span>;
  }

  return (
    <TeamLink
      teamSlug={teamSlug}
      className="transition hover:text-ink hover:underline"
      title={displayName}
    >
      {displayName}
    </TeamLink>
  );
}

function getStatusClass(status: string | null | undefined) {
  if (status === "scheduled") {
    return "border-line-strong bg-accent-soft text-accent-ink";
  }

  if (status === "postponed") {
    return "border-amber-500/25 bg-amber-400/15 text-amber-500";
  }

  if (status === "cancelled") {
    return "border-neg/25 bg-neg/10 text-neg";
  }

  return "border-line bg-veil text-ink-2";
}

export function LeagueFixturesPanel({ rows = [] }: LeagueFixturesPanelProps) {
  const { t } = useI18n();
  const roundOptions = useMemo(() => {
    return Array.from(
      new Set(rows.map((row) => row.round_number).filter((value): value is number => typeof value === "number")),
    ).sort((a, b) => a - b);
  }, [rows]);

  const [selectedRound, setSelectedRound] = useState<number | "all">(
    roundOptions[0] ?? "all",
  );

  const filteredRows = useMemo(() => {
    if (selectedRound === "all") {
      return rows;
    }

    return rows.filter((row) => row.round_number === selectedRound);
  }, [rows, selectedRound]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-veil px-3 py-3 text-sm text-ink-2">
        {t("leagueDetail.noFixtureData")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">{t("leagueDetail.fixturesFilterLabel")}</div>
        <select
          value={selectedRound === "all" ? "all" : String(selectedRound)}
          onChange={(event) => {
            const value = event.target.value;
            setSelectedRound(value === "all" ? "all" : Number(value));
          }}
          className="rounded-lg border border-line bg-field px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong"
        >
          <option value="all">{t("leagueDetail.allWeeks")}</option>
          {roundOptions.map((roundNumber) => (
            <option key={roundNumber} value={roundNumber}>
              {t("leagueDetail.weekLabel", { number: roundNumber })}
            </option>
          ))}
        </select>
        <div className="text-xs text-ink-3">
          {selectedRound === "all"
            ? t("leagueDetail.fixturesCount", { count: rows.length })
            : t("leagueDetail.fixturesCountInWeek", {
                count: filteredRows.length,
                week: selectedRound,
              })}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-field">
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
              <th className="px-3 py-2 font-medium">{t("leagueDetail.colWeek")}</th>
              <th className="px-3 py-2 font-medium">{t("common.date")}</th>
              <th className="px-3 py-2 font-medium">{t("leagueDetail.colTime")}</th>
              <th className="px-3 py-2 font-medium">{t("common.home")}</th>
              <th className="px-3 py-2 font-medium">{t("common.away")}</th>
              <th className="px-3 py-2 font-medium">{t("leagueDetail.colStatus")}</th>
              <th className="px-3 py-2 font-medium">{t("leagueDetail.colVenue")}</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row) => (
              <tr
                key={row.fixture_id}
                className="border-t border-line text-[13px] text-ink transition hover:bg-veil"
              >
                <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                  {row.round_number ?? "—"}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                  {formatDate(row.fixture_datetime ?? row.fixture_date)}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                  {formatTime(t, row.kickoff_time_known, row.kickoff_time_text)}
                </td>
                <td className="min-w-[210px] px-3 py-1.5 font-medium text-ink">
                  <TeamName teamSlug={row.home_team_slug} name={row.home_team_name} />
                </td>
                <td className="min-w-[210px] px-3 py-1.5 font-medium text-ink">
                  <TeamName teamSlug={row.away_team_slug} name={row.away_team_name} />
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span
                    className={`inline-flex min-w-[72px] items-center justify-center rounded-md border px-2 py-[2px] text-[10px] font-semibold uppercase ${getStatusClass(
                      row.fixture_status,
                    )}`}
                  >
                    {row.fixture_status
                      ? row.fixture_status.replace(/_/g, " ")
                      : t("leagueDetail.fixtureStatusUnknown")}
                  </span>
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                  {row.venue ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
