import type { Translator } from "@/lib/i18n/messages";
import type { PlayerMatchLogRow, PlayerProfileRow } from "../types";
import { formatDate } from "./formatDate";
import { formatDecimal } from "./formatDecimal";

// PlayerOverviewPanel'deki rol/yük/kullanım/katkı sezgiselinin veri-odaklı
// kopyası; showcase (design=v2) görünümü aynı etiketleri üretir, orijinal
// panel dokunulmadan kalır.

export type SnapshotTone = "neutral" | "positive" | "accent" | "warning";

export type Snapshot = {
  label: string;
  subvalue: string;
  tone: SnapshotTone;
};

export type OverviewSnapshots = {
  role: Snapshot;
  load: Snapshot;
  usage: Snapshot;
  output: Snapshot;
  staleProfile: boolean;
  coolingProfile: boolean;
  offseason: boolean;
  daysSinceLastMatch: number | null;
  last5: {
    matches: number;
    starts: number;
    subApps: number;
    minutes: number;
    avgMinutes: number;
    goals: number;
    assists: number;
    xg: number;
  };
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
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
  return (positionGroup ?? "").toUpperCase().includes("MID");
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

function getDaysSince(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.floor((Date.now() - parsed) / 86400000));
}

function formatInactivityText(t: Translator, days: number | null) {
  if (days === null) return t("playerDetail.lastAppearanceDateUnavailable");
  return t("playerDetail.daysSinceLastAppearance", { days });
}

export function buildOverviewSnapshots(
  t: Translator,
  profile: PlayerProfileRow,
  matchLog: PlayerMatchLogRow[],
  options?: { leagueLastMatchDate?: string | null }
): OverviewSnapshots {
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
  const last5Goals = recentRows.reduce((sum, row) => sum + (row.goals ?? 0), 0);
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
  const recentStartsRate =
    recentRows.length > 0 ? last5Starts / recentRows.length : 0;

  const lastAppearanceDate =
    recentRows[0]?.match_datetime ?? profile.last_match_datetime ?? null;
  const daysSinceLastMatch = getDaysSince(lastAppearanceDate);

  // Sezon arası algısı: lig de bir aydan uzun süredir oynamıyorsa ve oyuncu
  // sezon sonuna kadar (son lig maçına <=45 gün mesafede) sahadaysa, eskimiş
  // veri "inaktif oyuncu" değil "sezon arası" demektir; kartlar sezon sonu
  // formunu normal şekilde gösterir, rol kartı "Sezon arası" der.
  const leagueLastMatchDate = options?.leagueLastMatchDate ?? null;
  const daysSinceLeagueLastMatch = getDaysSince(leagueLastMatchDate);
  const playerLastMs = lastAppearanceDate ? Date.parse(lastAppearanceDate) : NaN;
  const leagueLastMs = leagueLastMatchDate
    ? Date.parse(leagueLastMatchDate)
    : NaN;
  const playerGapFromSeasonEndDays =
    Number.isNaN(playerLastMs) || Number.isNaN(leagueLastMs)
      ? null
      : Math.max(0, Math.floor((leagueLastMs - playerLastMs) / 86400000));
  const offseason =
    daysSinceLeagueLastMatch !== null &&
    daysSinceLeagueLastMatch > 30 &&
    playerGapFromSeasonEndDays !== null &&
    playerGapFromSeasonEndDays <= 45;

  const staleProfile =
    !offseason && daysSinceLastMatch !== null && daysSinceLastMatch > 90;
  const coolingProfile =
    !offseason &&
    daysSinceLastMatch !== null &&
    daysSinceLastMatch > 45 &&
    daysSinceLastMatch <= 90;

  const role: Snapshot = offseason
    ? {
        label: t("playerDetail.offseasonLabel"),
        subvalue: t("playerDetail.offseasonEndedSub", {
          date: formatDate(leagueLastMatchDate),
        }),
        tone: "accent",
      }
    : staleProfile
    ? {
        label: t("playerDetail.inactiveLabel"),
        subvalue: t("playerDetail.noAppearanceSince", {
          date: formatDate(lastAppearanceDate),
        }),
        tone: "warning",
      }
    : coolingProfile
    ? {
        label: t("playerDetail.recentRoleUncertainLabel"),
        subvalue: t("playerDetail.recentRoleUncertainSub", {
          inactivityText: formatInactivityText(t, daysSinceLastMatch),
        }),
        tone: "warning",
      }
    : recentStartsRate >= 0.8 && avgMinutes >= 75
    ? {
        label: t("playerDetail.coreStarterLabel"),
        subvalue: t("playerDetail.recentStartsAvgMin", {
          starts: last5Starts,
          total: recentRows.length || 0,
          avgMin: formatDecimal(avgMinutes, 1),
        }),
        tone: "positive",
      }
    : recentStartsRate >= 0.6
    ? {
        label: t("playerDetail.regularStarterLabel"),
        subvalue: t("playerDetail.recentStarts", {
          starts: last5Starts,
          total: recentRows.length || 0,
        }),
        tone: "accent",
      }
    : last5SubApps >= 2
    ? {
        label: t("playerDetail.rotationOptionLabel"),
        subvalue: t("playerDetail.recentSubApps", { count: last5SubApps }),
        tone: "warning",
      }
    : {
        label: t("playerDetail.usageProfileUnclearLabel"),
        subvalue: t("playerDetail.notEnoughRoleSeparation"),
        tone: "neutral",
      };

  const load: Snapshot = staleProfile
    ? {
        label: t("playerDetail.historicalWorkloadLabel"),
        subvalue: t("playerDetail.avgMinBeforeInactivity", {
          avgMin: formatDecimal(avgMinutes, 1),
        }),
        tone: "neutral",
      }
    : coolingProfile
    ? {
        label: t("playerDetail.usageCoolingOffLabel"),
        subvalue: formatInactivityText(t, daysSinceLastMatch),
        tone: "warning",
      }
    : avgMinutes >= 82
    ? {
        label: t("playerDetail.highMinuteLoadLabel"),
        subvalue: t("playerDetail.avgMinutesSuffix", {
          avgMin: formatDecimal(avgMinutes, 1),
        }),
        tone: "positive",
      }
    : avgMinutes >= 60
    ? {
        label: t("playerDetail.stableWorkloadLabel"),
        subvalue: t("playerDetail.avgMinutesSuffix", {
          avgMin: formatDecimal(avgMinutes, 1),
        }),
        tone: "accent",
      }
    : avgMinutes >= 30
    ? {
        label: t("playerDetail.managedMinutesLabel"),
        subvalue: t("playerDetail.avgMinutesSuffix", {
          avgMin: formatDecimal(avgMinutes, 1),
        }),
        tone: "warning",
      }
    : {
        label: t("playerDetail.lowInvolvementLabel"),
        subvalue: t("playerDetail.avgMinutesSuffix", {
          avgMin: formatDecimal(avgMinutes, 1),
        }),
        tone: "neutral",
      };

  const usage: Snapshot = staleProfile
    ? {
        label: t("playerDetail.noRecentUsageLabel"),
        subvalue: formatInactivityText(t, daysSinceLastMatch),
        tone: "warning",
      }
    : coolingProfile
    ? {
        label: t("playerDetail.noShortWindowCertaintyLabel"),
        subvalue: formatInactivityText(t, daysSinceLastMatch),
        tone: "warning",
      }
    : last5AvgMinutes >= 85
    ? {
        label: t("playerDetail.recent90MinTrustLabel"),
        subvalue: t("playerDetail.avgMinAcrossLast5", {
          avgMin: formatDecimal(last5AvgMinutes, 1),
        }),
        tone: "positive",
      }
    : last5AvgMinutes >= 65
    ? {
        label: t("playerDetail.strongRecentUsageLabel"),
        subvalue: t("playerDetail.avgMinAcrossLast5", {
          avgMin: formatDecimal(last5AvgMinutes, 1),
        }),
        tone: "accent",
      }
    : recentRows.length === 0
    ? {
        label: t("playerDetail.noRecentUsageLabel"),
        subvalue: t("playerDetail.recentMatchLogUnavailable"),
        tone: "neutral",
      }
    : {
        label: t("playerDetail.limitedRecentLoadLabel"),
        subvalue: t("playerDetail.avgMinAcrossLast5", {
          avgMin: formatDecimal(last5AvgMinutes, 1),
        }),
        tone: "warning",
      };

  const output: Snapshot = staleProfile
    ? {
        label: t("playerDetail.noCurrentOutputWindowLabel"),
        subvalue: t("playerDetail.outputLabelsSuppressed", {
          date: formatDate(lastAppearanceDate),
        }),
        tone: "warning",
      }
    : last5Goals + last5Assists > 0
    ? {
        label: t("playerDetail.directOutputRecordedLabel"),
        subvalue: t("playerDetail.goalsAssistsInLast5", {
          goals: last5Goals,
          assists: last5Assists,
        }),
        tone: "accent",
      }
    : defensiveProfile
    ? {
        label: t("playerDetail.defensiveRoleProfileLabel"),
        subvalue: t("playerDetail.startsMinutesInLast5", {
          starts: last5Starts,
          total: recentRows.length || 0,
          minutes: last5Minutes,
        }),
        tone: "neutral",
      }
    : midfieldProfile
    ? {
        label: t("playerDetail.controlFirstProfileLabel"),
        subvalue: t("playerDetail.startsNoDirectReturns", {
          starts: last5Starts,
          total: recentRows.length || 0,
        }),
        tone: "neutral",
      }
    : attackingProfile && last5Xg >= 0.4
    ? {
        label: t("playerDetail.threatWithoutReturnLabel"),
        subvalue: t("playerDetail.xgInLast5", {
          xg: formatDecimal(last5Xg, 2),
        }),
        tone: "warning",
      }
    : attackingProfile
    ? {
        label: t("playerDetail.lowFinalThirdReturnLabel"),
        subvalue: t("playerDetail.goalsAssistsXgInLast5", {
          goals: last5Goals,
          assists: last5Assists,
          xg: formatDecimal(last5Xg, 2),
        }),
        tone: "neutral",
      }
    : {
        label: t("playerDetail.lowDirectOutputLabel"),
        subvalue: t("playerDetail.goalsAssistsInLast5", {
          goals: last5Goals,
          assists: last5Assists,
        }),
        tone: "neutral",
      };

  return {
    role,
    load,
    usage,
    output,
    staleProfile,
    coolingProfile,
    offseason,
    daysSinceLastMatch,
    last5: {
      matches: recentRows.length,
      starts: last5Starts,
      subApps: last5SubApps,
      minutes: last5Minutes,
      avgMinutes: last5AvgMinutes,
      goals: last5Goals,
      assists: last5Assists,
      xg: last5Xg,
    },
  };
}
