import Image from "next/image";
import Link from "next/link";
import MetricSelect from "@/components/rankings/MetricSelect";
import SortableRankingTable, {
  type RankingColumn,
  type RankingRow,
} from "@/components/rankings/SortableRankingTable";
import { TEAM_METRIC_META } from "@/features/team-detail/metricMeta";
import { getTeamDetailedMetrics } from "@/features/team-detail/server/getTeamDetailedMetrics";
import { getTeamMetricLeaderboard } from "@/features/team-detail/server/getTeamMetricLeaderboard";
import { getTeamStatisticsSummary } from "@/features/team-detail/server/getTeamStatisticsSummary";
import {
  getAllFootballTeamLogos,
  getAnyFootballTeamBySlug,
  getFootballTeams,
} from "@/lib/football-teams";
import { getT } from "@/lib/i18n/server";
import { categoryLabel, metricLabel } from "@/lib/i18n/metricLabel";
import { formatMetricValue, formatRateValue } from "@/lib/metric-format";
import { getTeamDetailHref } from "@/lib/routes";
import { previousSeasonLabel } from "@/lib/season";

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
  // team parametresi opsiyonel: verilmezse sayfa genel sıralama görünümüne düşer.
  const teamSlug = resolved.team ?? null;

  const [t, teams, logoBySlug, localTeam] = await Promise.all([
    getT(),
    getFootballTeams(),
    getAllFootballTeamLogos(),
    resolved.team ? getAnyFootballTeamBySlug(resolved.team) : null,
  ]);

  // Sezon/lig varsayılanları: seçili takım yoksa herhangi bir güncel takımın
  // özeti güncel sezonu verir.
  const summarySlug = teamSlug ?? teams[0]?.slug;
  const summary = summarySlug
    ? await getTeamStatisticsSummary(summarySlug)
    : null;

  const seasonLabel = resolved.season ?? summary?.season_label ?? undefined;
  const competition = summary?.competition ?? undefined;
  const prevSeason = previousSeasonLabel(seasonLabel);

  // Metrik seçenek kataloğu: seçili takım yoksa da tam liste gerekir; her
  // takımda 29 metriğin tamamı bulunduğundan katalog kaynak takımı yeterli.
  const detailedRows = await getTeamDetailedMetrics(summarySlug ?? "", {
    seasonLabel,
  });

  const metricKey =
    detailedRows.find((row) => row.metric_key === resolved.metric)
      ?.metric_key ??
    detailedRows.find((row) => row.metric_key === DEFAULT_METRIC)?.metric_key ??
    detailedRows[0]?.metric_key ??
    null;

  const [leaderboard, prevLeaderboard] = await Promise.all([
    metricKey
      ? getTeamMetricLeaderboard({ metricKey, seasonLabel, competition })
      : Promise.resolve([]),
    metricKey && prevSeason
      ? getTeamMetricLeaderboard({
          metricKey,
          seasonLabel: prevSeason,
          competition,
        })
      : Promise.resolve([]),
  ]);

  // Geçmiş sezon kıyası yalnızca o sezonda gerçek veri varsa gösterilir;
  // kapsam dışı metriklerde herkes 0 değerle 1. sırada görünür (anlamsız).
  const prevHasData =
    prevLeaderboard.some((row) => (row.per_match_value ?? 0) !== 0) &&
    new Set(prevLeaderboard.map((row) => row.league_rank)).size > 1;

  const prevRankBySlug = new Map(
    prevHasData
      ? prevLeaderboard
          .filter((row) => row.team_slug && row.league_rank !== null)
          .map((row) => [row.team_slug as string, row.league_rank as number])
      : []
  );

  const selectedRow = teamSlug
    ? leaderboard.find((row) => row.team_slug === teamSlug) ?? null
    : null;
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

  const backHref = teamSlug
    ? (() => {
        const params = new URLSearchParams();
        params.set("team", teamSlug);
        params.set("tab", "detailed-stats");
        if (resolved.season) params.set("season", resolved.season);
        return `/dashboard/stats-analysis/football/team-stats/detail?${params.toString()}`;
      })()
    : "/dashboard/stats-analysis";

  const metricOptions = detailedRows.map((row) => ({
    key: row.metric_key,
    label: metricLabel(t, row.metric_key, row.metric_label),
    category: categoryLabel(t, row.category_key, row.category_label),
  }));

  const metricSelectParams: Record<string, string> = {};
  if (teamSlug) metricSelectParams.team = teamSlug;
  if (resolved.season) metricSelectParams.season = resolved.season;

  // Anlamsız (tamamen boş) kolonları gizle: ör. yüzde metriklerinde Toplam.
  const hasAny = (pick: (r: (typeof leaderboard)[number]) => number | null) =>
    leaderboard.some((row) => pick(row) !== null && pick(row) !== undefined);
  const showTotal = hasAny((r) => r.total_value);
  const showHome = hasAny((r) => r.home_value);
  const showAway = hasAny((r) => r.away_value);
  const showVsAvg = hasAny((r) => r.vs_league_avg_pct);

  const columns: RankingColumn[] = [
    { id: "rank", label: t("common.rank"), defaultDir: "asc" },
    { id: "team", label: t("common.team"), defaultDir: "asc" },
    ...(showTotal
      ? [{ id: "total", label: t("common.totalLabel"), defaultDir: "desc" as const }]
      : []),
    { id: "perMatch", label: t("common.perMatchLabel"), defaultDir: "desc" },
    ...(showHome
      ? [{ id: "home", label: t("common.home"), defaultDir: "desc" as const }]
      : []),
    ...(showAway
      ? [{ id: "away", label: t("common.away"), defaultDir: "desc" as const }]
      : []),
    ...(showVsAvg
      ? [{ id: "vsAvg", label: t("common.vsAvgLabel"), defaultDir: "desc" as const }]
      : []),
  ];

  const tableRows: RankingRow[] = leaderboard.map((row, index) => {
    const isSelected = teamSlug !== null && row.team_slug === teamSlug;
    const teamHref = getTeamDetailHref(row.team_slug);
    const logoPath = row.team_slug ? logoBySlug[row.team_slug] : undefined;
    const prevRank = row.team_slug
      ? prevRankBySlug.get(row.team_slug)
      : undefined;

    const cells = [
      <span key="rank" className="font-semibold">
        {row.league_rank ?? "—"}
        {prevRank !== undefined ? (
          <span
            className="ml-1 text-[11px] font-normal text-ink-3"
            title={t("common.prevSeasonRank", { rank: prevRank })}
          >
            ({prevRank})
          </span>
        ) : null}
      </span>,
      <span key="team" className="inline-flex items-center gap-2">
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
                ? "font-semibold text-ink"
                : "text-ink hover:text-ink"
            }`}
          >
            {row.team_name}
          </Link>
        ) : (
          <span>{row.team_name ?? "—"}</span>
        )}
      </span>,
      ...(showTotal
        ? [
            <span key="total">
              {formatMetricValue(row.total_value, row.value_format)}
            </span>,
          ]
        : []),
      <span key="perMatch" className="font-medium">
        {formatRateValue(row.per_match_value, row.value_format)}
      </span>,
      ...(showHome
        ? [
            <span key="home">
              {formatRateValue(row.home_value, row.value_format)}
            </span>,
          ]
        : []),
      ...(showAway
        ? [
            <span key="away">
              {formatRateValue(row.away_value, row.value_format)}
            </span>,
          ]
        : []),
      ...(showVsAvg
        ? [
            <span
              key="vsAvg"
              className={`font-medium ${
                row.vs_league_avg_pct == null
                  ? "text-ink-2"
                  : (row.vs_league_avg_pct >= 0) ===
                    (row.is_higher_better !== false)
                  ? "text-pos"
                  : "text-neg"
              }`}
            >
              {formatMetricValue(row.vs_league_avg_pct, "pct_1")}
            </span>,
          ]
        : []),
    ];

    const sortValues: (number | string | null)[] = [
      row.league_rank,
      row.team_name ?? null,
      ...(showTotal ? [row.total_value] : []),
      row.per_match_value,
      ...(showHome ? [row.home_value] : []),
      ...(showAway ? [row.away_value] : []),
      ...(showVsAvg ? [row.vs_league_avg_pct] : []),
    ];

    return {
      id: `${row.team_slug}-${index}`,
      highlighted: isSelected,
      cells,
      sortValues,
    };
  });

  return (
    <section className="w-full space-y-3">
      <div className="rounded-lg border border-line bg-card p-5">
        <Link
          href={backHref}
          className="text-[12px] text-ink-3 transition hover:text-ink"
        >
          ← {teamSlug ? t("common.backToDetailedStats") : t("nav.statsAnalysis")}
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
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
              <div className="text-[11px] uppercase tracking-[0.20em] text-ink-3">
                {t("nav.teamRankings")}
                {seasonLabel ? ` · ${seasonLabel}` : ""}
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-ink">
                {metricTitle}
              </h1>
            </div>
          </div>

          <MetricSelect
            options={metricOptions}
            selectedKey={metricKey}
            basePath="/dashboard/stats-analysis/football/team-stats/metric"
            baseParams={metricSelectParams}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {leaderRow ? (
            <span className="inline-flex rounded-lg border border-line bg-veil px-2.5 py-1 text-[11px] font-medium text-ink-2">
              {categoryLabel(t, leaderRow.category_key, leaderRow.category_label)}
            </span>
          ) : null}
          {leaderRow ? (
            <span className="inline-flex rounded-lg border border-line bg-veil px-2.5 py-1 text-[11px] font-medium text-ink-2">
              {leaderRow.is_higher_better === false
                ? t("common.lowerIsBetter")
                : t("common.higherIsBetter")}
            </span>
          ) : null}
        </div>

        {meta ? (
          <p className="mt-3 max-w-3xl text-[13px] leading-6 text-ink-2">
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
          {selectedRow ? (
            <SummaryCard
              label={`${localTeam?.name ?? teamSlug} · ${t("common.rank")}`}
              value={
                selectedRow.league_rank != null
                  ? `#${selectedRow.league_rank}`
                  : "—"
              }
              subvalue={[
                formatRateValue(
                  selectedRow.per_match_value,
                  selectedRow.value_format
                ),
                selectedRow.team_slug &&
                prevRankBySlug.has(selectedRow.team_slug)
                  ? t("common.prevSeasonRank", {
                      rank: prevRankBySlug.get(selectedRow.team_slug)!,
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              highlight
            />
          ) : null}
          {selectedRow ? (
            <SummaryCard
              label={t("common.gapToLeader")}
              value={
                gapToLeader !== null
                  ? formatRateValue(gapToLeader, selectedRow.value_format)
                  : "—"
              }
              subvalue={t("common.perMatchLabel")}
            />
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-line">
        <SortableRankingTable
          columns={columns}
          rows={tableRows}
          initialSortIndex={0}
          initialSortDir="asc"
        />
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
      className={`rounded-lg border p-3 ${
        highlight
          ? "border-line-strong bg-card-2"
          : "border-line bg-veil"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
        {label}
      </div>
      <div className="mt-1 truncate text-lg font-semibold text-ink">
        {value}
      </div>
      {subvalue ? (
        <div className="mt-0.5 text-[12px] text-ink-2">{subvalue}</div>
      ) : null}
    </div>
  );
}
