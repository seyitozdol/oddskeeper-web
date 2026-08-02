"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { vbwPhotoUrl, fivbFlagUrl } from "../lib";
import type { VbLeaderboardRow, VbMatch, VbFixture } from "../types";

type Tab = "players" | "results" | "fixtures" | "tools";

type Props = {
  competitionId: number;
  leaderboard: VbLeaderboardRow[];
  matches: VbMatch[];
  fixtures: VbFixture[];
  initialTab?: Tab;
};

function ageOf(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a -= 1;
  return a;
}

const num = (v: number | null | undefined) => (v == null ? "—" : String(v));

export default function VolleyballExplorer({
  competitionId,
  leaderboard,
  matches,
  fixtures,
  initialTab = "players",
}: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>(initialTab);
  // Varsayilan Turkiye odakli (kullanici istegi).
  const [turkeyOnly, setTurkeyOnly] = useState(true);

  const tabs: { key: Tab; label: string }[] = [
    { key: "players", label: t("volleyball.tabPlayers") },
    { key: "results", label: t("volleyball.tabResults") },
    { key: "fixtures", label: t("volleyball.tabFixtures") },
  ];

  const rows = useMemo(
    () =>
      turkeyOnly
        ? leaderboard.filter((r) => r.team_code === "TUR")
        : leaderboard,
    [leaderboard, turkeyOnly]
  );

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
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
          href="/dashboard/volleyball/tools"
          className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-veil"
        >
          {t("volleyball.tabTools")}
        </Link>
      </div>

      {tab === "players" && (
        <PlayersTab
          rows={rows}
          competitionId={competitionId}
          turkeyOnly={turkeyOnly}
          setTurkeyOnly={setTurkeyOnly}
        />
      )}
      {tab === "results" && (
        <ResultsTab matches={matches} />
      )}
      {tab === "fixtures" && <FixturesTab fixtures={fixtures} />}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3 ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

type SortKey =
  | "player" | "team" | "pos" | "age" | "ht"
  | "pts" | "atk" | "blk" | "srv" | "dig" | "rec" | "set";

type ColDef = {
  key: SortKey;
  label: string;
  tip: string;
  align: "left" | "right";
  kind: "num" | "text";
  get: (r: VbLeaderboardRow) => number | string | null;
};

function PlayersTab({
  rows,
  competitionId,
  turkeyOnly,
  setTurkeyOnly,
}: {
  rows: VbLeaderboardRow[];
  competitionId: number;
  turkeyOnly: boolean;
  setTurkeyOnly: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const [sortKey, setSortKey] = useState<SortKey>("pts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const cols: ColDef[] = [
    { key: "player", label: t("volleyball.thPlayer"), tip: t("volleyball.tipPlayer"), align: "left", kind: "text", get: (r) => r.full_name ?? r.short_name ?? String(r.fivb_id) },
    { key: "team", label: t("volleyball.thTeam"), tip: t("volleyball.tipTeam"), align: "left", kind: "text", get: (r) => r.team_code },
    { key: "pos", label: t("volleyball.thPos"), tip: t("volleyball.tipPos"), align: "left", kind: "text", get: (r) => r.position },
    { key: "age", label: t("volleyball.thAge"), tip: t("volleyball.tipAge"), align: "right", kind: "num", get: (r) => ageOf(r.birth_date) },
    { key: "ht", label: t("volleyball.thHt"), tip: t("volleyball.tipHt"), align: "right", kind: "num", get: (r) => r.height_cm },
    { key: "pts", label: t("volleyball.thPts"), tip: t("volleyball.tipPts"), align: "right", kind: "num", get: (r) => r.points },
    { key: "atk", label: t("volleyball.thAtk"), tip: t("volleyball.tipAtk"), align: "right", kind: "num", get: (r) => r.attack_points },
    { key: "blk", label: t("volleyball.thBlk"), tip: t("volleyball.tipBlk"), align: "right", kind: "num", get: (r) => r.block_points },
    { key: "srv", label: t("volleyball.thSrv"), tip: t("volleyball.tipSrv"), align: "right", kind: "num", get: (r) => r.serve_points },
    { key: "dig", label: t("volleyball.thDig"), tip: t("volleyball.tipDig"), align: "right", kind: "num", get: (r) => r.dig_digs },
    { key: "rec", label: t("volleyball.thRec"), tip: t("volleyball.tipRec"), align: "right", kind: "num", get: (r) => r.rec_success },
    { key: "set", label: t("volleyball.thSet"), tip: t("volleyball.tipSet"), align: "right", kind: "num", get: (r) => r.set_successful },
  ];

  const activeCol = cols.find((c) => c.key === sortKey) ?? cols[5];
  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = activeCol.get(a);
      const vb = activeCol.get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // null'lar her zaman sonda
      if (vb == null) return -1;
      const cmp =
        activeCol.kind === "num"
          ? (va as number) - (vb as number)
          : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, activeCol, sortDir]);

  const onSort = (c: ColDef) => {
    if (c.key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(c.key);
      setSortDir(c.kind === "num" ? "desc" : "asc");
    }
  };

  if (rows.length === 0)
    return <p className="text-sm text-ink-3">{t("volleyball.noPlayers")}</p>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs text-ink-3">
          {rows.length} {t("volleyball.players")}
        </span>
        <div className="inline-flex rounded-lg border border-line bg-card-2 p-0.5">
          <button
            onClick={() => setTurkeyOnly(true)}
            className={`rounded-md px-3 py-1 text-[11px] font-semibold transition ${
              turkeyOnly ? "bg-accent text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            {t("volleyball.turkeyOnly")}
          </button>
          <button
            onClick={() => setTurkeyOnly(false)}
            className={`rounded-md px-3 py-1 text-[11px] font-semibold transition ${
              !turkeyOnly ? "bg-accent text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            {t("volleyball.allTeams")}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line">
              <Th>{t("volleyball.thRank")}</Th>
              {cols.map((c) => {
                const active = c.key === sortKey;
                return (
                  <th
                    key={c.key}
                    title={c.tip}
                    onClick={() => onSort(c)}
                    aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    className={`cursor-pointer select-none px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] transition hover:text-ink ${
                      c.align === "right" ? "text-right" : "text-left"
                    } ${active ? "text-ink" : "text-ink-3"}`}
                  >
                    {c.label}
                    <span className="ml-0.5 inline-block w-2 text-accent-ink">
                      {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const isTur = r.team_code === "TUR";
              return (
                <tr
                  key={r.fivb_id}
                  className={`border-b border-line/60 transition hover:bg-veil ${
                    isTur ? "bg-card-2/40" : ""
                  }`}
                >
                  <td className="px-2 py-1.5 text-ink-3">{i + 1}</td>
                  {cols.map((c) => {
                    const v = c.get(r);
                    if (c.key === "player") {
                      const photo = vbwPhotoUrl(r.vbw_photo) ?? (r.sofascore_player_id ? `https://img.sofascore.com/api/v1/player/${r.sofascore_player_id}/image` : null);
                      return (
                        <td key={c.key} className="whitespace-nowrap px-2 py-1.5">
                          <Link
                            href={`/dashboard/volleyball/player/${r.fivb_id}?comp=${competitionId}`}
                            className="flex items-center gap-2 font-medium text-ink hover:text-accent-ink"
                          >
                            {photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photo}
                                alt=""
                                width={24}
                                height={24}
                                loading="lazy"
                                className="h-6 w-6 shrink-0 rounded-full border border-line bg-card-2 object-cover"
                              />
                            ) : (
                              <span className="h-6 w-6 shrink-0 rounded-full border border-line bg-card-2" />
                            )}
                            <span>{v ?? r.fivb_id}</span>
                          </Link>
                        </td>
                      );
                    }
                    if (c.key === "team") {
                      const flag = fivbFlagUrl(r.team_code);
                      return (
                        <td key={c.key} className={`whitespace-nowrap px-2 py-1.5 ${isTur ? "font-semibold text-accent-ink" : "text-ink-2"}`}>
                          <span className="inline-flex items-center gap-1.5 align-middle">
                            {flag ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={flag} alt="" width={18} height={12} loading="lazy" className="h-3 w-[18px] shrink-0 rounded-[2px] object-cover" />
                            ) : null}
                            <span>{r.team_code ?? "—"}</span>
                          </span>
                        </td>
                      );
                    }
                    const display = c.kind === "num" ? num(v as number | null) : v ?? "—";
                    const cls = c.key === "pts" ? "font-semibold text-ink" : "text-ink-2";
                    return (
                      <td
                        key={c.key}
                        className={`px-2 py-1.5 ${c.align === "right" ? "text-right" : ""} ${cls}`}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultsTab({ matches }: { matches: VbMatch[] }) {
  const { t, locale } = useI18n();
  const [turkeyOnly, setTurkeyOnly] = useState(true);

  if (matches.length === 0)
    return <Placeholder text={t("volleyball.comingSoonResults")} />;

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const rows = (
    turkeyOnly
      ? matches.filter((m) => m.home_code === "TUR" || m.away_code === "TUR")
      : matches
  )
    .slice()
    .sort((a, b) => (b.match_date ?? "").localeCompare(a.match_date ?? ""));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs text-ink-3">
          {rows.length} {t("volleyball.tabResults").toLowerCase()}
        </span>
        <div className="inline-flex rounded-lg border border-line bg-card-2 p-0.5">
          <button
            onClick={() => setTurkeyOnly(false)}
            className={`rounded-md px-3 py-1 text-[11px] font-semibold transition ${
              !turkeyOnly ? "bg-accent text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            {t("volleyball.allTeams")}
          </button>
          <button
            onClick={() => setTurkeyOnly(true)}
            className={`rounded-md px-3 py-1 text-[11px] font-semibold transition ${
              turkeyOnly ? "bg-accent text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            {t("volleyball.turkeyOnly")}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line">
              <Th>{t("volleyball.thDate")}</Th>
              <Th right>{t("volleyball.thHome")}</Th>
              <Th>{t("volleyball.thScore")}</Th>
              <Th>{t("volleyball.thAway")}</Th>
              <Th>{t("volleyball.thSets")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const hs = m.home_sets ?? 0;
              const as = m.away_sets ?? 0;
              const homeWin = hs > as;
              const awayWin = as > hs;
              const isTur = m.home_code === "TUR" || m.away_code === "TUR";
              return (
                <tr
                  key={m.match_no}
                  className={`border-b border-line/60 transition hover:bg-veil ${
                    isTur ? "bg-card-2/40" : ""
                  }`}
                >
                  <td className="px-2 py-1.5 text-ink-3">{fmtDate(m.match_date)}</td>
                  <td
                    className={`px-2 py-1.5 text-right ${
                      homeWin ? "font-semibold text-ink" : "text-ink-2"
                    } ${m.home_code === "TUR" ? "text-accent-ink" : ""}`}
                  >
                    {m.home_code ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center font-semibold text-ink whitespace-nowrap">
                    {m.status === "Results" || (hs || as) ? `${hs}–${as}` : "—"}
                  </td>
                  <td
                    className={`px-2 py-1.5 ${
                      awayWin ? "font-semibold text-ink" : "text-ink-2"
                    } ${m.away_code === "TUR" ? "text-accent-ink" : ""}`}
                  >
                    {m.away_code ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-ink-3 whitespace-nowrap">
                    {m.set_scores && m.set_scores.length > 0
                      ? m.set_scores.map((s) => `${s.a}-${s.b}`).join(", ")
                      : "—"}
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

function FixturesTab({ fixtures }: { fixtures: VbFixture[] }) {
  const { t, locale } = useI18n();
  if (fixtures.length === 0)
    return <Placeholder text={t("volleyball.comingSoonFixtures")} />;

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  };

  // Turnuvaya gore grupla ( or. "EuroVolley 2026 · Pool A").
  const groups = new Map<string, VbFixture[]>();
  for (const f of fixtures) {
    const key = [f.competition_name, f.stage].filter(Boolean).join(" · ");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([key, list]) => (
        <div key={key}>
          <h3 className="mb-3 text-sm font-semibold text-ink">{key}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-line">
                  <Th>{t("volleyball.thDate")}</Th>
                  <Th>{t("volleyball.thTime")}</Th>
                  <Th right>{t("volleyball.thHome")}</Th>
                  <Th> </Th>
                  <Th>{t("volleyball.thAway")}</Th>
                  <Th>{t("volleyball.thVenue")}</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-line/60 bg-card-2/40 transition hover:bg-veil"
                  >
                    <td className="whitespace-nowrap px-2 py-1.5 text-ink-2">
                      {fmtDate(f.match_date)}
                    </td>
                    <td className="px-2 py-1.5 text-ink-3">{f.match_time ?? "—"}</td>
                    <td
                      className={`px-2 py-1.5 text-right font-medium ${
                        f.home_code === "TUR" ? "text-accent-ink" : "text-ink"
                      }`}
                    >
                      {f.home_code ?? f.home_name ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-center text-ink-3">v</td>
                    <td
                      className={`px-2 py-1.5 ${
                        f.away_code === "TUR" ? "font-medium text-accent-ink" : "text-ink"
                      }`}
                    >
                      {f.away_code ?? f.away_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-ink-3">
                      {f.venue ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-ink-3">
      {text}
    </div>
  );
}
