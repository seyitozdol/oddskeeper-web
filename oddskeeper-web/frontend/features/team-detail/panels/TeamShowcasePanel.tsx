import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  Crosshair,
  Flag,
  Gauge,
  Goal,
  Landmark,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  User,
  Users,
  Zap,
} from "lucide-react";
import type {
  TeamDetailedMetricRow,
  TeamProfileRow,
  TeamRecentFormRow,
  TeamResultRow,
  TeamStatisticsSummaryRow,
} from "../types";
import { TeamHeroLogo } from "../components/TeamHeroLogo";
import {
  ShowcaseRadar,
  ShowcaseRadarBars,
  ShowcaseTrend,
  type ShowcaseRadarAxis,
  type ShowcaseTrendPoint,
} from "@/components/showcase/ShowcaseCharts";
import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/messages";
import type { TeamNote } from "@/lib/team-notes";
import { getTeamAliases } from "@/features/player-detail/server/getTeamAliases";
import { resolveShortTeamName } from "@/lib/team-alias";

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

function fmt(v: number | string | null | undefined, digits = 0): string {
  const n = num(v);
  if (n === null) return "—";
  return digits > 0 ? n.toFixed(digits) : String(Math.round(n));
}

function shortDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${`${d.getDate()}`.padStart(2, "0")}/${`${d.getMonth() + 1}`.padStart(2, "0")}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function resultBadgeClass(res: "W" | "D" | "L" | null) {
  if (res === "W") return "bg-pos/15 text-pos";
  if (res === "L") return "bg-neg/15 text-neg";
  return "bg-veil text-ink-2";
}

// Kümülatif puan serisi (render dışı saf yardımcı; lint immutability kuralı
// component gövdesinde closure mutasyonuna izin vermiyor).
function buildCumulativeTrend(rows: TeamResultRow[]): ShowcaseTrendPoint[] {
  const out: ShowcaseTrendPoint[] = [];
  let cum = 0;
  for (const r of rows) {
    cum += r.result_points ?? 0;
    out.push({
      key: r.source_match_id,
      label: shortDate(r.match_datetime),
      value: cum,
      tone:
        r.result_code === "W" ? "pos" : r.result_code === "L" ? "neg" : "hollow",
    });
  }
  return out;
}

function resultLetter(t: Translator, res: "W" | "D" | "L" | null) {
  if (res === "W") return t("tff1.resultWin");
  if (res === "L") return t("tff1.resultLoss");
  if (res === "D") return t("tff1.resultDraw");
  return "—";
}

/* ── yapı taşları (oyuncu vitriniyle aynı dil) ──────────────── */

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
      <div className={`mt-1.5 truncate text-lg font-semibold leading-6 ${valueClass}`}>
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 truncate text-[10px] leading-4 text-ink-3">{sub}</div>
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
      <div className="mt-1.5 text-2xl font-semibold leading-7 text-ink">{value}</div>
      {sub ? <div className="mt-0.5 text-[10px] text-ink-3">{sub}</div> : null}
    </div>
  );
}

/* ── ana panel ──────────────────────────────────────────────── */

// Radar eksenleri: tsl_ss takım mat'ından 6 temsilci metrik.
// league_percentile takım mat'ında best=1.0 konvansiyonundadır (yön
// düzeltilmiş); skor = yüzdelik * 100.
const RADAR_METRIC_KEYS = [
  "team_goals_for",
  "team_expected_goals",
  "team_shots_on_target",
  "team_pass_accuracy_pct",
  "team_goals_against",
  "team_shots_against",
];

export type TeamShowcasePanelProps = {
  teamSlug: string;
  teamName: string;
  logoPath: string;
  teamProfile: TeamProfileRow | null;
  summary: TeamStatisticsSummaryRow | null;
  seasonHistory: TeamStatisticsSummaryRow[];
  recentForm: TeamRecentFormRow[];
  results: TeamResultRow[];
  detailedMetrics: TeamDetailedMetricRow[];
  teamNotes: TeamNote[];
  logoBySlug?: Record<string, string>;
};

export async function TeamShowcasePanel({
  teamSlug,
  teamName,
  logoPath,
  teamProfile,
  summary,
  seasonHistory,
  recentForm,
  results,
  detailedMetrics,
  teamNotes,
  logoBySlug = {},
}: TeamShowcasePanelProps) {
  const t = await getT();
  const teamAliases = await getTeamAliases();
  const shortOpp = (
    slug: string | null | undefined,
    name: string | null | undefined
  ) => resolveShortTeamName(teamAliases, slug, name);

  const detailHrefBase = `/dashboard/stats-analysis/football/team-stats/detail?team=${encodeURIComponent(teamSlug)}`;
  const seasonLabel = summary?.season_label ?? null;

  // Sezon pilleri (en yeni önce)
  const seasonsSorted = [...seasonHistory].sort((a, b) =>
    (b.season_label ?? "").localeCompare(a.season_label ?? "")
  );

  // Sezon sonuçları: grafik için eskiden yeniye, tablo için yeniden eskiye
  const seasonResults = results
    .filter((r) => !seasonLabel || r.season_label === seasonLabel)
    .sort((a, b) => (a.match_datetime ?? "").localeCompare(b.match_datetime ?? ""));
  const resultsDesc = [...seasonResults].reverse();
  const tableRows = resultsDesc.slice(0, 6);
  const last5 = recentForm.length > 0 ? recentForm.slice(0, 5) : resultsDesc.slice(0, 5);

  // Kümülatif puan grafiği
  const trendPoints = buildCumulativeTrend(seasonResults);
  const yMax = Math.max(trendPoints[trendPoints.length - 1]?.value ?? 0, 3);
  const yTicks = [0, Math.round(yMax / 3), Math.round((2 * yMax) / 3), yMax].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  // Radar + güçlü/zayıf yön (yüzdelik best=1.0)
  const metricByKey = new Map(detailedMetrics.map((m) => [m.metric_key, m]));
  const radarAxes: ShowcaseRadarAxis[] = RADAR_METRIC_KEYS.flatMap((key) => {
    const m = metricByKey.get(key);
    if (!m || m.league_percentile === null) return [];
    return [
      {
        key,
        label: m.metric_label,
        value: Math.max(0, Math.min(100, (m.league_percentile ?? 0) * 100)),
      },
    ];
  });

  const ranked = detailedMetrics
    .filter((m) => m.league_percentile !== null)
    .sort((a, b) => (b.league_percentile ?? 0) - (a.league_percentile ?? 0));
  const strengths = ranked.slice(0, 2);
  const weakest = ranked.length > 0 ? ranked[ranked.length - 1] : null;

  const perMatch = (key: string, digits = 1) =>
    fmt(metricByKey.get(key)?.per_match_value, digits);

  const formLetters = (rows: { result_code: "W" | "D" | "L" | null }[]) => (
    <span className="flex items-center gap-1">
      {rows.map((r, i) => (
        <span
          key={i}
          className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold ${resultBadgeClass(r.result_code)}`}
        >
          {resultLetter(t, r.result_code)}
        </span>
      ))}
    </span>
  );

  return (
    <section className="w-full space-y-3">
      {/* hero + özet paneli */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_460px]">
          {/* sol: hero */}
          <div className="relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
              <TeamHeroLogo
                teamSlug={teamSlug}
                teamName={teamName}
                logoSrc={logoPath || null}
                initialNotes={teamNotes}
              />

              <div className="min-w-0">
                <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl xl:text-[42px] xl:leading-[1.1]">
                  <span className="truncate">{teamName}</span>
                  {/* Lig logosu (SELF-HOST; Vercel optimizer SofaScore'u cekemiyor).
                      tsl-league-mark: koyu temalarda duz beyaz, acik temada renkli. */}
                  <Image
                    src="/images/leagues/super-lig-ss.png"
                    alt="Trendyol Süper Lig"
                    title="Trendyol Süper Lig"
                    width={56}
                    height={56}
                    className="tsl-league-mark h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
                  />
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-ink-2">
                  <span className="font-medium text-ink">
                    {summary?.competition ?? "—"}
                  </span>
                  {seasonsSorted.length > 1 ? (
                    <span className="flex flex-wrap items-center gap-1">
                      {seasonsSorted.slice(0, 5).map((row) => (
                        <Link
                          key={row.season_label ?? "?"}
                          href={`${detailHrefBase}&tab=team-statistics&season=${encodeURIComponent(row.season_label ?? "")}`}
                          className={`rounded-md border px-2 py-0.5 text-[12px] transition ${
                            row.season_label === seasonLabel
                              ? "border-line-strong bg-card-2 text-ink"
                              : "border-line bg-veil text-ink-2 hover:text-ink"
                          }`}
                        >
                          {row.season_label}
                        </Link>
                      ))}
                    </span>
                  ) : (
                    <span>{seasonLabel ?? "—"}</span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-ink-3">
                  {teamProfile?.stadium_name ? (
                    <span>{teamProfile.stadium_name}</span>
                  ) : null}
                  {teamProfile?.founded_year ? (
                    <>
                      <span>•</span>
                      <span>
                        {t("teamDetail.labelFounded")}: {teamProfile.founded_year}
                      </span>
                    </>
                  ) : null}
                  {teamProfile?.capacity ? (
                    <>
                      <span>•</span>
                      <span>{teamProfile.capacity.toLocaleString("en-GB")}</span>
                    </>
                  ) : null}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("teamDetail.labelMarketValue")}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-pos">
                      {teamProfile?.market_value_display ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("teamDetail.labelHeadCoach")}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-ink">
                      {teamProfile?.head_coach ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("teamDetail.labelStadium")}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-ink">
                      {teamProfile?.stadium_name ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("teamDetail.labelCapacity")}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-ink">
                      {teamProfile?.capacity
                        ? teamProfile.capacity.toLocaleString("en-GB")
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* sağ: takım özeti */}
          <div className="border-t border-line bg-card-2/40 p-5 xl:border-l xl:border-t-0">
            <SectionHeading icon={<Sparkles size={13} />}>
              {t("teamDetail.snapshotPanelLabel")}
            </SectionHeading>

            <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <SnapshotRow
                icon={<Trophy size={14} />}
                label={t("teamDetail.statPoints")}
                value={
                  summary
                    ? `${summary.points} (${summary.wins}${t("tff1.resultWin")} ${summary.draws}${t("tff1.resultDraw")} ${summary.losses}${t("tff1.resultLoss")})`
                    : "—"
                }
              />
              <SnapshotRow
                icon={<Activity size={14} />}
                label={t("teamDetail.recentFormTitle")}
                value={last5.length > 0 ? formLetters(last5) : "—"}
              />
              <SnapshotRow
                icon={<Zap size={14} />}
                label={t("playerDetail.strengthsLabel")}
                value={
                  strengths.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {strengths.map((m) => (
                        <span
                          key={m.metric_key}
                          className="rounded-md border border-line-strong bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-ink"
                          title={`#${m.league_rank}`}
                        >
                          {m.metric_label}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <SnapshotRow
                icon={<Shield size={14} />}
                label={t("teamDetail.weaknessLabel")}
                value={
                  weakest ? (
                    <span
                      className="rounded-md border border-line bg-veil px-1.5 py-0.5 text-[11px] font-medium text-ink-2"
                      title={`#${weakest.league_rank}`}
                    >
                      {weakest.metric_label}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <SnapshotRow
                icon={<Goal size={14} />}
                label={t("teamDetail.statGoalDifference")}
                value={
                  summary
                    ? `${summary.goal_difference > 0 ? "+" : ""}${summary.goal_difference} (${summary.goals_for}-${summary.goals_against})`
                    : "—"
                }
              />
              <SnapshotRow
                icon={<Gauge size={14} />}
                label={t("teamDetail.statPointsPerGame")}
                value={fmt(summary?.points_per_game, 2)}
              />
              <SnapshotRow
                icon={<User size={14} />}
                label={t("teamDetail.labelHeadCoach")}
                value={teamProfile?.head_coach ?? "—"}
              />
              <SnapshotRow
                icon={<CalendarDays size={14} />}
                label={t("playerDetail.lastMatchLabel")}
                value={formatDate(summary?.latest_match_datetime)}
              />
            </div>
          </div>
        </div>

        {/* istatistik şeridi */}
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4 xl:grid-cols-8">
          <StripStat
            icon={<CalendarDays size={11} />}
            label={t("teamDetail.statPlayed")}
            value={summary?.played ?? "—"}
            sub={seasonLabel ?? undefined}
          />
          <StripStat
            icon={<Trophy size={11} />}
            label={t("teamDetail.statPoints")}
            value={summary?.points ?? "—"}
            sub={seasonLabel ?? undefined}
          />
          <StripStat
            icon={<ShieldCheck size={11} />}
            label={t("teamDetail.statWins")}
            value={summary?.wins ?? "—"}
            valueClass="text-pos"
            sub={seasonLabel ?? undefined}
          />
          <StripStat
            icon={<Flag size={11} />}
            label={t("teamDetail.statDraws")}
            value={summary?.draws ?? "—"}
            sub={seasonLabel ?? undefined}
          />
          <StripStat
            icon={<Shield size={11} />}
            label={t("teamDetail.statLosses")}
            value={summary?.losses ?? "—"}
            valueClass="text-neg"
            sub={seasonLabel ?? undefined}
          />
          <StripStat
            icon={<Goal size={11} />}
            label={t("teamDetail.statGoalsFor")}
            value={summary?.goals_for ?? "—"}
            sub={seasonLabel ?? undefined}
          />
          <StripStat
            icon={<Target size={11} />}
            label={t("teamDetail.statGoalsAgainst")}
            value={summary?.goals_against ?? "—"}
            sub={seasonLabel ?? undefined}
          />
          <StripStat
            icon={<TrendingUp size={11} />}
            label={t("teamDetail.statGoalDifference")}
            value={
              summary
                ? `${summary.goal_difference > 0 ? "+" : ""}${summary.goal_difference}`
                : "—"
            }
            sub={seasonLabel ?? undefined}
          />
        </div>
      </div>

      {/* alt üçlü grid */}
      <div className="grid gap-3 xl:grid-cols-12">
        {/* sol sütun */}
        <div className="space-y-3 xl:col-span-4">
          <div className="rounded-2xl border border-line bg-card p-4">
            <SectionHeading icon={<Activity size={13} />}>
              {t("teamDetail.recentFormTitle")}
            </SectionHeading>

            {last5.length === 0 ? (
              <div className="mt-3 text-sm text-ink-2">
                {t("playerDetail.noRecentFormData")}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {last5.map((row, i) => (
                  <div
                    key={`${row.source_match_id}-${i}`}
                    className="min-w-0 rounded-xl border border-line bg-field px-2 py-2"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold ${resultBadgeClass(row.result_code)}`}
                      >
                        {resultLetter(t, row.result_code)}
                      </span>
                      <span className="truncate text-[9px] text-ink-3">
                        {shortDate(row.match_datetime)}
                      </span>
                    </div>
                    <div
                      className="mt-2 truncate text-[11px] font-medium text-ink"
                      title={row.opponent_name ?? undefined}
                    >
                      {shortOpp(
                        (row as TeamResultRow).opponent_team_slug ?? null,
                        row.opponent_name
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-ink-2">
                      {row.score_display ?? `${row.team_score ?? "-"}-${row.opponent_score ?? "-"}`}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="text-[10px] text-ink-3">
                        {row.is_home ? t("tff1.homeShort") : t("tff1.awayShort")}
                      </span>
                      <span className="rounded bg-accent-soft px-1 py-0.5 text-[9px] font-semibold text-accent-ink">
                        {(row as TeamRecentFormRow).result_points ??
                          (row.result_code === "W" ? 3 : row.result_code === "D" ? 1 : 0)}
                        P
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
                    <ShowcaseRadar axes={radarAxes} />
                  </div>
                  <ShowcaseRadarBars axes={radarAxes} />
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
              {seasonLabel ? (
                <span className="ml-1 normal-case tracking-normal text-ink-3">
                  ({seasonLabel})
                </span>
              ) : null}
            </SectionHeading>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-field px-4 py-3 sm:grid-cols-4">
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("common.competition")}
                </div>
                <div className="mt-1 truncate text-sm font-medium text-ink">
                  {summary?.competition ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("common.season")}
                </div>
                <div className="mt-1 text-sm font-medium text-ink">
                  {seasonLabel ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("teamDetail.statWinRate")}
                </div>
                <div className="mt-1 text-sm font-medium text-ink">
                  {fmt(summary?.win_rate_pct, 1)}%
                </div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("teamDetail.statPointsPerGame")}
                </div>
                <div className="mt-1 text-sm font-medium text-ink">
                  {fmt(summary?.points_per_game, 2)}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <SectionHeading icon={<Activity size={13} />}>
                {t("playerDetail.performanceOverTimeLabel")}
              </SectionHeading>
              {trendPoints.length === 0 ? (
                <div className="mt-3 text-sm text-ink-2">
                  {t("playerDetail.noRecentMatchData")}
                </div>
              ) : (
                <div className="mt-3">
                  <ShowcaseTrend points={trendPoints} yMax={yMax} yTicks={yTicks} />
                  <div className="mt-1 flex items-center gap-4 text-[10px] text-ink-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-pos" />
                      {t("tff1.resultWin")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-neg" />
                      {t("tff1.resultLoss")}
                    </span>
                    <span className="ml-auto">{t("teamDetail.pointsTrendNote")}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-1 border-t border-line pt-4 sm:grid-cols-4">
              <AvgStat
                icon={<Goal size={11} />}
                label={t("teamDetail.statGoalsFor")}
                value={perMatch("team_goals_for", 2)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Target size={11} />}
                label={t("teamDetail.statGoalsAgainst")}
                value={perMatch("team_goals_against", 2)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<TrendingUp size={11} />}
                label={t("playerDetail.xgColumn")}
                value={perMatch("team_expected_goals", 2)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Crosshair size={11} />}
                label={t("playerDetail.shotsLabel")}
                value={perMatch("team_shots", 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Target size={11} />}
                label={t("playerDetail.shotsOnTargetLabel")}
                value={perMatch("team_shots_on_target", 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Landmark size={11} />}
                label={t("playerDetail.passAccuracyLabel")}
                value={
                  metricByKey.get("team_pass_accuracy_pct")
                    ? `${fmt(metricByKey.get("team_pass_accuracy_pct")?.per_match_value, 0)}%`
                    : "—"
                }
              />
              <AvgStat
                icon={<Shield size={11} />}
                label={t("playerDetail.tacklesLabel")}
                value={perMatch("team_tackles", 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Users size={11} />}
                label={metricByKey.get("team_shots_against")?.metric_label ?? "—"}
                value={perMatch("team_shots_against", 1)}
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
                  href={`${detailHrefBase}&tab=results`}
                  className="text-[11px] text-accent-ink transition hover:underline"
                >
                  {t("teamDetail.tabResults")} →
                </Link>
              }
            >
              {t("playerDetail.recentMatchesLabel")}
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
                      <th className="px-2 py-1.5 font-medium">{t("common.date")}</th>
                      <th className="px-2 py-1.5 font-medium">{t("common.opponent")}</th>
                      <th className="px-2 py-1.5 font-medium">{t("common.score")}</th>
                      <th className="px-2 py-1.5 font-medium">{t("tff1.colHomeAway")}</th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("teamDetail.statPoints")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => {
                      const oppLogo = row.opponent_team_slug
                        ? logoBySlug[row.opponent_team_slug] ??
                          `/images/football_logos/${row.opponent_team_slug}.png`
                        : null;
                      return (
                        <tr
                          key={row.source_match_id}
                          className="border-t border-line text-[12px] text-ink transition hover:bg-veil"
                        >
                          <td className="whitespace-nowrap px-2 py-2 text-ink-2">
                            {formatDate(row.match_datetime)}
                          </td>
                          <td className="max-w-[150px] px-2 py-2">
                            <span className="flex items-center gap-1.5">
                              {oppLogo ? (
                                <Image
                                  src={oppLogo}
                                  alt=""
                                  width={16}
                                  height={16}
                                  className="h-4 w-4 shrink-0 object-contain"
                                />
                              ) : null}
                              <span
                                className="truncate font-medium"
                                title={row.opponent_name ?? undefined}
                              >
                                {shortOpp(row.opponent_team_slug, row.opponent_name)}
                              </span>
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            <span className="inline-flex items-center gap-1.5">
                              <span>{row.score_display ?? "—"}</span>
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold ${resultBadgeClass(row.result_code)}`}
                              >
                                {resultLetter(t, row.result_code)}
                              </span>
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-ink-2">
                            {row.is_home ? t("tff1.homeShort") : t("tff1.awayShort")}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-accent-ink">
                            {row.result_points ?? "—"}
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
            <SectionHeading
              icon={<TrendingUp size={13} />}
              right={
                <Link
                  href={`${detailHrefBase}&tab=season-history`}
                  className="text-[11px] text-accent-ink transition hover:underline"
                >
                  {t("teamDetail.tabSeasonHistory")} →
                </Link>
              }
            >
              {t("teamDetail.seasonHistoryTitle")}
            </SectionHeading>

            {seasonsSorted.length === 0 ? (
              <div className="mt-3 text-sm text-ink-2">
                {t("playerDetail.noRecentMatchData")}
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="text-left text-[9px] uppercase tracking-[0.12em] text-ink-3">
                      <th className="px-2 py-1.5 font-medium">{t("common.season")}</th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("teamDetail.statPlayed")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("tff1.resultWin")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("tff1.resultDraw")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("tff1.resultLoss")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("teamDetail.statGoalsFor")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("teamDetail.statGoalsAgainst")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("teamDetail.statPoints")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasonsSorted.slice(0, 8).map((row) => {
                      const isCurrent = row.season_label === seasonLabel;
                      return (
                        <tr
                          key={row.season_label ?? "?"}
                          className={`border-t border-line text-[12px] transition hover:bg-veil ${
                            isCurrent ? "text-ink" : "text-ink-2"
                          }`}
                        >
                          <td className="whitespace-nowrap px-2 py-2 font-medium">
                            <Link
                              href={`${detailHrefBase}&tab=team-statistics&season=${encodeURIComponent(row.season_label ?? "")}`}
                              className="transition hover:text-ink hover:underline"
                            >
                              {row.season_label}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {row.played}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {row.wins}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {row.draws}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {row.losses}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {row.goals_for}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {row.goals_against}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-accent-ink">
                            {row.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
