import { getT } from "@/lib/i18n/server";
import type { TeamFixtureRow } from "../types";
import { formatFixtureDate } from "../utils/formatFixtureDate";
import { formatKickoffTime } from "../utils/formatKickoffTime";
import TeamLink from "@/components/links/TeamLink";
import type { Translator } from "@/lib/i18n/messages";

type FixturePanelProps = {
  rows?: TeamFixtureRow[];
};

function getStatusClass(status: TeamFixtureRow["fixture_status"]) {
  if (status === "scheduled") {
    return "border-accent/25 bg-accent-soft text-accent-ink";
  }

  if (status === "completed") {
    return "border-pos/25 bg-pos/10 text-pos";
  }

  if (status === "postponed") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-500";
  }

  if (status === "cancelled") {
    return "border-neg/25 bg-neg/10 text-neg";
  }

  return "border-line bg-veil text-ink-2";
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  scheduled: "teamDetail.statusScheduled",
  completed: "teamDetail.statusCompleted",
  postponed: "teamDetail.statusPostponed",
  cancelled: "teamDetail.statusCancelled",
};

function getStatusLabel(
  status: TeamFixtureRow["fixture_status"],
  t: Translator
) {
  if (!status) return t("teamDetail.statusUnknown");
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(key) : status.replace(/_/g, " ");
}

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

export async function FixturePanel({ rows = [] }: FixturePanelProps) {
  const t = await getT();

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-veil px-4 py-3 text-sm text-ink-2">
        {t("teamDetail.noFixtureData")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="min-w-full border-collapse">
        <thead className="bg-veil">
          <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
            <th className="px-3 py-2 font-medium">{t("common.date")}</th>
            <th className="px-3 py-2 font-medium">{t("teamDetail.colTime")}</th>
            <th className="px-3 py-2 font-medium">{t("teamDetail.colHomeAway")}</th>
            <th className="px-3 py-2 font-medium">{t("common.opponent")}</th>
            <th className="px-3 py-2 font-medium">{t("teamDetail.colRound")}</th>
            <th className="px-3 py-2 font-medium">{t("teamDetail.colStatus")}</th>
            <th className="px-3 py-2 font-medium">{t("common.competition")}</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.fixture_id}
              className="border-t border-line text-[13px] text-ink-2 transition hover:bg-veil"
            >
              <td className="px-3 py-1.5 whitespace-nowrap">
                {formatFixtureDate(row.fixture_date)}
              </td>

              <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                {formatKickoffTime(row.kickoff_time_known, row.kickoff_time_text)}
              </td>

              <td className="px-3 py-1.5 whitespace-nowrap">
                <span className="rounded-md border border-line bg-veil px-2 py-[2px] text-[10px] font-medium text-ink-2">
                  {row.is_home ? t("common.home") : t("common.away")}
                </span>
              </td>

              <td className="px-3 py-1.5 min-w-[210px] font-medium text-ink">
                <OpponentName
                  teamSlug={row.opponent_team_slug}
                  name={row.opponent_name}
                />
              </td>

              <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                {row.round_number}
              </td>

              <td className="px-3 py-1.5 whitespace-nowrap">
                <span
                  className={`inline-flex min-w-[64px] items-center justify-center rounded-md border px-2 py-[2px] text-[10px] font-semibold uppercase ${getStatusClass(
                    row.fixture_status
                  )}`}
                >
                  {getStatusLabel(row.fixture_status, t)}
                </span>
              </td>

              <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                {row.competition ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}