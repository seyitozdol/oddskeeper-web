import Image from "next/image";
import { Trophy } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getAllFootballTeamLogos } from "@/lib/football-teams";
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
    return "border-warn/25 bg-warn/10 text-warn";
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

// Rakip logosu: yerel football logosu varsa o; yoksa (Avrupa rakibi) SofaScore
// takim gorseli DOGRUDAN <img> ile (optimizer SofaScore'u sunucudan cekemiyor,
// tarayici ceker). O da yoksa bas harfli daire.
function OpponentLogo({
  slug,
  sourceId,
  name,
  localLogo,
}: {
  slug: string | null | undefined;
  sourceId: string | null | undefined;
  name: string;
  localLogo: string | null;
}) {
  if (localLogo) {
    return (
      <Image
        src={localLogo}
        alt={name}
        width={22}
        height={22}
        className="h-[22px] w-[22px] shrink-0 object-contain"
      />
    );
  }
  if (sourceId && /^\d+$/.test(sourceId)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://img.sofascore.com/api/v1/team/${sourceId}/image`}
        alt={name}
        className="h-[22px] w-[22px] shrink-0 object-contain"
        loading="lazy"
      />
    );
  }
  return (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-line bg-veil text-[10px] font-semibold text-ink-3">
      {(slug ?? name).slice(0, 1).toUpperCase()}
    </span>
  );
}

// Turnuva logosu: bilinen turnuvalar self-host (tsl-league-mark: koyu temada
// beyaz); bilinmeyenlere kupa ikonu. Yeni turnuva geldiginde buraya eklenir.
function competitionLogo(comp: string | null): string | null {
  if (!comp) return null;
  if (comp.includes("Süper Lig")) return "/images/leagues/super-lig-ss.png";
  if (comp.includes("1. Lig")) return "/images/leagues/tff-1-lig-ss.png";
  if (comp.includes("Champions League")) return "/images/leagues/ucl.png";
  if (comp.includes("Europa League")) return "/images/leagues/uel.png";
  if (comp.includes("Conference")) return "/images/leagues/uecl.png";
  return null;
}

function OpponentName({
  teamSlug,
  name,
  linkable,
}: {
  teamSlug: string | null | undefined;
  name: string | null | undefined;
  linkable: boolean;
}) {
  const displayName = name ?? "—";

  if (!teamSlug || !linkable) {
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
  const logos = await getAllFootballTeamLogos();

  // Saat: kickoff_time_text yoksa fixture_datetime'dan (Malta saati; Upcoming
  // Events ile ayni dilim).
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    hour: "2-digit",
    minute: "2-digit",
  });
  const kickoff = (row: TeamFixtureRow) =>
    row.kickoff_time_text
      ? formatKickoffTime(row.kickoff_time_known, row.kickoff_time_text)
      : row.fixture_datetime
        ? timeFmt.format(new Date(row.fixture_datetime))
        : formatKickoffTime(row.kickoff_time_known, row.kickoff_time_text);

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
          {rows.map((row) => {
            const oppSlug = row.opponent_team_slug ?? null;
            const localLogo = oppSlug ? logos[oppSlug] ?? null : null;
            const compLogo = competitionLogo(row.competition);
            return (
              <tr
                key={row.fixture_id}
                className="border-t border-line text-[13px] text-ink-2 transition hover:bg-veil"
              >
                <td className="px-3 py-1.5 whitespace-nowrap">
                  {formatFixtureDate(row.fixture_date)}
                </td>

                <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                  {kickoff(row)}
                </td>

                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span className="rounded-md border border-line bg-veil px-2 py-[2px] text-[10px] font-medium text-ink-2">
                    {row.is_home ? t("common.home") : t("common.away")}
                  </span>
                </td>

                <td className="px-3 py-1.5 min-w-[210px] font-medium text-ink">
                  <span className="flex items-center gap-2">
                    <OpponentLogo
                      slug={oppSlug}
                      sourceId={row.opponent_team_source_id}
                      name={row.opponent_name ?? "—"}
                      localLogo={localLogo}
                    />
                    <OpponentName
                      teamSlug={oppSlug}
                      name={row.opponent_name}
                      linkable={Boolean(localLogo)}
                    />
                  </span>
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
                  <span className="flex items-center gap-1.5">
                    {compLogo ? (
                      <Image
                        src={compLogo}
                        alt={row.competition ?? ""}
                        width={18}
                        height={18}
                        className="tsl-league-mark h-[18px] w-[18px] shrink-0 object-contain"
                      />
                    ) : (
                      <Trophy className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                    )}
                    {row.competition ?? "—"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
