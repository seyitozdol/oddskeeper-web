"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import PlayerLink from "@/components/links/PlayerLink";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { getTeamDetailHref } from "@/lib/routes";
import { canonicalNationality, getCountryFlagUrl } from "@/lib/country-flags";
import type {
  PlayerStatsListRow,
  TslAdvancedRow,
} from "@/features/player-stats/types";

type Basis = "total" | "per90" | "per_match";
type MetricGroup = "general" | "attack" | "passing" | "defense" | "physical";

const GROUPS: { value: MetricGroup; labelKey: string }[] = [
  { value: "general", labelKey: "statsHub.metricGroupGeneral" },
  { value: "attack", labelKey: "statsHub.metricGroupAttack" },
  { value: "passing", labelKey: "statsHub.metricGroupPassing" },
  { value: "defense", labelKey: "statsHub.metricGroupDefense" },
  { value: "physical", labelKey: "statsHub.metricGroupPhysical" },
];

type Col = { key: string; labelKey: string; dec?: 0 | 1 | 2; perEligible?: boolean };

// Genel tablo kolonlari
const GENERAL_COLS: Col[] = [
  { key: "appearances", labelKey: "common.appearances" },
  { key: "starts", labelKey: "common.starts" },
  { key: "goals", labelKey: "common.goals", perEligible: true },
  { key: "assists", labelKey: "common.assists", perEligible: true },
  { key: "total_minutes", labelKey: "common.minutes" },
  { key: "xg", labelKey: "statsHub.xg", dec: 2, perEligible: true },
  { key: "xgot", labelKey: "statsHub.xgot", dec: 2, perEligible: true },
  { key: "xa", labelKey: "statsHub.xa", dec: 2, perEligible: true },
  { key: "yellowCards", labelKey: "statsHub.yellowCards", perEligible: true },
  { key: "redCards", labelKey: "statsHub.redCards", perEligible: true },
];

const ADVANCED_COLS: Record<Exclude<MetricGroup, "general">, Col[]> = {
  attack: [
    { key: "xgot", labelKey: "statsHub.xgot", dec: 2, perEligible: true },
    { key: "xa", labelKey: "statsHub.xa", dec: 2, perEligible: true },
    { key: "key_passes", labelKey: "statsHub.keyPasses", perEligible: true },
    { key: "big_chances_created", labelKey: "statsHub.bigChancesCreated", perEligible: true },
    { key: "big_chances_missed", labelKey: "statsHub.bigChancesMissed", perEligible: true },
    { key: "dribbles_won", labelKey: "statsHub.dribblesWon", perEligible: true },
    { key: "dribbles_attempted", labelKey: "statsHub.dribblesAttempted", perEligible: true },
  ],
  passing: [
    { key: "long_balls", labelKey: "statsHub.longBalls", perEligible: true },
    { key: "accurate_long_balls", labelKey: "statsHub.accurateLongBalls", perEligible: true },
    { key: "key_passes", labelKey: "statsHub.keyPasses", perEligible: true },
    { key: "big_chances_created", labelKey: "statsHub.bigChancesCreated", perEligible: true },
  ],
  defense: [
    { key: "duels_won", labelKey: "statsHub.duelsWon", perEligible: true },
    { key: "duels_lost", labelKey: "statsHub.duelsLost", perEligible: true },
    { key: "aerials_won", labelKey: "statsHub.aerialsWon", perEligible: true },
    { key: "clearances", labelKey: "statsHub.clearances", perEligible: true },
    { key: "ball_recoveries", labelKey: "statsHub.ballRecoveries", perEligible: true },
  ],
  physical: [
    { key: "km_covered", labelKey: "statsHub.kmCovered", dec: 1, perEligible: true },
    { key: "sprints", labelKey: "statsHub.sprints", perEligible: true },
    { key: "top_speed", labelKey: "statsHub.topSpeed", dec: 1 },
  ],
};

const POSITIONS = [
  { value: "ALL", labelKey: "statsHub.allPositions" },
  { value: "GK", labelKey: "common.goalkeepers" },
  { value: "DF", labelKey: "common.defenders" },
  { value: "MF", labelKey: "common.midfielders" },
  { value: "FW", labelKey: "common.forwards" },
];

const PAGE_SIZE = 100;

function norm(v: string) {
  return v.toLocaleLowerCase("tr").normalize("NFKD").replace(/\p{M}/gu, "").replace(/ı/g, "i");
}

export default function ResmiPlayers({
  rows,
  advancedRows = [],
  teamLogos = {},
  season,
}: {
  rows: PlayerStatsListRow[];
  advancedRows?: TslAdvancedRow[];
  teamLogos?: Record<string, string>;
  season: string;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("ALL");
  const [hideDeparted, setHideDeparted] = useState(false);
  const [group, setGroup] = useState<MetricGroup>("general");
  const [basis, setBasis] = useState<Basis>("total");
  const [sortKey, setSortKey] = useState("goals");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const advByKey = useMemo(() => {
    const m = new Map<string, TslAdvancedRow>();
    for (const r of advancedRows) m.set(`${r.season_label}|${r.opta_player_id}`, r);
    return m;
  }, [advancedRows]);

  const getRaw = useCallback(
    (row: PlayerStatsListRow, key: string): number | null => {
      // genel alanlar dogrudan satirdan
      const direct: Record<string, number | null> = {
        appearances: row.appearances,
        starts: row.starts,
        goals: row.goals,
        assists: row.assists,
        total_minutes: row.total_minutes,
        xg: row.xg,
        xgot: row.xgot,
        xa: row.xa,
        yellowCards: row.yellowCards,
        redCards: row.redCards,
      };
      if (key in direct) return direct[key];
      // gelismis alanlar sezon bazli advanced mat'tan
      const adv = row.opta_player_id ? advByKey.get(`${season}|${row.opta_player_id}`) : undefined;
      const v = adv ? (adv as unknown as Record<string, number | null>)[key] : null;
      return v ?? null;
    },
    [advByKey, season]
  );

  const applyBasis = useCallback(
    (row: PlayerStatsListRow, raw: number | null, perEligible?: boolean): number | null => {
      if (raw == null) return null;
      if (basis === "total" || !perEligible) return raw;
      if (basis === "per_match") {
        return row.appearances > 0 ? raw / row.appearances : null;
      }
      // per90
      return row.total_minutes > 0 ? (raw / row.total_minutes) * 90 : null;
    },
    [basis]
  );

  const cols = group === "general" ? GENERAL_COLS : ADVANCED_COLS[group];

  const filtered = useMemo(() => {
    const tokens = norm(search).split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (hideDeparted && !r.in_current_squad) return false;
      if (position !== "ALL" && r.position_code !== position) return false;
      if (tokens.length === 0) return true;
      const hay = norm([r.player_name, r.full_name, r.team_name].filter(Boolean).join(" "));
      return tokens.every((tk) => hay.includes(tk));
    });
  }, [rows, search, position, hideDeparted]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (sortKey === "player_name") {
        return dir * (a.full_name ?? a.player_name).localeCompare(b.full_name ?? b.player_name, "tr");
      }
      if (sortKey === "team_name") {
        return dir * (a.team_name ?? "").localeCompare(b.team_name ?? "", "tr");
      }
      const col = cols.find((c) => c.key === sortKey);
      const av = applyBasis(a, getRaw(a, sortKey), col?.perEligible);
      const bv = applyBasis(b, getRaw(b, sortKey), col?.perEligible);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return dir * (av - bv);
    });
    return arr;
  }, [filtered, sortKey, sortDir, cols, applyBasis, getRaw]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "player_name" || key === "team_name" ? "asc" : "desc");
    }
    setPage(0);
  };

  const fmt = (row: PlayerStatsListRow, col: Col): string => {
    const v = applyBasis(row, getRaw(row, col.key), col.perEligible);
    if (v == null) return "—";
    const dec = basis !== "total" && col.perEligible ? 2 : (col.dec ?? 0);
    return dec ? v.toFixed(dec) : String(Math.round(v));
  };

  const chip = (active: boolean) =>
    `rounded-md border px-2.5 py-1 text-[12px] transition ${
      active ? "border-line-strong bg-card-2 text-ink" : "border-line bg-veil text-ink-2 hover:border-line-strong hover:text-ink"
    }`;

  return (
    <div className="space-y-3">
      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder={t("statsHub.searchPlaceholder")}
          className="w-full max-w-[260px] rounded-lg border border-line bg-field px-3 py-1.5 text-[13px] text-ink outline-none focus:border-line-strong"
        />
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map((p) => (
            <button key={p.value} type="button" onClick={() => { setPosition(p.value); setPage(0); }} className={chip(position === p.value)}>
              {t(p.labelKey)}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-2">
          <input
            type="checkbox"
            checked={hideDeparted}
            onChange={(e) => { setHideDeparted(e.target.checked); setPage(0); }}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          {t("statsHub.hideDeparted")}
        </label>
      </div>

      {/* Metrik gruplari + basis */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => {
                setGroup(g.value);
                const first = g.value === "general" ? "goals" : ADVANCED_COLS[g.value][0].key;
                setSortKey(first);
                setSortDir("desc");
              }}
              className={chip(group === g.value)}
            >
              {t(g.labelKey)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-line bg-veil p-0.5">
          {(["total", "per90", "per_match"] as Basis[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBasis(b)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition ${basis === b ? "bg-card-2 text-ink" : "text-ink-3 hover:text-ink-2"}`}
            >
              {b === "total" ? t("tsl.basisTotal") : b === "per90" ? t("tsl.basisPer90") : t("tsl.basisPerMatch")}
            </button>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-ink-3">
        {t("tsl.season")} {group === "general" ? "2025/2026" : season} · {sorted.length}{" "}
        {sorted.length === 1 ? t("tsl.player") : t("tsl.sectionPlayers")}
      </div>

      {/* Tablo */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[10px] uppercase tracking-[0.08em] text-ink-3">
                <Th onClick={() => toggleSort("player_name")} active={sortKey === "player_name"} dir={sortDir}>
                  {t("tsl.player")}
                </Th>
                <Th onClick={() => toggleSort("team_name")} active={sortKey === "team_name"} dir={sortDir}>
                  {t("tsl.team")}
                </Th>
                <th className="px-2 py-2 text-center font-medium">{t("tsl.position")}</th>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className={`cursor-pointer select-none px-2 py-2 text-center font-medium transition hover:text-ink-2 ${sortKey === c.key ? "text-ink" : ""}`}
                  >
                    {t(c.labelKey)}
                    {sortKey === c.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={3 + cols.length} className="px-4 py-10 text-center text-[13px] text-ink-3">
                    {t("statsHub.noPlayersMatch")}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.player_slug} className="border-b border-line/50 last:border-0 hover:bg-veil">
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar row={row} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <PlayerLink
                              playerSlug={row.player_slug}
                              className="truncate text-[13px] font-medium text-accent-ink hover:text-accent hover:underline"
                              title={row.full_name ?? row.player_name}
                            >
                              {row.full_name ?? row.player_name}
                            </PlayerLink>
                            <Flag nationality={row.nationality} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <TeamCell row={row} teamLogos={teamLogos} leftLabel={t("common.leftClub")} />
                    </td>
                    <td className="px-2 py-1.5 text-center text-[12px] text-ink-2">{row.position_code}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="px-2 py-1.5 text-center tabular-nums text-ink-2">
                        {fmt(row, c)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Sayfalama */}
        {pageCount > 1 ? (
          <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[12px]">
            <span className="text-ink-3">
              {t("tsl.page")} {safePage + 1}/{pageCount}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-md border border-line bg-veil px-2 py-1 text-ink-2 transition hover:text-ink disabled:opacity-40"
              >
                ‹
              </button>
              {Array.from({ length: pageCount }, (_, i) => i)
                .filter((i) => Math.abs(i - safePage) <= 2 || i === 0 || i === pageCount - 1)
                .map((i, idx, arr) => (
                  <span key={i} className="flex items-center">
                    {idx > 0 && i - arr[idx - 1] > 1 ? <span className="px-1 text-ink-3">…</span> : null}
                    <button
                      type="button"
                      onClick={() => setPage(i)}
                      className={`rounded-md px-2 py-1 tabular-nums transition ${i === safePage ? "bg-card-2 font-semibold text-ink" : "text-ink-3 hover:text-ink-2"}`}
                    >
                      {i + 1}
                    </button>
                  </span>
                ))}
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                className="rounded-md border border-line bg-veil px-2 py-1 text-ink-2 transition hover:text-ink disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-[11px] text-ink-3">{t("tsl.dataNote")}</p>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
}) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none px-2 py-2 font-medium transition hover:text-ink-2 ${active ? "text-ink" : ""}`}
    >
      {children}
      {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

function Avatar({ row }: { row: PlayerStatsListRow }) {
  const name = row.full_name ?? row.player_name;
  if (!row.photo_url) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-veil text-[11px] font-semibold text-ink-3">
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <Image
      src={row.photo_url}
      alt={name}
      width={32}
      height={32}
      className="h-8 w-8 shrink-0 rounded-full border border-line bg-veil object-cover"
    />
  );
}

function Flag({ nationality }: { nationality: string | null }) {
  if (!nationality) return null;
  const url = getCountryFlagUrl(nationality);
  if (!url) return null;
  return (
    <Image
      src={url}
      alt={canonicalNationality(nationality) ?? nationality}
      width={16}
      height={12}
      className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
    />
  );
}

function TeamCell({
  row,
  teamLogos,
  leftLabel,
}: {
  row: PlayerStatsListRow;
  teamLogos: Record<string, string>;
  leftLabel: string;
}) {
  const href = getTeamDetailHref(row.team_slug);
  const logo = row.team_slug ? teamLogos[row.team_slug] : undefined;
  const content = (
    <span className="inline-flex items-center gap-2">
      {logo ? (
        <Image src={logo} alt="" width={18} height={18} className="h-[18px] w-[18px] shrink-0 object-contain" />
      ) : null}
      <span className="text-[12px]">{row.team_name ?? "—"}</span>
    </span>
  );
  const node = href ? (
    <Link href={href} className="text-ink-2 transition hover:text-ink hover:underline">
      {content}
    </Link>
  ) : (
    content
  );
  if (row.in_current_squad) return node;
  return (
    <span className="inline-flex items-center gap-1.5">
      {node}
      <span className="rounded-full border border-line bg-veil px-1.5 py-0.5 text-[9px] uppercase text-ink-3">
        {leftLabel}
      </span>
    </span>
  );
}
