import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  Clock,
  Crosshair,
  Euro,
  Flame,
  Gauge,
  Goal,
  MapPin,
  Percent,
  Ruler,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import TeamLink from "@/components/links/TeamLink";
import MatchLink from "@/components/links/MatchLink";
import { PlayerResultBadge } from "../components/PlayerResultBadge";
import type {
  PlayerAdvancedOverviewRow,
  PlayerCurrentInfoRow,
  PlayerDetailedMetricRow,
  PlayerMatchLogRow,
  PlayerProfileRow,
} from "../types";
import { formatDate } from "../utils/formatDate";
import { formatDecimal } from "../utils/formatDecimal";
import { getTeamLogoPath } from "../utils/getTeamLogoPath";
import {
  buildOverviewSnapshots,
  type Snapshot,
  type SnapshotTone,
} from "../utils/buildSnapshots";
import { getTeamDetailHref } from "@/lib/routes";
import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/messages";
import { knownDisplayName } from "@/lib/player-name";
import { canonicalNationality, getCountryFlagUrl } from "@/lib/country-flags";
import { categoryLabel, metricLabel } from "@/lib/i18n/metricLabel";
import {
  resolveShortTeamName,
  type TeamAliasMap,
} from "@/lib/team-alias";

type PlayerShowcasePanelProps = {
  profile: PlayerProfileRow;
  currentInfo?: PlayerCurrentInfoRow | null;
  marketValueEur?: number | null;
  matchLog?: PlayerMatchLogRow[];
  advancedOverview?: PlayerAdvancedOverviewRow | null;
  detailedMetrics?: PlayerDetailedMetricRow[];
  teamAliases?: TeamAliasMap;
  leagueLastMatchDate?: string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function formatMarketValue(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `€${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  return `€${Math.round(value / 1_000)}K`;
}

function toneValueClass(tone: SnapshotTone) {
  if (tone === "positive") return "text-pos";
  if (tone === "accent") return "text-accent-ink";
  if (tone === "warning") return "text-warn";
  return "text-ink";
}

function getRoleBadgeClasses(role: string | null | undefined) {
  const normalized = (role ?? "").toLowerCase();
  if (normalized === "starter") return "border-pos/25 bg-pos/15 text-pos";
  if (normalized === "substitute")
    return "border-warn/25 bg-warn/15 text-warn";
  return "border-line bg-veil text-ink-2";
}

function normalizeRoleLabel(t: Translator, role: string | null | undefined) {
  const normalized = (role ?? "").toLowerCase();
  if (normalized === "starter") return t("playerDetail.starterRoleLabel");
  if (normalized === "substitute") return t("playerDetail.subRoleLabel");
  return "—";
}

function shortDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${day}/${month}`;
}

/* ── küçük yapı taşları ─────────────────────────────────────── */

function SectionHeading({
  icon,
  children,
  right,
}: {
  icon?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-3">
        {icon ? <span className="text-accent-ink">{icon}</span> : null}
        <span>{children}</span>
      </div>
      {right}
    </div>
  );
}

function StripStat({
  icon,
  label,
  value,
  sub,
  valueClass = "text-ink",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="bg-card px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
        <span className="text-accent-ink/80">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div
        className={`mt-1.5 truncate text-lg font-semibold leading-6 ${valueClass}`}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 truncate text-[10px] leading-4 text-ink-3">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function SnapshotRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-accent-soft text-accent-ink">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
          {label}
        </div>
        <div className="mt-0.5 text-sm font-medium text-ink">{value}</div>
      </div>
    </div>
  );
}

function AvgStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
        <span className="shrink-0 text-accent-ink/80">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 text-2xl font-semibold leading-7 text-ink">
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[10px] text-ink-3">{sub}</div>
      ) : null}
    </div>
  );
}

/* ── radar ──────────────────────────────────────────────────── */

type RadarAxis = { key: string; label: string; value: number };

function radarPoint(index: number, count: number, frac: number, radius: number) {
  const angle = ((-90 + index * (360 / count)) * Math.PI) / 180;
  return {
    x: 110 + radius * frac * Math.cos(angle),
    y: 110 + radius * frac * Math.sin(angle),
  };
}

function RadarChart({ axes }: { axes: RadarAxis[] }) {
  const count = axes.length;
  const radius = 76;
  const rings = [0.25, 0.5, 0.75, 1];

  const ringPolygons = rings.map((frac) =>
    axes
      .map((_, i) => {
        const p = radarPoint(i, count, frac, radius);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ")
  );

  const valuePolygon = axes
    .map((axis, i) => {
      const p = radarPoint(i, count, Math.max(axis.value, 4) / 100, radius);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 220 220" className="mx-auto w-full max-w-[260px]">
      {ringPolygons.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="var(--line)"
          strokeWidth={1}
        />
      ))}

      {axes.map((_, i) => {
        const p = radarPoint(i, count, 1, radius);
        return (
          <line
            key={i}
            x1={110}
            y1={110}
            x2={p.x}
            y2={p.y}
            stroke="var(--line)"
            strokeWidth={1}
          />
        );
      })}

      <polygon
        points={valuePolygon}
        fill="var(--accent)"
        fillOpacity={0.16}
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {axes.map((axis, i) => {
        const p = radarPoint(i, count, Math.max(axis.value, 4) / 100, radius);
        return (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--accent)" />
        );
      })}

      {axes.map((axis, i) => {
        const p = radarPoint(i, count, 1, radius + 22);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y - 3}
            textAnchor="middle"
            fontSize={9.5}
            fill="var(--ink-2)"
          >
            {axis.label}
            <tspan
              x={p.x}
              dy={11}
              fontSize={10}
              fontWeight={700}
              fill="var(--accent-ink)"
            >
              {Math.round(axis.value)}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

/* ── performans grafiği ─────────────────────────────────────── */

function PerformanceChart({
  rows,
  t,
}: {
  rows: PlayerMatchLogRow[];
  t: Translator;
}) {
  // rows: kronolojik (eskiden yeniye) son 10 maç
  const width = 560;
  const height = 190;
  const padL = 34;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const minutes = rows.map((row) => row.minutes_played ?? 0);
  const yMax = Math.max(90, ...minutes);

  const x = (i: number) =>
    rows.length <= 1 ? padL + plotW / 2 : padL + (i / (rows.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - (v / yMax) * plotH;

  const linePath = rows
    .map((row, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(minutes[i]).toFixed(1)}`)
    .join(" ");

  const areaPath =
    rows.length > 1
      ? `${linePath} L${x(rows.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`
      : "";

  const ticks = [0, 30, 60, 90].filter((tick) => tick <= yMax);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padL}
              y1={y(tick)}
              x2={width - padR}
              y2={y(tick)}
              stroke="var(--line)"
              strokeWidth={1}
              strokeDasharray={tick === 0 ? undefined : "3 4"}
            />
            <text
              x={padL - 6}
              y={y(tick) + 3}
              textAnchor="end"
              fontSize={9}
              fill="var(--ink-3)"
            >
              {tick}
            </text>
          </g>
        ))}

        {areaPath ? (
          <path d={areaPath} fill="var(--accent)" fillOpacity={0.1} />
        ) : null}

        <path
          d={linePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {rows.map((row, i) => {
          const scored = (row.goals ?? 0) > 0;
          const assisted = !scored && (row.assists ?? 0) > 0;
          return (
            <circle
              key={row.source_match_id}
              cx={x(i)}
              cy={y(minutes[i])}
              r={scored || assisted ? 4.5 : 3}
              fill={
                scored
                  ? "var(--accent)"
                  : assisted
                  ? "var(--pos)"
                  : "var(--card)"
              }
              stroke={assisted ? "var(--pos)" : "var(--accent)"}
              strokeWidth={1.5}
            />
          );
        })}

        {rows.map((row, i) =>
          rows.length <= 6 || i % 2 === 0 || i === rows.length - 1 ? (
            <text
              key={`label-${row.source_match_id}`}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize={9}
              fill="var(--ink-3)"
            >
              {shortDate(row.match_datetime)}
            </text>
          ) : null
        )}
      </svg>

      <div className="mt-1 flex items-center gap-4 text-[10px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          {t("playerDetail.goalMarkerLegend")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-pos" />
          {t("playerDetail.assistMarkerLegend")}
        </span>
        <span className="ml-auto">{t("playerDetail.performanceChartNote")}</span>
      </div>
    </div>
  );
}

/* ── ana panel ──────────────────────────────────────────────── */

export async function PlayerShowcasePanel({
  profile,
  currentInfo = null,
  marketValueEur = null,
  matchLog = [],
  advancedOverview = null,
  detailedMetrics = [],
  teamAliases = {},
  leagueLastMatchDate = null,
}: PlayerShowcasePanelProps) {
  const t = await getT();

  const shortTeam = (
    slug: string | null | undefined,
    name: string | null | undefined
  ) => resolveShortTeamName(teamAliases, slug, name);

  const displayTeamSlug = currentInfo?.current_team_slug ?? profile.team_slug;
  const displayTeamName = currentInfo?.current_team_name ?? profile.team_name;
  const displayPlayerName =
    knownDisplayName(currentInfo?.player_name, currentInfo?.first_name) ||
    currentInfo?.full_name ||
    profile.player_name;

  const teamLogoPath = getTeamLogoPath(displayTeamSlug);
  const snapshots = buildOverviewSnapshots(t, profile, matchLog, {
    leagueLastMatchDate,
  });

  const detailHrefBase = `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(
    profile.player_slug
  )}`;
  const overviewReturnTo = `${detailHrefBase}&tab=overview`;

  const backToTeamHref = getTeamDetailHref(displayTeamSlug)
    ? `${getTeamDetailHref(displayTeamSlug)}&tab=squad`
    : "/dashboard/stats-analysis/football/team-stats";

  /* sezon satırları: maç başı ortalamalar + grafik */
  const seasonRows = profile.season_label
    ? matchLog.filter((row) => row.season_label === profile.season_label)
    : matchLog;
  const playedSeasonRows = seasonRows.filter(
    (row) => (row.minutes_played ?? 0) > 0 || row.lineup_status !== null
  );
  const appsCount = Math.max(playedSeasonRows.length, 1);

  const sumSeason = (pick: (row: PlayerMatchLogRow) => number) =>
    playedSeasonRows.reduce((sum, row) => sum + pick(row), 0);

  const seasonShotsTotal = sumSeason(
    (row) =>
      (row.shots_on_target ?? 0) +
      (row.shots_off_target ?? 0) +
      (row.shots_blocked ?? 0)
  );
  const seasonSot = sumSeason((row) => row.shots_on_target ?? 0);
  const seasonPasses = sumSeason((row) => toNumber(row.passes));
  const seasonAccuratePasses = sumSeason((row) => row.accurate_pass ?? 0);
  const seasonTackles = sumSeason((row) => row.tackles ?? 0);
  const seasonXg = sumSeason((row) => toNumber(row.expected_goals));
  const passAccuracyPct =
    seasonPasses > 0 ? (seasonAccuratePasses / seasonPasses) * 100 : null;

  const chartRows = [...matchLog.slice(0, 10)].reverse();
  const recentRows = matchLog.slice(0, 5);
  const tableRows = matchLog.slice(0, 6);

  /* radar: kategori bazında lig yüzdeliği ortalaması.
     league_percentile yön-düzeltilmiş "en iyiye uzaklık" oranıdır (0 = ligin
     en iyisi); skor = 100 - yüzdelik. Kategoriler SofaScore (tsl_ss)
     kataloğunun uzayı; playing_time/overall radar dışı bırakıldı. */
  const isGoalkeeper = profile.primary_position_code === "GK";
  const categoryOrder = isGoalkeeper
    ? ["goalkeeping", "defending", "passing", "duels", "discipline", "physical"]
    : ["attacking", "creation", "passing", "duels", "defending", "physical"];

  // yüzdelik kaynakta 0-1 (oran) ya da 0-100 gelebilir; ölçeği veriden algıla
  const allPercentiles = detailedMetrics
    .map((row) => row.league_percentile)
    .filter((value): value is number => value !== null);
  const percentileScale =
    allPercentiles.length > 0 && Math.max(...allPercentiles) <= 1 ? 100 : 1;

  const radarAxes: RadarAxis[] = categoryOrder.flatMap((key) => {
    const rows = detailedMetrics.filter(
      (row) => row.category_key === key && row.league_percentile !== null
    );
    if (rows.length === 0) return [];
    const avgDistance =
      (rows.reduce((sum, row) => sum + (row.league_percentile ?? 0), 0) /
        rows.length) *
      percentileScale;
    return [
      {
        key,
        label: categoryLabel(t, key, rows[0].category_label),
        value: Math.max(0, Math.min(100, 100 - avgDistance)),
      },
    ];
  });

  /* sezon geçmişi: maç logundan sezon+lig+takım kırılımı */
  type CareerRow = {
    key: string;
    season: string;
    competition: string;
    teamName: string;
    teamSlug: string | null;
    apps: number;
    starts: number;
    minutes: number;
    goals: number;
    assists: number;
    xg: number;
  };

  const careerMap = new Map<string, CareerRow>();
  for (const row of matchLog) {
    const season = row.season_label ?? "—";
    const competition = row.competition ?? "—";
    const teamName = row.team_name ?? "—";
    const key = `${season}|${competition}|${teamName}`;
    const entry =
      careerMap.get(key) ??
      ({
        key,
        season,
        competition,
        teamName,
        teamSlug: row.team_slug,
        apps: 0,
        starts: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
        xg: 0,
      } as CareerRow);

    entry.apps += 1;
    entry.starts += (row.lineup_status ?? "").toLowerCase() === "starter" ? 1 : 0;
    entry.minutes += row.minutes_played ?? 0;
    entry.goals += row.goals ?? 0;
    entry.assists += row.assists ?? 0;
    entry.xg += toNumber(row.expected_goals);
    careerMap.set(key, entry);
  }
  const careerRows = [...careerMap.values()].sort((a, b) =>
    b.season.localeCompare(a.season)
  );

  const nationality = currentInfo?.nationality ?? null;
  const flagUrl = nationality ? getCountryFlagUrl(nationality) : null;

  const strengthChips = [
    advancedOverview?.primary_strength_metric_key
      ? metricLabel(
          t,
          advancedOverview.primary_strength_metric_key,
          advancedOverview.primary_strength_metric_label
        )
      : null,
    advancedOverview?.secondary_strength_metric_key
      ? metricLabel(
          t,
          advancedOverview.secondary_strength_metric_key,
          advancedOverview.secondary_strength_metric_label
        )
      : null,
  ].filter((chip): chip is string => Boolean(chip));

  const snapshotCells: { labelKey: string; snapshot: Snapshot }[] = [
    { labelKey: "playerDetail.roleSnapshotLabel", snapshot: snapshots.role },
    { labelKey: "playerDetail.loadProfileLabel", snapshot: snapshots.load },
    { labelKey: "playerDetail.recentUsageLabel", snapshot: snapshots.usage },
    { labelKey: "playerDetail.recentOutputLabel", snapshot: snapshots.output },
  ];

  return (
    <section className="w-full space-y-3">
      {/* üst çubuk: takıma dön (sekme navigasyonu soldaki menüde) */}
      <div className="flex items-center gap-2">
        <Link
          href={backToTeamHref}
          className="rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink-2 transition hover:text-ink"
        >
          {t("playerDetail.backButton")}
        </Link>
      </div>

      {/* hero + özet paneli */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_520px]">
          {/* sol: hero */}
          <div className="relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />
            {currentInfo?.shirt_number !== null &&
            currentInfo?.shirt_number !== undefined ? (
              <div className="pointer-events-none absolute -top-10 right-2 select-none text-[170px] font-black leading-none tracking-tighter text-ink/5">
                {currentInfo.shirt_number}
              </div>
            ) : null}

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="relative h-[168px] w-[168px] shrink-0 overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-card-2 to-canvas">
                {currentInfo?.photo_url ? (
                  <Image
                    src={currentInfo.photo_url}
                    alt={displayPlayerName}
                    width={168}
                    height={168}
                    className="h-full w-full object-cover"
                  />
                ) : teamLogoPath ? (
                  <div className="flex h-full w-full items-center justify-center p-8">
                    <Image
                      src={teamLogoPath}
                      alt={displayTeamName}
                      width={96}
                      height={96}
                      className="h-auto w-auto object-contain opacity-60"
                    />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-3">
                    <User size={48} />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent-ink">
                  {t("playerDetail.profileKicker")}
                </p>

                <h1 className="mt-1.5 truncate text-3xl font-bold tracking-tight text-ink sm:text-4xl xl:text-[42px] xl:leading-[1.1]">
                  {displayPlayerName}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-ink-2">
                  <span className="inline-flex items-center gap-1.5">
                    {teamLogoPath ? (
                      <Image
                        src={teamLogoPath}
                        alt={displayTeamName}
                        width={27}
                        height={27}
                        className="h-[27px] w-[27px] shrink-0 object-contain"
                      />
                    ) : null}
                    <TeamLink
                      teamSlug={displayTeamSlug}
                      className="font-medium text-ink transition hover:underline"
                      title={displayTeamName}
                    >
                      {displayTeamName}
                    </TeamLink>
                  </span>
                  {currentInfo?.shirt_number !== null &&
                  currentInfo?.shirt_number !== undefined ? (
                    <>
                      <span className="text-ink-3">•</span>
                      <span>#{currentInfo.shirt_number}</span>
                    </>
                  ) : null}
                  <span className="text-ink-3">•</span>
                  <span>{currentInfo?.position ?? profile.primary_position_code}</span>
                  <span className="text-ink-3">•</span>
                  <span>{profile.competition ?? "—"}</span>
                  <span className="text-ink-3">•</span>
                  <span>{profile.season_label ?? "—"}</span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-ink-3">
                  {nationality ? (
                    <span className="inline-flex items-center gap-1.5">
                      {flagUrl ? (
                        <Image
                          src={flagUrl}
                          alt={nationality}
                          width={16}
                          height={12}
                          className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
                        />
                      ) : null}
                      <span>{canonicalNationality(nationality)}</span>
                    </span>
                  ) : null}
                  {currentInfo?.height_cm ? (
                    <>
                      <span>•</span>
                      <span>
                        {t("playerDetail.heightCm", {
                          value: currentInfo.height_cm,
                        })}
                      </span>
                    </>
                  ) : null}
                  {currentInfo?.weight_kg ? (
                    <>
                      <span>•</span>
                      <span>
                        {t("playerDetail.weightKg", {
                          value: currentInfo.weight_kg,
                        })}
                      </span>
                    </>
                  ) : null}
                  {currentInfo?.birth_date ? (
                    <>
                      <span>•</span>
                      <span>
                        {currentInfo.birth_date}
                        {currentInfo.age !== null
                          ? ` (${t("playerDetail.ageValue", {
                              age: currentInfo.age,
                            })})`
                          : ""}
                      </span>
                    </>
                  ) : null}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("common.marketValue")}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-pos">
                      {marketValueEur !== null
                        ? formatMarketValue(marketValueEur)
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("playerDetail.squadNumberLabel")}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-ink">
                      {currentInfo?.shirt_number ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("playerDetail.positionLabel")}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-ink">
                      {currentInfo?.position ?? profile.position_group}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("playerDetail.birthPlaceLabel")}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-ink">
                      {currentInfo?.birth_place ?? "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* sağ: oyuncu özeti */}
          <div className="border-t border-line bg-card-2/40 p-5 xl:border-l xl:border-t-0">
            <SectionHeading icon={<Sparkles size={13} />}>
              {t("playerDetail.snapshotPanelLabel")}
            </SectionHeading>

            <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <SnapshotRow
                icon={<User size={14} />}
                label={t("playerDetail.roleSnapshotLabel")}
                value={
                  <span className={toneValueClass(snapshots.role.tone)}>
                    {snapshots.role.label}
                  </span>
                }
              />
              <SnapshotRow
                icon={<MapPin size={14} />}
                label={t("playerDetail.nationalityLabel")}
                value={
                  nationality ? (
                    <span className="inline-flex items-center gap-1.5">
                      {flagUrl ? (
                        <Image
                          src={flagUrl}
                          alt={nationality}
                          width={16}
                          height={12}
                          className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
                        />
                      ) : null}
                      {canonicalNationality(nationality)}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <SnapshotRow
                icon={<Zap size={14} />}
                label={t("playerDetail.strengthsLabel")}
                value={
                  strengthChips.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {strengthChips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-md border border-line-strong bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-ink"
                        >
                          {chip}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <SnapshotRow
                icon={<CalendarDays size={14} />}
                label={t("playerDetail.birthDateLabel")}
                value={
                  currentInfo?.birth_date
                    ? `${currentInfo.birth_date}${
                        currentInfo.age !== null
                          ? ` (${t("playerDetail.ageValue", {
                              age: currentInfo.age,
                            })})`
                          : ""
                      }`
                    : "—"
                }
              />
              <SnapshotRow
                icon={<Ruler size={14} />}
                label={t("playerDetail.heightWeightLabel")}
                value={
                  currentInfo?.height_cm || currentInfo?.weight_kg
                    ? `${
                        currentInfo?.height_cm
                          ? t("playerDetail.heightCm", {
                              value: currentInfo.height_cm,
                            })
                          : "—"
                      } / ${
                        currentInfo?.weight_kg
                          ? t("playerDetail.weightKg", {
                              value: currentInfo.weight_kg,
                            })
                          : "—"
                      }`
                    : "—"
                }
              />
              <SnapshotRow
                icon={<Euro size={14} />}
                label={t("common.marketValue")}
                value={
                  marketValueEur !== null ? (
                    <span className="text-pos">
                      {formatMarketValue(marketValueEur)}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <SnapshotRow
                icon={<Clock size={14} />}
                label={t("playerDetail.lastMatchLabel")}
                value={formatDate(profile.last_match_datetime)}
              />
              <SnapshotRow
                icon={<ShieldCheck size={14} />}
                label={t("common.team")}
                value={
                  <TeamLink
                    teamSlug={displayTeamSlug}
                    className="transition hover:underline"
                    title={displayTeamName}
                  >
                    {displayTeamName}
                  </TeamLink>
                }
              />
            </div>
          </div>
        </div>

        {/* istatistik şeridi */}
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-3 xl:grid-cols-9">
          <StripStat
            icon={<CalendarDays size={11} />}
            label={t("common.appearances")}
            value={profile.appearances}
            sub={profile.season_label ?? undefined}
          />
          <StripStat
            icon={<Clock size={11} />}
            label={t("playerDetail.minutesLabel")}
            value={profile.total_minutes}
            sub={profile.season_label ?? undefined}
          />
          <StripStat
            icon={<Target size={11} />}
            label={t("common.goals")}
            value={profile.goals}
            sub={profile.season_label ?? undefined}
          />
          <StripStat
            icon={<Zap size={11} />}
            label={t("common.assists")}
            value={profile.assists}
            sub={profile.season_label ?? undefined}
          />
          <StripStat
            icon={<Percent size={11} />}
            label={t("playerDetail.starterRateLabel")}
            value={`${formatDecimal(profile.starter_rate_pct, 1)}%`}
            sub={profile.season_label ?? undefined}
          />
          {snapshotCells.map(({ labelKey, snapshot }) => (
            <StripStat
              key={labelKey}
              icon={
                labelKey === "playerDetail.roleSnapshotLabel" ? (
                  <ShieldCheck size={11} />
                ) : labelKey === "playerDetail.loadProfileLabel" ? (
                  <Gauge size={11} />
                ) : labelKey === "playerDetail.recentUsageLabel" ? (
                  <Activity size={11} />
                ) : (
                  <Flame size={11} />
                )
              }
              label={t(labelKey)}
              value={
                <span className="text-[15px] leading-6">{snapshot.label}</span>
              }
              valueClass={toneValueClass(snapshot.tone)}
              sub={snapshot.subvalue}
            />
          ))}
        </div>
      </div>

      {/* alt üçlü grid */}
      <div className="grid gap-3 xl:grid-cols-12">
        {/* sol sütun */}
        <div className="space-y-3 xl:col-span-4">
          <div className="rounded-2xl border border-line bg-card p-4">
            <SectionHeading icon={<Activity size={13} />}>
              {t("playerDetail.last5AppearancesLabel")}
            </SectionHeading>

            {recentRows.length === 0 ? (
              <div className="mt-3 text-sm text-ink-2">
                {t("playerDetail.noRecentFormData")}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {recentRows.map((row) => (
                  <div
                    key={`${row.source_match_id}-${row.player_source_id}`}
                    className="min-w-0 rounded-xl border border-line bg-field px-2 py-2"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <PlayerResultBadge resultCode={row.result_code} />
                      <span className="truncate text-[9px] text-ink-3">
                        {shortDate(row.match_datetime)}
                      </span>
                    </div>
                    <div
                      className="mt-2 truncate text-[11px] font-medium text-ink"
                      title={row.opponent_name ?? undefined}
                    >
                      {shortTeam(row.opponent_team_slug, row.opponent_name)}
                    </div>
                    <div className="mt-1 text-[11px] text-ink-2">
                      {row.score_display ?? "—"}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="text-[10px] text-ink-3">
                        {row.minutes_played ?? "—"}&#39;
                      </span>
                      <span
                        className="rounded bg-accent-soft px-1 py-0.5 text-[9px] font-semibold text-accent-ink"
                        title={t("playerDetail.xgColumn")}
                      >
                        {formatDecimal(row.expected_goals, 2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-card p-4">
            <SectionHeading icon={<Crosshair size={13} />}>
              {t("playerDetail.attributeOverviewLabel")}
            </SectionHeading>

            {radarAxes.length >= 3 ? (
              <>
                <div className="mt-3 flex items-center gap-4">
                  <div className="w-[54%] min-w-0 shrink-0">
                    <RadarChart axes={radarAxes} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    {radarAxes.map((axis) => (
                      <div key={axis.key}>
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-ink-2">
                            {axis.label}
                          </span>
                          <span className="shrink-0 font-semibold text-ink">
                            {Math.round(axis.value)}
                          </span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-veil">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${Math.round(axis.value)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-3 text-[10px] text-ink-3">
                  {t("playerDetail.attributePercentileNote")}
                </p>
              </>
            ) : (
              <div className="mt-3 text-sm text-ink-2">
                {t("playerDetail.noAttributeData")}
              </div>
            )}
          </div>
        </div>

        {/* orta sütun */}
        <div className="space-y-3 xl:col-span-4">
          <div className="rounded-2xl border border-line bg-card p-4">
            <SectionHeading icon={<TrendingUp size={13} />}>
              {t("playerDetail.seasonSummaryLabel")}
              {profile.season_label ? (
                <span className="ml-1 normal-case tracking-normal text-ink-3">
                  ({profile.season_label})
                </span>
              ) : null}
            </SectionHeading>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-field px-4 py-3 sm:grid-cols-4">
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("common.team")}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink">
                  {teamLogoPath ? (
                    <Image
                      src={teamLogoPath}
                      alt={displayTeamName}
                      width={16}
                      height={16}
                      className="h-4 w-4 shrink-0 object-contain"
                    />
                  ) : null}
                  <span className="truncate">{displayTeamName}</span>
                </div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("common.competition")}
                </div>
                <div className="mt-1 truncate text-sm font-medium text-ink">
                  {profile.competition ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("playerDetail.positionLabel")}
                </div>
                <div className="mt-1 truncate text-sm font-medium text-ink">
                  {currentInfo?.position ?? profile.primary_position_code}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("playerDetail.avgMinutesLabel")}
                </div>
                <div className="mt-1 text-sm font-medium text-ink">
                  {formatDecimal(profile.avg_minutes, 1)}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <SectionHeading icon={<Activity size={13} />}>
                {t("playerDetail.performanceOverTimeLabel")}
              </SectionHeading>
              {chartRows.length === 0 ? (
                <div className="mt-3 text-sm text-ink-2">
                  {t("playerDetail.noRecentMatchData")}
                </div>
              ) : (
                <div className="mt-3">
                  <PerformanceChart rows={chartRows} t={t} />
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-1 border-t border-line pt-4 sm:grid-cols-5">
              <AvgStat
                icon={<Clock size={11} />}
                label={t("playerDetail.minutesLabel")}
                value={formatDecimal(profile.avg_minutes, 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Goal size={11} />}
                label={t("common.goals")}
                value={formatDecimal(profile.goals / Math.max(profile.appearances, 1), 2)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Zap size={11} />}
                label={t("common.assists")}
                value={formatDecimal(
                  profile.assists / Math.max(profile.appearances, 1),
                  2
                )}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Crosshair size={11} />}
                label={t("playerDetail.shotsLabel")}
                value={formatDecimal(seasonShotsTotal / appsCount, 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Target size={11} />}
                label={t("playerDetail.shotsOnTargetLabel")}
                value={formatDecimal(seasonSot / appsCount, 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-1 border-t border-line pt-4">
              <AvgStat
                icon={<Percent size={11} />}
                label={t("playerDetail.passAccuracyLabel")}
                value={
                  passAccuracyPct !== null
                    ? `${formatDecimal(passAccuracyPct, 0)}%`
                    : "—"
                }
              />
              <AvgStat
                icon={<ShieldCheck size={11} />}
                label={t("playerDetail.tacklesLabel")}
                value={formatDecimal(seasonTackles / appsCount, 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<TrendingUp size={11} />}
                label={t("playerDetail.xgColumn")}
                value={formatDecimal(seasonXg / appsCount, 2)}
                sub={t("playerDetail.perMatchSuffix")}
              />
            </div>
          </div>
        </div>

        {/* sağ sütun */}
        <div className="space-y-3 xl:col-span-4">
          <div className="rounded-2xl border border-line bg-card p-4">
            <SectionHeading
              icon={<CalendarDays size={13} />}
              right={
                <Link
                  href={`${detailHrefBase}&tab=match-log`}
                  className="text-[11px] text-accent-ink transition hover:underline"
                >
                  {t("playerDetail.tabMatchLog")} →
                </Link>
              }
            >
              {snapshots.staleProfile
                ? t("playerDetail.lastRecordedMatchesLabel")
                : t("playerDetail.recentMatchesLabel")}
            </SectionHeading>

            {tableRows.length === 0 ? (
              <div className="mt-3 text-sm text-ink-2">
                {t("playerDetail.noRecentMatchData")}
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="text-left text-[9px] uppercase tracking-[0.12em] text-ink-3">
                      <th className="px-2 py-1.5 font-medium">
                        {t("common.date")}
                      </th>
                      <th className="px-2 py-1.5 font-medium">
                        {t("common.opponent")}
                      </th>
                      <th className="px-2 py-1.5 font-medium">
                        {t("common.score")}
                      </th>
                      <th className="px-2 py-1.5 font-medium">
                        {t("playerDetail.roleColumn")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("common.minutes")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("playerDetail.goalsAbbr")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("playerDetail.assistsAbbr")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("playerDetail.xgColumn")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => {
                      const opponentLogo = getTeamLogoPath(
                        row.opponent_team_slug
                      );
                      return (
                        <tr
                          key={`${row.source_match_id}-${row.player_source_id}`}
                          className="border-t border-line text-[12px] text-ink transition hover:bg-veil"
                        >
                          <td className="whitespace-nowrap px-2 py-2 text-ink-2">
                            <MatchLink
                              sourceMatchId={row.source_match_id}
                              returnTo={overviewReturnTo}
                              className="transition hover:text-ink hover:underline"
                              title={t("playerDetail.openMatchDetailTitle")}
                            >
                              {formatDate(row.match_datetime)}
                            </MatchLink>
                          </td>
                          <td className="max-w-[140px] px-2 py-2">
                            <span className="flex items-center gap-1.5">
                              {opponentLogo ? (
                                <Image
                                  src={opponentLogo}
                                  alt={row.opponent_name ?? ""}
                                  width={16}
                                  height={16}
                                  className="h-4 w-4 shrink-0 object-contain"
                                />
                              ) : null}
                              <span
                                className="truncate font-medium"
                                title={row.opponent_name ?? undefined}
                              >
                                {shortTeam(
                                  row.opponent_team_slug,
                                  row.opponent_name
                                )}
                              </span>
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            <span className="inline-flex items-center gap-1.5">
                              <span>{row.score_display ?? "—"}</span>
                              <PlayerResultBadge
                                resultCode={row.result_code}
                              />
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            <span
                              className={`inline-flex rounded-md border px-1.5 py-[2px] text-[10px] font-medium ${getRoleBadgeClasses(
                                row.lineup_status
                              )}`}
                            >
                              {normalizeRoleLabel(t, row.lineup_status)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {row.minutes_played ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {row.goals ?? 0}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {row.assists ?? 0}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-accent-ink">
                            {formatDecimal(row.expected_goals, 3)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-card p-4">
            <SectionHeading icon={<TrendingUp size={13} />}>
              {t("playerDetail.careerStatsLabel")}
            </SectionHeading>

            {careerRows.length === 0 ? (
              <div className="mt-3 text-sm text-ink-2">
                {t("playerDetail.noRecentMatchData")}
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="text-left text-[9px] uppercase tracking-[0.12em] text-ink-3">
                      <th className="px-2 py-1.5 font-medium">
                        {t("common.season")}
                      </th>
                      <th className="px-2 py-1.5 font-medium">
                        {t("common.team")}
                      </th>
                      <th className="px-2 py-1.5 font-medium">
                        {t("common.competition")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("common.appearances")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("common.minutes")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("playerDetail.goalsAbbr")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("playerDetail.assistsAbbr")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("common.starts")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("playerDetail.xgColumn")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {careerRows.map((row) => {
                      const logo = getTeamLogoPath(row.teamSlug);
                      const isCurrent =
                        row.season === (profile.season_label ?? "");
                      return (
                        <tr
                          key={row.key}
                          className={`border-t border-line text-[12px] transition hover:bg-veil ${
                            isCurrent ? "text-ink" : "text-ink-2"
                          }`}
                        >
                          <td className="whitespace-nowrap px-2 py-2 font-medium">
                            {row.season}
                          </td>
                          <td className="max-w-[120px] px-2 py-2">
                            <span className="flex items-center gap-1.5">
                              {logo ? (
                                <Image
                                  src={logo}
                                  alt={row.teamName}
                                  width={16}
                                  height={16}
                                  className="h-4 w-4 shrink-0 object-contain"
                                />
                              ) : null}
                              <span
                                className="truncate"
                                title={row.teamName}
                              >
                                {shortTeam(row.teamSlug, row.teamName)}
                              </span>
                            </span>
                          </td>
                          <td className="max-w-[100px] truncate px-2 py-2">
                            {row.competition}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {row.apps}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {row.minutes}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-ink">
                            {row.goals}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {row.assists}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {row.starts}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-accent-ink">
                            {formatDecimal(row.xg, 2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {profile.season_label ? (
              <p className="mt-3 text-[10px] text-ink-3">
                {t("playerDetail.allStatsSeasonNote", {
                  season: profile.season_label,
                })}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
