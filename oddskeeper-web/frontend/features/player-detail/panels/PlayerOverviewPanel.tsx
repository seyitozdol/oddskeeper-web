import TeamLink from "@/components/links/TeamLink";
import MatchLink from "@/components/links/MatchLink";
import { PlayerResultBadge } from "../components/PlayerResultBadge";
import type { PlayerMatchLogRow, PlayerProfileRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { formatDecimal } from "../utils/formatDecimal";

type PlayerOverviewPanelProps = {
  profile: PlayerProfileRow;
  matchLog: PlayerMatchLogRow[];
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;

  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
}

export function PlayerOverviewPanel({
  profile,
  matchLog,
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
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-white/38">
            Player Context
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Team
              </div>
              <div className="mt-1 text-base font-medium text-white">
                <TeamLink
                  teamSlug={profile.team_slug}
                  className="font-medium text-white transition hover:text-white hover:underline"
                  title={profile.team_name}
                >
                  {profile.team_name}
                </TeamLink>
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Competition
              </div>
              <div className="mt-1 text-base font-medium text-white">
                {profile.competition ?? "—"}
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Season
              </div>
              <div className="mt-1 text-base font-medium text-white">
                {profile.season_label ?? "—"}
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Position Group
              </div>
              <div className="mt-1 text-base font-medium text-white">
                {profile.position_group}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-white/38">
            Season Summary
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Avg Minutes
              </div>
              <div className="mt-1 text-base font-medium text-white">
                {formatDecimal(profile.avg_minutes)}
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Sub Appearances
              </div>
              <div className="mt-1 text-base font-medium text-white">
                {profile.sub_appearances}
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                First Match
              </div>
              <div className="mt-1 text-base font-medium text-white">
                {formatDate(profile.first_match_datetime)}
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Last Match
              </div>
              <div className="mt-1 text-base font-medium text-white">
                {formatDate(profile.last_match_datetime)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-white/38">
          Recent Form
        </div>

        {recentRows.length === 0 ? (
          <div className="mt-4 text-sm text-white/55">
            No recent form data found.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {recentRows.map((row) => (
              <div
                key={`${row.source_match_id}-${row.player_source_id}`}
                className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <PlayerResultBadge resultCode={row.result_code} />
                  <div className="text-[11px] text-white/45">
                    {formatDate(row.match_datetime)}
                  </div>
                </div>

                <div className="mt-3 min-h-[36px] text-sm font-medium text-white">
                  <TeamLink
                    teamSlug={row.opponent_team_slug}
                    className="font-medium text-white transition hover:text-white hover:underline"
                    title={row.opponent_name ?? "Opponent"}
                  >
                    {row.opponent_name ?? "—"}
                  </TeamLink>
                </div>

                <div className="mt-3 flex items-center justify-between text-[12px] text-white/65">
                  <span>{row.score_display ?? "—"}</span>
                  <span>{row.minutes_played ?? "—"} min</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-white/38">
          Last 5 Summary
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Matches
            </div>
            <div className="mt-2 text-xl font-semibold text-white">
              {recentRows.length}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Starts
            </div>
            <div className="mt-2 text-xl font-semibold text-white">
              {last5Starts}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Subs
            </div>
            <div className="mt-2 text-xl font-semibold text-white">
              {last5SubApps}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Minutes
            </div>
            <div className="mt-2 text-xl font-semibold text-white">
              {last5Minutes}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Avg Min
            </div>
            <div className="mt-2 text-xl font-semibold text-white">
              {formatDecimal(last5AvgMinutes, 1)}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Goals
            </div>
            <div className="mt-2 text-xl font-semibold text-white">
              {last5Goals}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Assists
            </div>
            <div className="mt-2 text-xl font-semibold text-white">
              {last5Assists}
            </div>
          </div>
        </div>

        <div className="mt-3 max-w-[180px] rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
            xG
          </div>
          <div className="mt-2 text-xl font-semibold text-white">
            {formatDecimal(last5Xg, 2)}
          </div>
        </div>
      </div>

      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-white/38">
          Recent Matches
        </div>

        {recentRows.length === 0 ? (
          <div className="mt-4 text-sm text-white/55">
            No recent match data found.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[14px] border border-white/10">
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
                      <TeamLink
                        teamSlug={row.opponent_team_slug}
                        className="font-medium text-white transition hover:text-white hover:underline"
                        title={row.opponent_name ?? "Opponent"}
                      >
                        {row.opponent_name ?? "—"}
                      </TeamLink>
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