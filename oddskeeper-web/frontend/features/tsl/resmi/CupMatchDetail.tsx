"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import type { CupMatchDetail } from "../server/cupProfiles";

function Crest({ src, alt, size = 40 }: { src: string | null; alt: string; size?: number }) {
  if (!src) return <span className="inline-block shrink-0 rounded-full bg-veil" style={{ width: size, height: size }} aria-hidden />;
  return <Image src={src} alt={alt} width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} unoptimized />;
}

function StatBar({ label, a, b }: { label: string; a: number | null; b: number | null }) {
  const av = a ?? 0, bv = b ?? 0;
  const tot = av + bv;
  const ap = tot > 0 ? (av / tot) * 100 : 50;
  const aWin = av > bv, bWin = bv > av;
  return (
    <div className="py-1.5">
      <div className="mb-0.5 flex items-center justify-between text-[12px]">
        <span className={`tabular-nums ${aWin ? "font-semibold text-ink" : "text-ink-2"}`}>{a ?? "—"}</span>
        <span className="text-[11px] text-ink-3">{label}</span>
        <span className={`tabular-nums ${bWin ? "font-semibold text-ink" : "text-ink-2"}`}>{b ?? "—"}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-field">
        <div className="bg-accent/70" style={{ width: `${ap}%` }} />
        <div className="bg-ink-3/40" style={{ width: `${100 - ap}%` }} />
      </div>
    </div>
  );
}

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "2-digit", month: "long", year: "numeric" }); } catch { return ""; }
}

export default function CupMatchDetailPage({ data }: { data: CupMatchDetail }) {
  const { locale } = useI18n();
  const tr = locale === "tr";
  return (
    <section className="mx-auto w-full max-w-2xl px-4 pb-14 pt-6 lg:px-8">
      <Link href="/dashboard/cup" className="mb-4 inline-block text-[12px] text-ink-3 hover:text-ink-2">← {tr ? "Kupa" : "Cup"}</Link>

      <div className="mb-6 rounded-xl border border-line bg-card p-5">
        {data.roundName && <div className="mb-3 text-center text-[11px] uppercase tracking-wide text-ink-3">{data.roundName} · {fmtDate(data.datetime, locale)}</div>}
        <div className="flex items-center justify-center gap-4">
          <Link href={data.homeHref ?? "#"} className="flex flex-1 flex-col items-center gap-1.5 text-center hover:opacity-80">
            <Crest src={data.homeLogo} alt={data.homeName} size={48} />
            <span className="text-[13px] font-medium text-ink">{data.homeName}</span>
          </Link>
          <div className="shrink-0 text-2xl font-bold tabular-nums text-ink">
            {data.homeScore ?? "-"} : {data.awayScore ?? "-"}
          </div>
          <Link href={data.awayHref ?? "#"} className="flex flex-1 flex-col items-center gap-1.5 text-center hover:opacity-80">
            <Crest src={data.awayLogo} alt={data.awayName} size={48} />
            <span className="text-[13px] font-medium text-ink">{data.awayName}</span>
          </Link>
        </div>
      </div>

      {data.stats.length > 0 ? (
        <div className="rounded-xl border border-line bg-card p-4">
          <h2 className="mb-2 text-[13px] font-semibold text-ink-2">{tr ? "Maç İstatistikleri" : "Match Statistics"}</h2>
          <div className="divide-y divide-line/60">
            {data.stats.map((s) => <StatBar key={s.key} label={s.label} a={s.a} b={s.b} />)}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-card p-6 text-center text-[13px] text-ink-3">
          {tr ? "Bu maç için istatistik yok." : "No statistics for this match."}
        </div>
      )}
    </section>
  );
}
