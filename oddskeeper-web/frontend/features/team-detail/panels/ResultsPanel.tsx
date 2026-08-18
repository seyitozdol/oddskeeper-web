"use client";

import { useMemo, useState } from "react";
import type { TeamResultRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { ResultBadge } from "../components/ResultBadge";
import TeamLink from "@/components/links/TeamLink";
import { useI18n } from "@/lib/i18n/LanguageProvider";

type ResultsPanelProps = {
  rows?: TeamResultRow[];
};

function OpponentName({
  teamSlug,
  name,
}: {
  teamSlug: string | null | undefined;
  name: string | null | undefined;
}) {
  const displayName = name ?? "—";

  if (!teamSlug) {
    return <span>{displayName}</span>;
  }

  return (
    <TeamLink
      teamSlug={teamSlug}
      className="font-medium text-ink transition hover:text-ink hover:underline"
      title={displayName}
    >
      {displayName}
    </TeamLink>
  );
}

// Rekabet chip sirasi: lig(ler) once, kupalar sonra (satirlardaki gorunum sirasi).
const COMP_ORDER = [
  "Süper Lig",
  "Trendyol 1. Lig",
  "Türkiye Kupası",
  "UEFA Şampiyonlar Ligi",
  "UEFA Avrupa Ligi",
  "UEFA Konferans Ligi",
];

export function ResultsPanel({ rows = [] }: ResultsPanelProps) {
  const { t } = useI18n();
  // Tek profil tum rekabetleri listeler; chip'lerle rekabet bazinda suzulur
  // (varsayilan: tumu). Yalniz tek rekabet varsa chip'ler gizli.
  const [compFilter, setCompFilter] = useState<string>("all");

  const competitions = useMemo(() => {
    const present = new Set(
      rows.map((r) => r.competition).filter((c): c is string => Boolean(c))
    );
    return [
      ...COMP_ORDER.filter((c) => present.has(c)),
      ...[...present].filter((c) => !COMP_ORDER.includes(c)).sort(),
    ];
  }, [rows]);

  const filteredRows = useMemo(
    () =>
      compFilter === "all"
        ? rows
        : rows.filter((r) => r.competition === compFilter),
    [rows, compFilter]
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-veil px-4 py-3 text-sm text-ink-2">
        {t("teamDetail.noResultData")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {competitions.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCompFilter("all")}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              compFilter === "all"
                ? "border-line-strong bg-card-2 text-ink"
                : "border-line bg-veil text-ink-2 hover:bg-veil"
            }`}
          >
            {t("playerDetail.allWithCount", { count: rows.length })}
          </button>
          {competitions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCompFilter(c)}
              className={`rounded-xl border px-3 py-2 text-sm transition ${
                compFilter === c
                  ? "border-line-strong bg-card-2 text-ink"
                  : "border-line bg-veil text-ink-2 hover:bg-veil"
              }`}
            >
              {c} ({rows.filter((r) => r.competition === c).length})
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="min-w-full border-collapse">
          <thead className="bg-veil">
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
              <th className="px-3 py-2 font-medium">{t("common.date")}</th>
              <th className="px-3 py-2 font-medium">{t("common.competition")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colHomeAway")}</th>
              <th className="px-3 py-2 font-medium">{t("common.opponent")}</th>
              <th className="px-3 py-2 font-medium">{t("common.score")}</th>
              <th className="px-3 py-2 font-medium">{t("common.result")}</th>
              <th className="px-3 py-2 font-medium">{t("teamDetail.colVenue")}</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row) => {
              return (
                <tr
                  key={`${row.source_match_id}-${row.team_slug}`}
                  className="border-t border-line text-[13px] text-ink-2 transition hover:bg-veil"
                >
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {formatDate(row.match_datetime)}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                    {row.competition ?? "—"}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className="rounded-md border border-line bg-veil px-2 py-[2px] text-[10px] font-medium text-ink-2">
                      {row.is_home ? t("common.home") : t("common.away")}
                    </span>
                  </td>

                  <td className="px-3 py-1.5 min-w-[210px]">
                    <OpponentName
                      teamSlug={row.opponent_team_slug}
                      name={row.opponent_team_name ?? row.opponent_name}
                    />
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-ink">
                    {row.score_display ?? "—"}
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <ResultBadge resultCode={row.result_code} compact />
                  </td>

                  <td className="px-3 py-1.5 min-w-[210px] text-ink-2">
                    {row.venue_label ?? row.venue ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
