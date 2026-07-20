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
      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-line bg-veil p-3">
        {logoPath ? (
          <Image
            src={logoPath}
            alt={teamName ?? "Team"}
            width={56}
            height={56}
            className="h-auto max-h-[56px] w-auto max-w-[56px] object-contain"
          />
        ) : (
          <div className="text-xs text-ink-3">No logo</div>
        )}
      </div>

      <TeamLink
        teamSlug={teamSlug}
        className="text-base font-semibold text-ink transition hover:text-ink hover:underline"
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
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-col gap-5">
        <div className="text-xs uppercase tracking-[0.28em] text-accent-ink">
          {t("matchDetail.kicker")}
        </div>

        <div className="flex flex-col items-center justify-between gap-5 xl:flex-row">
          <TeamBadge
            teamName={profile.home_team_name}
            teamSlug={profile.home_team_slug}
          />

          <div className="flex flex-col items-center text-center">
            <div className="text-sm text-ink-2">
              {profile.competition ?? "—"}
            </div>

            <div className="mt-2 text-4xl font-semibold text-ink lg:text-6xl">
              {profile.score_display ?? "—"}
            </div>

            <div className="mt-3 text-sm text-ink-2">
              {formatDateTime(profile.match_datetime)}
            </div>

            <div className="mt-1 text-sm text-ink-3">
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
                    ? "border-line-strong bg-card-2 text-ink"
                    : "border-line bg-veil text-ink-2 hover:bg-veil"
                }`}
              >
                {t(MATCH_TAB_LABEL_KEYS[tab])}
              </Link>
            );
          })}

          <Link
            href={backHref}
            className="rounded-xl border border-line bg-veil px-3 py-2 text-sm text-ink transition hover:bg-veil"
          >
            {t("matchDetail.backLabel")}
          </Link>
        </div>
      </div>
    </div>
  );
}