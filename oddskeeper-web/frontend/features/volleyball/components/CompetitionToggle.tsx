"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { VbCompetition } from "../types";

// Sag-ust turnuva secici (VNL 2026 / VNL 2025 / Dünya Ş. 2025 / ...). ?comp= URL
// parametresini gunceller; sunucu bileseni secili turnuvayla yeniden veri ceker.
// Basketboldaki SeasonToggle'in voleybol karsiligi (yil/turnuva bazli).
export default function CompetitionToggle({
  competitions,
  current,
}: {
  competitions: VbCompetition[];
  current: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const go = (id: number) => {
    const p = new URLSearchParams(sp.toString());
    p.set("comp", String(id));
    router.push(`${pathname}?${p.toString()}`);
  };
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-line bg-card-2 p-0.5">
      {competitions.map((c) => (
        <button
          key={c.competition_id}
          onClick={() => go(c.competition_id)}
          className={`rounded-md px-3 py-1 text-[12px] font-semibold transition ${
            c.competition_id === current
              ? "bg-accent text-on-accent"
              : "text-ink-2 hover:text-ink"
          }`}
        >
          {c.short_label}
        </button>
      ))}
    </div>
  );
}
