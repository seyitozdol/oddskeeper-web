"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { VbLeaderboardRow, VbMatch } from "../types";

type Tab = "players" | "results" | "fixtures" | "tools";

type Props = {
  competitionId: number;
  leaderboard: VbLeaderboardRow[];
  matches: VbMatch[];
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
  initialTab = "players",
}: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [turkeyOnly, setTurkeyOnly] = useState(false);

  const tabs: { key: Tab; label: string }[] = [
    { key: "players", label: t("volleyball.tabPlayers") },
    { key: "results", label: t("volleyball.tabResults") },
    { key: "fixtures", label: t("volleyball.tabFixtures") },
    { key: "tools", label: t("volleyball.tabTools") },
  ];

  const rows = useMemo(() => {
    const list = turkeyOnly
      ? leaderboard.filter((r) => r.team_code === "TUR")
      : leaderboard;
    return [...list].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  }, [leaderboard, turkeyOnly]);

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
      {tab === "fixtures" && (
        <Placeholder text={t("volleyball.comingSoonFixtures")} />
      )}
      {tab === "tools" && (
        <Placeholder text={t("volleyball.comingSoonTools")} />
      )}
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
              <Th>{t("volleyball.thRank")}</Th>
              <Th>{t("volleyball.thPlayer")}</Th>
              <Th>{t("volleyball.thTeam")}</Th>
              <Th>{t("volleyball.thPos")}</Th>
              <Th right>{t("volleyball.thAge")}</Th>
              <Th right>{t("volleyball.thHt")}</Th>
              <Th right>{t("volleyball.thPts")}</Th>
              <Th right>{t("volleyball.thAtk")}</Th>
              <Th right>{t("volleyball.thBlk")}</Th>
              <Th right>{t("volleyball.thSrv")}</Th>
              <Th right>{t("volleyball.thDig")}</Th>
              <Th right>{t("volleyball.thRec")}</Th>
              <Th right>{t("volleyball.thSet")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isTur = r.team_code === "TUR";
              return (
                <tr
                  key={r.fivb_id}
                  className={`border-b border-line/60 transition hover:bg-veil ${
                    isTur ? "bg-card-2/40" : ""
                  }`}
                >
                  <td className="px-2 py-1.5 text-ink-3">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <Link
                      href={`/dashboard/volleyball/player/${r.fivb_id}?comp=${competitionId}`}
                      className="font-medium text-ink hover:text-accent-ink"
                    >
                      {r.short_name ?? r.full_name ?? r.fivb_id}
                    </Link>
                  </td>
                  <td className={`px-2 py-1.5 ${isTur ? "font-semibold text-accent-ink" : "text-ink-2"}`}>
                    {r.team_code ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-ink-3">{r.position ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{num(ageOf(r.birth_date))}</td>
                  <td className="px-2 py-1.5 text-right text-ink-2">
                    {r.height_cm ? `${r.height_cm}` : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold text-ink">{num(r.points)}</td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{num(r.attack_points)}</td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{num(r.block_points)}</td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{num(r.serve_points)}</td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{num(r.dig_digs)}</td>
                  <td className="px-2 py-1.5 text-right text-ink-2">
                    {r.rec_success == null ? "—" : `${r.rec_success}`}
                  </td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{num(r.set_successful)}</td>
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
  return (
    <div>
      <p className="mb-3 text-xs text-ink-3">{t("volleyball.comingSoonResults")}</p>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line">
              <Th>{t("volleyball.thTeam")}</Th>
              <Th> </Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m, i) => (
              <tr key={i} className="border-b border-line/60 hover:bg-veil">
                <td className="px-2 py-1.5 text-ink-3">{fmtDate(m.match_date)}</td>
                <td className="px-2 py-1.5 text-right font-medium text-ink">{m.home_team}</td>
                <td className="px-2 py-1.5 text-ink-2">{m.away_team}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
