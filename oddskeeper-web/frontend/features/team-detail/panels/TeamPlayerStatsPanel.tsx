import { getT } from "@/lib/i18n/server";
import { categoryLabel, metricLabel } from "@/lib/i18n/metricLabel";
import MetricSelect from "@/components/rankings/MetricSelect";
import SortableRankingTable, {
  type RankingColumn,
  type RankingRow,
} from "@/components/rankings/SortableRankingTable";
import { SeasonSelect } from "../components/SeasonSelect";
import { formatMetric } from "@/features/tsl/lib";
import { Flag, PlayerFace, PlayerNameLink } from "@/features/tsl/resmi/parts";
import type { TeamPlayerStatsBundle } from "../server/getTeamPlayerStats";

// Takim-kapsamli oyuncu istatistikleri: secili metrige gore sirali liste,
// foto + bayrak + sezon/metrik secicileriyle (Player Rankings'in takim hali).
export default async function TeamPlayerStatsPanel({
  teamSlug,
  data,
}: {
  teamSlug: string;
  data: TeamPlayerStatsBundle;
}) {
  const t = await getT();
  const { season, seasons, catalog, metricKey, metric, rows } = data;

  const options = catalog.map((c) => ({
    key: c.metricKey,
    label: metricLabel(t, c.metricKey, c.metricLabel),
    category: categoryLabel(t, c.categoryKey, c.categoryLabel),
  }));

  const higher = metric?.isHigherBetter ?? true;
  const ranked = rows
    .filter((r) => r.total != null)
    .slice()
    .sort((a, b) => (higher ? (b.total ?? 0) - (a.total ?? 0) : (a.total ?? 0) - (b.total ?? 0)));

  const showMatches = ranked.some((r) => r.matches != null);
  const showPerMatch = ranked.some((r) => r.perMatch != null);
  const showPer90 = ranked.some((r) => r.per90 != null);

  const columns: RankingColumn[] = [
    { id: "rank", label: t("tsl.rank"), defaultDir: "asc" },
    { id: "player", label: t("tsl.player"), defaultDir: "asc" },
    ...(showMatches ? [{ id: "matches", label: t("tsl.appearances"), defaultDir: "desc" as const }] : []),
    { id: "total", label: t("tsl.basisTotal"), defaultDir: "desc" },
    ...(showPerMatch ? [{ id: "perMatch", label: t("tsl.basisPerMatch"), defaultDir: "desc" as const }] : []),
    ...(showPer90 ? [{ id: "per90", label: t("tsl.basisPer90"), defaultDir: "desc" as const }] : []),
  ];

  const tableRows: RankingRow[] = ranked.map((r, i) => ({
    id: `${r.playerId}-${i}`,
    cells: [
      <span key="rank" className="font-semibold">{i + 1}</span>,
      <span key="player" className="flex items-center gap-2">
        <PlayerFace photo={r.photo} name={r.playerName} size={26} />
        <PlayerNameLink
          name={r.playerName}
          href={r.href}
          className="font-medium text-accent-ink hover:text-accent"
        />
        <Flag nationality={r.nationality} />
      </span>,
      ...(showMatches
        ? [<span key="matches" className="tabular-nums text-ink-2">{r.matches ?? "—"}</span>]
        : []),
      <span key="total" className="font-semibold text-ink">{formatMetric(r.total, r.valueFormat)}</span>,
      ...(showPerMatch ? [<span key="perMatch" className="tabular-nums">{formatMetric(r.perMatch, "decimal")}</span>] : []),
      ...(showPer90 ? [<span key="per90">{formatMetric(r.per90, "decimal")}</span>] : []),
    ],
    sortValues: [
      i + 1,
      r.playerName,
      ...(showMatches ? [r.matches] : []),
      r.total,
      ...(showPerMatch ? [r.perMatch] : []),
      ...(showPer90 ? [r.per90] : []),
    ],
    searchText: r.playerName,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MetricSelect
          options={options}
          selectedKey={metricKey}
          basePath="/dashboard/stats-analysis/football/team-stats/detail"
          baseParams={{ team: teamSlug, tab: "player-stats", season }}
        />
        <SeasonSelect
          teamSlug={teamSlug}
          tab="player-stats"
          seasons={seasons}
          selectedSeason={season}
          extraParams={{ metric: metricKey }}
        />
      </div>

      {tableRows.length ? (
        <div className="rounded-2xl border border-line">
          <SortableRankingTable
            columns={columns}
            rows={tableRows}
            initialSortIndex={0}
            initialSortDir="asc"
            searchPlaceholder={t("tsl.searchPlaceholder")}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-veil px-4 py-6 text-center text-sm text-ink-2">
          {t("tsl.noData")}
        </div>
      )}
    </div>
  );
}
