"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import { RESMI_LEADER_METRICS } from "../constants";

export default function LeaderTabs({ active }: { active: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const push = (key: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("leader", key);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {RESMI_LEADER_METRICS.map((m) => {
        const on = m.key === active;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => push(m.key)}
            className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium transition ${
              on
                ? "border-accent/40 bg-accent-soft text-accent-ink"
                : "border-line bg-veil text-ink-3 hover:text-ink-2"
            }`}
          >
            {t(m.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
