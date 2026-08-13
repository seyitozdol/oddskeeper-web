"use client";

import Link from "next/link";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import type { CupPlayerProfile } from "../server/cupProfiles";

function age(birth: string | null): number | null {
  if (!birth) return null;
  try {
    const b = new Date(birth);
    const now = new Date("2026-08-13");
    let a = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
    return a > 0 && a < 60 ? a : null;
  } catch { return null; }
}
function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "2-digit", month: "short", year: "2-digit" }); } catch { return ""; }
}

export default function CupPlayerProfilePage({ data }: { data: CupPlayerProfile }) {
  const { locale } = useI18n();
  const tr = locale === "tr";
  const a = age(data.birthDate);
  return (
    <section className="mx-auto w-full max-w-2xl px-4 pb-14 pt-6 lg:px-8">
      <Link href="/dashboard/cup" className="mb-4 inline-block text-[12px] text-ink-3 hover:text-ink-2">← {tr ? "Kupa" : "Cup"}</Link>

      <div className="mb-6 flex items-center gap-4">
        {data.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.photo} alt={data.name} referrerPolicy="no-referrer" className="shrink-0 rounded-full object-cover ring-1 ring-line" style={{ width: 72, height: 72 }} loading="lazy" />
        ) : (
          <span className="shrink-0 rounded-full bg-veil" style={{ width: 72, height: 72 }} />
        )}
        <div>
          <h1 className="text-xl font-bold text-ink">{data.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-3">
            {data.position && <span>{data.position}</span>}
            {data.height && <span>{data.height} cm</span>}
            {a && <span>{a} {tr ? "yaş" : "yrs"}</span>}
            {data.teamName && (
              <Link href={data.teamHref ?? "#"} className="flex items-center gap-1 text-ink-2 hover:text-ink">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {data.teamLogo && <img src={data.teamLogo} alt={data.teamName} referrerPolicy="no-referrer" className="h-3.5 w-3.5 object-contain" loading="lazy" />}
                {data.teamName}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Sezon özeti */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {data.seasons.map((s) => (
          <div key={s.season} className="rounded-lg border border-line bg-card p-3">
            <div className="text-[11px] text-ink-3">{s.season}</div>
            <div className="mt-0.5 text-[15px] font-semibold text-ink">{s.rating ?? "—"}</div>
            <div className="text-[11px] text-ink-3">{s.apps} {tr ? "maç · ort. reyting" : "matches · avg rating"}</div>
          </div>
        ))}
      </div>

      {/* Maç geçmişi */}
      {data.matches.length > 0 && (
        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-ink-2">{tr ? "Kupa maçları" : "Cup matches"}</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {data.matches.map((m) => (
              <li key={m.matchId}>
                <Link href={`/dashboard/cup/match/${encodeURIComponent(m.matchId)}`} className="flex items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-veil">
                  <span className="w-14 shrink-0 text-[10px] text-ink-3">{fmtDate(m.datetime, locale)}</span>
                  <span className="flex-1 truncate text-ink-2">{m.roundName ?? ""}</span>
                  {m.rating != null && <span className="shrink-0 rounded bg-veil px-1.5 py-0.5 text-[11px] font-semibold text-ink">{m.rating}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
