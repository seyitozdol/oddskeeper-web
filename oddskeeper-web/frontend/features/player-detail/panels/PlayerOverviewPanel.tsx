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

type Tone = "neutral" | "positive" | "accent" | "warning";
type RecencyState = "active" | "cooling" | "stale" | "unknown";

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;

  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function formatValue(value: ReactNode) {
  return value === null || value === undefined || value === "" ? "—" : value;
}

function getToneClasses(tone: Tone) {
  if (tone === "positive") {
    return "border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.02))]";
  }

  if (tone === "accent") {
    return "border-sky-500/20 bg-[linear-gradient(180deg,rgba(59,130,246,0.08),rgba(255,255,255,0.02))]";
  }

  if (tone === "warning") {
    return "border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.02))]";
  }

  return "border-white/10 bg-white/[0.025]";
}

function getRoleBadgeClasses(role: string | null | undefined) {
  const normalized = (role ?? "").toLowerCase();

  if (normalized === "starter") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  if (normalized === "substitute") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }

  return "border-white/10 bg-white/[0.03] text-white/60";
}

function normalizeRoleLabel(role: string | null | undefined) {
  const normalized = (role ?? "").toLowerCase();

  if (normalized === "starter") return "Starter";
  if (normalized === "substitute") return "Sub";
  return "—";
}

function isDefensiveProfile(positionGroup: string | null | undefined) {
  const normalized = (positionGroup ?? "").toUpperCase();
  return (
    normalized.includes("DEF") ||
    normalized.includes("BACK") ||
    normalized.includes("CENTRE") ||
    normalized.includes("CENTER")
  );
}

function isMidfieldProfile(positionGroup: string | null | undefined) {
  const normalized = (positionGroup ?? "").toUpperCase();
  return normalized.includes("MID");
}

function isAttackingProfile(positionGroup: string | null | undefined) {
  const normalized = (positionGroup ?? "").toUpperCase();
  return (
    normalized.includes("FW") ||
    normalized.includes("ATT") ||
    normalized.includes("STRIKER") ||
    normalized.includes("WING") ||
    normalized.includes("FORWARD")
  );
}

function parseDateMs(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getDaysSince(value: string | null | undefined) {
  const parsedMs = parseDateMs(value);
  if (parsedMs === null) return null;

  const diffMs = Date.now() - parsedMs;
  return Math.max(0, Math.floor(diffMs / 86400000));
}

function getRecencyState(daysSinceLastMatch: number | null): RecencyState {
  if (daysSinceLastMatch === null) return "unknown";
  if (daysSinceLastMatch <= 45) return "active";
  if (daysSinceLastMatch <= 90) return "cooling";
  return "stale";
}

function formatInactivityText(daysSinceLastMatch: number | null) {
  if (daysSinceLastMatch === null) return "Last appearance date unavailable";
  return `${daysSinceLastMatch} days since last appearance`;
}

function MiniInfoTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${getToneClasses(tone)}`}>
      <div className="text-[9px] uppercase tracking-[0.16em] text-white/38">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{formatValue(value)}</div>
    </div>
  );
}

function SnapshotCard({
  label,
  value,
  subvalue,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  subvalue?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={`rounded-xl border px-3 py-3 ${getToneClasses(tone)}`}>
      <div className="text-[9px] uppercase tracking-[0.16em] text-white/38">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-semibold leading-5 text-white">
        {formatValue(value)}
      </div>
      {subvalue ? (
        <div className="mt-1 text-[11px] leading-4 text-white/58">{subvalue}</div>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.22em] text-white/38">
      {children}
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

  const avgMinutes = toNumber(profile.avg_minutes);
  const defensiveProfile = isDefensiveProfile(profile.position_group);
  const midfieldProfile = isMidfieldProfile(profile.position_group);
  const attackingProfile = isAttackingProfile(profile.position_group);
  const recentStartsRate = recentRows.length > 0 ? last5Starts / recentRows.length : 0;

  const lastAppearanceDate =
    recentRows[0]?.match_datetime ?? profile.last_match_datetime ?? null;
  const daysSinceLastMatch = getDaysSince(lastAppearanceDate);
  const recencyState = getRecencyState(daysSinceLastMatch);
  const staleProfile = recencyState === "stale";
  const coolingProfile = recencyState === "cooling";

  const roleSnapshot = staleProfile
    ? {
        label: "Inactive",
        subvalue: `No appearance since ${formatDate(lastAppearanceDate)}`,
        tone: "warning" as Tone,
      }
    : coolingProfile
    ? {
        label: "Recent role uncertain",
        subvalue: `${formatInactivityText(daysSinceLastMatch)} • current role not fully clear`,
        tone: "warning" as Tone,
      }
    : recentStartsRate >= 0.8 && avgMinutes >= 75
    ? {
        label: "Core starter",
        subvalue: `${last5Starts}/${recentRows.length || 0} recent starts • ${formatDecimal(avgMinutes, 1)} avg min`,
        tone: "positive" as Tone,
      }
    : recentStartsRate >= 0.6
    ? {
        label: "Regular starter",
        subvalue: `${last5Starts}/${recentRows.length || 0} recent starts`,
        tone: "accent" as Tone,
      }
    : last5SubApps >= 2
    ? {
        label: "Rotation option",
        subvalue: `${last5SubApps} recent sub apps`,
        tone: "warning" as Tone,
      }
    : {
        label: "Usage profile unclear",
        subvalue: "Not enough recent role separation",
        tone: "neutral" as Tone,
      };

  const loadSnapshot = staleProfile
    ? {
        label: "Historical workload",
        subvalue: `${formatDecimal(avgMinutes, 1)} avg minutes before inactivity`,
        tone: "neutral" as Tone,
      }
    : coolingProfile
    ? {
        label: "Usage cooling off",
        subvalue: `${formatInactivityText(daysSinceLastMatch)}`,
        tone: "warning" as Tone,
      }
    : avgMinutes >= 82
    ? {
        label: "High-minute load",
        subvalue: `${formatDecimal(avgMinutes, 1)} avg minutes`,
        tone: "positive" as Tone,
      }
    : avgMinutes >= 60
    ? {
        label: "Stable workload",
        subvalue: `${formatDecimal(avgMinutes, 1)} avg minutes`,
        tone: "accent" as Tone,
      }
    : avgMinutes >= 30
    ? {
        label: "Managed minutes",
        subvalue: `${formatDecimal(avgMinutes, 1)} avg minutes`,
        tone: "warning" as Tone,
      }
    : {
        label: "Low involvement",
        subvalue: `${formatDecimal(avgMinutes, 1)} avg minutes`,
        tone: "neutral" as Tone,
      };

  const recentUsageSnapshot = staleProfile
    ? {
        label: "No recent usage",
        subvalue: formatInactivityText(daysSinceLastMatch),
        tone: "warning" as Tone,
      }
    : coolingProfile
    ? {
        label: "No short-window certainty",
        subvalue: `${formatInactivityText(daysSinceLastMatch)}`,
        tone: "warning" as Tone,
      }
    : last5AvgMinutes >= 85
    ? {
        label: "Recent 90-min trust",
        subvalue: `${formatDecimal(last5AvgMinutes, 1)} avg min across last 5`,
        tone: "positive" as Tone,
      }
    : last5AvgMinutes >= 65
    ? {
        label: "Strong recent usage",
        subvalue: `${formatDecimal(last5AvgMinutes, 1)} avg min across last 5`,
        tone: "accent" as Tone,
      }
    : recentRows.length === 0
    ? {
        label: "No recent usage",
        subvalue: "Recent match log unavailable",
        tone: "neutral" as Tone,
      }
    : {
        label: "Limited recent load",
        subvalue: `${formatDecimal(last5AvgMinutes, 1)} avg min across last 5`,
        tone: "warning" as Tone,
      };

  const outputSnapshot = staleProfile
    ? {
        label: "No current output window",
        subvalue: `Output labels suppressed • last appearance ${formatDate(lastAppearanceDate)}`,
        tone: "warning" as Tone,
      }
    : last5Goals + last5Assists > 0
    ? {
        label: "Direct output recorded",
        subvalue: `${last5Goals} goals • ${last5Assists} assists in last 5`,
        tone: "accent" as Tone,
      }
    : defensiveProfile
    ? {
        label: "Defensive role profile",
        subvalue: `${last5Starts}/${recentRows.length || 0} starts • ${last5Minutes} minutes in last 5`,
        tone: "neutral" as Tone,
      }
    : midfieldProfile
    ? {
        label: "Control-first profile",
        subvalue: `${last5Starts}/${recentRows.length || 0} starts • 0 direct returns in last 5`,
        tone: "neutral" as Tone,
      }
    : attackingProfile && last5Xg >= 0.4
    ? {
        label: "Threat without return",
        subvalue: `${formatDecimal(last5Xg, 2)} xG in last 5`,
        tone: "warning" as Tone,
      }
    : attackingProfile
    ? {
        label: "Low final-third return",
        subvalue: `${last5Goals} goals • ${last5Assists} assists • ${formatDecimal(last5Xg, 2)} xG in last 5`,
        tone: "neutral" as Tone,
      }
    : {
        label: "Low direct output",
        subvalue: `${last5Goals} goals • ${last5Assists} assists in last 5`,
        tone: "neutral" as Tone,
      };

  const overviewReturnTo = `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(
    profile.player_slug
  )}&tab=overview`;

  const recentFormSectionLabel = staleProfile
    ? "Last Recorded Appearances"
    : "Recent Form";

  const last5SectionLabel = staleProfile
    ? "Last 5 Recorded Appearances"
    : "Last 5 Summary";

  return (
    <div className="space-y-2.5">
      <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <SnapshotCard
            label="Role Snapshot"
            value={roleSnapshot.label}
            subvalue={roleSnapshot.subvalue}
            tone={roleSnapshot.tone}
          />
          <SnapshotCard
            label="Load Profile"
            value={loadSnapshot.label}
            subvalue={loadSnapshot.subvalue}
            tone={loadSnapshot.tone}
          />
          <SnapshotCard
            label="Recent Usage"
            value={recentUsageSnapshot.label}
            subvalue={recentUsageSnapshot.subvalue}
            tone={recentUsageSnapshot.tone}
          />
          <SnapshotCard
            label="Recent Output"
            value={outputSnapshot.label}
            subvalue={outputSnapshot.subvalue}
            tone={outputSnapshot.tone}
          />
        </div>
      </div>

      <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-3">
        <div className="grid gap-3 xl:grid-cols-2">
          <div>
            <SectionLabel>Player Context</SectionLabel>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MiniInfoTile
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
                tone="accent"
              />
              <MiniInfoTile label="Competition" value={profile.competition ?? "—"} />
              <MiniInfoTile label="Season" value={profile.season_label ?? "—"} />
              <MiniInfoTile label="Position Group" value={profile.position_group} />
            </div>
          </div>

          <div>
            <SectionLabel>Season Summary</SectionLabel>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MiniInfoTile
                label="Avg Minutes"
                value={formatDecimal(profile.avg_minutes, 1)}
                tone={avgMinutes >= 75 ? "positive" : avgMinutes >= 55 ? "accent" : "neutral"}
              />
              <MiniInfoTile
                label="Sub Appearances"
                value={profile.sub_appearances}
                tone={toNumber(profile.sub_appearances) <= 2 ? "positive" : "neutral"}
              />
              <MiniInfoTile
                label="First Match"
                value={formatDate(profile.first_match_datetime)}
              />
              <MiniInfoTile
                label="Last Match"
                value={formatDate(profile.last_match_datetime)}
                tone={staleProfile ? "warning" : coolingProfile ? "warning" : "neutral"}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-3">
        <SectionLabel>{recentFormSectionLabel}</SectionLabel>

        {recentRows.length === 0 ? (
          <div className="mt-2 text-sm text-white/55">
            No recent form data found.
          </div>
        ) : (
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {recentRows.map((row) => (
              <div
                key={`${row.source_match_id}-${row.player_source_id}`}
                className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5"
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

                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-white/60">
                  <span>{row.score_display ?? "—"}</span>
                  <span>{row.minutes_played ?? "—"} min</span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex rounded-md border px-2 py-[2px] text-[10px] font-medium ${getRoleBadgeClasses(
                      row.lineup_status
                    )}`}
                  >
                    {normalizeRoleLabel(row.lineup_status)}
                  </span>
                  <span className="text-[10px] text-white/45">
                    xG {formatDecimal(row.expected_goals, 3)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-3">
        <SectionLabel>{last5SectionLabel}</SectionLabel>

        <div className="mt-2 grid gap-2 sm:grid-cols-3 xl:grid-cols-8">
          <MiniInfoTile label="Matches" value={recentRows.length} tone="accent" />
          <MiniInfoTile label="Starts" value={last5Starts} tone={last5Starts >= 4 ? "positive" : "neutral"} />
          <MiniInfoTile label="Subs" value={last5SubApps} tone={last5SubApps >= 2 ? "warning" : "neutral"} />
          <MiniInfoTile label="Minutes" value={last5Minutes} tone={last5Minutes >= 400 ? "positive" : "neutral"} />
          <MiniInfoTile label="Avg Min" value={formatDecimal(last5AvgMinutes, 1)} tone={last5AvgMinutes >= 80 ? "positive" : last5AvgMinutes >= 60 ? "accent" : "neutral"} />
          <MiniInfoTile label="Goals" value={last5Goals} tone={last5Goals > 0 ? "accent" : "neutral"} />
          <MiniInfoTile label="Assists" value={last5Assists} tone={last5Assists > 0 ? "accent" : "neutral"} />
          <MiniInfoTile label="xG" value={formatDecimal(last5Xg, 2)} tone={attackingProfile && last5Xg >= 0.3 ? "accent" : "neutral"} />
        </div>
      </div>

      <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-3">
        <SectionLabel>{staleProfile ? "Last Recorded Matches" : "Recent Matches"}</SectionLabel>

        {recentRows.length === 0 ? (
          <div className="mt-2 text-sm text-white/55">
            No recent match data found.
          </div>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-[14px] border border-white/10">
            <table className="min-w-full border-collapse">
              <thead className="bg-white/[0.03]">
                <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Opponent</th>
                  <th className="px-3 py-2 font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">Res</th>
                  <th className="px-3 py-2 font-medium">Role</th>
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
                    className="border-t border-white/10 text-[12px] text-white/80 transition hover:bg-white/[0.018]"
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
                      <span
                        className={`inline-flex rounded-md border px-2 py-[2px] text-[10px] font-medium ${getRoleBadgeClasses(
                          row.lineup_status
                        )}`}
                      >
                        {normalizeRoleLabel(row.lineup_status)}
                      </span>
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
