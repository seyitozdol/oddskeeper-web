"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import type { CupStageMatch, ResmiCupStagesBundle } from "../server/resmiLoaders";

// Kupa logolari harici CDN'den gelebildiginden next/image yerine duz <img>.
function Crest({ src, alt, size = 18 }: { src: string | null; alt: string; size?: number }) {
  if (!src) return <span className="inline-block shrink-0 rounded-full bg-veil" style={{ width: size, height: size }} aria-hidden />;
  // Mackolik CDN hotlink korumasi: referer gonderirsek 403. no-referrer sart.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} referrerPolicy="no-referrer" className="shrink-0 object-contain" style={{ width: size, height: size }} loading="lazy" />;
}

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

// Knockout maç kartı (bracket sütunlarında).
function BracketCard({ m, matchBase, locale }: { m: CupStageMatch; matchBase: string; locale: string }) {
  const played = m.homeScore != null && m.awayScore != null;
  const homeWin = played && (m.homeScore ?? 0) > (m.awayScore ?? 0);
  const awayWin = played && (m.awayScore ?? 0) > (m.homeScore ?? 0);
  const row = (name: string, logo: string | null, score: number | null, win: boolean) => (
    <div className={`flex items-center gap-1.5 ${win ? "font-semibold text-ink" : "text-ink-2"}`}>
      <Crest src={logo} alt={name} />
      <span className="flex-1 truncate text-[12px]">{name}</span>
      <span className="w-4 shrink-0 text-right text-[12px] tabular-nums">{score ?? "-"}</span>
    </div>
  );
  return (
    <Link
      href={`${matchBase}/${encodeURIComponent(m.matchId)}`}
      className="block rounded-lg border border-line bg-card px-2.5 py-1.5 transition hover:border-line-strong"
    >
      <div className="mb-0.5 text-[9px] text-ink-3">{fmtDate(m.datetime, locale)}</div>
      <div className="space-y-1">
        {row(m.homeName, m.homeLogo, m.homeScore, homeWin)}
        {row(m.awayName, m.awayLogo, m.awayScore, awayWin)}
      </div>
    </Link>
  );
}

const KNOCKOUT = ["Çeyrek Final", "Yarı Final", "Final"];
const EARLY = ["1. Tur", "2. Tur", "3. Tur", "4. Tur", "5. Tur"];

// Grup maclarindan mini puan durumu (oynanmis maclardan). Takim kimligi slug
// varsa slug, yoksa ad. Siralama: puan, averaj, atilan gol.
type GroupRow = {
  key: string;
  name: string;
  logo: string | null;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number;
  ga: number;
};

function computeGroupStandings(matches: CupStageMatch[]): GroupRow[] {
  const rows = new Map<string, GroupRow>();
  const ensure = (key: string, name: string, logo: string | null) => {
    let r = rows.get(key);
    if (!r) {
      r = { key, name, logo, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0 };
      rows.set(key, r);
    } else if (!r.logo && logo) r.logo = logo;
    return r;
  };
  for (const m of matches) {
    const hKey = m.homeSlug ?? m.homeName;
    const aKey = m.awaySlug ?? m.awayName;
    const h = ensure(hKey, m.homeName, m.homeLogo);
    const a = ensure(aKey, m.awayName, m.awayLogo);
    if (m.homeScore == null || m.awayScore == null) continue;
    h.played++; a.played++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    if (m.homeScore > m.awayScore) { h.win++; a.loss++; }
    else if (m.homeScore < m.awayScore) { a.win++; h.loss++; }
    else { h.draw++; a.draw++; }
  }
  const pts = (r: GroupRow) => r.win * 3 + r.draw;
  return [...rows.values()].sort(
    (x, y) => pts(y) - pts(x) || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.name.localeCompare(y.name, "tr")
  );
}

function GroupStandings({ matches }: { matches: CupStageMatch[] }) {
  const rows = computeGroupStandings(matches);
  if (!rows.length) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-line text-[9px] uppercase tracking-[0.06em] text-ink-3">
            <th className="py-1.5 pl-2.5 pr-1 text-left font-medium">#</th>
            <th className="px-1 py-1.5 text-left font-medium">Takım</th>
            <th className="px-1.5 py-1.5 text-center font-medium">O</th>
            <th className="px-1.5 py-1.5 text-center font-medium">G</th>
            <th className="px-1.5 py-1.5 text-center font-medium">B</th>
            <th className="px-1.5 py-1.5 text-center font-medium">M</th>
            <th className="px-1.5 py-1.5 text-center font-medium">AV</th>
            <th className="px-1.5 py-1.5 pr-2.5 text-right font-semibold text-ink-2">P</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const gd = r.gf - r.ga;
            return (
              <tr key={r.key} className={`${i % 2 ? "bg-veil/40" : ""} border-b border-line/50 last:border-0`}>
                <td className="py-1 pl-2.5 pr-1 text-[11px] font-bold tabular-nums text-ink-2">{i + 1}</td>
                <td className="px-1 py-1">
                  <span className="flex items-center gap-1.5">
                    <Crest src={r.logo} alt={r.name} size={16} />
                    <span className="truncate text-ink">{r.name}</span>
                  </span>
                </td>
                <td className="px-1.5 py-1 text-center tabular-nums text-ink-2">{r.played}</td>
                <td className="px-1.5 py-1 text-center tabular-nums text-ink-2">{r.win}</td>
                <td className="px-1.5 py-1 text-center tabular-nums text-ink-2">{r.draw}</td>
                <td className="px-1.5 py-1 text-center tabular-nums text-ink-2">{r.loss}</td>
                <td className="px-1.5 py-1 text-center tabular-nums text-ink-2">{gd > 0 ? `+${gd}` : gd}</td>
                <td className="px-1.5 py-1 pr-2.5 text-right text-[13px] font-bold tabular-nums text-ink">{r.win * 3 + r.draw}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ResmiCupStages({ data }: { data: ResmiCupStagesBundle }) {
  const { t, locale } = useI18n();
  const { stages, matchesByRound, matchBase, season } = data;
  const [showEarly, setShowEarly] = useState(false);

  if (!stages.length) {
    return (
      <div className="rounded-xl border border-line bg-card p-6 text-center text-[13px] text-ink-3">
        {t("tsl.noData")}
      </div>
    );
  }

  const knockout = KNOCKOUT.filter((r) => (matchesByRound[r] ?? []).length);
  const groupRounds = stages.map((s) => s.roundName).filter((r) => r.startsWith("Grup") && (matchesByRound[r] ?? []).length);
  const earlyRounds = EARLY.filter((r) => (matchesByRound[r] ?? []).length);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <h2 className="text-[15px] font-semibold text-ink">{t("tsl.sectionCupStages")} · {season}</h2>

      {/* Knockout bracket: Çeyrek → Yarı → Final, sütun sütun daralan */}
      {knockout.length > 0 && (
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-ink-2">{locale === "tr" ? "Eleme Turu" : "Knockout"}</h3>
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-4">
              {knockout.map((round) => {
                const matches = matchesByRound[round] ?? [];
                return (
                  <div key={round} className="flex w-56 shrink-0 flex-col">
                    <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                      {round}
                    </div>
                    <div className="flex flex-1 flex-col justify-around gap-3">
                      {matches.map((m) => (
                        <BracketCard key={m.matchId} m={m} matchBase={matchBase} locale={locale} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Grup aşaması: her grup için mini puan durumu + maçlar */}
      {groupRounds.length > 0 && (
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-ink-2">
            {locale === "tr" ? "Grup Aşaması" : "Group Stage"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {groupRounds.map((round) => (
              <div key={round} className="space-y-2">
                <div className="text-[12px] font-semibold text-ink-3">{round}</div>
                <GroupStandings matches={matchesByRound[round] ?? []} />
                <ul className="grid gap-1">
                  {(matchesByRound[round] ?? []).map((m) => (
                    <MatchLine key={m.matchId} m={m} matchBase={matchBase} locale={locale} compact />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Erken turlar (katlanır — çok maç) */}
      {earlyRounds.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowEarly((s) => !s)}
            className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink"
          >
            <span>{locale === "tr" ? "Erken Turlar" : "Early Rounds"}</span>
            <span className="text-[11px] text-ink-3">{showEarly ? "▲" : "▼"}</span>
          </button>
          {showEarly &&
            earlyRounds.map((round) => (
              <div key={round} className="mb-3">
                <div className="mb-1 text-[12px] font-medium text-ink-3">{round}</div>
                <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {(matchesByRound[round] ?? []).map((m) => (
                    <MatchLine key={m.matchId} m={m} matchBase={matchBase} locale={locale} compact />
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// Tek satır maç (grup + erken turlar için).
function MatchLine({ m, matchBase, locale, compact }: { m: CupStageMatch; matchBase: string; locale: string; compact?: boolean }) {
  const played = m.homeScore != null && m.awayScore != null;
  const homeWin = played && (m.homeScore ?? 0) > (m.awayScore ?? 0);
  const awayWin = played && (m.awayScore ?? 0) > (m.homeScore ?? 0);
  return (
    <li>
      <Link
        href={`${matchBase}/${encodeURIComponent(m.matchId)}`}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] transition hover:bg-veil"
      >
        <Crest src={m.homeLogo} alt={m.homeName} size={16} />
        <span className={`flex-1 truncate text-right ${homeWin ? "font-semibold text-ink" : "text-ink-2"}`}>{m.homeName}</span>
        <span className="shrink-0 rounded bg-veil px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink">
          {played ? `${m.homeScore}-${m.awayScore}` : "-"}
        </span>
        <span className={`flex-1 truncate ${awayWin ? "font-semibold text-ink" : "text-ink-2"}`}>{m.awayName}</span>
        <Crest src={m.awayLogo} alt={m.awayName} size={16} />
        {!compact && <span className="w-10 shrink-0 text-right text-[9px] text-ink-3">{fmtDate(m.datetime, locale)}</span>}
      </Link>
    </li>
  );
}
