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

export function TeamStatisticsPanel({
  teamProfile = null,
  summary,
  splits = [],
  recentForm = [],
}: TeamStatisticsPanelProps) {
  if (!summary) {
    return (
      <div className="space-y-3">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          <CompactInfoCard
            label="Founded"
            value={getMetaValue(teamProfile?.founded_year)}
          />
          <CompactInfoCard
            label="Stadium"
            value={getMetaValue(teamProfile?.stadium_name)}
          />
          <CompactInfoCard
            label="Head Coach"
            value={getMetaValue(teamProfile?.head_coach)}
          />
          <CompactInfoCard
            label="Website"
            value={getWebsiteLabel(teamProfile?.website_url)}
          />
          <CompactInfoCard
            label="Capacity"
            value={formatCapacity(teamProfile?.capacity ?? null)}
          />
          <CompactInfoCard
            label="Market Value"
            value={getMetaValue(teamProfile?.market_value_display)}
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
          No team statistics data found for this team.
        </div>
      </div>
    );
  }

  const lastFiveSummary = getLastFiveSummary(recentForm);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <CompactInfoCard
          label="Founded"
          value={getMetaValue(teamProfile?.founded_year)}
        />
        <CompactInfoCard
          label="Stadium"
          value={getMetaValue(teamProfile?.stadium_name)}
        />
        <CompactInfoCard
          label="Head Coach"
          value={getMetaValue(teamProfile?.head_coach)}
        />
        <CompactInfoCard
          label="Website"
          value={getWebsiteLabel(teamProfile?.website_url)}
        />
        <CompactInfoCard
          label="Capacity"
          value={formatCapacity(teamProfile?.capacity ?? null)}
        />
        <CompactInfoCard
          label="Market Value"
          value={getMetaValue(teamProfile?.market_value_display)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/48">
        <span>{summary.competition ?? "—"}</span>
        <span className="text-white/20">•</span>
        <span>{summary.season_label ?? "—"}</span>
        <span className="text-white/20">•</span>
        <span>Updated through {formatDate(summary.latest_match_datetime)}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Played" value={String(summary.played)} />
        <StatCard label="Points" value={String(summary.points)} />
        <StatCard label="Wins" value={String(summary.wins)} />
        <StatCard label="Draws" value={String(summary.draws)} />
        <StatCard label="Losses" value={String(summary.losses)} />
        <StatCard
          label="Goal Difference"
          value={String(summary.goal_difference)}
        />
        <StatCard label="Goals For" value={String(summary.goals_for)} />
        <StatCard
          label="Goals Against"
          value={String(summary.goals_against)}
        />
        <StatCard
          label="Win Rate"
          value={formatPercentage(summary.win_rate_pct)}
        />
        <StatCard
          label="Points Per Game"
          value={formatDecimal(summary.points_per_game)}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <SplitStatsTable rows={splits} />

        <div className="space-y-3">
          <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/42">
              Recent Form
            </div>

            <RecentFormStrip rows={recentForm} />

            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatCard
                label="Last 5 Points"
                value={String(lastFiveSummary.points)}
              />
              <StatCard
                label="Last 5 GF"
                value={String(lastFiveSummary.goalsFor)}
              />
              <StatCard
                label="Last 5 GA"
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