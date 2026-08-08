"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";

// MSM Config: "Geçmişten line düzeltmesi yapılınca, önceki export'ta olup yeni
// export'ta olmayan line'ları SU ile yazdır" toggle'i. Sadece Match Stats Model.
// Kontrollü bileşen: değer parent'ta tutulur (export mantığıyla senkron kalsın),
// onChange kaydeder ve başarıyı döndürür.
export default function SuspendMissingConfig({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  async function handle(next: boolean) {
    const ok = await onChange(next);
    setStatus(ok ? "saved" : "error");
    if (ok) setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
        {t("modelHistory.suspendTitle")}
        {status === "saved" && (
          <span className="text-[11px] normal-case text-pos">{t("modelHistory.cfgSaved")}</span>
        )}
        {status === "error" && (
          <span className="text-[11px] normal-case text-neg">{t("modelHistory.cfgSaveFailed")}</span>
        )}
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-ink-3">
        {t("modelHistory.suspendNote")}
      </p>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => handle(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        {t("modelHistory.suspendLabel")}
      </label>
    </div>
  );
}
