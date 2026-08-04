"use client";

import { useI18n } from "../../../lib/i18n/LanguageProvider";

// Match Stats Model sekmesi şimdilik boş; ileride maç bazlı model buraya gelecek.
export default function ResmiMatchStatsModel() {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-line bg-card px-5 py-16 text-center text-sm text-ink-3">
      {t("tsl.matchStatsModelSoon")}
    </div>
  );
}
