import Image from "next/image";
import Link from "next/link";
import { PLAYER_METRIC_META } from "@/features/player-detail/metricMeta";
import { getPlayerCurrentInfo } from "@/features/player-detail/server/getPlayerCurrentInfo";
import { getPlayerDetailedMetrics } from "@/features/player-detail/server/getPlayerDetailedMetrics";
import { getPlayerMetricLeaderboard } from "@/features/player-detail/server/getPlayerMetricLeaderboard";
import { getPlayerNameMap } from "@/features/player-detail/server/getPlayerNameMap";
import { getPlayerProfile } from "@/features/player-detail/server/getPlayerProfile";
import { getLeaguePlayerLeaderboardMeta } from "@/features/league-detail/server/getLeaguePlayerLeaderboard";
import { getAllFootballTeamLogos } from "@/lib/football-teams";
import { getT } from "@/lib/i18n/server";
import { categoryLabel, metricLabel } from "@/lib/i18n/metricLabel";
import { formatMetricValue, formatRateValue } from "@/lib/metric-format";
import { previousSeasonLabel } from "@/lib/season";
import { getPlayerDetailHref, getTeamDetailHref } from "@/lib/routes";

type PageProps = {
  searchParams?: Promise<{
    player?: string;
    metric?: string;
    view?: string;
  }>;
};

const DEFAULT_METRIC = "goals_total";

type ViewMode = "all" | "top10" | "bottom10" | "around";

function isViewMode(value: string | undefined): value is ViewMode {
  return (
    value === "all" ||
    value === "top10" ||
    value === "bottom10" ||
    value === "around"
  );
}

export default async function PlayerMetricLeaderboardPage({
  searchParams,
}: PageProps) {
  const resolved = (await searchParams) ?? {};
  // player parametresi opsiyonel: verilmezse genel sıralama görünümü.
  const playerSlug = resolved.player ?? null;

  const [t, profile, currentInfo, nameMap, logoBySlug] = await Promise.all([
    getT(),
    playerSlug ? getPlayerProfile(playerSlug) : null,
    playerSlug ? getPlayerCurrentInfo(playerSlug) : null,
    getPlayerNameMap(),
    getAllFootballTeamLogos(),
  ]);

  const detailedRows = playerSlug
    ? await getPlayerDetailedMetrics(playerSlug, {
        seasonLabel: profile?.season_label ?? undefined,
      })
    : [];

  const metricKeyFromRows =
    detailedRows.find((row) => row.metric_key === resolved.metric)
      ?.metric_key ??
    detailedRows.find((row) => row.metric_key === DEFAULT_METRIC)?.metric_key ??
    detailedRows[0]?.metric_key ??
    null;

  const metricKey = playerSlug
    ? metricKeyFromRows
    : resolved.metric ?? DEFAULT_METRIC;

  const [leaderboard, prevLeaderboard] = await Promise.all([
    metricKey
      ? getPlayerMetricLeaderboard({
          metricKey,
          seasonLabel: profile?.season_label ?? undefined,
          competition: profile?.competition ?? undefined,
        })
      : Promise.resolve([]),
    // Geçmiş sezon oyuncu metrikleri üretildiğinde kıyas otomatik görünür;
    // şimdilik veri katmanında yalnızca güncel sezon var.
    metricKey && previousSeasonLabel(profile?.season_label)
      ? getPlayerMetricLeaderboard({
          metricKey,
          seasonLabel: previousSeasonLabel(profile?.season_label)!,
        })
      : Promise.resolve([]),
  ]);

  // Geçmiş sezonda gerçek veri yoksa (herkes 0/aynı sırada) kıyas gösterme.
  const prevHasData =
    prevLeaderboard.some((row) => (row.per_match_value ?? 0) !== 0) &&
    new Set(prevLeaderboard.map((row) => row.league_rank)).size > 1;

  const prevRankById = new Map(
    prevHasData
      ? prevLeaderboard
          .filter((row) => row.player_source_id && row.league_rank !== null)
          .map((row) => [
            String(row.player_source_id),
            row.league_rank as number,
          ])
      : []
  );

  // Metrik seçenekleri: oyuncu seçiliyse kendi satırları, değilse lig kataloğu.
  const catalogOptions =
    !playerSlug && leaderboard[0]?.competition && leaderboard[0]?.season_label
      ? await getLeaguePlayerLeaderboardMeta(
          leaderboard[0].competition,
          leaderboard[0].season_label
        )
      : [];

  const optionRows = playerSlug ? detailedRows : catalogOptions;

  const playerSourceId = profile?.player_source_id ?? null;
  const selectedRow = playerSourceId
    ? leaderboard.find(
        (row) => String(row.player_source_id) === String(playerSourceId)
      ) ?? null
    : null;

  const rankedRows = leaderboard.filter((row) => row.league_rank !== null);
  const leaderRow = rankedRows[0] ?? null;

  const meta = metricKey ? PLAYER_METRIC_META[metricKey] : undefined;
  const metricTitle = metricLabel(
    t,
    metricKey,
    selectedRow?.metric_label ?? leaderRow?.metric_label
  );

  const displayName = playerSlug
    ? [currentInfo?.first_name, currentInfo?.last_name]
        .filter(Boolean)
        .join(" ") ||
      currentInfo?.full_name ||
      profile?.player_name ||
      playerSlug
    : null;

  const gapToLeader =
    selectedRow?.per90_value != null && leaderRow?.per90_value != null
      ? Math.abs(leaderRow.per90_value - selectedRow.per90_value)
      : null;

  const backHref = playerSlug
    ? `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(
        playerSlug
      )}&tab=detailed-stats`
    : "/dashboard/stats-analysis";

  const pageHref = (params: {
    metric?: string | null;
    view?: ViewMode | null;
  }) => {
    const search = new URLSearchParams();
    if (playerSlug) search.set("player", playerSlug);
    const metric = params.metric === undefined ? metricKey : params.metric;
    if (metric) search.set("metric", metric);
    const view = params.view === undefined ? requestedView : params.view;
    if (view && view !== "all") search.set("view", view);
    return `/dashboard/stats-analysis/football/player-stats/metric?${search.toString()}`;
  };

  // Görünüm modları: Tümü / İlk 10 / Son 10 / Seçilenin çevresi (±10)
  const requestedView: ViewMode = isViewMode(resolved.view)
    ? resolved.view === "around" && !selectedRow
      ? "all"
      : resolved.view
    : "all";

  let visibleRows = rankedRows;
  if (requestedView === "top10") {
    visibleRows = rankedRows.slice(0, 10);
  } else if (requestedView === "bottom10") {
    visibleRows = rankedRows.slice(-10);
  } else if (requestedView === "around" && selectedRow) {
    const index = rankedRows.findIndex(
      (row) => String(row.player_source_id) === String(playerSourceId)
    );
    const start = Math.max(0, index - 10);
    visibleRows = rankedRows.slice(start, index + 11);
  }

  const viewOptions: { mode: ViewMode; label: string }[] = [
    { mode: "all", label: t("common.all") },
    { mode: "top10", label: t("common.viewTop10") },
    { mode: "bottom10", label: t("common.viewBottom10") },
    ...(selectedRow
      ? [{ mode: "around" as ViewMode, label: t("common.viewAround") }]
      : []),
  ];

  const optionsByCategory = new Map<
    string,
    { key: string; label: string }[]
  >();
  for (const row of optionRows) {
    const catLabel = categoryLabel(
      t,
      row.category_key,
      "category_label" in row ? row.category_label : null
    );
    if (!optionsByCategory.has(catLabel)) {
      optionsByCategory.set(catLabel, []);
    }
    optionsByCategory.get(catLabel)!.push({
      key: row.metric_key,
      label: metricLabel(t, row.metric_key, row.metric_label),
    });
  }

  // Anlamsız (tamamen boş) kolonları gizle.
  const hasAny = (pick: (r: (typeof rankedRows)[number]) => number | null) =>
    rankedRows.some((row) => pick(row) !== null && pick(row) !== undefined);
  const showPer90 = hasAny((r) => r.per90_value);
  const showPerMatch = hasAny((r) => r.per_match_value);
  const showTotal = hasAny((r) => r.total_value);
  const showVsAvg = hasAny((r) => r.vs_league_avg_pct);

  return (
    <section className="w-full space-y-3">
      <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.90),rgba(5,10,18,0.96))] p-5">
        <Link
          href={backHref}
          className="text-[12px] text-white/50 transition hover:text-white"
        >
          ← {playerSlug ? t("common.backToDetailedStats") : t("nav.statsAnalysis")}
        </Link>

        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-[0.20em] text-white/40">
            {t("nav.playerRankings")}
            {leaderRow?.season_label ? ` · ${leaderRow.season_label}` : ""}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            {metricTitle}
          </h1>
          {displayName ? (
            <div className="mt-1 text-sm text-white/55">{displayName}</div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {leaderRow ? (
            <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/70">
              {categoryLabel(t, leaderRow.category_key, leaderRow.category_label)}
            </span>
          ) : null}
          {leaderRow ? (
            <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/70">
              {leaderRow.is_higher_better === false
                ? t("common.lowerIsBetter")
                : t("common.higherIsBetter")}
            </span>
          ) : null}
        </div>

        {meta ? (
          <p className="mt-3 max-w-3xl text-[13px] leading-6 text-white/60">
            {t(meta.shortDescriptionKey)} {t(meta.interpretationKey)}
          </p>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label={t("common.leagueLeader")}
            value={
              (leaderRow &&
                (nameMap[String(leaderRow.player_source_id)]?.fullName ??
                  leaderRow.player_name)) ??
              "—"
            }
            subvalue={
              leaderRow
                ? `${formatRateValue(
                    leaderRow.per90_value,
                    leaderRow.value_format
                  )} · ${leaderRow.team_name ?? ""}`
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
            subvalue={t("common.per90Label")}
          />
          {playerSlug ? (
            <SummaryCard
              label={`${displayName} · ${t("common.rank")}`}
              value={
                selectedRow?.league_rank != null
                  ? `#${selectedRow.league_rank}`
                  : "—"
              }
              subvalue={
                selectedRow
                  ? [
                      formatRateValue(
                        selectedRow.per90_value,
                        selectedRow.value_format
                      ),
                      prevRankById.has(String(playerSourceId))
                        ? t("common.prevSeasonRank", {
                            rank: prevRankById.get(String(playerSourceId))!,
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : t("common.notQualified")
              }
              highlight
            />
          ) : null}
          {playerSlug ? (
            <SummaryCard
              label={t("common.gapToLeader")}
              value={
                gapToLeader !== null
                  ? formatRateValue(gapToLeader, selectedRow?.value_format)
                  : "—"
              }
              subvalue={t("common.per90Label")}
            />
          ) : null}
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
                  href={pageHref({ metric: option.key })}
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
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
          {viewOptions.map((option) => (
            <Link
              key={option.mode}
              href={pageHref({ view: option.mode })}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                requestedView === option.mode
                  ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {option.label}
            </Link>
          ))}
          <span className="ml-auto text-[11px] text-white/40">
            {visibleRows.length} / {rankedRows.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
                <th className="px-4 py-2.5 font-medium">{t("common.rank")}</th>
                <th className="px-4 py-2.5 font-medium">{t("common.player")}</th>
                <th className="px-4 py-2.5 font-medium">{t("common.team")}</th>
                {showPer90 ? (
                  <th className="px-4 py-2.5 font-medium">
                    {t("common.per90Label")}
                  </th>
                ) : null}
                {showPerMatch ? (
                  <th className="px-4 py-2.5 font-medium">
                    {t("common.perMatchLabel")}
                  </th>
                ) : null}
                {showTotal ? (
                  <th className="px-4 py-2.5 font-medium">
                    {t("common.totalLabel")}
                  </th>
                ) : null}
                {showVsAvg ? (
                  <th className="px-4 py-2.5 font-medium">
                    {t("common.vsAvgLabel")}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const isSelected =
                  playerSourceId !== null &&
                  String(row.player_source_id) === String(playerSourceId);
                const nameEntry = nameMap[String(row.player_source_id)];
                const rowPlayerHref = getPlayerDetailHref(nameEntry?.slug);
                const rowName = nameEntry?.fullName ?? row.player_name ?? "—";
                const teamHref = getTeamDetailHref(row.team_slug);
                const logoPath = row.team_slug
                  ? logoBySlug[row.team_slug]
                  : undefined;
                const prevRank = prevRankById.get(String(row.player_source_id));

                return (
                  <tr
                    key={`${row.player_source_id}-${row.team_slug}-${index}`}
                    className={`border-t text-[13px] transition ${
                      isSelected
                        ? "border-[#4da2ff]/30 bg-[#10335d]/40 text-white"
                        : "border-white/10 text-white/80 hover:bg-white/[0.03]"
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-2 font-semibold">
                      {row.league_rank ?? "—"}
                      {prevRank !== undefined ? (
                        <span
                          className="ml-1 text-[11px] font-normal text-white/40"
                          title={t("common.prevSeasonRank", { rank: prevRank })}
                        >
                          ({prevRank})
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {rowPlayerHref ? (
                        <Link
                          href={rowPlayerHref}
                          className={`transition hover:underline ${
                            isSelected
                              ? "font-semibold text-white"
                              : "text-[#8dc8ff] hover:text-[#bfe0ff]"
                          }`}
                        >
                          {rowName}
                        </Link>
                      ) : (
                        <span
                          className={
                            isSelected ? "font-semibold text-white" : undefined
                          }
                        >
                          {rowName}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        {logoPath ? (
                          <Image
                            src={logoPath}
                            alt={row.team_name ?? ""}
                            width={16}
                            height={16}
                            className="h-4 w-4 shrink-0 object-contain"
                          />
                        ) : null}
                        {teamHref ? (
                          <Link
                            href={teamHref}
                            className="text-white/70 transition hover:text-white hover:underline"
                          >
                            {row.team_name}
                          </Link>
                        ) : (
                          <span>{row.team_name ?? "—"}</span>
                        )}
                      </span>
                    </td>
                    {showPer90 ? (
                      <td className="px-4 py-2 font-medium">
                        {formatRateValue(row.per90_value, row.value_format)}
                      </td>
                    ) : null}
                    {showPerMatch ? (
                      <td className="px-4 py-2">
                        {formatRateValue(row.per_match_value, row.value_format)}
                      </td>
                    ) : null}
                    {showTotal ? (
                      <td className="px-4 py-2">
                        {formatMetricValue(row.total_value, row.value_format)}
                      </td>
                    ) : null}
                    {showVsAvg ? (
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
                    ) : null}
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
