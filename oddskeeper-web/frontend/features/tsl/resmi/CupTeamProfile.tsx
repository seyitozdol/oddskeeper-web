"use client";

import Link from "next/link";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import type { CupTeamProfile } from "../server/cupProfiles";

function Crest({ src, alt, size = 20 }: { src: string | null; alt: string; size?: number }) {
  if (!src) return <span className="inline-block shrink-0 rounded-full bg-veil" style={{ width: size, height: size }} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="shrink-0 object-contain" style={{ width: size, height: size }} loading="lazy" />;
}

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "2-digit", month: "short", year: "2-digit" }); } catch { return ""; }
}

export default function CupTeamProfilePage({ data }: { data: CupTeamProfile }) {
  const { locale } = useI18n();
  const tr = locale === "tr";
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-14 pt-6 lg:px-8">
      <Link href="/dashboard/cup" className="mb-4 inline-block text-[12px] text-ink-3 hover:text-ink-2">← {tr ? "Kupa" : "Cup"}</Link>

      <div className="mb-6 flex items-center gap-3">
        <Crest src={data.logo} alt={data.name} size={48} />
        <div>
          <h1 className="text-xl font-bold text-ink">{data.name}</h1>
          <p className="text-[12px] text-ink-3">{tr ? "Türkiye Kupası" : "Turkish Cup"}</p>
        </div>
      </div>

      {data.seasons.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {data.seasons.map((s) => (
            <div key={s.season} className="rounded-lg border border-line bg-card p-3">
              <div className="text-[11px] text-ink-3">{s.season}</div>
              <div className="mt-0.5 text-[13px] font-semibold text-ink">{s.wins}G {s.draws}B {s.losses}M</div>
              <div className="text-[11px] text-ink-3">{s.played} {tr ? "maç" : "matches"} · {s.goalsFor}:{s.goalsAgainst}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Sonuçlar */}
        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-ink-2">{tr ? "Sonuçlar" : "Results"}</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {data.results.map((r) => {
              const played = r.gf != null && r.ga != null;
              const win = played && (r.gf ?? 0) > (r.ga ?? 0);
              const loss = played && (r.gf ?? 0) < (r.ga ?? 0);
              return (
                <li key={r.matchId}>
                  <Link href={`/dashboard/cup/match/${encodeURIComponent(r.matchId)}`} className="flex items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-veil">
                    <span className="w-12 shrink-0 text-[10px] text-ink-3">{fmtDate(r.datetime, locale)}</span>
                    <Crest src={r.oppLogo} alt={r.oppName} size={16} />
                    <span className="flex-1 truncate text-ink-2">{r.isHome ? "" : "@ "}{r.oppName}</span>
                    {played ? (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${win ? "bg-pos/15 text-pos" : loss ? "bg-neg/15 text-neg" : "bg-veil text-ink-2"}`}>
                        {r.gf}-{r.ga}
                      </span>
                    ) : <span className="text-ink-3">-</span>}
                  </Link>
                </li>
              );
            })}
            {!data.results.length && <li className="px-3 py-3 text-[12px] text-ink-3">—</li>}
          </ul>
        </div>

        {/* İstatistik + Kadro */}
        <div className="space-y-5">
          {data.stats.length > 0 && (
            <div>
              <h2 className="mb-2 text-[13px] font-semibold text-ink-2">{tr ? "İstatistik (maç ort.)" : "Stats (per match)"}</h2>
              <ul className="grid grid-cols-2 gap-1.5">
                {data.stats.map((s) => (
                  <li key={s.key} className="rounded-lg border border-line bg-card px-3 py-2">
                    <div className="text-[11px] text-ink-3">{s.label}</div>
                    <div className="text-[14px] font-semibold text-ink">{s.perMatch ?? "—"}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.squad.length > 0 && (
            <div>
              <h2 className="mb-2 text-[13px] font-semibold text-ink-2">{tr ? "Kadro (kupa)" : "Squad (cup)"}</h2>
              <ul className="divide-y divide-line rounded-xl border border-line bg-card">
                {data.squad.slice(0, 30).map((p) => (
                  <li key={p.playerId}>
                    <Link href={p.href} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-veil">
                      <Crest src={p.photo} alt={p.name} size={22} />
                      <span className="flex-1 truncate text-ink-2">{p.name}</span>
                      {p.rating != null && <span className="shrink-0 rounded bg-veil px-1.5 py-0.5 text-[11px] font-semibold text-ink">{p.rating}</span>}
                      <span className="w-8 shrink-0 text-right text-[11px] text-ink-3">{p.apps ?? 0} {tr ? "m" : "a"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
