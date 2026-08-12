import { getT } from "@/lib/i18n/server";
import { categoryLabel, metricLabel } from "@/lib/i18n/metricLabel";
import MetricSelect from "@/components/rankings/MetricSelect";
import SortableRankingTable, {
  type RankingColumn,
  type RankingRow,
} from "@/components/rankings/SortableRankingTable";
import { formatMetric } from "@/features/tsl/lib";
import type { ResmiPlayerRankingsBundle } from "@/features/tsl/server/resmiLoaders";
import { Flag, PlayerFace, PlayerNameLink, TeamNameLink } from "./parts";
import TeamCrest from "@/features/tsl/shared/TeamCrest";

export default async function ResmiPlayerRankings({
  data,
}: {
  data: ResmiPlayerRankingsBundle;
}) {
  const t = await getT();
  const {
    catalog, metricKey, metric, rows, playerHrefById, teamHrefById, basePath, season,
    photoById, nationalityById, teamLogoById,
  } = data;

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

  const showMatches = ranked.some((r) => r.matches != null);
  const showPerMatch = ranked.some((r) => r.perMatch != null);
  const showPer90 = ranked.some((r) => r.per90 != null);
  const showVsAvg = ranked.some((r) => r.vsAvgPct != null);

  const columns: RankingColumn[] = [
    { id: "rank", label: t("tsl.rank"), defaultDir: "asc" },
    { id: "player", label: t("tsl.player"), defaultDir: "asc" },
    { id: "team", label: t("tsl.team"), defaultDir: "asc" },
    ...(showMatches ? [{ id: "matches", label: t("tsl.appearances"), defaultDir: "desc" as const }] : []),
    { id: "total", label: t("tsl.basisTotal"), defaultDir: "desc" },
    ...(showPerMatch ? [{ id: "perMatch", label: t("tsl.basisPerMatch"), defaultDir: "desc" as const }] : []),
    ...(showPer90 ? [{ id: "per90", label: t("tsl.basisPer90"), defaultDir: "desc" as const }] : []),
    ...(showVsAvg ? [{ id: "vsAvg", label: t("tsl.vsAvg"), defaultDir: "desc" as const }] : []),
  ];

  const tableRows: RankingRow[] = ranked.map((r, i) => {
    const cells = [
      <span key="rank" className="font-semibold">{i + 1}</span>,
      <span key="player" className="flex items-center gap-2">
        <PlayerFace photo={photoById[r.playerId] ?? null} name={r.playerName} size={26} />
        <PlayerNameLink
          name={r.playerName}
          href={playerHrefById[r.playerId] ?? null}
          className="font-medium text-accent-ink hover:text-accent"
        />
        <Flag nationality={nationalityById[r.playerId] ?? null} />
      </span>,
      <span key="team" className="flex items-center gap-1.5">
        <TeamCrest logo={r.teamId ? teamLogoById[r.teamId] ?? null : null} name={r.teamName} size="xs" />
        <TeamNameLink name={r.teamName} href={r.teamId ? teamHrefById[r.teamId] ?? null : null} className="text-ink-2" />
      </span>,
      ...(showMatches ? [<span key="matches" className="tabular-nums text-ink-2">{r.matches ?? "—"}</span>] : []),
      <span key="total" className="font-semibold text-ink">{formatMetric(r.total, r.valueFormat)}</span>,
      ...(showPerMatch ? [<span key="perMatch" className="tabular-nums">{formatMetric(r.perMatch, "decimal")}</span>] : []),
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
      ...(showMatches ? [r.matches] : []),
      r.total,
      ...(showPerMatch ? [r.perMatch] : []),
      ...(showPer90 ? [r.per90] : []),
      ...(showVsAvg ? [r.vsAvgPct] : []),
    ];
    return {
      id: `${r.playerId}-${i}`,
      cells,
      sortValues,
      searchText: `${r.playerName} ${r.teamName}`,
    };
  });

  return (
    <section className="space-y-3">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">
          {t("tsl.sectionPlayerRankings")} · {season}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{title}</h1>
      </div>

      {/* Metrik seçici sekmelerin/başlığın hemen altında (çok metrik → dropdown) */}
      {options.length ? (
        <div className="rounded-xl border border-line bg-card px-3 py-2">
          <MetricSelect
            options={options}
            selectedKey={metricKey}
            basePath={basePath}
            baseParams={{ season, section: "playerRankings" }}
          />
        </div>
      ) : null}

      <div className="rounded-2xl border border-line">
        <SortableRankingTable
          columns={columns}
          rows={tableRows}
          initialSortIndex={0}
          initialSortDir="asc"
          searchPlaceholder={t("tsl.searchPlaceholder")}
        />
      </div>
    </section>
  );
}
