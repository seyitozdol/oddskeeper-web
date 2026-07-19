import Image from "next/image";
import Link from "next/link";
import TeamLink from "@/components/links/TeamLink";
import { getT } from "@/lib/i18n/server";
import { MATCH_TAB_LABEL_KEYS, VALID_MATCH_TABS } from "../constants";
import type { MatchProfileRow, ValidMatchTab } from "../types";
import { formatDateTime } from "../utils/formatDateTime";

type MatchDetailHeaderProps = {
  profile: MatchProfileRow;
  activeTab: ValidMatchTab;
  backHref: string;
};

function getTeamLogoPath(teamSlug?: string | null) {
  if (!teamSlug) return null;
  return `/images/football_logos/${teamSlug}.png`;
}

function TeamBadge({
  teamName,
  teamSlug,
}: {
  teamName: string | null;
  teamSlug: string | null;
}) {
  const logoPath = getTeamLogoPath(teamSlug);

  return (
    <div className="flex min-w-[180px] flex-col items-center gap-3 text-center">
      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        {logoPath ? (
          <Image
            src={logoPath}
            alt={teamName ?? "Team"}
            width={56}
            height={56}
            className="h-auto max-h-[56px] w-auto max-w-[56px] object-contain"
          />
        ) : (
          <div className="text-xs text-white/35">No logo</div>
        )}
      </div>

      <TeamLink
        teamSlug={teamSlug}
        className="text-base font-semibold text-white transition hover:text-white hover:underline"
        title={teamName ?? "Team"}
      >
        {teamName ?? "—"}
      </TeamLink>
    </div>
  );
}

export async function MatchDetailHeader({
  profile,
  activeTab,
  backHref,
}: MatchDetailHeaderProps) {
  const t = await getT();

  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] p-5 shadow-[0_0_50px_rgba(34,104,189,0.08)]">
      <div className="flex flex-col gap-5">
        <div className="text-xs uppercase tracking-[0.28em] text-[#7cbcff]">
          {t("matchDetail.kicker")}
        </div>

        <div className="flex flex-col items-center justify-between gap-5 xl:flex-row">
          <TeamBadge
            teamName={profile.home_team_name}
            teamSlug={profile.home_team_slug}
          />

          <div className="flex flex-col items-center text-center">
            <div className="text-sm text-white/55">
              {profile.competition ?? "—"}
            </div>

            <div className="mt-2 text-4xl font-semibold text-white lg:text-6xl">
              {profile.score_display ?? "—"}
            </div>

            <div className="mt-3 text-sm text-white/65">
              {formatDateTime(profile.match_datetime)}
            </div>

            <div className="mt-1 text-sm text-white/50">
              {profile.venue ?? "—"}
            </div>
          </div>

          <TeamBadge
            teamName={profile.away_team_name}
            teamSlug={profile.away_team_slug}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {VALID_MATCH_TABS.map((tab) => {
            const isActive = activeTab === tab;
            const href = `/dashboard/stats-analysis/football/match-stats/detail?match=${encodeURIComponent(
              profile.source_match_id
            )}&tab=${tab}&returnTo=${encodeURIComponent(backHref)}`;

            return (
              <Link
                key={tab}
                href={href}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  isActive
                    ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
                }`}
              >
                {t(MATCH_TAB_LABEL_KEYS[tab])}
              </Link>
            );
          })}

          <Link
            href={backHref}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 transition hover:bg-white/[0.06]"
          >
            {t("matchDetail.backLabel")}
          </Link>
        </div>
      </div>
    </div>
  );
}