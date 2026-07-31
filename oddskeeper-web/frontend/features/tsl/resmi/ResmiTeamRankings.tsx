import { getT } from "@/lib/i18n/server";
import MetricSelect from "@/components/rankings/MetricSelect";
import SortableRankingTable, {
  type RankingColumn,
  type RankingRow,
} from "@/components/rankings/SortableRankingTable";
import { RESMI_BASE_PATH } from "@/features/tsl/constants";
import { formatMetric } from "@/features/tsl/lib";
import type { ResmiTeamRankingsBundle } from "@/features/tsl/server/resmiLoaders";
import TeamCrest from "@/features/tsl/shared/TeamCrest";
import { TeamNameLink } from "./parts";

export default async function ResmiTeamRankings({
  data,
}: {
  data: ResmiTeamRankingsBundle;
}) {
  const t = await getT();
  const { catalog, metricKey, metricLabel, rows, metaById, teamSlugById, season } = data;

  const higher = rows[0]?.isHigherBetter ?? true;
  const ranked = rows
    .filter((r) => r.total != null)
    .slice()
    .sort((a, b) => (higher ? (b.total ?? 0) - (a.total ?? 0) : (a.total ?? 0) - (b.total ?? 0)));

  const showPerMatch = ranked.some((r) => r.perMatch != null);
  const showVsAvg = ranked.some((r) => r.vsAvgPct != null);

  const columns: RankingColumn[] = [
    { id: "rank", label: t("tsl.rank"), defaultDir: "asc" },
    { id: "team", label: t("tsl.team"), defaultDir: "asc" },
    { id: "total", label: t("tsl.basisTotal"), defaultDir: "desc" },
    ...(showPerMatch ? [{ id: "perMatch", label: t("tsl.basisPerMatch"), defaultDir: "desc" as const }] : []),
    ...(showVsAvg ? [{ id: "vsAvg", label: t("tsl.vsAvg"), defaultDir: "desc" as const }] : []),
  ];

  const tableRows: RankingRow[] = ranked.map((r, i) => {
    const id = r.teamId ?? "";
    const logo = metaById[id]?.logo ?? null;
    const slug = teamSlugById[id] ?? null;
    const cells = [
      <span key="rank" className="font-semibold">{i + 1}</span>,
      <span key="team" className="inline-flex items-center gap-2">
        <TeamCrest logo={logo} name={r.teamName} size="sm" />
        <TeamNameLink name={r.teamName} slug={slug} className="font-medium text-ink" />
      </span>,
      <span key="total" className="font-semibold text-ink">{formatMetric(r.total, r.valueFormat)}</span>,
      ...(showPerMatch ? [<span key="perMatch">{formatMetric(r.perMatch, "decimal")}</span>] : []),
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
      r.teamName,
      r.total,
      ...(showPerMatch ? [r.perMatch] : []),
      ...(showVsAvg ? [r.vsAvgPct] : []),
    ];
    return { id: `${id}-${i}`, cells, sortValues };
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">
            {t("tsl.sectionTeamRankings")} · {season}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{metricLabel}</h1>
        </div>
        {catalog.length ? (
          <MetricSelect
            options={catalog}
            selectedKey={metricKey}
            basePath={RESMI_BASE_PATH}
            baseParams={{ season, section: "teamRankings" }}
          />
        ) : null}
      </div>

      {tableRows.length ? (
        <div className="rounded-2xl border border-line">
          <SortableRankingTable columns={columns} rows={tableRows} initialSortIndex={0} initialSortDir="asc" />
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-card py-16 text-center text-sm text-ink-3">
          {t("tsl.noData")}
        </p>
      )}
    </section>
  );
}
