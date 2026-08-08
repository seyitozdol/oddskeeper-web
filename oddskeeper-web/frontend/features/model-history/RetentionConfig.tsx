"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import {
  fetchRetention,
  saveRetention,
  type HistorySport,
} from "@/lib/model-history";
import { confirmPermanentSave } from "@/lib/confirm-save";

// Config sekmesindeki "Export gecmisi saklama (gun)" ayari. Her spor/lig icin
// ayri deger. Sure otomatik temizlikte kullanilir (bkz. /api/model-history).
export default function RetentionConfig({
  sport,
  league,
}: {
  sport: HistorySport;
  league: string;
}) {
  const { t } = useI18n();
  const [days, setDays] = useState("30");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  useEffect(() => {
    let alive = true;
    fetchRetention(sport, league).then((d) => {
      if (alive) setDays(String(d));
    });
    return () => {
      alive = false;
    };
  }, [sport, league]);

  async function save() {
    const n = parseInt(days, 10);
    if (!Number.isFinite(n)) return;
    if (!(await confirmPermanentSave())) return;
    setStatus("saving");
    const ok = await saveRetention(sport, league, n);
    setStatus(ok ? "saved" : "error");
    if (ok) setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
        {t("modelHistory.cfgTitle")}
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-ink-3">
        {t("modelHistory.cfgRetentionNote")}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-3">
            {t("modelHistory.cfgRetention")}
          </label>
          <input
            type="number"
            min={1}
            max={3650}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-28 rounded-md border border-line bg-field px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {t("modelHistory.cfgSave")}
        </button>
        {status === "saved" && (
          <span className="text-[11px] text-pos">{t("modelHistory.cfgSaved")}</span>
        )}
        {status === "error" && (
          <span className="text-[11px] text-neg">
            {t("modelHistory.cfgSaveFailed")}
          </span>
        )}
      </div>
    </div>
  );
}
