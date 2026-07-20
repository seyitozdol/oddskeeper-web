import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TEAM_METRIC_META } from "@/features/team-detail/metricMeta";
import { getTeamDetailedMetrics } from "@/features/team-detail/server/getTeamDetailedMetrics";
import { getTeamMetricLeaderboard } from "@/features/team-detail/server/getTeamMetricLeaderboard";
import { getTeamStatisticsSummary } from "@/features/team-detail/server/getTeamStatisticsSummary";
import { getFootballTeams } from "@/lib/football-teams";
import { getT } from "@/lib/i18n/server";
import { categoryLabel, metricLabel } from "@/lib/i18n/metricLabel";
import { formatMetricValue, formatRateValue } from "@/lib/metric-format";
import { getTeamDetailHref } from "@/lib/routes";

type PageProps = {
  searchParams?: Promise<{
    team?: string;
    metric?: string;
    season?: string;
  }>;
};

const DEFAULT_METRIC = "team_goals_for";

export default async function TeamMetricLeaderboardPage({
  searchParams,
}: PageProps) {
  const resolved = (await searchParams) ?? {};
  const teamSlug = resolved.team;

  if (!teamSlug) {
    notFound();
  }

  const [t, teams, summary] = await Promise.all([
    getT(),
    getFootballTeams(),
    getTeamStatisticsSummary(teamSlug),
  ]);

  const seasonLabel = resolved.season ?? summary?.season_label ?? undefined;
  const competition = summary?.competition ?? undefined;

  const detailedRows = await getTeamDetailedMetrics(teamSlug, {
    seasonLabel,
  });

  const metricKey =
    detailedRows.find((row) => row.metric_key === resolved.metric)
      ?.metric_key ??
    detailedRows.find((row) => row.metric_key === DEFAULT_METRIC)?.metric_key ??
    detailedRows[0]?.metric_key ??
    null;

  const leaderboard = metricKey
    ? await getTeamMetricLeaderboard({ metricKey, seasonLabel, competition })
    : [];

  const logoBySlug = Object.fromEntries(
    teams.map((team) => [team.slug, team.logoPath])
  );
  const localTeam = teams.find((team) => team.slug === teamSlug) ?? null;

  const selectedRow =
    leaderboard.find((row) => row.team_slug === teamSlug) ?? null;
  const leaderRow = leaderboard[0] ?? null;
  const meta = metricKey ? TEAM_METRIC_META[metricKey] : undefined;
  const metricTitle = metricLabel(
    t,
    metricKey,
    selectedRow?.metric_label ?? leaderRow?.metric_label
  );

  const gapToLeader =
    selectedRow?.per_match_value != null && leaderRow?.per_match_value != null
      ? Math.abs(leaderRow.per_match_value - selectedRow.per_match_value)
      : null;

  const backHref = (() => {
    const params = new URLSearchParams();
    params.set("team", teamSlug);
    params.set("tab", "detailed-stats");
    if (resolved.season) params.set("season", resolved.season);
    return `/dashboard/stats-analysis/football/team-stats/detail?${params.toString()}`;
  })();

  const metricHref = (key: string) => {
    const params = new URLSearchParams();
    params.set("team", teamSlug);
    params.set("metric", key);
    if (resolved.season) params.set("season", resolved.season);
    return `/dashboard/stats-analysis/football/team-stats/metric?${params.toString()}`;
  };

  // Metrik seçenekleri kategoriye göre gruplu
  const optionsByCategory = new Map<
    string,
    { key: string; label: string; categoryKey: string }[]
  >();
  for (const row of detailedRows) {
    const catLabel = categoryLabel(t, row.category_key, row.category_label);
    if (!optionsByCategory.has(catLabel)) {
      optionsByCategory.set(catLabel, []);
    }
    optionsByCategory
      .get(catLabel)!
      .push({
        key: row.metric_key,
        label: metricLabel(t, row.metric_key, row.metric_label),
        categoryKey: row.category_key,
      });
  }

  return (
    <section className="w-full space-y-3">
      <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.90),rgba(5,10,18,0.96))] p-5">
        <Link
          href={backHref}
          className="text-[12px] text-white/50 transition hover:text-white"
        >
          ← {t("common.backToDetailedStats")}
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {localTeam ? (
            <Image
              src={localTeam.logoPath}
              alt={localTeam.name}
              width={44}
              height={44}
              className="h-11 w-11 object-contain"
            />
          ) : null}

          <div>
            <div className="text-[11px] uppercase tracking-[0.20em] text-white/40">
              {t("common.leagueRanking")}
              {seasonLabel ? ` · ${seasonLabel}` : ""}
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              {metricTitle}
            </h1>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {selectedRow ? (
            <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/70">
              {categoryLabel(
                t,
                selectedRow.category_key,
                selectedRow.category_label
              )}
            </span>
          ) : null}
          {selectedRow ? (
            <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/70">
              {selectedRow.is_higher_better === false
                ? t("common.lowerIsBetter")
                : t("common.higherIsBetter")}
            </span>
          ) : null}
        </div>

        {meta ? (
          <p className="mt-3 max-w-3xl text-[13px] leading-6 text-white/60">
            {t(meta.descKey)} {t(meta.interpKey)}
          </p>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label={t("common.leagueLeader")}
            value={leaderRow?.team_name ?? "—"}
            subvalue={
              leaderRow
                ? formatRateValue(
                    leaderRow.per_match_value,
                    leaderRow.value_format
                  )
                : undefined
            }
          />
          <SummaryCard
            label={t("common.leagueAverage")}
            value={
              leaderRow
                ? formatRateValue(leaderRow.league_avg, leaderRow.value_format)
                : "—"
            }
            subvalue={t("common.perMatchLabel")}
          />
          <SummaryCard
            label={`${localTeam?.name ?? teamSlug} · ${t("common.rank")}`}
            value={selectedRow?.league_rank != null ? `#${selectedRow.league_rank}` : "—"}
            subvalue={
              selectedRow
                ? formatRateValue(
                    selectedRow.per_match_value,
                    selectedRow.value_format
                  )
                : undefined
            }
            highlight
          />
          <SummaryCard
            label={t("common.gapToLeader")}
            value={
              gapToLeader !== null
                ? formatRateValue(gapToLeader, selectedRow?.value_format)
                : "—"
            }
            subvalue={t("common.perMatchLabel")}
          />
        </div>
      </div>

      <div className="rounded-[18px] border border-white/10 bg-white/[0.02] p-4">
        <div className="space-y-2">
          {Array.from(optionsByCategory.entries()).map(([catLabel, options]) => (
            <div key={catLabel} className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 w-24 shrink-0 text-[11px] uppercase tracking-[0.12em] text-white/35">
                {catLabel}
              </span>
              {options.map((option) => (
                <Link
                  key={option.key}
                  href={metricHref(option.key)}
                  className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium transition ${
                    option.key === metricKey
                      ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[18px] border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
                <th className="px-4 py-2.5 font-medium">{t("common.rank")}</th>
                <th className="px-4 py-2.5 font-medium">{t("common.team")}</th>
                <th className="px-4 py-2.5 font-medium">
                  {t("common.totalLabel")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("common.perMatchLabel")}
                </th>
                <th className="px-4 py-2.5 font-medium">{t("common.home")}</th>
                <th className="px-4 py-2.5 font-medium">{t("common.away")}</th>
                <th className="px-4 py-2.5 font-medium">
                  {t("common.vsAvgLabel")}
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => {
                const isSelected = row.team_slug === teamSlug;
                const teamHref = getTeamDetailHref(row.team_slug);
                const logoPath = row.team_slug
                  ? logoBySlug[row.team_slug]
                  : undefined;

                return (
                  <tr
                    key={`${row.team_slug}-${row.league_rank}`}
                    className={`border-t text-[13px] transition ${
                      isSelected
                        ? "border-[#4da2ff]/30 bg-[#10335d]/40 text-white"
                        : "border-white/10 text-white/80 hover:bg-white/[0.03]"
                    }`}
                  >
                    <td className="px-4 py-2 font-semibold">
                      {row.league_rank ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        {logoPath ? (
                          <Image
                            src={logoPath}
                            alt={row.team_name ?? ""}
                            width={18}
                            height={18}
                            className="h-[18px] w-[18px] shrink-0 object-contain"
                          />
                        ) : null}
                        {teamHref ? (
                          <Link
                            href={teamHref}
                            className={`transition hover:underline ${
                              isSelected
                                ? "font-semibold text-white"
                                : "text-white/80 hover:text-white"
                            }`}
                          >
                            {row.team_name}
                          </Link>
                        ) : (
                          <span>{row.team_name ?? "—"}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {formatMetricValue(row.total_value, row.value_format)}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {formatRateValue(row.per_match_value, row.value_format)}
                    </td>
                    <td className="px-4 py-2">
                      {formatRateValue(row.home_value, row.value_format)}
                    </td>
                    <td className="px-4 py-2">
                      {formatRateValue(row.away_value, row.value_format)}
                    </td>
                    <td
                      className={`px-4 py-2 font-medium ${
                        row.vs_league_avg_pct == null
                          ? "text-white/55"
                          : (row.vs_league_avg_pct >= 0) ===
                            (row.is_higher_better !== false)
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }`}
                    >
                      {formatMetricValue(row.vs_league_avg_pct, "pct_1")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  subvalue,
  highlight = false,
}: {
  label: string;
  value: string;
  subvalue?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[14px] border p-3 ${
        highlight
          ? "border-[#4da2ff]/35 bg-[#10335d]/40"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">
        {label}
      </div>
      <div className="mt-1 truncate text-lg font-semibold text-white">
        {value}
      </div>
      {subvalue ? (
        <div className="mt-0.5 text-[12px] text-white/55">{subvalue}</div>
      ) : null}
    </div>
  );
}
