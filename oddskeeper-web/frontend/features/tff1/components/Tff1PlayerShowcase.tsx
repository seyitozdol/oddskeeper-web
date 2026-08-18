import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  Clock,
  Crosshair,
  Euro,
  Gauge,
  Goal,
  MapPin,
  Percent,
  Ruler,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import {
  formatMarketValue,
  formatMatchDate,
  playerAge,
  positionLabel,
  ROLE_CHIP_CLASS,
  ROLE_LABEL_KEYS,
  squadRole,
} from "../lib";
import type {
  Tff1MarketValue,
  Tff1MatchLogRow,
  Tff1PlayerInfo,
  Tff1PlayerRow,
  Tff1TeamRow,
} from "../types";
import type { Translator } from "@/lib/i18n/messages";
import { categoryLabel } from "@/lib/i18n/metricLabel";
import { canonicalNationality, getCountryFlagUrl } from "@/lib/country-flags";

/* ── yardımcılar ────────────────────────────────────────────── */

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
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

// Maç sonucu: oyuncunun takımı perspektifinden G/B/M
function matchResult(m: Tff1MatchLogRow): "W" | "D" | "L" | null {
  const gf = m.is_home ? m.home_score : m.away_score;
  const ga = m.is_home ? m.away_score : m.home_score;
  if (gf === null || ga === null) return null;
  return gf > ga ? "W" : gf < ga ? "L" : "D";
}

function resultBadgeClass(res: "W" | "D" | "L" | null) {
  if (res === "W") return "bg-pos/15 text-pos";
  if (res === "L") return "bg-neg/15 text-neg";
  return "bg-veil text-ink-2";
}

function resultLetter(t: Translator, res: "W" | "D" | "L" | null) {
  if (res === "W") return t("tff1.resultWin");
  if (res === "L") return t("tff1.resultLoss");
  if (res === "D") return t("tff1.resultDraw");
  return "—";
}

/* ── lig yüzdelikleri (radar + güçlü yönler) ────────────────── */

type MetricSpec = {
  key: keyof Tff1PlayerRow;
  labelKey: string;
  // per90: dakikaya oranla ölçekle; direct: değeri olduğu gibi kıyasla
  basis: "per90" | "direct";
};

const CATEGORY_METRICS: Record<string, MetricSpec[]> = {
  attacking: [
    { key: "goals", labelKey: "tff1.colGoals", basis: "per90" },
    { key: "xg", labelKey: "tff1.colXg", basis: "per90" },
    { key: "xgot", labelKey: "tff1.colXgot", basis: "per90" },
    { key: "shots", labelKey: "tff1.colShots", basis: "per90" },
    { key: "shots_on_target", labelKey: "tff1.colShotsOnTarget", basis: "per90" },
  ],
  creation: [
    { key: "assists", labelKey: "tff1.colAssists", basis: "per90" },
    { key: "xa", labelKey: "tff1.colXa", basis: "per90" },
    { key: "key_passes", labelKey: "tff1.colKeyPasses", basis: "per90" },
    { key: "big_chances_created", labelKey: "tff1.colBigChancesCreated", basis: "per90" },
    { key: "crosses", labelKey: "tff1.colCrosses", basis: "per90" },
  ],
  passing: [
    { key: "total_passes", labelKey: "tff1.colPasses", basis: "per90" },
    { key: "accurate_passes", labelKey: "tff1.colAccuratePasses", basis: "per90" },
    { key: "pass_accuracy", labelKey: "tff1.colPassAccuracy", basis: "direct" },
    { key: "long_balls", labelKey: "tff1.colLongBalls", basis: "per90" },
  ],
  duels: [
    { key: "duels_won", labelKey: "tff1.colDuelsWon", basis: "per90" },
    { key: "aerials_won", labelKey: "tff1.colAerialsWon", basis: "per90" },
    { key: "dribbles_won", labelKey: "tff1.colDribblesWon", basis: "per90" },
  ],
  defending: [
    { key: "tackles", labelKey: "tff1.colTackles", basis: "per90" },
    { key: "interceptions", labelKey: "tff1.colInterceptions", basis: "per90" },
    { key: "clearances", labelKey: "tff1.colClearances", basis: "per90" },
    { key: "ball_recoveries", labelKey: "tff1.colBallRecoveries", basis: "per90" },
  ],
  physical: [
    { key: "km_covered", labelKey: "tff1.colKmCovered", basis: "per90" },
    { key: "sprints", labelKey: "tff1.colSprints", basis: "per90" },
    { key: "top_speed", labelKey: "tff1.colTopSpeed", basis: "direct" },
  ],
  goalkeeping: [
    { key: "saves", labelKey: "tff1.colSaves", basis: "per90" },
    { key: "penalties_saved", labelKey: "tff1.colPenaltiesSaved", basis: "direct" },
  ],
};

function metricBasisValue(row: Tff1PlayerRow, spec: MetricSpec): number | null {
  const raw = num(row[spec.key] as number | string | null);
  if (raw === null) return null;
  if (spec.basis === "direct") return raw;
  const minutes = num(row.minutes);
  if (!minutes || minutes <= 0) return null;
  return (raw / minutes) * 90;
}

// Kalifiye lig havuzunda 0-100 yüzdelik (değeri altında kalanların oranı).
function percentileIn(pool: number[], value: number): number {
  if (pool.length <= 1) return 50;
  const below = pool.filter((v) => v < value).length;
  return (below / (pool.length - 1)) * 100;
}

type AxisScore = { key: string; label: string; value: number };
type StrengthChip = { label: string; percentile: number };

function computeLeagueProfile(
  t: Translator,
  player: Tff1PlayerRow,
  leagueRows: Tff1PlayerRow[]
): { axes: AxisScore[]; strengths: StrengthChip[] } {
  const maxMinutes = Math.max(...leagueRows.map((r) => num(r.minutes) ?? 0), 1);
  const qualified = leagueRows.filter(
    (r) => (num(r.minutes) ?? 0) >= maxMinutes * 0.3
  );

  const isKeeper = player.position_code === "G";
  const categoryOrder = isKeeper
    ? ["goalkeeping", "passing", "defending", "duels", "physical"]
    : ["attacking", "creation", "passing", "duels", "defending", "physical"];

  const axes: AxisScore[] = [];
  const metricScores: StrengthChip[] = [];

  for (const cat of categoryOrder) {
    const specs = CATEGORY_METRICS[cat] ?? [];
    const scores: number[] = [];

    for (const spec of specs) {
      const own = metricBasisValue(player, spec);
      if (own === null) continue;
      const pool = qualified
        .map((r) => metricBasisValue(r, spec))
        .filter((v): v is number => v !== null);
      if (pool.length < 10) continue;
      const pct = percentileIn(pool, own);
      scores.push(pct);
      metricScores.push({ label: t(spec.labelKey), percentile: pct });
    }

    if (scores.length > 0) {
      axes.push({
        key: cat,
        label: categoryLabel(t, cat),
        value: scores.reduce((a, b) => a + b, 0) / scores.length,
      });
    }
  }

  const strengths = metricScores
    .sort((a, b) => b.percentile - a.percentile)
    .slice(0, 2);

  return { axes, strengths };
}

/* ── görsel yapı taşları (showcase diliyle aynı) ────────────── */

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
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="bg-card px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
        <span className="text-accent-ink/80">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 truncate text-lg font-semibold leading-6 text-ink">
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

function radarPoint(index: number, count: number, frac: number, radius: number) {
  const angle = ((-90 + index * (360 / count)) * Math.PI) / 180;
  return {
    x: 110 + radius * frac * Math.cos(angle),
    y: 110 + radius * frac * Math.sin(angle),
  };
}

function RadarChart({ axes }: { axes: AxisScore[] }) {
  const count = axes.length;
  const radius = 76;
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox="0 0 220 220" className="mx-auto w-full max-w-[260px]">
      {rings.map((frac, i) => (
        <polygon
          key={i}
          points={axes
            .map((_, j) => {
              const p = radarPoint(j, count, frac, radius);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(" ")}
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
        points={axes
          .map((axis, i) => {
            const p = radarPoint(i, count, Math.max(axis.value, 4) / 100, radius);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          })
          .join(" ")}
        fill="var(--accent)"
        fillOpacity={0.16}
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {axes.map((axis, i) => {
        const p = radarPoint(i, count, Math.max(axis.value, 4) / 100, radius);
        return <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--accent)" />;
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

/* ── reyting grafiği ────────────────────────────────────────── */

function RatingChart({
  rows,
  t,
  locale,
}: {
  rows: Tff1MatchLogRow[];
  t: Translator;
  locale: string;
}) {
  void locale;
  const width = 560;
  const height = 190;
  const padL = 34;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const ratings = rows.map((r) => num(r.rating) ?? 0);
  const yMax = 10;

  const x = (i: number) =>
    rows.length <= 1 ? padL + plotW / 2 : padL + (i / (rows.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - (Math.min(v, yMax) / yMax) * plotH;

  const linePath = rows
    .map(
      (row, i) =>
        `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(ratings[i]).toFixed(1)}`
    )
    .join(" ");

  const areaPath =
    rows.length > 1
      ? `${linePath} L${x(rows.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`
      : "";

  const ticks = [0, 2.5, 5, 7.5, 10];

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
              key={row.match_id}
              cx={x(i)}
              cy={y(ratings[i])}
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
              key={`label-${row.match_id}`}
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
        <span className="ml-auto">
          {t("playerDetail.performanceChartNoteRating")}
        </span>
      </div>
    </div>
  );
}

/* ── ana bileşen ────────────────────────────────────────────── */

// Ekranın lig-bağımlı ("chrome") parçaları. Verilmezse Trendyol 1. Lig
// varsayılanları kullanılır (mevcut tff1 davranışı birebir korunur); Avrupa
// kupası gibi başka kaynaklar bunları geçerek aynı bileşeni yeniden kullanır.
export type PlayerShowcaseChrome = {
  backHref: string;
  backLabel: string;
  competitionLabel: string;
  teamHref: string | null; // null -> takım adı düz metin (kupa takım profili henüz yok)
  matchHref: (m: Tff1MatchLogRow) => string | null;
  showMarketValue: boolean;
};

export type Tff1PlayerShowcaseProps = {
  latest: Tff1PlayerRow;
  seasonRows: Tff1PlayerRow[];
  leagueRows: Tff1PlayerRow[];
  // Radar/güçlü yönler için kaynak sezon: sezon başında (5 maç altı) örneklem
  // gürültülü olduğundan sayfa yeterli maçı olan son sezonu geçirir.
  radarRow?: Tff1PlayerRow;
  radarLeagueRows?: Tff1PlayerRow[];
  info: Tff1PlayerInfo | null;
  marketValue: Tff1MarketValue | null;
  teamRow: Tff1TeamRow | null;
  logoByTeam: Record<string, string>;
  matchLog: Tff1MatchLogRow[];
  t: Translator;
  locale: string;
  chrome?: PlayerShowcaseChrome;
};

export function Tff1PlayerShowcase({
  latest,
  seasonRows,
  leagueRows,
  radarRow,
  radarLeagueRows,
  info,
  marketValue,
  teamRow,
  logoByTeam,
  matchLog,
  t,
  locale,
  chrome,
}: Tff1PlayerShowcaseProps) {
  const isKeeper = latest.position_code === "G";
  const apps = num(latest.appearances) ?? 0;
  const minutes = num(latest.minutes) ?? 0;
  const starts = num(latest.starts) ?? 0;
  const avgMinutes = apps > 0 ? minutes / apps : 0;
  const role = squadRole(latest, num(teamRow?.played) ?? 38);
  const age = playerAge(info?.birth_date);
  const teamLogo = latest.team_id ? logoByTeam[latest.team_id] ?? null : null;
  const teamName =
    latest.teams && latest.teams !== latest.team_name
      ? latest.teams
      : latest.team_name;
  const defaultTeamHref = latest.team_id
    ? `/dashboard/tff-1-lig/team/${latest.team_id}?season=${encodeURIComponent(latest.season_label)}`
    : null;
  // Lig-bağımlı parçalar: chrome verilmezse mevcut tff1 davranışı.
  const ui = {
    backHref:
      chrome?.backHref ??
      "/dashboard/stats-analysis/tff1/resmi?season=2026%2F2027&section=league",
    backLabel: chrome?.backLabel ?? t("tff1.backToLeague"),
    competitionLabel: chrome?.competitionLabel ?? "Trendyol 1. Lig",
    teamHref: chrome ? chrome.teamHref : defaultTeamHref,
    matchHref:
      chrome?.matchHref ??
      ((m: Tff1MatchLogRow) =>
        m.competition.startsWith("Trendyol 1. Lig")
          ? `/dashboard/tff-1-lig/match/${m.match_id}`
          : null),
    showMarketValue: chrome?.showMarketValue ?? true,
  };
  const teamHref = ui.teamHref;

  const flagUrl = info?.country ? getCountryFlagUrl(info.country) : null;

  // Oynanan maçlar (dakika > 0), en yeniden eskiye sıralı gelir
  const playedLog = matchLog.filter((m) => (num(m.minutes) ?? 0) > 0);
  const recentRows = playedLog.slice(0, 5);
  const chartRows = [...playedLog.slice(0, 10)].reverse();
  const tableRows = playedLog.slice(0, 6);

  const attributeRow = radarRow ?? latest;
  const { axes, strengths } = computeLeagueProfile(
    t,
    attributeRow,
    radarLeagueRows ?? leagueRows
  );

  const seasonSum = (pick: (m: Tff1MatchLogRow) => number) =>
    playedLog
      .filter((m) => m.season_label === latest.season_label)
      .reduce((sum, m) => sum + pick(m), 0);
  const seasonPasses = seasonSum((m) => num(m.total_passes) ?? 0);
  const seasonAccPasses = seasonSum((m) => num(m.accurate_passes) ?? 0);
  const passAccuracyPct =
    num(latest.pass_accuracy) ??
    (seasonPasses > 0 ? (seasonAccPasses / seasonPasses) * 100 : null);

  return (
    <section className="w-full space-y-3">
      {/* üst çubuk */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={ui.backHref}
          className="rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink-2 transition hover:text-ink"
        >
          ← {ui.backLabel}
        </Link>
        <span className="rounded-full border border-line-strong bg-accent-soft px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-accent-ink">
          {ui.competitionLabel}
        </span>
      </div>

      {/* hero + özet paneli */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_480px]">
          {/* sol: hero */}
          <div className="relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="relative h-[168px] w-[168px] shrink-0 overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-card-2 to-canvas">
                {info?.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={info.photo_url}
                    alt={latest.player_name ?? ""}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-ink-3">
                    {(latest.player_name ?? "?").slice(0, 1)}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent-ink">
                  {t("playerDetail.profileKicker")}
                </p>

                <h1 className="mt-1.5 truncate text-3xl font-bold tracking-tight text-ink sm:text-4xl xl:text-[42px] xl:leading-[1.1]">
                  {latest.player_name}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-ink-2">
                  <span className="inline-flex items-center gap-1.5">
                    {teamLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={teamLogo}
                        alt=""
                        style={{ width: 27, height: 27 }}
                        className="shrink-0 object-contain"
                      />
                    ) : null}
                    {teamHref ? (
                      <Link
                        href={teamHref}
                        className="font-medium text-ink transition hover:underline"
                      >
                        {teamName}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{teamName}</span>
                    )}
                  </span>
                  <span className="text-ink-3">•</span>
                  <span>{positionLabel(latest, locale)}</span>
                  <span className="text-ink-3">•</span>
                  <span>{ui.competitionLabel}</span>
                  <span className="text-ink-3">•</span>
                  <span>{latest.season_label}</span>
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[11px] ${ROLE_CHIP_CLASS[role]}`}
                  >
                    {t(ROLE_LABEL_KEYS[role])}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-ink-3">
                  {info?.country ? (
                    <span className="inline-flex items-center gap-1.5">
                      {flagUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={flagUrl}
                          alt={info.country}
                          className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
                        />
                      ) : null}
                      <span>{canonicalNationality(info.country)}</span>
                    </span>
                  ) : null}
                  {info?.height_cm ? (
                    <>
                      <span>•</span>
                      <span>
                        {t("playerDetail.heightCm", { value: info.height_cm })}
                      </span>
                    </>
                  ) : null}
                  {info?.birth_date ? (
                    <>
                      <span>•</span>
                      <span>
                        {info.birth_date}
                        {age !== null
                          ? ` (${t("playerDetail.ageValue", { age })})`
                          : ""}
                      </span>
                    </>
                  ) : null}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  {ui.showMarketValue ? (
                    <div>
                      <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                        {t("common.marketValue")}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-pos">
                        {formatMarketValue(marketValue?.market_value_eur)}
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("playerDetail.positionLabel")}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-ink">
                      {positionLabel(latest, locale)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("tff1.drawerAge")}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-ink">
                      {age !== null ? age : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
                      {t("tff1.drawerHeight")}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-ink">
                      {info?.height_cm ? `${info.height_cm} cm` : "—"}
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
                value={t(ROLE_LABEL_KEYS[role])}
              />
              <SnapshotRow
                icon={<MapPin size={14} />}
                label={t("playerDetail.nationalityLabel")}
                value={
                  info?.country ? (
                    <span className="inline-flex items-center gap-1.5">
                      {flagUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={flagUrl}
                          alt={info.country}
                          className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
                        />
                      ) : null}
                      {canonicalNationality(info.country)}
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
                  strengths.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {strengths.map((chip) => (
                        <span
                          key={chip.label}
                          className="rounded-md border border-line-strong bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-ink"
                          title={`${Math.round(chip.percentile)}/100`}
                        >
                          {chip.label}
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
                  info?.birth_date
                    ? `${info.birth_date}${
                        age !== null
                          ? ` (${t("playerDetail.ageValue", { age })})`
                          : ""
                      }`
                    : "—"
                }
              />
              <SnapshotRow
                icon={<Ruler size={14} />}
                label={t("tff1.drawerHeight")}
                value={info?.height_cm ? `${info.height_cm} cm` : "—"}
              />
              {ui.showMarketValue ? (
                <SnapshotRow
                  icon={<Euro size={14} />}
                  label={t("common.marketValue")}
                  value={
                    marketValue?.market_value_eur ? (
                      <span className="text-pos">
                        {formatMarketValue(marketValue.market_value_eur)}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
              ) : null}
              <SnapshotRow
                icon={<Clock size={14} />}
                label={t("playerDetail.lastMatchLabel")}
                value={
                  playedLog[0]
                    ? formatMatchDate(playedLog[0].match_datetime, locale)
                    : "—"
                }
              />
              <SnapshotRow
                icon={<ShieldCheck size={14} />}
                label={t("common.team")}
                value={
                  teamHref ? (
                    <Link
                      href={teamHref}
                      className="transition hover:underline"
                    >
                      {teamName}
                    </Link>
                  ) : (
                    teamName ?? "—"
                  )
                }
              />
            </div>
          </div>
        </div>

        {/* istatistik şeridi */}
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4 xl:grid-cols-8">
          <StripStat
            icon={<CalendarDays size={11} />}
            label={t("tff1.colAppearances")}
            value={apps}
            sub={latest.season_label}
          />
          <StripStat
            icon={<ShieldCheck size={11} />}
            label={t("tff1.colStarts")}
            value={starts}
            sub={latest.season_label}
          />
          <StripStat
            icon={<Clock size={11} />}
            label={t("tff1.colMinutes")}
            value={minutes}
            sub={latest.season_label}
          />
          <StripStat
            icon={<Gauge size={11} />}
            label={t("playerDetail.avgMinutesLabel")}
            value={fmt(avgMinutes, 1)}
            sub={latest.season_label}
          />
          <StripStat
            icon={isKeeper ? <ShieldCheck size={11} /> : <Goal size={11} />}
            label={isKeeper ? t("tff1.colSaves") : t("tff1.colGoals")}
            value={isKeeper ? fmt(latest.saves) : fmt(latest.goals)}
            sub={latest.season_label}
          />
          <StripStat
            icon={<Zap size={11} />}
            label={t("tff1.colAssists")}
            value={fmt(latest.assists)}
            sub={latest.season_label}
          />
          <StripStat
            icon={<TrendingUp size={11} />}
            label={t("tff1.colXg")}
            value={latest.xg === null ? "—" : fmt(latest.xg, 2)}
            sub={latest.season_label}
          />
          <StripStat
            icon={<Star size={11} />}
            label={t("tff1.colRating")}
            value={
              latest.rating_avg === null ? (
                "—"
              ) : (
                <span className="text-accent-ink">
                  {fmt(latest.rating_avg, 2)}
                </span>
              )
            }
            sub={latest.season_label}
          />
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
                {recentRows.map((m) => {
                  const res = matchResult(m);
                  return (
                    <div
                      key={`${m.match_id}-${m.team_id}`}
                      className="min-w-0 rounded-xl border border-line bg-field px-2 py-2"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold ${resultBadgeClass(res)}`}
                        >
                          {resultLetter(t, res)}
                        </span>
                        <span className="truncate text-[9px] text-ink-3">
                          {shortDate(m.match_datetime)}
                        </span>
                      </div>
                      <div
                        className="mt-2 truncate text-[11px] font-medium text-ink"
                        title={m.opponent_name ?? undefined}
                      >
                        {m.opponent_name ?? "—"}
                      </div>
                      <div className="mt-1 text-[11px] text-ink-2">
                        {m.home_score ?? "-"}:{m.away_score ?? "-"}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <span className="text-[10px] text-ink-3">
                          {fmt(m.minutes)}&#39;
                        </span>
                        <span
                          className="rounded bg-accent-soft px-1 py-0.5 text-[9px] font-semibold text-accent-ink"
                          title={t("tff1.colRating")}
                        >
                          {m.rating === null ? "—" : fmt(m.rating, 1)}
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
              {attributeRow.season_label !== latest.season_label ? (
                <span className="ml-1 normal-case tracking-normal text-ink-3">
                  ({attributeRow.season_label})
                </span>
              ) : null}
            </SectionHeading>

            {axes.length >= 3 ? (
              <>
                <div className="mt-3 flex items-center gap-4">
                  <div className="w-[54%] min-w-0 shrink-0">
                    <RadarChart axes={axes} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    {axes.map((axis) => (
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
              <span className="ml-1 normal-case tracking-normal text-ink-3">
                ({latest.season_label})
              </span>
            </SectionHeading>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-field px-4 py-3 sm:grid-cols-4">
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("common.team")}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink">
                  {teamLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={teamLogo}
                      alt=""
                      style={{ width: 16, height: 16 }}
                      className="shrink-0 object-contain"
                    />
                  ) : null}
                  <span className="truncate">{teamName}</span>
                </div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("common.competition")}
                </div>
                <div className="mt-1 truncate text-sm font-medium text-ink">
                  {ui.competitionLabel}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("playerDetail.positionLabel")}
                </div>
                <div className="mt-1 truncate text-sm font-medium text-ink">
                  {positionLabel(latest, locale)}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("playerDetail.avgMinutesLabel")}
                </div>
                <div className="mt-1 text-sm font-medium text-ink">
                  {fmt(avgMinutes, 1)}
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
                  <RatingChart rows={chartRows} t={t} locale={locale} />
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-1 border-t border-line pt-4 sm:grid-cols-4">
              <AvgStat
                icon={<Clock size={11} />}
                label={t("tff1.colMinutes")}
                value={fmt(avgMinutes, 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={isKeeper ? <ShieldCheck size={11} /> : <Goal size={11} />}
                label={isKeeper ? t("tff1.colSaves") : t("tff1.colGoals")}
                value={fmt(
                  (num(isKeeper ? latest.saves : latest.goals) ?? 0) /
                    Math.max(apps, 1),
                  2
                )}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Zap size={11} />}
                label={t("tff1.colAssists")}
                value={fmt((num(latest.assists) ?? 0) / Math.max(apps, 1), 2)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Crosshair size={11} />}
                label={t("tff1.colShots")}
                value={fmt((num(latest.shots) ?? 0) / Math.max(apps, 1), 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Target size={11} />}
                label={t("tff1.colShotsOnTarget")}
                value={fmt(
                  (num(latest.shots_on_target) ?? 0) / Math.max(apps, 1),
                  1
                )}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Percent size={11} />}
                label={t("tff1.colPassAccuracy")}
                value={
                  passAccuracyPct !== null
                    ? `${fmt(passAccuracyPct, 0)}%`
                    : "—"
                }
              />
              <AvgStat
                icon={<ShieldCheck size={11} />}
                label={t("tff1.colTackles")}
                value={fmt((num(latest.tackles) ?? 0) / Math.max(apps, 1), 1)}
                sub={t("playerDetail.perMatchSuffix")}
              />
              <AvgStat
                icon={<Star size={11} />}
                label={t("tff1.colRating")}
                value={
                  latest.rating_avg === null ? "—" : fmt(latest.rating_avg, 2)
                }
              />
            </div>
          </div>
        </div>

        {/* sağ sütun */}
        <div className="space-y-3 xl:col-span-4">
          <div className="rounded-2xl border border-line bg-card p-4">
            <SectionHeading icon={<CalendarDays size={13} />}>
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
                      <th className="px-2 py-1.5 font-medium">
                        {t("tff1.colDate")}
                      </th>
                      <th className="px-2 py-1.5 font-medium">
                        {t("tff1.colOpponent")}
                      </th>
                      <th className="px-2 py-1.5 font-medium">
                        {t("tff1.colScore")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("tff1.colMinutes")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {isKeeper ? t("tff1.colSaves") : t("playerDetail.goalsAbbr")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("playerDetail.assistsAbbr")}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t("tff1.colRating")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((m) => {
                      const res = matchResult(m);
                      const opponentLogo = m.opponent_id
                        ? logoByTeam[m.opponent_id] ?? null
                        : null;
                      const mHref = ui.matchHref(m);
                      const opponentCell = (
                        <span className="flex items-center gap-1.5">
                          {opponentLogo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={opponentLogo}
                              alt=""
                              style={{ width: 16, height: 16 }}
                              className="shrink-0 object-contain"
                            />
                          ) : null}
                          <span
                            className="truncate font-medium"
                            title={m.opponent_name ?? undefined}
                          >
                            {m.opponent_name ?? "—"}
                          </span>
                        </span>
                      );
                      return (
                        <tr
                          key={`${m.match_id}-${m.team_id}`}
                          className="border-t border-line text-[12px] text-ink transition hover:bg-veil"
                        >
                          <td className="whitespace-nowrap px-2 py-2 text-ink-2">
                            {mHref ? (
                              <Link
                                href={mHref}
                                className="transition hover:text-ink hover:underline"
                              >
                                {formatMatchDate(m.match_datetime, locale)}
                              </Link>
                            ) : (
                              formatMatchDate(m.match_datetime, locale)
                            )}
                          </td>
                          <td className="max-w-[140px] px-2 py-2">
                            {opponentCell}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            <span className="inline-flex items-center gap-1.5">
                              <span>
                                {m.home_score ?? "-"}:{m.away_score ?? "-"}
                              </span>
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold ${resultBadgeClass(res)}`}
                              >
                                {resultLetter(t, res)}
                              </span>
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {fmt(m.minutes)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {isKeeper ? fmt(m.saves) : fmt(m.goals)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {fmt(m.assists)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-accent-ink">
                            {m.rating === null ? "—" : fmt(m.rating, 2)}
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

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-[0.12em] text-ink-3">
                    <th className="px-2 py-1.5 font-medium">
                      {t("tff1.seasonLabel")}
                    </th>
                    <th className="px-2 py-1.5 font-medium">
                      {t("tff1.colTeam")}
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      {t("tff1.colAppearances")}
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      {t("tff1.colMinutes")}
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      {isKeeper ? t("tff1.colSaves") : t("playerDetail.goalsAbbr")}
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      {t("playerDetail.assistsAbbr")}
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      {t("tff1.colXg")}
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      {t("tff1.colRating")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {seasonRows.map((row) => {
                    const rowTeamName =
                      row.teams && row.teams !== row.team_name
                        ? row.teams
                        : row.team_name;
                    const rowLogo = row.team_id
                      ? logoByTeam[row.team_id] ?? null
                      : null;
                    const isCurrent = row.season_label === latest.season_label;
                    return (
                      <tr
                        key={row.season_label}
                        className={`border-t border-line text-[12px] transition hover:bg-veil ${
                          isCurrent ? "text-ink" : "text-ink-2"
                        }`}
                      >
                        <td className="whitespace-nowrap px-2 py-2 font-medium">
                          {row.season_label}
                        </td>
                        <td className="max-w-[120px] px-2 py-2">
                          <span className="flex items-center gap-1.5">
                            {rowLogo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={rowLogo}
                                alt=""
                                style={{ width: 16, height: 16 }}
                                className="shrink-0 object-contain"
                              />
                            ) : null}
                            <span className="truncate" title={rowTeamName ?? ""}>
                              {rowTeamName}
                            </span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          {fmt(row.appearances)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          {fmt(row.minutes)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-ink">
                          {isKeeper ? fmt(row.saves) : fmt(row.goals)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          {fmt(row.assists)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          {row.xg === null ? "—" : fmt(row.xg, 2)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-accent-ink">
                          {row.rating_avg === null ? "—" : fmt(row.rating_avg, 2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-[10px] text-ink-3">
              {t("playerDetail.allStatsSeasonNote", {
                season: latest.season_label,
              })}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
