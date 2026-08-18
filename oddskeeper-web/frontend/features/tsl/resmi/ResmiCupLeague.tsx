"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import TeamCrest from "../shared/TeamCrest";
import FormPills from "../shared/FormPills";
import type {
  CupBracketRound,
  CupLeagueBundle,
  CupMatchLite,
  CupStandingRow,
  CupTie,
  CupTieRound,
} from "../server/eurocupLeague";

type StageKey = "qualifying" | "playoff" | "league" | "bracket";

export default function ResmiCupLeague({ data }: { data: CupLeagueBundle }) {
  const { locale } = useI18n();
  const tr = locale === "tr";

  const stages = useMemo(() => {
    const out: { key: StageKey; label: string }[] = [];
    if (data.qualifying.length) out.push({ key: "qualifying", label: tr ? "Ön Elemeler" : "Qualifying" });
    if (data.playoffEntry.length) out.push({ key: "playoff", label: tr ? "Play-off" : "Play-off" });
    if (data.hasLeaguePhase) out.push({ key: "league", label: tr ? "Lig Aşaması" : "League Phase" });
    if (data.bracket.length) out.push({ key: "bracket", label: tr ? "Eleme Turları" : "Knockout" });
    return out;
  }, [data, tr]);

  const [stage, setStage] = useState<StageKey>(
    () => (data.hasLeaguePhase ? "league" : (stages[0]?.key ?? "league"))
  );
  const active = stages.some((s) => s.key === stage) ? stage : stages[0]?.key ?? "league";

  if (!stages.length) {
    return (
      <div className="mx-auto mt-6 w-full max-w-3xl rounded-xl border border-line bg-card p-6 text-center text-[13px] text-ink-2">
        {tr ? "Bu sezon için henüz veri yok." : "No data for this season yet."}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {stages.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStage(s.key)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
              active === s.key ? "bg-accent text-accent-ink" : "bg-card-2 text-ink-2 hover:bg-veil hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {active === "league" ? <Standings rows={data.standings} tr={tr} /> : null}
      {active === "qualifying" ? <TieRounds rounds={data.qualifying} tr={tr} /> : null}
      {active === "playoff" ? (
        <TieRounds rounds={[{ roundName: tr ? "Play-off Turu" : "Play-off Round", ties: data.playoffEntry }]} tr={tr} />
      ) : null}
      {active === "bracket" ? <Bracket rounds={data.bracket} tr={tr} /> : null}
    </div>
  );
}

// ---- Lig aşaması puan tablosu (36 takım, bölge renkleri) ----
const ZONE_BAR: Record<string, string> = {
  r16: "bg-emerald-500",
  playoff: "bg-amber-500",
  out: "bg-rose-500/70",
};

function Standings({ rows, tr }: { rows: CupStandingRow[]; tr: boolean }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-3">
        <Legend color="bg-emerald-500" label={tr ? "1-8 · Son 16 (doğrudan)" : "1-8 · Round of 16"} />
        <Legend color="bg-amber-500" label={tr ? "9-24 · Play-off" : "9-24 · Play-off"} />
        <Legend color="bg-rose-500/70" label={tr ? "25-36 · Elenen" : "25-36 · Eliminated"} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[640px] text-[12px]">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wide text-ink-3">
              <th className="px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">{tr ? "Takım" : "Team"}</th>
              <th className="px-2 py-2 text-center">P</th>
              <th className="px-2 py-2 text-center">W</th>
              <th className="px-2 py-2 text-center">D</th>
              <th className="px-2 py-2 text-center">L</th>
              <th className="px-2 py-2 text-center">GLS</th>
              <th className="px-2 py-2 text-center">GD</th>
              <th className="px-2 py-2 text-center">Form</th>
              <th className="px-2 py-2 text-center font-bold">PTS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-4 w-1 rounded ${r.zone ? ZONE_BAR[r.zone] : ""}`} />
                    <span className="tabular-nums text-ink-2">{r.rank}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <TeamCrest logo={r.logo} name={r.teamName} size="xs" />
                    <span className="truncate text-ink">{r.teamName}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums text-ink-2">{r.played}</td>
                <td className="px-2 py-1.5 text-center tabular-nums text-ink-2">{r.wins}</td>
                <td className="px-2 py-1.5 text-center tabular-nums text-ink-2">{r.draws}</td>
                <td className="px-2 py-1.5 text-center tabular-nums text-ink-2">{r.losses}</td>
                <td className="px-2 py-1.5 text-center tabular-nums text-ink-3">
                  {r.goalsFor}:{r.goalsAgainst}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums text-ink-2">
                  {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex justify-center">
                    <FormPills form={r.form} />
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center font-bold tabular-nums text-ink">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

// ---- Yükselen oku (turu geçen takım) ----
function AdvanceArrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

// ---- Alt kupaya düşüş ikonu (elenen takım UL/Con'a düştüyse) ----
const DROP_ICON: Record<"uel" | "uecl", { src: string; tr: string; en: string }> = {
  uel: { src: "/images/leagues/uel.png", tr: "Avrupa Ligi'ne düştü", en: "Dropped to Europa League" },
  uecl: { src: "/images/leagues/uecl.png", tr: "Konferans Ligi'ne düştü", en: "Dropped to Conference League" },
};
function DropIcon({ dest, tr }: { dest: "uel" | "uecl"; tr: boolean }) {
  const d = DROP_ICON[dest];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={d.src}
      alt=""
      title={tr ? d.tr : d.en}
      className="tsl-league-mark h-3.5 w-3.5 shrink-0 object-contain opacity-80"
    />
  );
}

function legDate(iso: string | null, tr: boolean): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(tr ? "tr-TR" : "en-GB", { day: "2-digit", month: "short" });
}

// ---- Tek tie kartı: TAKIM-BAŞINA-SATIR (isim tam genişlik, kırpma yok) +
// her leg icin ayri skor sutunu (iki maç da görünür, toplam skor yok). ----
function TieCard({ tie, tr }: { tie: CupTie; tr: boolean }) {
  const advancedId = tie.advanced === "home" ? tie.homeId : tie.advanced === "away" ? tie.awayId : null;
  const droppedId = tie.homeDropped ? tie.homeId : tie.awayDropped ? tie.awayId : null;
  const dropDest = tie.homeDropped ?? tie.awayDropped;
  const legDates = tie.legs.map((l) => legDate(l.datetime, tr));
  const scoreOf = (teamId: string, leg: CupMatchLite): number | null =>
    leg.homeId === teamId ? leg.homeScore : leg.awayScore;

  const row = (teamId: string, name: string, logo: string | null) => {
    const adv = teamId === advancedId;
    const dropped = teamId === droppedId ? dropDest : null;
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <TeamCrest logo={logo} name={name} size="xs" />
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className={`truncate ${adv ? "font-semibold text-ink" : "text-ink-2"}`}>{name}</span>
          {adv ? <AdvanceArrow /> : null}
          {dropped ? <DropIcon dest={dropped} tr={tr} /> : null}
        </div>
        {tie.legs.map((leg, i) => {
          const s = scoreOf(teamId, leg);
          return (
            <span
              key={i}
              className={`w-7 shrink-0 text-center tabular-nums ${adv ? "font-bold text-ink" : "text-ink-2"}`}
            >
              {s ?? "–"}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-line bg-card text-[12px]">
      {tie.legs.length > 1 ? (
        <div className="flex items-center gap-1.5 px-2 pt-1 text-[9px] uppercase tracking-wide text-ink-3">
          <span className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1" />
          {legDates.map((d, i) => (
            <span key={i} className="w-7 shrink-0 text-center">
              {d}
            </span>
          ))}
        </div>
      ) : null}
      {row(tie.homeId, tie.homeName, tie.homeLogo)}
      <div className="mx-2 h-px bg-line/50" />
      {row(tie.awayId, tie.awayName, tie.awayLogo)}
    </div>
  );
}

// ---- Tur bazlı tie'ler (ön elemeler / play-off) — grid ----
function TieRounds({ rounds, tr }: { rounds: CupTieRound[]; tr: boolean }) {
  if (!rounds.length || rounds.every((r) => !r.ties.length)) {
    return <div className="rounded-xl border border-line bg-card p-6 text-center text-[13px] text-ink-2">{tr ? "Veri yok." : "No data."}</div>;
  }
  return (
    <div className="space-y-5">
      {rounds.map((rd) => (
        <div key={rd.roundName}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-2">{rd.roundName}</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rd.ties.map((t, i) => (
              <TieCard key={`${t.homeId}-${t.awayId}-${i}`} tie={t} tr={tr} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Eleme braketi (turlar, soldan sağa) ----
const BRACKET_LABEL_TR: Record<string, string> = {
  "Knockout Play-off": "Eleme Play-off",
  "Round of 16": "Son 16",
  Quarterfinals: "Çeyrek Final",
  Semifinals: "Yarı Final",
  Final: "Final",
};

function Bracket({ rounds, tr }: { rounds: CupBracketRound[]; tr: boolean }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {rounds.map((rd) => (
        <div key={rd.roundLabel} className="min-w-[260px] flex-1">
          <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-2">
            {tr ? BRACKET_LABEL_TR[rd.roundLabel] ?? rd.roundLabel : rd.roundLabel}
          </div>
          <div className="space-y-2">
            {rd.ties.map((t, i) => (
              <TieCard key={`${t.homeId}-${t.awayId}-${i}`} tie={t} tr={tr} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
