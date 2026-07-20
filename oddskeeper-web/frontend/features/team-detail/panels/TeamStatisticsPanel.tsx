import { getT } from "@/lib/i18n/server";
import { CompactInfoCard } from "../components/CompactInfoCard";
import { LastFiveMatchesList } from "../components/LastFiveMatchesList";
import { RecentFormStrip } from "../components/RecentFormStrip";
import { SplitStatsTable } from "../components/SplitStatsTable";
import { StatCard } from "../components/StatCard";
import type {
  TeamProfileRow,
  TeamRecentFormRow,
  TeamStatisticsSplitRow,
  TeamStatisticsSummaryRow,
} from "../types";
import { formatCapacity } from "../utils/formatCapacity";
import { formatDate } from "../utils/formatDate";
import { formatDecimal } from "../utils/formatDecimal";
import { formatPercentage } from "../utils/formatPercentage";
import { getLastFiveSummary } from "../utils/getLastFiveSummary";
import { getMetaValue } from "../utils/getMetaValue";
import { getWebsiteLabel } from "../utils/getWebsiteLabel";

type TeamStatisticsPanelProps = {
  teamProfile?: TeamProfileRow | null;
  summary: TeamStatisticsSummaryRow | null;
  splits?: TeamStatisticsSplitRow[];
  recentForm?: TeamRecentFormRow[];
};

export async function TeamStatisticsPanel({
  teamProfile = null,
  summary,
  splits = [],
  recentForm = [],
}: TeamStatisticsPanelProps) {
  const t = await getT();

  if (!summary) {
    return (
      <div className="space-y-3">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          <CompactInfoCard
            label={t("teamDetail.labelFounded")}
            value={getMetaValue(teamProfile?.founded_year)}
          />
          <CompactInfoCard
            label={t("teamDetail.labelStadium")}
            value={getMetaValue(teamProfile?.stadium_name)}
          />
          <CompactInfoCard
            label={t("teamDetail.labelHeadCoach")}
            value={getMetaValue(teamProfile?.head_coach)}
          />
          <CompactInfoCard
            label={t("teamDetail.labelWebsite")}
            value={getWebsiteLabel(teamProfile?.website_url)}
          />
          <CompactInfoCard
            label={t("teamDetail.labelCapacity")}
            value={formatCapacity(teamProfile?.capacity ?? null)}
          />
          <CompactInfoCard
            label={t("teamDetail.labelMarketValue")}
            value={getMetaValue(teamProfile?.market_value_display)}
          />
        </div>

        <div className="rounded-xl border border-line bg-veil px-4 py-3 text-sm text-ink-2">
          {t("teamDetail.noTeamStatsData")}
        </div>
      </div>
    );
  }

  const lastFiveSummary = getLastFiveSummary(recentForm);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <CompactInfoCard
          label={t("teamDetail.labelFounded")}
          value={getMetaValue(teamProfile?.founded_year)}
        />
        <CompactInfoCard
          label={t("teamDetail.labelStadium")}
          value={getMetaValue(teamProfile?.stadium_name)}
        />
        <CompactInfoCard
          label={t("teamDetail.labelHeadCoach")}
          value={getMetaValue(teamProfile?.head_coach)}
        />
        <CompactInfoCard
          label={t("teamDetail.labelWebsite")}
          value={getWebsiteLabel(teamProfile?.website_url)}
        />
        <CompactInfoCard
          label={t("teamDetail.labelCapacity")}
          value={formatCapacity(teamProfile?.capacity ?? null)}
        />
        <CompactInfoCard
          label={t("teamDetail.labelMarketValue")}
          value={getMetaValue(teamProfile?.market_value_display)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
        <span>{summary.competition ?? "—"}</span>
        <span className="text-ink-3">•</span>
        <span>{summary.season_label ?? "—"}</span>
        <span className="text-ink-3">•</span>
        <span>
          {t("teamDetail.updatedThrough", {
            date: formatDate(summary.latest_match_datetime),
          })}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label={t("teamDetail.statPlayed")} value={String(summary.played)} />
        <StatCard label={t("teamDetail.statPoints")} value={String(summary.points)} />
        <StatCard label={t("teamDetail.statWins")} value={String(summary.wins)} />
        <StatCard label={t("teamDetail.statDraws")} value={String(summary.draws)} />
        <StatCard label={t("teamDetail.statLosses")} value={String(summary.losses)} />
        <StatCard
          label={t("teamDetail.statGoalDifference")}
          value={String(summary.goal_difference)}
        />
        <StatCard label={t("teamDetail.statGoalsFor")} value={String(summary.goals_for)} />
        <StatCard
          label={t("teamDetail.statGoalsAgainst")}
          value={String(summary.goals_against)}
        />
        <StatCard
          label={t("teamDetail.statWinRate")}
          value={formatPercentage(summary.win_rate_pct)}
        />
        <StatCard
          label={t("teamDetail.statPointsPerGame")}
          value={formatDecimal(summary.points_per_game)}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <SplitStatsTable rows={splits} />

        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-veil px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">
              {t("teamDetail.recentFormTitle")}
            </div>

            <RecentFormStrip rows={recentForm} />

            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatCard
                label={t("teamDetail.statLast5Points")}
                value={String(lastFiveSummary.points)}
              />
              <StatCard
                label={t("teamDetail.statLast5Gf")}
                value={String(lastFiveSummary.goalsFor)}
              />
              <StatCard
                label={t("teamDetail.statLast5Ga")}
                value={String(lastFiveSummary.goalsAgainst)}
              />
            </div>
          </div>

          <LastFiveMatchesList rows={recentForm} />
        </div>
      </div>
    </div>
  );
}