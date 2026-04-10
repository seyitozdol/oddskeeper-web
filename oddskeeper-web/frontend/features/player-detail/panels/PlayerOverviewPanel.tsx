import type { ReactNode } from "react";
import TeamLink from "@/components/links/TeamLink";
import MatchLink from "@/components/links/MatchLink";
import { PlayerResultBadge } from "../components/PlayerResultBadge";
import type { PlayerMatchLogRow, PlayerProfileRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { formatDecimal } from "../utils/formatDecimal";

type PlayerOverviewPanelProps = {
  profile: PlayerProfileRow;
  matchLog?: PlayerMatchLogRow[];
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;

  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function formatValue(value: ReactNode) {
  return value === null || value === undefined || value === "" ? "—" : value;
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-white">
        {formatValue(value)}
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-white">
        {formatValue(value)}
      </div>
    </div>
  );
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
      className="font-medium text-white transition hover:text-white hover:underline"
      title={displayName}
    >
      {displayName}
    </TeamLink>
  );
}

export function PlayerOverviewPanel({
  profile,
  matchLog = [],
}: PlayerOverviewPanelProps) {
  const recentRows = matchLog.slice(0, 5);

  const last5Starts = recentRows.filter(
    (row) => (row.lineup_status ?? "").toLowerCase() === "starter"
  ).length;

  const last5SubApps = recentRows.filter(
    (row) => (row.lineup_status ?? "").toLowerCase() === "substitute"
  ).length;

  const last5Minutes = recentRows.reduce(
    (sum, row) => sum + (row.minutes_played ?? 0),
    0
  );

  const last5Goals = recentRows.reduce(
    (sum, row) => sum + (row.goals ?? 0),
    0
  );

  const last5Assists = recentRows.reduce(
    (sum, row) => sum + (row.assists ?? 0),
    0
  );

  const last5Xg = recentRows.reduce(
    (sum, row) => sum + toNumber(row.expected_goals),
    0
  );

  const last5AvgMinutes =
    recentRows.length > 0 ? last5Minutes / recentRows.length : 0;

  const overviewReturnTo = `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(
    profile.player_slug
  )}&tab=overview`;

  return (
    <div className="space-y-3">
      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/38">
              Player Context
            </div>

            <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <InfoItem
                label="Team"
                value={
                  <TeamLink
                    teamSlug={profile.team_slug}
                    className="font-medium text-white transition hover:text-white hover:underline"
                    title={profile.team_name}
                  >
                    {profile.team_name}
                  </TeamLink>
                }
              />
              <InfoItem label="Competition" value={profile.competition ?? "—"} />
              <InfoItem label="Season" value={profile.season_label ?? "—"} />
              <InfoItem label="Position Group" value={profile.position_group} />
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/38">
              Season Summary
            </div>

            <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <InfoItem
                label="Avg Minutes"
                value={formatDecimal(profile.avg_minutes)}
              />
              <InfoItem
                label="Sub Appearances"
                value={profile.sub_appearances}
              />
              <InfoItem
                label="First Match"
                value={formatDate(profile.first_match_datetime)}
              />
              <InfoItem
                label="Last Match"
                value={formatDate(profile.last_match_datetime)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-white/38">
          Recent Form
        </div>

        {recentRows.length === 0 ? (
          <div className="mt-3 text-sm text-white/55">
            No recent form data found.
          </div>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {recentRows.map((row) => (
              <div
                key={`${row.source_match_id}-${row.player_source_id}`}
                className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <PlayerResultBadge resultCode={row.result_code} />
                  <div className="text-[10px] text-white/45">
                    {formatDate(row.match_datetime)}
                  </div>
                </div>

                <div className="mt-2 truncate text-sm font-medium text-white">
                  <OpponentName
                    teamSlug={row.opponent_team_slug}
                    name={row.opponent_name}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
                  <span>{row.score_display ?? "—"}</span>
                  <span>{row.minutes_played ?? "—"} min</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-white/38">
          Last 5 Summary
        </div>

        <div className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-3 xl:grid-cols-7">
          <SummaryItem label="Matches" value={recentRows.length} />
          <SummaryItem label="Starts" value={last5Starts} />
          <SummaryItem label="Subs" value={last5SubApps} />
          <SummaryItem label="Minutes" value={last5Minutes} />
          <SummaryItem
            label="Avg Min"
            value={formatDecimal(last5AvgMinutes, 1)}
          />
          <SummaryItem label="Goals" value={last5Goals} />
          <SummaryItem label="Assists" value={last5Assists} />
        </div>

        <div className="mt-3 max-w-[160px]">
          <SummaryItem label="xG" value={formatDecimal(last5Xg, 2)} />
        </div>
      </div>

      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-white/38">
          Recent Matches
        </div>

        {recentRows.length === 0 ? (
          <div className="mt-3 text-sm text-white/55">
            No recent match data found.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[14px] border border-white/10">
            <table className="min-w-full border-collapse">
              <thead className="bg-white/[0.03]">
                <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Opponent</th>
                  <th className="px-3 py-2 font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">Res</th>
                  <th className="px-3 py-2 font-medium">Min</th>
                  <th className="px-3 py-2 font-medium">G</th>
                  <th className="px-3 py-2 font-medium">A</th>
                  <th className="px-3 py-2 font-medium">xG</th>
                </tr>
              </thead>

              <tbody>
                {recentRows.map((row) => (
                  <tr
                    key={`${row.source_match_id}-${row.player_source_id}`}
                    className="border-t border-white/10 text-[12px] text-white/80"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      <MatchLink
                        sourceMatchId={row.source_match_id}
                        returnTo={overviewReturnTo}
                        className="transition hover:text-white hover:underline"
                        title="Open match detail"
                      >
                        {formatDate(row.match_datetime)}
                      </MatchLink>
                    </td>

                    <td className="px-3 py-2 min-w-[180px]">
                      <OpponentName
                        teamSlug={row.opponent_team_slug}
                        name={row.opponent_name}
                      />
                    </td>

                    <td className="px-3 py-2 whitespace-nowrap">
                      <MatchLink
                        sourceMatchId={row.source_match_id}
                        returnTo={overviewReturnTo}
                        className="transition hover:text-white hover:underline"
                        title="Open match detail"
                      >
                        {row.score_display ?? "—"}
                      </MatchLink>
                    </td>

                    <td className="px-3 py-2 whitespace-nowrap">
                      <PlayerResultBadge resultCode={row.result_code} />
                    </td>

                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.minutes_played ?? "—"}
                    </td>

                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.goals ?? "—"}
                    </td>

                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.assists ?? "—"}
                    </td>

                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDecimal(row.expected_goals, 3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}