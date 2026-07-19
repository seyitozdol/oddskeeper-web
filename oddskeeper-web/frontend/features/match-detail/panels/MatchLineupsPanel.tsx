import Image from "next/image";
import PlayerLink from "@/components/links/PlayerLink";
import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/messages";
import type { MatchParticipantRow } from "../types";

type MatchLineupsPanelProps = {
  rows: MatchParticipantRow[];
};

function getTeamLogoPath(teamSlug?: string | null) {
  if (!teamSlug) return null;
  return `/images/football_logos/${teamSlug}.png`;
}

function getStatusRank(lineupStatus?: string | null) {
  const value = (lineupStatus ?? "").toLowerCase();

  if (value === "starter") return 1;
  if (value === "substitute") return 2;
  return 3;
}

function sortParticipants(a: MatchParticipantRow, b: MatchParticipantRow) {
  const byStatus = getStatusRank(a.lineup_status) - getStatusRank(b.lineup_status);
  if (byStatus !== 0) return byStatus;

  const aMinutes = a.minutes_played ?? 0;
  const bMinutes = b.minutes_played ?? 0;
  if (aMinutes !== bMinutes) return bMinutes - aMinutes;

  return a.player_name.localeCompare(b.player_name);
}

function getStatusBadgeClass(lineupStatus?: string | null) {
  const value = (lineupStatus ?? "").toLowerCase();

  if (value === "starter") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  if (value === "substitute") {
    return "border-sky-500/25 bg-sky-500/10 text-sky-300";
  }

  return "border-white/10 bg-white/[0.03] text-white/60";
}

function TeamLogo({
  teamSlug,
  teamName,
}: {
  teamSlug?: string | null;
  teamName?: string | null;
}) {
  const logoPath = getTeamLogoPath(teamSlug);

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
      {logoPath ? (
        <Image
          src={logoPath}
          alt={teamName ?? "Team"}
          width={20}
          height={20}
          className="h-auto max-h-[20px] w-auto max-w-[20px] object-contain"
        />
      ) : (
        <div className="text-[10px] text-white/35">—</div>
      )}
    </div>
  );
}

function TeamParticipantsCard({
  teamSlug,
  teamName,
  rows,
  t,
}: {
  teamSlug?: string | null;
  teamName?: string | null;
  rows: MatchParticipantRow[];
  t: Translator;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-[16px] border border-white/10 bg-white/[0.03] p-3">
      <div
        className="grid items-center gap-2 border-b border-white/10 pb-2 text-[9px] uppercase tracking-[0.12em] text-white/35"
        style={{ gridTemplateColumns: "28px minmax(0,220px) 34px 38px 72px" }}
      >
        <TeamLogo teamSlug={teamSlug} teamName={teamName} />
        <div>{t("common.player")}</div>
        <div>{t("common.position")}</div>
        <div>{t("common.minutes")}</div>
        <div>{t("matchDetail.colStatus")}</div>
      </div>

      {rows.length === 0 ? (
        <div className="pt-3 text-sm text-white/55">
          {t("matchDetail.noParticipantDataTeam")}
        </div>
      ) : (
        <div className="pt-1">
          {rows.map((row) => (
            <div
              key={`${row.source_match_id}-${row.player_source_id}`}
              className="grid items-center gap-2 border-b border-white/8 px-0 py-1.5 text-[12px] text-white/80 last:border-b-0"
              style={{ gridTemplateColumns: "28px minmax(0,220px) 34px 38px 72px" }}
            >
              <div />

              <div className="min-w-0">
                <PlayerLink
                  playerSlug={row.player_slug}
                  className="block truncate font-medium text-white transition hover:text-white hover:underline"
                  title={row.player_name}
                >
                  {row.player_name}
                </PlayerLink>
              </div>

              <div className="whitespace-nowrap text-white/65">
                {row.position_code ?? "—"}
              </div>

              <div className="whitespace-nowrap">
                {row.minutes_played ?? "—"}
              </div>

              <div className="whitespace-nowrap">
                <span
                  className={`inline-flex h-5 min-w-[68px] items-center justify-center rounded-md border px-2 text-[9px] font-semibold uppercase ${getStatusBadgeClass(
                    row.lineup_status
                  )}`}
                >
                  {row.lineup_status ?? "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export async function MatchLineupsPanel({ rows }: MatchLineupsPanelProps) {
  const t = await getT();

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        {t("matchDetail.noParticipantData")}
      </div>
    );
  }

  const homeRows = rows
    .filter((row) => row.team_side === "home")
    .sort(sortParticipants);

  const awayRows = rows
    .filter((row) => row.team_side === "away")
    .sort(sortParticipants);

  const homeName = homeRows[0]?.team_name ?? t("common.home");
  const awayName = awayRows[0]?.team_name ?? t("common.away");
  const homeSlug = homeRows[0]?.team_slug ?? null;
  const awaySlug = awayRows[0]?.team_slug ?? null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-white/40">
        {t("matchDetail.participantLayer")}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <TeamParticipantsCard
          teamSlug={homeSlug}
          teamName={homeName}
          rows={homeRows}
          t={t}
        />

        <TeamParticipantsCard
          teamSlug={awaySlug}
          teamName={awayName}
          rows={awayRows}
          t={t}
        />
      </div>
    </div>
  );
}