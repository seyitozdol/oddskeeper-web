import { getT } from "@/lib/i18n/server";
import type { MatchIncidentRow } from "../types";

type MatchIncidentsPanelProps = {
  rows: MatchIncidentRow[];
};

function getSideBadgeClass(side: string | null) {
  if (side === "home") {
    return "border-sky-500/25 bg-sky-500/10 text-sky-300";
  }

  if (side === "away") {
    return "border-violet-500/25 bg-violet-500/10 text-violet-300";
  }

  return "border-white/10 bg-white/[0.03] text-white/60";
}

export async function MatchIncidentsPanel({ rows }: MatchIncidentsPanelProps) {
  const t = await getT();

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        {t("matchDetail.noIncidents")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl overflow-x-auto rounded-[14px] border border-white/10">
      <table className="min-w-full border-collapse">
        <thead className="bg-white/[0.03]">
          <tr className="text-left text-[9px] uppercase tracking-[0.14em] text-white/38">
            <th className="px-3 py-2 font-medium">{t("matchDetail.colMinute")}</th>
            <th className="px-3 py-2 font-medium">{t("matchDetail.colSide")}</th>
            <th className="px-3 py-2 font-medium">{t("matchDetail.colEvent")}</th>
            <th className="px-3 py-2 font-medium">{t("matchDetail.colPrimary")}</th>
            <th className="px-3 py-2 font-medium">{t("matchDetail.colSecondary")}</th>
            <th className="px-3 py-2 font-medium">{t("matchDetail.colRaw")}</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.source_match_id}-${row.minute_sort}-${row.event_type_code}-${index}`}
              className="border-t border-white/10 text-[12px] text-white/80 transition hover:bg-white/[0.018]"
            >
              <td className="px-3 py-2 whitespace-nowrap">
                {row.minute_text ?? "—"}
              </td>

              <td className="px-3 py-2 whitespace-nowrap">
                <span
                  className={`inline-flex min-w-[50px] items-center justify-center rounded-md border px-2 py-[1px] text-[9px] font-semibold uppercase ${getSideBadgeClass(
                    row.side
                  )}`}
                >
                  {row.side ?? "—"}
                </span>
              </td>

              <td className="px-3 py-2 whitespace-nowrap text-white">
                {row.event_title ?? row.event_type_code ?? "—"}
              </td>

              <td className="px-3 py-2 whitespace-nowrap">
                {row.primary_player_text ?? "—"}
              </td>

              <td className="px-3 py-2 whitespace-nowrap">
                {row.secondary_player_text ?? "—"}
              </td>

              <td className="px-3 py-2 min-w-[220px] text-white/55">
                {row.raw_text ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}