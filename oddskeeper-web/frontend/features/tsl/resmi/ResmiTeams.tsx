import { getT } from "@/lib/i18n/server";
import type { ResmiTeamsBundle } from "@/features/tsl/server/resmiLoaders";
import ResmiTeamBoard, { type MetricLite, type TeamLite } from "./ResmiTeamBoard";
import { PlayerFace, PlayerNameLink } from "./parts";

const CATEGORY_LABELS: Record<string, string> = {
  attacking: "Hücum",
  build_up: "Oyun Kurma",
  defending: "Savunma",
  discipline: "Disiplin",
};

export default async function ResmiTeams({ data }: { data: ResmiTeamsBundle }) {
  const t = await getT();
  const { standings, teamMetrics, aggression, transfers, teamSlugById } = data;

  if (!standings.length) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  const teams: TeamLite[] = standings.map((s) => ({
    id: s.teamId,
    name: s.teamName,
    logo: s.logo,
    slug: teamSlugById[s.teamId] ?? null,
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

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      {/* Kompakt takim metrikleri */}
      <div>
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
          {t("tsl.sectionTeams")}
        </h2>
        <ResmiTeamBoard teams={teams} metrics={metrics} />
      </div>

      {/* Transferler */}
      <div>
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
          {t("tsl.transfers")}
        </h2>
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          {transfers.length ? (
            <div className="divide-y divide-line/60">
              {transfers.map((tr, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                  <PlayerFace photo={tr.photo} name={tr.playerName} size={30} />
                  <div className="min-w-0 flex-1">
                    <PlayerNameLink
                      name={tr.playerName}
                      slug={tr.playerSlug}
                      className="block truncate text-[12px] font-medium text-ink"
                    />
                    <div className="flex items-center gap-1 text-[10px] text-ink-3">
                      <TransferClub name={tr.fromName} logo={tr.fromLogo} />
                      <span className="text-ink-3">→</span>
                      <TransferClub name={tr.toName} logo={tr.toLogo} />
                    </div>
                  </div>
                  <span className="shrink-0 text-right text-[12px] font-bold tabular-nums text-accent-ink">
                    {tr.feeEur ? formatFee(tr.feeEur) : tr.feeText ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-10 text-center text-[12px] text-ink-3">{t("tsl.noData")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TransferClub({ name, logo }: { name: string | null; logo: string | null }) {
  return (
    <span className="inline-flex max-w-[90px] items-center gap-1 truncate">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" loading="lazy" />
      ) : null}
      <span className="truncate">{name ?? "—"}</span>
    </span>
  );
}

function formatFee(eur: number): string {
  if (eur >= 1_000_000) {
    const m = eur / 1_000_000;
    return `€${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (eur >= 1000) return `€${Math.round(eur / 1000)}K`;
  return `€${eur}`;
}
