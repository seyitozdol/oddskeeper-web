"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Sağ-üst sezon seçici (2025-2026 / 2026-2027). ?season= URL parametresini günceller;
// sunucu bileşeni yeni sezonla yeniden veri çeker. BSL/EL/EC hub'larında ortak.
export default function SeasonToggle({ seasons, current }: { seasons: readonly string[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const go = (s: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set("season", s);
    router.push(`${pathname}?${p.toString()}`);
  };
  // Güncel (en yeni) sezon her zaman en solda: azalan sırala ("2026-2027" > "2025-2026").
  const ordered = [...seasons].sort((a, b) => b.localeCompare(a));
  return (
    <div className="inline-flex rounded-lg border border-line bg-card-2 p-0.5">
      {ordered.map((s) => (
        <button
          key={s}
          onClick={() => go(s)}
          className={`rounded-md px-3 py-1 text-[12px] font-semibold transition ${s === current ? "bg-accent text-white" : "text-ink-2 hover:text-ink"}`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
