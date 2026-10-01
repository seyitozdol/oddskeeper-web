"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Sağ-üst sezon seçici (2025-2026 / 2026-2027). ?season= URL parametresini günceller;
// sunucu bileşeni yeni sezonla yeniden veri çeker. BSL/EL/EC hub'larında ortak.
// options verilirse (milli takim: turnuva baskilari) etiketli ACILIR LISTE olarak,
// verilen sirayla gosterilir; cok sayida uzun etiket chip satirina sigmaz.
export default function SeasonToggle({
  seasons,
  current,
  options,
  ariaLabel,
}: {
  seasons: readonly string[];
  current: string;
  options?: { value: string; label: string }[];
  ariaLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const go = (s: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set("season", s);
    router.push(`${pathname}?${p.toString()}`);
  };
  if (options?.length) {
    return (
      <select
        aria-label={ariaLabel}
        value={current}
        onChange={(e) => go(e.target.value)}
        className="rounded-lg border border-line bg-card-2 px-3 py-1.5 text-[12px] font-semibold text-ink focus:border-accent focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-field text-ink">
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  // Güncel (en yeni) sezon her zaman en solda: azalan sırala ("2026-2027" > "2025-2026").
  const ordered = [...seasons].sort((a, b) => b.localeCompare(a));
  return (
    <div className="inline-flex rounded-lg border border-line bg-card-2 p-0.5">
      {ordered.map((s) => (
        <button
          key={s}
          onClick={() => go(s)}
          className={`rounded-md px-3 py-1 text-[12px] font-semibold transition ${s === current ? "bg-accent text-on-accent" : "text-ink-2 hover:text-ink"}`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
