"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { metricLabel } from "@/lib/i18n/metricLabel";
import { canonicalNationality, getCountryFlagUrl } from "@/lib/country-flags";
import { normalizeSearch } from "@/features/tsl/lib";
import type { ResmiPlayersBundle } from "@/features/tsl/server/resmiLoaders";
import type { ResmiPlayerRow } from "@/features/tsl/server/resmi";

type Basis = "total" | "per90" | "per_match";
type Group = "general" | "attack" | "passing" | "defense" | "physical";

type Fmt = "int" | "dec1" | "dec2" | "pct";
type Col = { key: string; fmt: Fmt };

const GROUPS: { value: Group; labelKey: string }[] = [
  { value: "general", labelKey: "statsHub.metricGroupGeneral" },
  { value: "attack", labelKey: "statsHub.metricGroupAttack" },
  { value: "passing", labelKey: "statsHub.metricGroupPassing" },
  { value: "defense", labelKey: "statsHub.metricGroupDefense" },
  { value: "physical", labelKey: "statsHub.metricGroupPhysical" },
];

const COLS: Record<Group, Col[]> = {
  general: [
    { key: "appearances", fmt: "int" },
    { key: "starts", fmt: "int" },
    { key: "goals_total", fmt: "int" },
    { key: "assists_total", fmt: "int" },
    { key: "total_minutes", fmt: "int" },
    { key: "expected_goals_total", fmt: "dec2" },
    { key: "expected_goals_on_target_total", fmt: "dec2" },
    { key: "expected_assists_total", fmt: "dec2" },
    { key: "cards_yellow_total", fmt: "int" },
    { key: "cards_red_total", fmt: "int" },
    { key: "rating_avg", fmt: "dec2" },
  ],
  attack: [
    { key: "goals_total", fmt: "int" },
    { key: "expected_goals_total", fmt: "dec2" },
    { key: "expected_goals_on_target_total", fmt: "dec2" },
    { key: "assists_total", fmt: "int" },
    { key: "expected_assists_total", fmt: "dec2" },
    { key: "shots_total", fmt: "int" },
    { key: "key_passes_total", fmt: "int" },
    { key: "big_chances_created_total", fmt: "int" },
    { key: "dribbles_won_total", fmt: "int" },
  ],
  passing: [
    { key: "passes_total", fmt: "int" },
    { key: "accurate_pass_total", fmt: "int" },
    { key: "pass_accuracy_pct", fmt: "pct" },
    { key: "key_passes_total", fmt: "int" },
    { key: "long_balls_total", fmt: "int" },
  ],
  defense: [
    { key: "tackles_total", fmt: "int" },
    { key: "interceptions_total", fmt: "int" },
    { key: "clearances_total", fmt: "int" },
    { key: "ball_recoveries_total", fmt: "int" },
    { key: "duels_won_total", fmt: "int" },
    { key: "aerials_won_total", fmt: "int" },
  ],
  physical: [
    { key: "km_covered_total", fmt: "dec1" },
    { key: "sprints_total", fmt: "int" },
    { key: "top_speed", fmt: "dec1" },
  ],
};

const GROUP_DEFAULT_SORT: Record<Group, string> = {
  general: "goals_total",
  attack: "goals_total",
  passing: "passes_total",
  defense: "tackles_total",
  physical: "km_covered_total",
};

const POSITIONS = [
  { value: "ALL", labelKey: "statsHub.allPositions" },
  { value: "G", labelKey: "common.goalkeepers" },
  { value: "D", labelKey: "common.defenders" },
  { value: "M", labelKey: "common.midfielders" },
  { value: "F", labelKey: "common.forwards" },
];

const PAGE_SIZE = 100;

const POS_SHORT: Record<string, string> = { G: "KL", D: "DF", M: "OS", F: "FV" };

export default function ResmiPlayers({ data }: { data: ResmiPlayersBundle }) {
  const { t } = useI18n();
  const { rows, season } = data;

  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("ALL");
  const [hideDeparted, setHideDeparted] = useState(false);
  const [group, setGroup] = useState<Group>("general");
  const [basis, setBasis] = useState<Basis>("total");
  const [sortKey, setSortKey] = useState("goals_total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const cols = COLS[group];

  const pick = (row: ResmiPlayerRow, key: string): number | null => {
    const m = row.metrics[key];
    if (!m) return null;
    if (basis === "per90") return m.per90 ?? m.total;
    if (basis === "per_match") return m.perMatch ?? m.total;
    return m.total;
  };

  const filtered = useMemo(() => {
    const tokens = normalizeSearch(search).split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (hideDeparted && !r.inCurrentSquad) return false;
      if (position !== "ALL" && (r.positionCode ?? "").toUpperCase() !== position) return false;
      if (!tokens.length) return true;
      const hay = normalizeSearch([r.name, r.teamName].filter(Boolean).join(" "));
      return tokens.every((tk) => hay.includes(tk));
    });
  }, [rows, search, position, hideDeparted]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name, "tr");
      if (sortKey === "team") return dir * (a.teamName ?? "").localeCompare(b.teamName ?? "", "tr");
      const av = pick(a, sortKey);
      const bv = pick(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return dir * (av - bv);
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, basis]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" || key === "team" ? "asc" : "desc");
    }
    setPage(0);
  };

  const fmtVal = (row: ResmiPlayerRow, col: Col): string => {
    const v = pick(row, col.key);
    if (v == null) return "—";
    if (col.fmt === "pct") return `${v.toFixed(1)}%`;
    if (col.fmt === "dec2") return v.toFixed(2);
    if (col.fmt === "dec1") return v.toFixed(1);
    return String(Math.round(v));
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
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
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
          <input type="checkbox" checked={hideDeparted} onChange={(e) => { setHideDeparted(e.target.checked); setPage(0); }} className="h-3.5 w-3.5 accent-[var(--accent)]" />
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
              onClick={() => { setGroup(g.value); setSortKey(GROUP_DEFAULT_SORT[g.value]); setSortDir("desc"); setPage(0); }}
              className={chip(group === g.value)}
            >
              {t(g.labelKey)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-line bg-veil p-0.5">
          {(["total", "per90", "per_match"] as Basis[]).map((b) => (
            <button key={b} type="button" onClick={() => setBasis(b)} className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition ${basis === b ? "bg-card-2 text-ink" : "text-ink-3 hover:text-ink-2"}`}>
              {b === "total" ? t("tsl.basisTotal") : b === "per90" ? t("tsl.basisPer90") : t("tsl.basisPerMatch")}
            </button>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-ink-3">
        {t("tsl.season")} {season} · {sorted.length} {t("tsl.sectionPlayers")}
      </div>

      {/* Tablo */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[10px] uppercase tracking-[0.08em] text-ink-3">
                <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>{t("tsl.player")}</Th>
                <Th onClick={() => toggleSort("team")} active={sortKey === "team"} dir={sortDir}>{t("tsl.team")}</Th>
                <th className="px-2 py-2 text-center font-medium">{t("tsl.position")}</th>
                {cols.map((c) => (
                  <th key={c.key} onClick={() => toggleSort(c.key)} className={`cursor-pointer select-none px-2 py-2 text-center font-medium transition hover:text-ink-2 ${sortKey === c.key ? "text-ink" : ""}`}>
                    {metricLabel(t, c.key, c.key)}
                    {sortKey === c.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={3 + cols.length} className="px-4 py-10 text-center text-[13px] text-ink-3">{t("statsHub.noPlayersMatch")}</td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.playerId} className="border-b border-line/50 last:border-0 hover:bg-veil">
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar photo={row.photo} name={row.name} />
                        <div className="flex items-center gap-1.5">
                          {row.playerHref ? (
                            <Link href={row.playerHref} className="truncate text-[13px] font-medium text-accent-ink hover:text-accent hover:underline" title={row.name}>
                              {row.name}
                            </Link>
                          ) : (
                            <span className="truncate text-[13px] font-medium text-ink" title={row.name}>{row.name}</span>
                          )}
                          <Flag nationality={row.nationality} />
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <TeamCell name={row.teamName} logo={row.teamLogo} href={row.teamHref} />
                    </td>
                    <td className="px-2 py-1.5 text-center text-[12px] text-ink-2">{POS_SHORT[(row.positionCode ?? "").toUpperCase()] ?? row.positionCode ?? "—"}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="px-2 py-1.5 text-center tabular-nums text-ink-2">{fmtVal(row, c)}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 ? (
          <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[12px]">
            <span className="text-ink-3">{t("tsl.page")} {safePage + 1}/{pageCount}</span>
            <div className="flex items-center gap-1">
              <button type="button" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-md border border-line bg-veil px-2 py-1 text-ink-2 transition hover:text-ink disabled:opacity-40">‹</button>
              {Array.from({ length: pageCount }, (_, i) => i)
                .filter((i) => Math.abs(i - safePage) <= 2 || i === 0 || i === pageCount - 1)
                .map((i, idx, arr) => (
                  <span key={i} className="flex items-center">
                    {idx > 0 && i - arr[idx - 1] > 1 ? <span className="px-1 text-ink-3">…</span> : null}
                    <button type="button" onClick={() => setPage(i)} className={`rounded-md px-2 py-1 tabular-nums transition ${i === safePage ? "bg-card-2 font-semibold text-ink" : "text-ink-3 hover:text-ink-2"}`}>{i + 1}</button>
                  </span>
                ))}
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} className="rounded-md border border-line bg-veil px-2 py-1 text-ink-2 transition hover:text-ink disabled:opacity-40">›</button>
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-[11px] text-ink-3">{t("tsl.dataNote")}</p>
    </div>
  );
}

function Th({ children, onClick, active, dir }: { children: React.ReactNode; onClick: () => void; active: boolean; dir: "asc" | "desc" }) {
  return (
    <th onClick={onClick} className={`cursor-pointer select-none px-2 py-2 font-medium transition hover:text-ink-2 ${active ? "text-ink" : ""}`}>
      {children}{active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

function Avatar({ photo, name }: { photo: string | null; name: string }) {
  if (!photo) {
    return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-veil text-[11px] font-semibold text-ink-3">{name.slice(0, 1).toUpperCase()}</span>;
  }
  return <Image src={photo} alt={name} width={32} height={32} className="h-8 w-8 shrink-0 rounded-full border border-line bg-veil object-cover" />;
}

function Flag({ nationality }: { nationality: string | null }) {
  if (!nationality) return null;
  const url = getCountryFlagUrl(nationality);
  if (!url) return null;
  return <Image src={url} alt={canonicalNationality(nationality) ?? nationality} width={16} height={12} className="h-3 w-4 shrink-0 rounded-[2px] object-cover" />;
}

function TeamCell({ name, logo, href }: { name: string | null; logo: string | null; href: string | null }) {
  const content = (
    <span className="inline-flex items-center gap-2">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-[18px] w-[18px] shrink-0 object-contain" loading="lazy" />
      ) : null}
      <span className="text-[12px]">{name ?? "—"}</span>
    </span>
  );
  return href ? <Link href={href} className="text-ink-2 transition hover:text-ink hover:underline">{content}</Link> : content;
}
