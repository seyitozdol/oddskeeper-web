"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import {
  deleteModelHistory,
  fetchModelHistory,
  formatHistoryLabel,
  type HistorySport,
  type ModelHistoryRecord,
} from "@/lib/model-history";

// Add to Input'un solundaki export gecmisi dropdown'i. Acildiginda spor/lig
// (ve verilirse SADECE secili mac) icin son kayitlari ceker; bir kayda tiklaninca
// onRestore ile snapshot'i geri yukler. Gecmis ORTAKtir; silme yetkisi kayit
// bazinda gelir (admin veya sahibi): yazinin saginda x + inline onay.
//
// matchLabel: verilirse yalnizca o macin kayitlari listelenir.
// reloadKey: her export sonrasi degistirilirse acik liste tazelenir.
export default function HistoryDropdown({
  sport,
  league,
  matchLabel,
  reloadKey = 0,
  onRestore,
}: {
  sport: HistorySport;
  league: string;
  matchLabel?: string;
  reloadKey?: number;
  onRestore: (rec: ModelHistoryRecord) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ModelHistoryRecord[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = () => {
    setLoading(true);
    fetchModelHistory(sport, league, 50, matchLabel)
      .then(setRecords)
      .finally(() => setLoading(false));
  };

  // Acilinca (ve export sonrasi reloadKey / secili mac degisince, acikken) tazele.
  useEffect(() => {
    if (open) {
      setConfirmId(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reloadKey, sport, league, matchLabel]);

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

  async function doDelete(id: string) {
    const ok = await deleteModelHistory(id);
    if (ok) setRecords((rs) => rs.filter((r) => r.id !== id));
    setConfirmId(null);
  }

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
        <div className="absolute right-0 z-30 mt-1 max-h-80 w-96 overflow-y-auto rounded-lg border border-line bg-card p-1 shadow-lg">
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
              <div
                key={rec.id}
                className="flex items-center gap-1 rounded px-1 transition hover:bg-veil"
              >
                <button
                  type="button"
                  onClick={() => {
                    onRestore(rec);
                    setOpen(false);
                  }}
                  className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[11px] text-ink-2 hover:text-ink"
                  title={formatHistoryLabel(rec)}
                >
                  {formatHistoryLabel(rec)}
                </button>
                {rec.canDelete &&
                  (confirmId === rec.id ? (
                    <span className="flex shrink-0 items-center gap-1 pr-1 text-[10px]">
                      <span className="text-ink-3">{t("modelHistory.deleteConfirm")}</span>
                      <button
                        type="button"
                        onClick={() => doDelete(rec.id)}
                        className="rounded bg-neg/15 px-1.5 py-0.5 font-semibold text-neg hover:bg-neg/25"
                      >
                        {t("modelHistory.deleteYes")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded px-1.5 py-0.5 text-ink-3 hover:text-ink"
                      >
                        {t("modelHistory.deleteNo")}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(rec.id)}
                      title={t("modelHistory.deleteConfirm")}
                      className="shrink-0 rounded px-1.5 py-1 text-[13px] leading-none text-ink-3 hover:text-neg"
                    >
                      ×
                    </button>
                  ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
