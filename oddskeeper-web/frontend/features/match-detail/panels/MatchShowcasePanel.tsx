import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  Crosshair,
  Goal,
  MapPin,
  Shield,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { MATCH_TAB_LABEL_KEYS, VALID_MATCH_TABS } from "../constants";
import type {
  MatchIncidentRow,
  MatchParticipantRow,
  MatchProfileRow,
  MatchTeamStatsRow,
} from "../types";
import {
  ShowcaseVsBars,
  type ShowcaseVsRow,
} from "@/components/showcase/ShowcaseCharts";
import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/messages";
import { getTeamDetailHref } from "@/lib/routes";
import { getTeamAliases } from "@/features/player-detail/server/getTeamAliases";
import { resolveShortTeamName } from "@/lib/team-alias";

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
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
  home,
  away,
  digits = 0,
}: {
  icon: ReactNode;
  label: string;
  home: number | null;
  away: number | null;
  digits?: number;
}) {
  const f = (v: number | null) =>
    v === null ? "—" : digits > 0 ? v.toFixed(digits) : String(Math.round(v));
  const homeLeads = (home ?? 0) > (away ?? 0);
  const awayLeads = (away ?? 0) > (home ?? 0);
  return (
    <div className="bg-card px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-ink-3">
        <span className="text-accent-ink/80">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5 text-lg font-semibold leading-6">
        <span className={homeLeads ? "text-accent-ink" : "text-ink"}>{f(home)}</span>
        <span className="text-[12px] text-ink-3">:</span>
        <span className={awayLeads ? "text-accent-ink" : "text-ink"}>{f(away)}</span>
      </div>
    </div>
  );
}

// Katkı listesi: oynayan oyunculardan gol/asist/kart/isabetli şutu olanlar,
// yoksa dakikaya göre ilk 5.
function contributors(rows: MatchParticipantRow[]): MatchParticipantRow[] {
  const played = rows.filter((r) => (r.minutes_played ?? 0) > 0);
  const withOutput = played.filter(
    (r) =>
      (r.goals ?? 0) > 0 ||
      (r.assists ?? 0) > 0 ||
      (r.cards_yellow ?? 0) > 0 ||
      (r.cards_red ?? 0) > 0 ||
      (r.shots_on_target ?? 0) > 0
  );
  const base = withOutput.length > 0 ? withOutput : played;
  return [...base]
    .sort(
      (a, b) =>
        (b.goals ?? 0) - (a.goals ?? 0) ||
        (b.assists ?? 0) - (a.assists ?? 0) ||
        (b.minutes_played ?? 0) - (a.minutes_played ?? 0)
    )
    .slice(0, 7);
}

function ContributorTable({
  title,
  rows,
  t,
}: {
  title: string;
  rows: MatchParticipantRow[];
  t: Translator;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold text-ink">{title}</div>
      {rows.length === 0 ? (
        <div className="text-[12px] text-ink-3">
          {t("matchDetail.noParticipantDataTeam")}
        </div>
      ) : (
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="text-left text-[9px] uppercase tracking-[0.12em] text-ink-3">
              <th className="px-2 py-1 font-medium">{t("tff1.colPlayer")}</th>
              <th className="px-2 py-1 text-right font-medium">{t("common.minutes")}</th>
              <th className="px-2 py-1 text-right font-medium">{t("playerDetail.goalsAbbr")}</th>
              <th className="px-2 py-1 text-right font-medium">{t("playerDetail.assistsAbbr")}</th>
              <th className="px-2 py-1 text-right font-medium">{t("tff1.colShotsOnTarget")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.player_source_id}
                className="border-t border-line text-[12px] text-ink transition hover:bg-veil"
              >
                <td className="max-w-[150px] px-2 py-1.5">
                  <span className="flex items-center gap-1">
                    {p.player_slug ? (
                      <Link
                        href={`/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(p.player_slug)}`}
                        className="truncate font-medium transition hover:text-accent-ink hover:underline"
                        title={p.player_name}
                      >
                        {p.player_name}
                      </Link>
                    ) : (
                      <span className="truncate font-medium">{p.player_name}</span>
                    )}
                    {(p.cards_red ?? 0) > 0 ? (
                      <span className="h-3 w-2 shrink-0 rounded-[2px] bg-neg" />
                    ) : (p.cards_yellow ?? 0) > 0 ? (
                      <span className="h-3 w-2 shrink-0 rounded-[2px] bg-amber-400" />
                    ) : null}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                  {p.minutes_played ?? "—"}
                </td>
                <td
                  className={`whitespace-nowrap px-2 py-1.5 text-right ${(p.goals ?? 0) > 0 ? "font-semibold text-accent-ink" : ""}`}
                >
                  {p.goals ?? 0}
                </td>
                <td
                  className={`whitespace-nowrap px-2 py-1.5 text-right ${(p.assists ?? 0) > 0 ? "font-semibold text-pos" : ""}`}
                >
                  {p.assists ?? 0}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                  {p.shots_on_target ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export type MatchShowcasePanelProps = {
  profile: MatchProfileRow;
  incidents: MatchIncidentRow[];
  teamStats: MatchTeamStatsRow[];
  participants: MatchParticipantRow[];
  backHref: string;
};

export async function MatchShowcasePanel({
  profile,
  incidents,
  teamStats,
  participants,
  backHref,
}: MatchShowcasePanelProps) {
  const t = await getT();
  const aliases = await getTeamAliases();

  const detailHrefBase = `/dashboard/stats-analysis/football/match-stats/detail?match=${encodeURIComponent(profile.source_match_id)}`;

  const homeName = resolveShortTeamName(
    aliases,
    profile.home_team_slug,
    profile.home_team_name
  );
  const awayName = resolveShortTeamName(
    aliases,
    profile.away_team_slug,
    profile.away_team_name
  );

  const homeStats =
    teamStats.find((r) => r.team_side === "home") ??
    teamStats.find((r) => r.team_slug === profile.home_team_slug) ??
    null;
  const awayStats =
    teamStats.find((r) => r.team_side === "away") ??
    teamStats.find((r) => r.team_slug === profile.away_team_slug) ??
    null;

  const vs = (
    key: string,
    label: string,
    pick: (r: MatchTeamStatsRow) => number | string | null,
    digits = 0
  ): ShowcaseVsRow => ({
    key,
    label,
    home: homeStats ? num(pick(homeStats)) : null,
    away: awayStats ? num(pick(awayStats)) : null,
    digits,
  });

  const vsRows: ShowcaseVsRow[] = [
    vs("xg", t("matchDetail.metricExpectedGoals"), (r) => r.details_expected_goals, 2),
    vs("shots", t("matchDetail.metricTotalShots"), (r) => r.summary_shots),
    vs("sot", t("matchDetail.metricShotsOnTarget"), (r) => r.summary_shots_on_target),
    vs("blocked", t("matchDetail.metricBlockedShots"), (r) => r.summary_blocked_shots),
    vs("corners", t("matchDetail.metricCornerKicks"), (r) => r.summary_corners_won),
    vs("passes", t("matchDetail.metricPasses"), (r) => r.summary_passes),
    vs("accpass", t("matchDetail.metricAccuratePass"), (r) => r.details_accurate_pass),
    vs("tackles", t("matchDetail.metricTackles"), (r) => r.summary_tackles),
    vs("fouls", t("tff1.colFouls"), (r) => r.summary_fouls_conceded),
    vs("yellow", t("matchDetail.metricYellowCards"), (r) => r.summary_yellow_cards),
  ];

  const sortedIncidents = [...incidents].sort(
    (a, b) => (a.minute_sort ?? 0) - (b.minute_sort ?? 0)
  );

  const homeContribs = contributors(
    participants.filter((p) => p.team_side === "home")
  );
  const awayContribs = contributors(
    participants.filter((p) => p.team_side === "away")
  );

  const teamBlock = (
    slug: string | null,
    fullName: string | null,
    shortName: string,
    align: "left" | "right"
  ) => {
    const logo = slug ? `/images/football_logos/${slug}.png` : null;
    const href = getTeamDetailHref(slug);
    return (
      <div
        className={`flex min-w-0 flex-1 flex-col items-center gap-3 ${align === "left" ? "sm:items-start" : "sm:items-end"}`}
      >
        <div className="flex h-[140px] w-[140px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-card-2 to-canvas p-4">
          {logo ? (
            <Image
              src={logo}
              alt={fullName ?? ""}
              width={112}
              height={112}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-3xl font-semibold text-ink-3">
              {(fullName ?? "?").slice(0, 1)}
            </span>
          )}
        </div>
        {href ? (
          <Link
            href={href}
            className="max-w-full truncate text-lg font-bold text-ink transition hover:text-accent-ink hover:underline sm:text-xl"
            title={fullName ?? undefined}
          >
            {shortName}
          </Link>
        ) : (
          <span className="max-w-full truncate text-lg font-bold text-ink sm:text-xl">
            {shortName}
          </span>
        )}
      </div>
    );
  };

  return (
    <section className="w-full space-y-3">
      {/* üst çubuk */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={backHref}
          className="rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink-2 transition hover:text-ink"
        >
          {t("matchDetail.backLabel")}
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          {VALID_MATCH_TABS.map((tab) => {
            const isActive = tab === "overview";
            const href = isActive
              ? `${detailHrefBase}&tab=overview`
              : `${detailHrefBase}&tab=${tab}`;
            return (
              <Link
                key={tab}
                href={href}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  isActive
                    ? "border-line-strong bg-accent-soft text-accent-ink"
                    : "border-line bg-card text-ink-2 hover:text-ink"
                }`}
              >
                {t(MATCH_TAB_LABEL_KEYS[tab])}
              </Link>
            );
          })}
          <Link
            href={`${detailHrefBase}&tab=overview&design=classic`}
            className="rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink-2 transition hover:text-ink"
            title={t("playerDetail.classicViewLabel")}
          >
            {t("playerDetail.classicViewLabel")}
          </Link>
        </div>
      </div>

      {/* hero */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />

          <p className="relative text-center text-[11px] font-medium uppercase tracking-[0.3em] text-accent-ink">
            {t("matchDetail.kicker")}
          </p>

          <div className="relative mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
            {teamBlock(profile.home_team_slug, profile.home_team_name, homeName, "left")}

            <div className="flex shrink-0 flex-col items-center gap-2 sm:pt-8">
              <div className="text-5xl font-bold tabular-nums tracking-tight text-ink sm:text-6xl">
                {profile.home_score ?? "-"}
                <span className="mx-2 text-ink-3">:</span>
                {profile.away_score ?? "-"}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={13} className="text-accent-ink" />
                  {profile.match_date_text ?? formatDate(profile.match_datetime)}
                </span>
                {profile.competition ? (
                  <>
                    <span className="text-ink-3">•</span>
                    <span>{profile.competition}</span>
                  </>
                ) : null}
              </div>
              {profile.venue ? (
                <div className="inline-flex items-center gap-1 text-[12px] text-ink-3">
                  <MapPin size={12} />
                  {profile.venue}
                </div>
              ) : null}
            </div>

            {teamBlock(profile.away_team_slug, profile.away_team_name, awayName, "right")}
          </div>
        </div>

        {/* istatistik şeridi (ev : deplasman) */}
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4 xl:grid-cols-8">
          <StripStat
            icon={<Goal size={11} />}
            label={t("matchDetail.metricExpectedGoals")}
            home={homeStats ? num(homeStats.details_expected_goals) : null}
            away={awayStats ? num(awayStats.details_expected_goals) : null}
            digits={2}
          />
          <StripStat
            icon={<Crosshair size={11} />}
            label={t("matchDetail.metricTotalShots")}
            home={homeStats?.summary_shots ?? null}
            away={awayStats?.summary_shots ?? null}
          />
          <StripStat
            icon={<Target size={11} />}
            label={t("matchDetail.metricShotsOnTarget")}
            home={homeStats?.summary_shots_on_target ?? null}
            away={awayStats?.summary_shots_on_target ?? null}
          />
          <StripStat
            icon={<Activity size={11} />}
            label={t("matchDetail.metricCornerKicks")}
            home={homeStats?.summary_corners_won ?? null}
            away={awayStats?.summary_corners_won ?? null}
          />
          <StripStat
            icon={<Users size={11} />}
            label={t("matchDetail.metricPasses")}
            home={homeStats?.summary_passes ?? null}
            away={awayStats?.summary_passes ?? null}
          />
          <StripStat
            icon={<Shield size={11} />}
            label={t("matchDetail.metricTackles")}
            home={homeStats?.summary_tackles ?? null}
            away={awayStats?.summary_tackles ?? null}
          />
          <StripStat
            icon={<Sparkles size={11} />}
            label={t("matchDetail.metricYellowCards")}
            home={homeStats?.summary_yellow_cards ?? null}
            away={awayStats?.summary_yellow_cards ?? null}
          />
          <StripStat
            icon={<ShieldCheckIcon />}
            label={t("tff1.colSaves")}
            home={homeStats?.summary_saves ?? null}
            away={awayStats?.summary_saves ?? null}
          />
        </div>
      </div>

      {/* alt üçlü grid */}
      <div className="grid gap-3 xl:grid-cols-12">
        {/* sol: karşılaştırma */}
        <div className="xl:col-span-4">
          <div className="rounded-2xl border border-line bg-card p-4">
            <SectionHeading icon={<Activity size={13} />}>
              {t("matchDetail.topStats")}
            </SectionHeading>
            {homeStats || awayStats ? (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-ink">
                  <span className="truncate">{homeName}</span>
                  <span className="truncate text-right">{awayName}</span>
                </div>
                <ShowcaseVsBars rows={vsRows} />
              </div>
            ) : (
              <div className="mt-3 text-sm text-ink-2">
                {t("matchDetail.noTeamStats")}
              </div>
            )}
          </div>
        </div>

        {/* orta: olaylar */}
        <div className="xl:col-span-4">
          <div className="rounded-2xl border border-line bg-card p-4">
            <SectionHeading icon={<CalendarDays size={13} />}>
              {t("matchDetail.tabIncidents")}
            </SectionHeading>

            {sortedIncidents.length === 0 ? (
              <div className="mt-3 text-sm text-ink-2">
                {t("matchDetail.noIncidents")}
              </div>
            ) : (
              <div className="mt-3 space-y-1.5">
                {sortedIncidents.map((row, i) => {
                  const isHome = row.side === "home";
                  return (
                    <div
                      key={`${row.minute_sort}-${i}`}
                      className={`flex items-center gap-2 rounded-lg border border-line bg-field px-2.5 py-1.5 ${
                        isHome ? "" : "flex-row-reverse text-right"
                      }`}
                    >
                      <span className="w-9 shrink-0 rounded bg-veil px-1 py-0.5 text-center text-[10px] font-semibold tabular-nums text-ink-2">
                        {row.minute_text ?? "—"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium text-ink">
                          {row.primary_player_text ?? row.event_title ?? "—"}
                        </div>
                        <div className="truncate text-[10px] text-ink-3">
                          {row.primary_player_text
                            ? row.event_title
                            : row.secondary_player_text}
                          {row.secondary_player_text && row.primary_player_text
                            ? ` • ${row.secondary_player_text}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* sağ: oyuncu katkıları */}
        <div className="xl:col-span-4">
          <div className="rounded-2xl border border-line bg-card p-4">
            <SectionHeading
              icon={<Users size={13} />}
              right={
                <Link
                  href={`${detailHrefBase}&tab=lineups`}
                  className="text-[11px] text-accent-ink transition hover:underline"
                >
                  {t("matchDetail.tabLineups")} →
                </Link>
              }
            >
              {t("matchDetail.tabLineups")}
            </SectionHeading>

            <div className="mt-3 space-y-4 overflow-x-auto">
              <ContributorTable title={homeName} rows={homeContribs} t={t} />
              <ContributorTable title={awayName} rows={awayContribs} t={t} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShieldCheckIcon() {
  return <Shield size={11} />;
}
