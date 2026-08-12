import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  Crosshair,
  Euro,
  Gauge,
  Goal,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { formatMarketValue, formatMatchDate } from "../lib";
import type { Tff1MatchRow, Tff1TeamRow } from "../types";
import { TeamHeroLogo } from "@/features/team-detail/components/TeamHeroLogo";
import {
  ShowcaseRadar,
  ShowcaseRadarBars,
  ShowcaseTrend,
  type ShowcaseRadarAxis,
  type ShowcaseTrendPoint,
} from "@/components/showcase/ShowcaseCharts";
import type { Translator } from "@/lib/i18n/messages";
import type { TeamNote } from "@/lib/team-notes";

function num(v: number | string | null | undefined): number {
  const x = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(x as number) ? (x as number) : 0;
}

function shortDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${`${d.getDate()}`.padStart(2, "0")}/${`${d.getMonth() + 1}`.padStart(2, "0")}`;
}

type Res = "W" | "D" | "L" | null;

function resultBadgeClass(res: Res) {
  if (res === "W") return "bg-pos/15 text-pos";
  if (res === "L") return "bg-neg/15 text-neg";
  return "bg-veil text-ink-2";
}

// Kümülatif puan serisi (render dışı saf yardımcı; lint immutability kuralı
// component gövdesinde closure mutasyonuna izin vermiyor).
function buildCumulativeTrend(
  rows: Tff1MatchRow[],
  resultFor: (m: Tff1MatchRow) => Res
): ShowcaseTrendPoint[] {
  const out: ShowcaseTrendPoint[] = [];
  let cum = 0;
  for (const m of rows) {
    const r = resultFor(m);
    cum += r === "W" ? 3 : r === "D" ? 1 : 0;
    out.push({
      key: m.match_id,
      label: shortDate(m.match_datetime),
      value: cum,
      tone: r === "W" ? "pos" : r === "L" ? "neg" : "hollow",
    });
  }
  return out;
}

/* ── yüzdelik motoru (lig takımları havuzunda) ─────────────── */

type TeamMetricSpec = {
  key: string;
  labelKey: string;
  pick: (r: Tff1TeamRow) => number | null;
  perPlayed?: boolean;
  lowerBetter?: boolean;
};

const TEAM_RADAR_SPECS: TeamMetricSpec[] = [
  { key: "attack", labelKey: "tff1.colGoals", pick: (r) => num(r.goals_for), perPlayed: true },
  { key: "sot", labelKey: "tff1.colShotsOnTarget", pick: (r) => num(r.shots_on_target), perPlayed: true },
  { key: "creation", labelKey: "tff1.colBigChancesCreated", pick: (r) => num(r.big_chances_created), perPlayed: true },
  { key: "pass", labelKey: "tff1.colPassAccuracy", pick: (r) => (r.pass_accuracy === null ? null : num(r.pass_accuracy)) },
  { key: "defence", labelKey: "tff1.colGoalsAgainst", pick: (r) => num(r.goals_against), perPlayed: true, lowerBetter: true },
  { key: "rating", labelKey: "tff1.colRating", pick: (r) => (r.rating_avg === null ? null : num(r.rating_avg)) },
];

function specValue(row: Tff1TeamRow, spec: TeamMetricSpec): number | null {
  const raw = spec.pick(row);
  if (raw === null) return null;
  if (spec.perPlayed) {
    const played = num(row.played);
    if (played <= 0) return null;
    return raw / played;
  }
  return raw;
}

function percentileIn(pool: number[], value: number, lowerBetter: boolean): number {
  if (pool.length <= 1) return 50;
  const better = lowerBetter
    ? pool.filter((v) => v > value).length
    : pool.filter((v) => v < value).length;
  return (better / (pool.length - 1)) * 100;
}

/* ── yapı taşları ───────────────────────────────────────────── */

function SectionHeading({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-3">
      {icon ? <span className="text-accent-ink">{icon}</span> : null}
      <span>{children}</span>
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

/* ── ana bileşen ────────────────────────────────────────────── */

export type Tff1TeamShowcaseProps = {
  teamId: string;
  team: Tff1TeamRow;
  teamSeasons: Tff1TeamRow[];
  seasonTeams: Tff1TeamRow[];
  // Radar için kaynak sezon: sezon başında (5 maç altı) örneklem gürültülü
  // olduğundan sayfa yeterli maçı olan son sezonu ve o sezonun havuzunu geçer.
  radarTeam?: Tff1TeamRow;
  radarSeasonTeams?: Tff1TeamRow[];
  rank: number;
  logoUrl: string | null;
  noteSlug: string | null;
  teamNotes: TeamNote[];
  leagueMatches: Tff1MatchRow[];
  squadValue: number;
  resultFor: (m: Tff1MatchRow) => Res;
  t: Translator;
  locale: string;
};

export function Tff1TeamShowcase({
  teamId,
  team,
  teamSeasons,
  seasonTeams,
  radarTeam,
  radarSeasonTeams,
  rank,
  logoUrl,
  noteSlug,
  teamNotes,
  leagueMatches,
  squadValue,
  resultFor,
  t,
  locale,
}: Tff1TeamShowcaseProps) {
  const season = team.season_label;
  const teamName = team.team_name ?? teamId;
  const played = num(team.played);

  const resultLetter = (r: Res) =>
    r === "W"
      ? t("tff1.resultWin")
      : r === "L"
        ? t("tff1.resultLoss")
        : r === "D"
          ? t("tff1.resultDraw")
          : "—";

  // Son 5 (yeniden eskiye) + kümülatif puan (eskiden yeniye)
  const last5 = leagueMatches.slice(0, 5);
  const asc = [...leagueMatches].reverse();
  const trendPoints = buildCumulativeTrend(asc, resultFor);
  const yMax = Math.max(trendPoints[trendPoints.length - 1]?.value ?? 0, 3);
  const yTicks = [0, Math.round(yMax / 3), Math.round((2 * yMax) / 3), yMax].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  // Radar + güçlü/zayıf yön (lig takımları havuzunda yüzdelik)
  const attrTeam = radarTeam ?? team;
  const attrPool = radarSeasonTeams ?? seasonTeams;
  const radarAxes: ShowcaseRadarAxis[] = [];
  for (const spec of TEAM_RADAR_SPECS) {
    const own = specValue(attrTeam, spec);
    if (own === null) continue;
    const pool = attrPool
      .map((r) => specValue(r, spec))
      .filter((v): v is number => v !== null);
    if (pool.length < 8) continue;
    radarAxes.push({
      key: spec.key,
      label: t(spec.labelKey),
      value: Math.max(0, Math.min(100, percentileIn(pool, own, spec.lowerBetter ?? false))),
    });
  }
  const rankedAxes = [...radarAxes].sort((a, b) => b.value - a.value);
  const strengths = rankedAxes.slice(0, 2);
  const weakest = rankedAxes.length > 0 ? rankedAxes[rankedAxes.length - 1] : null;

  const perPlayed = (v: number | string | null, digits = 1) =>
    played > 0 ? (num(v) / played).toFixed(digits) : "—";

  const formLetters = (
    <span className="flex items-center gap-1">
      {last5.map((m, i) => {
        const r = resultFor(m);
        return (
          <span
            key={i}
            className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold ${resultBadgeClass(r)}`}
          >
            {resultLetter(r)}
          </span>
        );
      })}
    </span>
  );

  return (
    <div className="space-y-3">
      {/* hero + özet paneli */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
              <TeamHeroLogo
                teamSlug={noteSlug}
                teamName={teamName}
                logoSrc={logoUrl}
                initialNotes={teamNotes}
              />

              <div className="min-w-0">
                <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl xl:text-[42px] xl:leading-[1.1]">
                  <span className="truncate">{teamName}</span>
                  {/* Lig logosu (SELF-HOST; Vercel optimizer SofaScore'u cekemiyor).
                      tsl-league-mark: koyu temalarda duz beyaz, acik temada renkli. */}
                  <Image
                    src="/images/leagues/tff-1-lig-ss.png"
                    alt="Trendyol 1. Lig"
                    title="Trendyol 1. Lig"
                    width={56}
                    height={56}
                    className="tsl-league-mark h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
                  />
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-ink-2">
                  <span className="font-medium text-ink">Trendyol 1. Lig</span>
                  <span className="flex flex-wrap items-center gap-1">
                    {teamSeasons.map((tr) => (
                      <Link
                        key={tr.season_label}
                        href={`/dashboard/tff-1-lig/team/${teamId}?season=${encodeURIComponent(tr.season_label)}`}
                        className={`rounded-md border px-2 py-0.5 text-[12px] transition ${
                          tr.season_label === season
                            ? "border-line-strong bg-card-2 text-ink"
                            : "border-line bg-veil text-ink-2 hover:text-ink"
                        }`}
                      >
                        {tr.season_label}
                      </Link>
                    ))}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("tff1.drawerRank")}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-ink">{rank}.</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("tff1.drawerSquadValue")}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-pos">
                      {formatMarketValue(squadValue || null)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("tff1.colRating")}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-ink">
                      {team.rating_avg === null ? "—" : Number(team.rating_avg).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("tff1.colCleanSheets")}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-ink">
                      {num(team.clean_sheets)}
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
                label={t("tff1.colPoints")}
                value={`${num(team.points)} (${num(team.wins)}${t("tff1.resultWin")} ${num(team.draws)}${t("tff1.resultDraw")} ${num(team.losses)}${t("tff1.resultLoss")})`}
              />
              <SnapshotRow
                icon={<Activity size={14} />}
                label={t("tff1.drawerForm")}
                value={last5.length > 0 ? formLetters : "—"}
              />
              <SnapshotRow
                icon={<Zap size={14} />}
                label={t("playerDetail.strengthsLabel")}
                value={
                  strengths.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {strengths.map((a) => (
                        <span
                          key={a.key}
                          className="rounded-md border border-line-strong bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-ink"
                          title={`${Math.round(a.value)}/100`}
                        >
                          {a.label}
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
                      title={`${Math.round(weakest.value)}/100`}
                    >
                      {weakest.label}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <SnapshotRow
                icon={<Goal size={14} />}
                label={t("tff1.drawerGoals")}
                value={`${num(team.goals_for)}-${num(team.goals_against)} (${num(team.goal_diff) > 0 ? "+" : ""}${num(team.goal_diff)})`}
              />
              <SnapshotRow
                icon={<Gauge size={14} />}
                label={t("teamDetail.statPointsPerGame")}
                value={played > 0 ? (num(team.points) / played).toFixed(2) : "—"}
              />
              <SnapshotRow
                icon={<Euro size={14} />}
                label={t("tff1.drawerSquadValue")}
                value={
                  <span className="text-pos">{formatMarketValue(squadValue || null)}</span>
                }
              />
              <SnapshotRow
                icon={<CalendarDays size={14} />}
                label={t("playerDetail.lastMatchLabel")}
                value={
                  leagueMatches[0]
                    ? formatMatchDate(leagueMatches[0].match_datetime, locale)
                    : "—"
                }
              />
            </div>
          </div>
        </div>

        {/* istatistik şeridi */}
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4 xl:grid-cols-8">
          <StripStat
            icon={<Star size={11} />}
            label={t("tff1.drawerRank")}
            value={`${rank}.`}
            sub={season}
          />
          <StripStat
            icon={<CalendarDays size={11} />}
            label={t("teamDetail.statPlayed")}
            value={played}
            sub={season}
          />
          <StripStat
            icon={<Trophy size={11} />}
            label={t("tff1.colPoints")}
            value={num(team.points)}
            sub={season}
          />
          <StripStat
            icon={<ShieldCheck size={11} />}
            label={t("teamDetail.statWins")}
            value={num(team.wins)}
            valueClass="text-pos"
            sub={season}
          />
          <StripStat
            icon={<Shield size={11} />}
            label={t("teamDetail.statLosses")}
            value={num(team.losses)}
            valueClass="text-neg"
            sub={season}
          />
          <StripStat
            icon={<Goal size={11} />}
            label={t("teamDetail.statGoalsFor")}
            value={num(team.goals_for)}
            sub={season}
          />
          <StripStat
            icon={<Target size={11} />}
            label={t("teamDetail.statGoalsAgainst")}
            value={num(team.goals_against)}
            sub={season}
          />
          <StripStat
            icon={<TrendingUp size={11} />}
            label={t("teamDetail.statGoalDifference")}
            value={`${num(team.goal_diff) > 0 ? "+" : ""}${num(team.goal_diff)}`}
            sub={season}
          />
        </div>
      </div>

      {/* alt üçlü grid */}
      <div className="grid gap-3 xl:grid-cols-12">
        {/* sol */}
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
                {last5.map((m) => {
                  const r = resultFor(m);
                  const isHome = m.home_team_id === teamId;
                  const opp = isHome ? m.away_team_name : m.home_team_name;
                  return (
                    <div
                      key={m.match_id}
                      className="min-w-0 rounded-xl border border-line bg-field px-2 py-2"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold ${resultBadgeClass(r)}`}
                        >
                          {resultLetter(r)}
                        </span>
                        <span className="truncate text-[9px] text-ink-3">
                          {shortDate(m.match_datetime)}
                        </span>
                      </div>
                      <div
                        className="mt-2 truncate text-[11px] font-medium text-ink"
                        title={opp ?? undefined}
                      >
                        {opp ?? "—"}
                      </div>
                      <div className="mt-1 text-[11px] text-ink-2">
                        {m.home_score ?? "-"}:{m.away_score ?? "-"}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <span className="text-[10px] text-ink-3">
                          {isHome ? t("tff1.homeShort") : t("tff1.awayShort")}
                        </span>
                        <span className="rounded bg-accent-soft px-1 py-0.5 text-[9px] font-semibold text-accent-ink">
                          {r === "W" ? 3 : r === "D" ? 1 : 0}P
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-card p-4">
            <SectionHeading icon={<Crosshair size={13} />}>
              {t("playerDetail.attributeOverviewLabel")}
              {attrTeam.season_label !== season ? (
                <span className="ml-1 normal-case tracking-normal text-ink-3">
                  ({attrTeam.season_label})
                </span>
              ) : null}
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

        {/* orta */}
        <div className="space-y-3 xl:col-span-4">
          <div className="rounded-2xl border border-line bg-card p-4">
            <SectionHeading icon={<TrendingUp size={13} />}>
              {t("playerDetail.seasonSummaryLabel")}
              <span className="ml-1 normal-case tracking-normal text-ink-3">
                ({season})
              </span>
            </SectionHeading>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-field px-4 py-3 sm:grid-cols-4">
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("common.competition")}
                </div>
                <div className="mt-1 truncate text-sm font-medium text-ink">
                  Trendyol 1. Lig
                </div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("common.season")}
                </div>
                <div className="mt-1 text-sm font-medium text-ink">{season}</div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("teamDetail.statWinRate")}
                </div>
                <div className="mt-1 text-sm font-medium text-ink">
                  {team.win_pct === null ? "—" : `${Number(team.win_pct).toFixed(1)}%`}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("teamDetail.statPointsPerGame")}
                </div>
                <div className="mt-1 text-sm font-medium text-ink">
                  {played > 0 ? (num(team.points) / played).toFixed(2) : "—"}
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
                value={perPlayed(team.goals_for, 2)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Target size={11} />}
                label={t("teamDetail.statGoalsAgainst")}
                value={perPlayed(team.goals_against, 2)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Crosshair size={11} />}
                label={t("tff1.colShots")}
                value={perPlayed(team.shots, 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Target size={11} />}
                label={t("tff1.colShotsOnTarget")}
                value={perPlayed(team.shots_on_target, 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Zap size={11} />}
                label={t("tff1.colKeyPasses")}
                value={perPlayed(team.key_passes, 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Gauge size={11} />}
                label={t("tff1.colPassAccuracy")}
                value={team.pass_accuracy === null ? "—" : `${Number(team.pass_accuracy).toFixed(0)}%`}
              />
              <AvgStat
                icon={<Shield size={11} />}
                label={t("tff1.colTackles")}
                value={perPlayed(team.tackles, 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Star size={11} />}
                label={t("tff1.colRating")}
                value={team.rating_avg === null ? "—" : Number(team.rating_avg).toFixed(2)}
              />
            </div>
          </div>
        </div>

        {/* sağ */}
        <div className="space-y-3 xl:col-span-4">
          <div className="rounded-2xl border border-line bg-card p-4">
            <SectionHeading icon={<CalendarDays size={13} />}>
              {t("playerDetail.recentMatchesLabel")}
            </SectionHeading>

            {leagueMatches.length === 0 ? (
              <div className="mt-3 text-sm text-ink-2">
                {t("playerDetail.noRecentMatchData")}
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="text-left text-[9px] uppercase tracking-[0.12em] text-ink-3">
                      <th className="px-2 py-1.5 font-medium">{t("tff1.colDate")}</th>
                      <th className="px-2 py-1.5 font-medium">{t("tff1.colOpponent")}</th>
                      <th className="px-2 py-1.5 font-medium">{t("tff1.colScore")}</th>
                      <th className="px-2 py-1.5 font-medium">{t("tff1.colHomeAway")}</th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("tff1.colPoints")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leagueMatches.slice(0, 6).map((m) => {
                      const r = resultFor(m);
                      const isHome = m.home_team_id === teamId;
                      const opp = isHome ? m.away_team_name : m.home_team_name;
                      return (
                        <tr
                          key={m.match_id}
                          className="border-t border-line text-[12px] text-ink transition hover:bg-veil"
                        >
                          <td className="whitespace-nowrap px-2 py-2 text-ink-2">
                            <Link
                              href={`/dashboard/tff-1-lig/match/${m.match_id}`}
                              className="transition hover:text-ink hover:underline"
                            >
                              {formatMatchDate(m.match_datetime, locale)}
                            </Link>
                          </td>
                          <td className="max-w-[150px] px-2 py-2">
                            <span className="truncate font-medium" title={opp ?? undefined}>
                              {opp ?? "—"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            <span className="inline-flex items-center gap-1.5">
                              <span>
                                {m.home_score ?? "-"}:{m.away_score ?? "-"}
                              </span>
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold ${resultBadgeClass(r)}`}
                              >
                                {resultLetter(r)}
                              </span>
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-ink-2">
                            {isHome ? t("tff1.homeShort") : t("tff1.awayShort")}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-accent-ink">
                            {r === "W" ? 3 : r === "D" ? 1 : r === "L" ? 0 : "—"}
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
              {t("teamDetail.seasonHistoryTitle")}
            </SectionHeading>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-[0.12em] text-ink-3">
                    <th className="px-2 py-1.5 font-medium">{t("tff1.seasonLabel")}</th>
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
                      {t("tff1.colPoints")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {teamSeasons.map((row) => {
                    const isCurrent = row.season_label === season;
                    return (
                      <tr
                        key={row.season_label}
                        className={`border-t border-line text-[12px] transition hover:bg-veil ${
                          isCurrent ? "text-ink" : "text-ink-2"
                        }`}
                      >
                        <td className="whitespace-nowrap px-2 py-2 font-medium">
                          <Link
                            href={`/dashboard/tff-1-lig/team/${teamId}?season=${encodeURIComponent(row.season_label)}`}
                            className="transition hover:text-ink hover:underline"
                          >
                            {row.season_label}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          {num(row.played)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          {num(row.wins)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          {num(row.draws)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          {num(row.losses)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          {num(row.goals_for)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          {num(row.goals_against)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-accent-ink">
                          {num(row.points)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
