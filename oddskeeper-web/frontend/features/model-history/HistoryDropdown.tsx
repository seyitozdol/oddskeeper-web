"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import {
  fetchModelHistory,
  formatHistoryLabel,
  type HistorySport,
  type ModelHistoryRecord,
} from "@/lib/model-history";

// Add to Input'un solundaki export gecmisi dropdown'i. Acildiginda spor/lig
// icin son kayitlari ceker; bir kayda tiklaninca onRestore ile snapshot'i
// geri yukler (her yuzey kendi restore mantigini uygular). Gecmis ORTAKtir.
//
// reloadKey: her export sonrasi degistirilirse acik liste tazelenir.
export default function HistoryDropdown({
  sport,
  league,
  reloadKey = 0,
  onRestore,
}: {
  sport: HistorySport;
  league: string;
  reloadKey?: number;
  onRestore: (rec: ModelHistoryRecord) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ModelHistoryRecord[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = () => {
    setLoading(true);
    fetchModelHistory(sport, league)
      .then(setRecords)
      .finally(() => setLoading(false));
  };

  // Acilinca (ve export sonrasi reloadKey degisince, acikken) tazele.
  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reloadKey, sport, league]);

  // Disari tiklayinca kapan.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md border border-line bg-field px-2.5 py-1.5 text-xs font-semibold text-ink-2 transition hover:text-ink"
        title={t("modelHistory.button")}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v5h5" />
          <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
          <path d="M12 7v5l3 2" />
        </svg>
        {t("modelHistory.button")}
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 max-h-80 w-80 overflow-y-auto rounded-lg border border-line bg-card p-1 shadow-lg">
          {loading ? (
            <div className="px-3 py-3 text-center text-[11px] text-ink-3">
              {t("modelHistory.loading")}
            </div>
          ) : records.length === 0 ? (
            <div className="px-3 py-3 text-center text-[11px] text-ink-3">
              {t("modelHistory.empty")}
            </div>
          ) : (
            records.map((rec) => (
              <button
                key={rec.id}
                type="button"
                onClick={() => {
                  onRestore(rec);
                  setOpen(false);
                }}
                className="block w-full truncate rounded px-3 py-1.5 text-left text-[11px] text-ink-2 transition hover:bg-veil hover:text-ink"
                title={formatHistoryLabel(rec)}
              >
                {formatHistoryLabel(rec)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
