import Link from "next/link";
import { notFound } from "next/navigation";
import { PLAYER_METRIC_META } from "@/features/player-detail/metricMeta";
import { getPlayerCurrentInfo } from "@/features/player-detail/server/getPlayerCurrentInfo";
import { getPlayerDetailedMetrics } from "@/features/player-detail/server/getPlayerDetailedMetrics";
import { getPlayerMetricLeaderboard } from "@/features/player-detail/server/getPlayerMetricLeaderboard";
import { getPlayerProfile } from "@/features/player-detail/server/getPlayerProfile";
import { getT } from "@/lib/i18n/server";
import { categoryLabel, metricLabel } from "@/lib/i18n/metricLabel";
import { formatMetricValue, formatRateValue } from "@/lib/metric-format";
import { getTeamDetailHref } from "@/lib/routes";

type PageProps = {
  searchParams?: Promise<{
    player?: string;
    metric?: string;
  }>;
};

const DEFAULT_METRIC = "goals_total";

export default async function PlayerMetricLeaderboardPage({
  searchParams,
}: PageProps) {
  const resolved = (await searchParams) ?? {};
  const playerSlug = resolved.player;

  if (!playerSlug) {
    notFound();
  }

  const [t, profile, currentInfo] = await Promise.all([
    getT(),
    getPlayerProfile(playerSlug),
    getPlayerCurrentInfo(playerSlug),
  ]);

  const detailedRows = await getPlayerDetailedMetrics(playerSlug, {
    seasonLabel: profile?.season_label ?? undefined,
  });

  const metricKey =
    detailedRows.find((row) => row.metric_key === resolved.metric)
      ?.metric_key ??
    detailedRows.find((row) => row.metric_key === DEFAULT_METRIC)?.metric_key ??
    detailedRows[0]?.metric_key ??
    resolved.metric ??
    null;

  const leaderboard = metricKey
    ? await getPlayerMetricLeaderboard({
        metricKey,
        seasonLabel: profile?.season_label ?? undefined,
        competition: profile?.competition ?? undefined,
      })
    : [];

  const playerSourceId = profile?.player_source_id ?? null;
  const selectedRow =
    leaderboard.find(
      (row) => String(row.player_source_id) === String(playerSourceId)
    ) ?? null;

  const rankedRows = leaderboard.filter((row) => row.league_rank !== null);
  const leaderRow = rankedRows[0] ?? null;

  const meta = metricKey ? PLAYER_METRIC_META[metricKey] : undefined;
  const metricTitle = metricLabel(
    t,
    metricKey,
    selectedRow?.metric_label ?? leaderRow?.metric_label
  );

  const displayName =
    [currentInfo?.first_name, currentInfo?.last_name].filter(Boolean).join(" ") ||
    currentInfo?.full_name ||
    profile?.player_name ||
    playerSlug;

  const gapToLeader =
    selectedRow?.per90_value != null && leaderRow?.per90_value != null
      ? Math.abs(leaderRow.per90_value - selectedRow.per90_value)
      : null;

  const backHref = `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(
    playerSlug
  )}&tab=detailed-stats`;

  const metricHref = (key: string) =>
    `/dashboard/stats-analysis/football/player-stats/metric?player=${encodeURIComponent(
      playerSlug
    )}&metric=${encodeURIComponent(key)}`;

  const optionsByCategory = new Map<
    string,
    { key: string; label: string }[]
  >();
  for (const row of detailedRows) {
    const catLabel = categoryLabel(t, row.category_key, row.category_label);
    if (!optionsByCategory.has(catLabel)) {
      optionsByCategory.set(catLabel, []);
    }
    optionsByCategory.get(catLabel)!.push({
      key: row.metric_key,
      label: metricLabel(t, row.metric_key, row.metric_label),
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

        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-[0.20em] text-white/40">
            {t("common.leagueRanking")}
            {profile?.season_label ? ` · ${profile.season_label}` : ""}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            {metricTitle}
          </h1>
          <div className="mt-1 text-sm text-white/55">{displayName}</div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {selectedRow ?? leaderRow ? (
            <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/70">
              {categoryLabel(
                t,
                (selectedRow ?? leaderRow)!.category_key,
                (selectedRow ?? leaderRow)!.category_label
              )}
            </span>
          ) : null}
          {selectedRow ?? leaderRow ? (
            <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/70">
              {(selectedRow ?? leaderRow)!.is_higher_better === false
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
            value={leaderRow?.player_name ?? "—"}
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
          <SummaryCard
            label={`${displayName} · ${t("common.rank")}`}
            value={
              selectedRow?.league_rank != null
                ? `#${selectedRow.league_rank}`
                : "—"
            }
            subvalue={
              selectedRow
                ? formatRateValue(
                    selectedRow.per90_value,
                    selectedRow.value_format
                  )
                : t("common.notQualified")
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
            subvalue={t("common.per90Label")}
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
                <th className="px-4 py-2.5 font-medium">{t("common.player")}</th>
                <th className="px-4 py-2.5 font-medium">{t("common.team")}</th>
                <th className="px-4 py-2.5 font-medium">
                  {t("common.per90Label")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("common.perMatchLabel")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("common.totalLabel")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("common.vsAvgLabel")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rankedRows.map((row, index) => {
                const isSelected =
                  String(row.player_source_id) === String(playerSourceId);
                const teamHref = getTeamDetailHref(row.team_slug);

                return (
                  <tr
                    key={`${row.player_source_id}-${row.team_slug}-${index}`}
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
                      <span
                        className={
                          isSelected ? "font-semibold text-white" : undefined
                        }
                      >
                        {row.player_name ?? "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
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
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {formatRateValue(row.per90_value, row.value_format)}
                    </td>
                    <td className="px-4 py-2">
                      {formatRateValue(row.per_match_value, row.value_format)}
                    </td>
                    <td className="px-4 py-2">
                      {formatMetricValue(row.total_value, row.value_format)}
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
