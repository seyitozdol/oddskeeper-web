import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getPlayerDetailHref } from "@/lib/routes";
import type { ResmiTeamsBundle } from "@/features/tsl/server/resmiLoaders";
import ResmiTeamBoard, { type MetricLite, type TeamLite } from "./ResmiTeamBoard";
import { PlayerFace, PlayerNameLink } from "./parts";
import TransferLogo from "./TransferLogo";

const CATEGORY_LABELS: Record<string, string> = {
  attacking: "Hücum",
  build_up: "Oyun Kurma",
  defending: "Savunma",
  discipline: "Disiplin",
};

export default async function ResmiTeams({ data }: { data: ResmiTeamsBundle }) {
  const t = await getT();
  const { standings, teamMetrics, aggression, transfers, teamHrefById } = data;

  // Sezon başlamadıysa (26/27) takım istatistiği yok ama transferler var.
  const hasBoard = standings.length > 0;
  if (!hasBoard && !transfers.length) {
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

  return (
    <div className={hasBoard ? "grid gap-5 lg:grid-cols-[1fr_1fr]" : "mx-auto max-w-3xl"}>
      {/* Kompakt takim metrikleri (sadece veri varken) */}
      {hasBoard ? (
        <div>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
            {t("tsl.sectionTeams")}
          </h2>
          <ResmiTeamBoard teams={teams} metrics={metrics} />
        </div>
      ) : null}

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
                      href={tr.playerSlug ? getPlayerDetailHref(tr.playerSlug) : null}
                      className="block truncate text-[12px] font-medium text-ink"
                    />
                    <div className="flex items-center gap-1 text-[10px] text-ink-3">
                      <TransferClub name={tr.fromName} logo={tr.fromLogo} href={null} />
                      <span className="text-ink-3">→</span>
                      <TransferClub name={tr.toName} logo={tr.toLogo} href={tr.toHref} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[12px] font-bold tabular-nums text-accent-ink">
                      {tr.isLoan ? t("tsl.loan") : tr.feeEur ? formatFee(tr.feeEur) : tr.feeText ?? "—"}
                    </span>
                    {tr.isLoan ? (
                      <div className="text-[9px] uppercase tracking-[0.1em] text-ink-3">
                        {tr.feeEur ? formatFee(tr.feeEur) : ""}
                      </div>
                    ) : null}
                  </div>
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

function TransferClub({
  name,
  logo,
  href,
}: {
  name: string | null;
  logo: string | null;
  href: string | null;
}) {
  const inner = (
    <span className="inline-flex max-w-[90px] items-center gap-1 truncate">
      <TransferLogo logo={logo} name={name} />
      <span className="truncate">{name ?? "—"}</span>
    </span>
  );
  return href ? (
    <Link href={href} className="transition hover:text-ink hover:underline">
      {inner}
    </Link>
  ) : (
    inner
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
