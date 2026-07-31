import { getT } from "@/lib/i18n/server";
import { categoryLabel, metricLabel } from "@/lib/i18n/metricLabel";
import MetricSelect from "@/components/rankings/MetricSelect";
import SortableRankingTable, {
  type RankingColumn,
  type RankingRow,
} from "@/components/rankings/SortableRankingTable";
import { formatMetric } from "@/features/tsl/lib";
import type { ResmiPlayerRankingsBundle } from "@/features/tsl/server/resmiLoaders";
import { PlayerNameLink, TeamNameLink } from "./parts";

export default async function ResmiPlayerRankings({
  data,
}: {
  data: ResmiPlayerRankingsBundle;
}) {
  const t = await getT();
  const { catalog, metricKey, metric, rows, playerHrefById, teamHrefById, basePath, season } = data;

  const options = catalog.map((c) => ({
    key: c.metricKey,
    label: metricLabel(t, c.metricKey, c.metricLabel),
    category: categoryLabel(t, c.categoryKey, c.categoryLabel),
  }));
  const title = metricLabel(t, metricKey, metric?.metricLabel);

  // Siralama: her zaman TOPLAM degere gore (gol krali = toplam gol).
  const higher = metric?.isHigherBetter ?? true;
  const ranked = rows
    .filter((r) => r.total != null)
    .slice()
    .sort((a, b) => (higher ? (b.total ?? 0) - (a.total ?? 0) : (a.total ?? 0) - (b.total ?? 0)));

  const showPer90 = ranked.some((r) => r.per90 != null);
  const showVsAvg = ranked.some((r) => r.vsAvgPct != null);

  const columns: RankingColumn[] = [
    { id: "rank", label: t("tsl.rank"), defaultDir: "asc" },
    { id: "player", label: t("tsl.player"), defaultDir: "asc" },
    { id: "team", label: t("tsl.team"), defaultDir: "asc" },
    { id: "total", label: t("tsl.basisTotal"), defaultDir: "desc" },
    ...(showPer90 ? [{ id: "per90", label: t("tsl.basisPer90"), defaultDir: "desc" as const }] : []),
    ...(showVsAvg ? [{ id: "vsAvg", label: t("tsl.vsAvg"), defaultDir: "desc" as const }] : []),
  ];

  const tableRows: RankingRow[] = ranked.map((r, i) => {
    const cells = [
      <span key="rank" className="font-semibold">{i + 1}</span>,
      <PlayerNameLink
        key="player"
        name={r.playerName}
        href={playerHrefById[r.playerId] ?? null}
        className="font-medium text-accent-ink hover:text-accent"
      />,
      <TeamNameLink key="team" name={r.teamName} href={r.teamId ? teamHrefById[r.teamId] ?? null : null} className="text-ink-2" />,
      <span key="total" className="font-semibold text-ink">{formatMetric(r.total, r.valueFormat)}</span>,
      ...(showPer90 ? [<span key="per90">{formatMetric(r.per90, "decimal")}</span>] : []),
      ...(showVsAvg
        ? [
            <span
              key="vsAvg"
              className={r.vsAvgPct == null ? "text-ink-2" : r.vsAvgPct >= 0 ? "text-pos" : "text-neg"}
            >
              {r.vsAvgPct == null ? "—" : `${r.vsAvgPct >= 0 ? "+" : ""}${Math.round(r.vsAvgPct)}%`}
            </span>,
          ]
        : []),
    ];
    const sortValues: (number | string | null)[] = [
      i + 1,
      r.playerName,
      r.teamName,
      r.total,
      ...(showPer90 ? [r.per90] : []),
      ...(showVsAvg ? [r.vsAvgPct] : []),
    ];
    return { id: `${r.playerId}-${i}`, cells, sortValues };
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">
            {t("tsl.sectionPlayerRankings")} · {season}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{title}</h1>
        </div>
        {options.length ? (
          <MetricSelect
            options={options}
            selectedKey={metricKey}
            basePath={basePath}
            baseParams={{ season, section: "playerRankings" }}
          />
        ) : null}
      </div>

      <div className="rounded-2xl border border-line">
        <SortableRankingTable columns={columns} rows={tableRows} initialSortIndex={0} initialSortDir="asc" />
      </div>
    </section>
  );
}
