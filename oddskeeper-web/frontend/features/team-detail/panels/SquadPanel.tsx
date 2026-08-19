"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Translator } from "@/lib/i18n/messages";
import { getCountryFlagUrl } from "@/lib/country-flags";
import type { TeamCurrentSquadRow, TeamProfileRow, TeamSquadRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { formatDecimal } from "../utils/formatDecimal";
import PlayerLink from "@/components/links/PlayerLink";

type SquadPanelProps = {
  rows?: TeamSquadRow[];
  currentSquad?: TeamCurrentSquadRow[];
  // Sol bilgi paneli (varsayilan acik, tiklama gerekmez).
  teamName?: string;
  logoPath?: string | null;
  profile?: TeamProfileRow | null;
};

const POSITION_GROUP_KEYS: Record<string, string> = {
  GOALKEEPER: "common.goalkeeper",
  DEFENDER: "common.defender",
  MIDFIELDER: "common.midfielder",
  FORWARD: "common.forward",
  OTHER: "common.other",
};

function getPositionGroupLabel(
  positionGroup: string,
  position: string | null,
  t: Translator
) {
  const key = POSITION_GROUP_KEYS[positionGroup];
  return key ? t(key) : position ?? "—";
}

// €7.0m / €500k bicimi; deger yoksa "—".
function formatMarketValue(eur: number | null): string {
  if (eur == null || !Number.isFinite(eur) || eur <= 0) return "—";
  if (eur >= 1_000_000) {
    const m = eur / 1_000_000;
    return `€${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}m`;
  }
  return `€${Math.round(eur / 1_000)}k`;
}

function NationFlag({ nationality }: { nationality: string | null }) {
  const url = getCountryFlagUrl(nationality);
  if (!url || !nationality) return null;
  return (
    <Image
      src={url}
      alt={nationality}
      title={nationality}
      width={16}
      height={12}
      className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
    />
  );
}

function PlayerAvatar({ photo, name }: { photo: string | null; name: string }) {
  if (photo) {
    return (
      <Image
        src={photo}
        alt={name}
        width={34}
        height={34}
        className="h-[34px] w-[34px] shrink-0 rounded-full border border-line bg-card-2 object-cover"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-line bg-veil text-[11px] font-semibold text-ink-3">
      {initials}
    </span>
  );
}

const TR_NATION = new Set(["turkiye", "turkey", "türkiye"]);

// Sol panel: takim kimligi + genel bilgiler (drawer benzeri, hep acik).
function TeamInfoCard({
  teamName,
  logoPath,
  profile,
  squad,
}: {
  teamName: string;
  logoPath: string | null;
  profile: TeamProfileRow | null;
  squad: TeamCurrentSquadRow[];
}) {
  const { t } = useI18n();

  const ages = squad.map((r) => r.age).filter((a): a is number => a != null && a > 0);
  const avgAge = ages.length
    ? (ages.reduce((s, a) => s + a, 0) / ages.length).toFixed(1)
    : null;
  const foreigners = squad.filter(
    (r) => r.nationality && !TR_NATION.has(r.nationality.toLowerCase())
  ).length;
  const valued = squad.filter((r) => (r.market_value_eur ?? 0) > 0);
  const totalValue = valued.reduce((s, r) => s + (r.market_value_eur ?? 0), 0);
  const topPlayer = valued.slice().sort((a, b) => (b.market_value_eur ?? 0) - (a.market_value_eur ?? 0))[0];

  // Pozisyon dagilimi (GK/DF/MF/FW) — kadro kompozisyonu tek bakista.
  const posCounts: Record<string, number> = {};
  for (const r of squad) posCounts[r.position_group] = (posCounts[r.position_group] ?? 0) + 1;
  const posOrder = ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"];

  const infoRows: [string, string | null][] = [
    [t("teamDetail.labelFounded"), profile?.founded_year ? String(profile.founded_year) : null],
    [t("teamDetail.labelStadium"), profile?.stadium_name ?? null],
    [
      t("teamDetail.labelCapacity"),
      profile?.capacity ? profile.capacity.toLocaleString("en-US") : null,
    ],
    [t("teamDetail.labelHeadCoach"), profile?.head_coach ?? null],
    [t("teamDetail.squadAvgAge"), avgAge],
    [t("teamDetail.squadForeigners"), squad.length ? `${foreigners} / ${squad.length}` : null],
    [
      t("teamDetail.squadAvgValue"),
      valued.length ? formatMarketValue(totalValue / valued.length) : null,
    ],
    [
      t("teamDetail.squadTopValue"),
      topPlayer
        ? `${topPlayer.player_name} · ${formatMarketValue(topPlayer.market_value_eur)}`
        : null,
    ],
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      {/* Buyuk logo: takim detay vitrinindeki hero kutusuyla ayni dil. */}
      <div className="flex flex-col items-center gap-4 border-b border-line bg-gradient-to-b from-card-2 to-card px-4 pb-5 pt-6 text-center">
        {logoPath ? (
          <div className="flex h-[160px] w-[160px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-card-2 to-canvas p-5">
            <Image
              src={logoPath}
              alt={teamName}
              width={120}
              height={120}
              className="h-full w-full object-contain"
            />
          </div>
        ) : null}
        <div>
          <div className="text-xl font-bold leading-tight tracking-tight text-ink">{teamName}</div>
          {squad.length ? (
            <div className="mt-1 text-[12px] text-ink-3">
              {t("teamDetail.squadSize")}: {squad.length}
              {totalValue > 0 ? ` · ${formatMarketValue(totalValue)}` : ""}
            </div>
          ) : null}
        </div>
        {/* Pozisyon dagilimi rozetleri */}
        {squad.length ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {posOrder
              .filter((p) => posCounts[p])
              .map((p) => (
                <span
                  key={p}
                  className="rounded-md border border-line bg-card px-2 py-1 text-[11px] font-medium text-ink-2"
                >
                  {getPositionGroupLabel(p, null, t)}{" "}
                  <span className="font-semibold text-ink">{posCounts[p]}</span>
                </span>
              ))}
          </div>
        ) : null}
      </div>
      <dl className="divide-y divide-line/60">
        {infoRows
          .filter(([, v]) => v != null && v !== "")
          .map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <dt className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">
                {label}
              </dt>
              <dd className="text-right text-[13px] font-semibold text-ink">{value}</dd>
            </div>
          ))}
      </dl>
      {profile?.website_url ? (
        <div className="border-t border-line px-4 py-2.5">
          <a
            href={profile.website_url}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-medium text-accent-ink transition hover:text-accent hover:underline"
          >
            {profile.website_url.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        </div>
      ) : null}
    </div>
  );
}

// Kadro: pozisyon grubuna gore bolumlenmis oyuncu kartlari (2 kolon).
function CurrentSquadCards({ rows }: { rows: TeamCurrentSquadRow[] }) {
  const { t } = useI18n();

  const groups: { key: string; rows: TeamCurrentSquadRow[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.key === row.position_group) last.rows.push(row);
    else groups.push({ key: row.position_group, rows: [row] });
  }

  return (
    <div className="rounded-xl border border-line bg-card">
      <div className="border-b border-line bg-veil px-3 py-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">
          {t("teamDetail.currentSquadTitle")}
        </div>
      </div>
      <div className="space-y-3 p-3">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              {getPositionGroupLabel(g.key, g.rows[0]?.position ?? null, t)}
            </div>
            <div className="grid gap-1.5 md:grid-cols-2">
              {g.rows.map((row) => (
                <div
                  key={row.player_source_id}
                  className="flex items-center gap-2.5 rounded-lg border border-line/70 bg-card-2/40 px-2.5 py-1.5"
                >
                  <span className="w-5 shrink-0 text-center text-[11px] font-semibold tabular-nums text-ink-3">
                    {row.shirt_number ?? "—"}
                  </span>
                  <PlayerAvatar photo={row.photo_url} name={row.player_name} />
                  <div className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {row.player_slug ? (
                        <PlayerLink
                          playerSlug={row.player_slug}
                          className="truncate text-[13px] font-medium text-accent-ink transition hover:text-accent hover:underline"
                          title={row.player_name}
                        >
                          {row.player_name}
                        </PlayerLink>
                      ) : (
                        <span
                          className="truncate text-[13px] font-medium text-ink"
                          title={t("teamDetail.playerPageNotYetAvailable")}
                        >
                          {row.player_name}
                        </span>
                      )}
                      <NationFlag nationality={row.nationality} />
                    </span>
                    <span className="block text-[11px] text-ink-3">
                      {row.position ?? getPositionGroupLabel(row.position_group, null, t)}
                      {row.age != null ? ` · ${row.age}` : ""}
                    </span>
                  </div>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-2">
                    {formatMarketValue(row.market_value_eur)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type SortKey =
  | "player_name"
  | "primary_position_code"
  | "appearances"
  | "starts"
  | "sub_appearances"
  | "starter_rate_pct"
  | "total_minutes"
  | "avg_minutes"
  | "goals"
  | "assists"
  | "last_match_datetime";

type SortDirection = "asc" | "desc";

const DEFAULT_DIRECTIONS: Record<SortKey, SortDirection> = {
  player_name: "asc",
  primary_position_code: "asc",
  appearances: "desc",
  starts: "desc",
  sub_appearances: "desc",
  starter_rate_pct: "desc",
  total_minutes: "desc",
  avg_minutes: "desc",
  goals: "desc",
  assists: "desc",
  last_match_datetime: "desc",
};

const POSITION_ORDER: Record<string, number> = {
  GK: 1,
  DF: 2,
  MF: 3,
  FW: 4,
  SUB: 5,
  OTHER: 6,
};

function compareText(a: string, b: string, direction: SortDirection) {
  return direction === "asc" ? a.localeCompare(b) : b.localeCompare(a);
}

function compareNumber(a: number, b: number, direction: SortDirection) {
  return direction === "asc" ? a - b : b - a;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function getSortIndicator(
  currentKey: SortKey,
  currentDirection: SortDirection,
  key: SortKey
) {
  if (currentKey !== key) return "";
  return currentDirection === "asc" ? " ↑" : " ↓";
}

function PlayerName({
  playerSlug,
  playerName,
}: {
  playerSlug: string | null | undefined;
  playerName: string;
}) {
  if (!playerSlug) {
    return <span>{playerName}</span>;
  }

  return (
    <PlayerLink
      playerSlug={playerSlug}
      className="font-medium text-accent-ink transition hover:text-accent hover:underline"
      title={playerName}
    >
      {playerName}
    </PlayerLink>
  );
}

function PlayerStatusBadge({ row }: { row: TeamSquadRow }) {
  const { t } = useI18n();

  if (row.current_team_slug === row.team_slug) {
    return null;
  }

  if (row.current_team_slug) {
    const currentTeam = row.current_team_name ?? row.current_team_slug;

    return (
      <span
        className="ml-2 rounded-full border border-warn/30 bg-warn/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-warn"
        title={t("teamDetail.nowPlaysForTooltip", { team: currentTeam })}
      >
        {t("common.nowAt", { team: currentTeam })}
      </span>
    );
  }

  return (
    <span
      className="ml-2 rounded-full border border-line bg-veil px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3"
      title={t("common.notInCurrentSquads")}
    >
      {t("common.leftClub")}
    </span>
  );
}

function getMetricSortValue(row: TeamSquadRow, sortKey: SortKey): number {
  if (sortKey === "last_match_datetime") {
    return row.last_match_datetime
      ? new Date(row.last_match_datetime).getTime()
      : 0;
  }

  if (sortKey === "starter_rate_pct") {
    return toNumber(row.starter_rate_pct);
  }

  if (sortKey === "avg_minutes") {
    return toNumber(row.avg_minutes);
  }

  if (sortKey === "appearances") return row.appearances;
  if (sortKey === "starts") return row.starts;
  if (sortKey === "sub_appearances") return row.sub_appearances;
  if (sortKey === "total_minutes") return row.total_minutes;
  if (sortKey === "goals") return row.goals;
  if (sortKey === "assists") return row.assists;

  return 0;
}

export function SquadPanel({
  rows = [],
  currentSquad = [],
  teamName = "",
  logoPath = null,
  profile = null,
}: SquadPanelProps) {
  const { t } = useI18n();
  const [sortKey, setSortKey] = useState<SortKey>("primary_position_code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Rozetler güncel kadro verisi olan takımlarda anlamlı; ligden düşen
  // takımlarda her satır "left club" olacağından gösterme.
  const showStatusBadges = currentSquad.length > 0;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(DEFAULT_DIRECTIONS[key]);
  }

  const sortedRows = useMemo(() => {
    const cloned = [...rows];

    cloned.sort((a, b) => {
      if (sortKey === "primary_position_code") {
        const aOrder = POSITION_ORDER[a.primary_position_code] ?? 999;
        const bOrder = POSITION_ORDER[b.primary_position_code] ?? 999;

        const byPosition = compareNumber(aOrder, bOrder, sortDirection);
        if (byPosition !== 0) return byPosition;

        const byStarts = compareNumber(a.starts, b.starts, "desc");
        if (byStarts !== 0) return byStarts;

        const byApps = compareNumber(a.appearances, b.appearances, "desc");
        if (byApps !== 0) return byApps;

        return compareText(a.player_name, b.player_name, "asc");
      }

      if (sortKey === "player_name") {
        return compareText(a.player_name, b.player_name, sortDirection);
      }

      const aValue = getMetricSortValue(a, sortKey);
      const bValue = getMetricSortValue(b, sortKey);

      const byMetric = compareNumber(aValue, bValue, sortDirection);
      if (byMetric !== 0) return byMetric;

      return compareText(a.player_name, b.player_name, "asc");
    });

    return cloned;
  }, [rows, sortKey, sortDirection]);

  if (rows.length === 0 && currentSquad.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-veil px-4 py-3 text-sm text-ink-2">
        {t("teamDetail.noSquadData")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {currentSquad.length > 0 ? (
        // Duseyde 3 parca: 1. parca takim + genel bilgiler (drawer benzeri,
        // varsayilan acik), kalan 2 parca oyuncu kartlari.
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <TeamInfoCard
            teamName={teamName || currentSquad[0]?.team_name || ""}
            logoPath={logoPath}
            profile={profile}
            squad={currentSquad}
          />
          <div className="lg:col-span-2">
            <CurrentSquadCards rows={currentSquad} />
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="rounded-xl border border-line">
          <div className="border-b border-line bg-veil px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">
              {t("teamDetail.seasonMatchStatsTitle")}
              {rows[0]?.season_label ? ` · ${rows[0].season_label}` : ""}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
        <thead className="bg-veil">
          <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
            <th className="px-3 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("player_name")}
                className="cursor-pointer select-none"
              >
                {t("common.player")}
                {getSortIndicator(sortKey, sortDirection, "player_name")}
              </button>
            </th>

            <th className="px-3 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("primary_position_code")}
                className="cursor-pointer select-none"
              >
                {t("teamDetail.colPosition")}
                {getSortIndicator(sortKey, sortDirection, "primary_position_code")}
              </button>
            </th>

            <th className="px-3 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("appearances")}
                className="cursor-pointer select-none"
              >
                {t("common.appearances")}
                {getSortIndicator(sortKey, sortDirection, "appearances")}
              </button>
            </th>

            <th className="px-3 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("starts")}
                className="cursor-pointer select-none"
              >
                {t("common.starts")}
                {getSortIndicator(sortKey, sortDirection, "starts")}
              </button>
            </th>

            <th className="px-3 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("sub_appearances")}
                className="cursor-pointer select-none"
              >
                {t("teamDetail.colSub")}
                {getSortIndicator(sortKey, sortDirection, "sub_appearances")}
              </button>
            </th>

            <th className="px-3 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("starter_rate_pct")}
                className="cursor-pointer select-none"
              >
                {t("teamDetail.colStarterPct")}
                {getSortIndicator(sortKey, sortDirection, "starter_rate_pct")}
              </button>
            </th>

            <th className="px-3 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("total_minutes")}
                className="cursor-pointer select-none"
              >
                {t("teamDetail.colMinutesFull")}
                {getSortIndicator(sortKey, sortDirection, "total_minutes")}
              </button>
            </th>

            <th className="px-3 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("avg_minutes")}
                className="cursor-pointer select-none"
              >
                {t("common.avgMinutes")}
                {getSortIndicator(sortKey, sortDirection, "avg_minutes")}
              </button>
            </th>

            <th className="px-3 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("goals")}
                className="cursor-pointer select-none"
              >
                {t("common.goals")}
                {getSortIndicator(sortKey, sortDirection, "goals")}
              </button>
            </th>

            <th className="px-3 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("assists")}
                className="cursor-pointer select-none"
              >
                {t("common.assists")}
                {getSortIndicator(sortKey, sortDirection, "assists")}
              </button>
            </th>

            <th className="px-3 py-2 font-medium">
              <button
                type="button"
                onClick={() => handleSort("last_match_datetime")}
                className="cursor-pointer select-none"
              >
                {t("teamDetail.colLastMatch")}
                {getSortIndicator(sortKey, sortDirection, "last_match_datetime")}
              </button>
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={row.player_source_id}
              className="border-t border-line text-[13px] text-ink-2 transition hover:bg-veil"
            >
              <td className="px-3 py-1.5 font-medium whitespace-nowrap text-ink">
                <PlayerName
                  playerSlug={row.player_slug}
                  playerName={row.player_name}
                />
                {showStatusBadges ? <PlayerStatusBadge row={row} /> : null}
              </td>

              <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                {row.primary_position_code}
              </td>

              <td className="px-3 py-1.5 whitespace-nowrap">{row.appearances}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{row.starts}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{row.sub_appearances}</td>

              <td className="px-3 py-1.5 whitespace-nowrap">
                {formatDecimal(row.starter_rate_pct)}%
              </td>

              <td className="px-3 py-1.5 whitespace-nowrap">{row.total_minutes}</td>

              <td className="px-3 py-1.5 whitespace-nowrap">
                {formatDecimal(row.avg_minutes)}
              </td>

              <td className="px-3 py-1.5 whitespace-nowrap">{row.goals}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{row.assists}</td>

              <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                {formatDate(row.last_match_datetime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}