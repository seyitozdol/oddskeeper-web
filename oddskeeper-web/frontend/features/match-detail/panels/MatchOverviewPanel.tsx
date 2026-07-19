import TeamLink from "@/components/links/TeamLink";
import { getT } from "@/lib/i18n/server";
import type { MatchProfileRow } from "../types";
import { formatDateTime } from "../utils/formatDateTime";

type MatchOverviewPanelProps = {
  profile: MatchProfileRow;
};

export async function MatchOverviewPanel({ profile }: MatchOverviewPanelProps) {
  const t = await getT();

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-white/38">
          {t("matchDetail.matchContext")}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              {t("common.competition")}
            </div>
            <div className="mt-1 text-base font-medium text-white">
              {profile.competition ?? "—"}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              {t("matchDetail.kickoff")}
            </div>
            <div className="mt-1 text-base font-medium text-white">
              {formatDateTime(profile.match_datetime)}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              {t("matchDetail.venue")}
            </div>
            <div className="mt-1 text-base font-medium text-white">
              {profile.venue ?? "—"}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              {t("common.score")}
            </div>
            <div className="mt-1 text-base font-medium text-white">
              {profile.score_display ?? "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-white/38">
          {t("matchDetail.teamsTitle")}
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              {t("common.home")}
            </div>
            <div className="mt-1 text-base font-medium text-white">
              <TeamLink
                teamSlug={profile.home_team_slug}
                className="font-medium text-white transition hover:text-white hover:underline"
                title={profile.home_team_name ?? t("common.home")}
              >
                {profile.home_team_name ?? "—"}
              </TeamLink>
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              {t("common.away")}
            </div>
            <div className="mt-1 text-base font-medium text-white">
              <TeamLink
                teamSlug={profile.away_team_slug}
                className="font-medium text-white transition hover:text-white hover:underline"
                title={profile.away_team_name ?? t("common.away")}
              >
                {profile.away_team_name ?? "—"}
              </TeamLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}