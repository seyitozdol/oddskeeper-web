import { getT } from "@/lib/i18n/server";
import type { ResmiTeamsBundle } from "@/features/tsl/server/resmiLoaders";
import ResmiTeamBoard, { type MetricLite, type TeamLite } from "./ResmiTeamBoard";

const CATEGORY_LABELS: Record<string, string> = {
  attacking: "Hücum",
  build_up: "Oyun Kurma",
  defending: "Savunma",
  discipline: "Disiplin",
};

export default async function ResmiTeams({ data }: { data: ResmiTeamsBundle }) {
  const t = await getT();
  const { standings, teamMetrics, aggression, teamHrefById } = data;

  // Transferler artik ayri sekmede. Takim istatistigi yoksa (ör. sezon basi) veri yok.
  const hasBoard = standings.length > 0;
  if (!hasBoard) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  const teams: TeamLite[] = standings.map((s) => ({
    id: s.teamId,
    name: s.teamName,
    logo: s.logo,
    href: teamHrefById[s.teamId] ?? null,
  }));
  // Metrikleri metricKey bazinda grupla
  const metricMap = new Map<string, MetricLite>();
  for (const m of teamMetrics) {
    if (!metricMap.has(m.metricKey)) {
      metricMap.set(m.metricKey, {
        key: m.metricKey,
        label: m.metricLabel,
        category: m.categoryKey ?? "other",
        categoryLabel: CATEGORY_LABELS[m.categoryKey ?? ""] ?? m.categoryKey ?? "",
        isHigherBetter: m.isHigherBetter,
        format: m.valueFormat,
        leagueAvg: m.leagueAvg,
        values: {},
      });
    }
    metricMap.get(m.metricKey)!.values[m.teamId] = { total: m.total, perMatch: m.perMatch };
  }

  // Agresyon (sari+kirmizi) sentetik metrik
  const aggTotals: number[] = [];
  const aggValues: MetricLite["values"] = {};
  for (const s of standings) {
    const a = aggression[s.teamId];
    const total = a?.total ?? null;
    if (total != null) aggTotals.push(total);
    aggValues[s.teamId] = {
      total,
      perMatch: total != null && s.played ? total / s.played : null,
    };
  }
  const aggAvg = aggTotals.length ? aggTotals.reduce((x, y) => x + y, 0) / aggTotals.length : null;
  metricMap.set("aggression", {
    key: "aggression",
    label: t("tsl.aggression"),
    category: "discipline",
    categoryLabel: CATEGORY_LABELS.discipline,
    isHigherBetter: false,
    format: "count",
    leagueAvg: aggAvg,
    values: aggValues,
  });

  const metrics = [...metricMap.values()];

  return <ResmiTeamBoard teams={teams} metrics={metrics} />;
}
