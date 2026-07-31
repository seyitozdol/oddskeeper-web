import { getT } from "@/lib/i18n/server";
import type { PlayersBundle } from "@/features/tsl/server/loaders";
import { formatMetric } from "@/features/tsl/lib";
import TslMetricNav from "@/features/tsl/shared/TslMetricNav";
import XgScatter from "./XgScatter";

export default async function PanelPlayers({ data }: { data: PlayersBundle }) {
  const t = await getT();
  const { catalog, metricKey, metric, rows, scatterGoals, scatterXg } = data;

  if (!catalog.length) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  // xG vs Gol sacilim verisi
  const xgMap = new Map(scatterXg.map((r) => [r.playerId, r.total ?? 0]));
  const points = scatterGoals
    .map((r) => ({
      id: r.playerId,
      name: r.playerName,
      team: r.teamName ?? "",
      goals: r.total ?? 0,
      xg: xgMap.get(r.playerId) ?? 0,
    }))
    .filter((p) => p.goals >= 3 || p.xg >= 3);

  // Secili metrik icin analitik tablo (lig ortalamasi referansli)
  const higher = metric?.isHigherBetter ?? true;
  const ranked = rows
    .slice()
    .sort((a, b) => {
      const av = a.total ?? 0;
      const bv = b.total ?? 0;
      return higher ? bv - av : av - bv;
    })
    .slice(0, 20);
  const maxV = Math.max(1, ...ranked.map((r) => Math.abs(r.total ?? 0)));
  const avg = ranked.find((r) => r.leagueAvg != null)?.leagueAvg ?? null;

  return (
    <div className="space-y-5">
      {/* Sacilim: xG vs Gol */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-ink">xG → {t("tsl.goals")}</h2>
          <span className="text-[11px] text-ink-3">
            {t("tsl.higherBetter")} · {t("tsl.topScorer")}
          </span>
        </div>
        <XgScatter points={points} labels={{ x: "xG", y: t("tsl.goals") }} />
      </div>

      {/* Metrik secici + analitik tablo */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-3">{metric?.categoryLabel}</p>
            <h2 className="text-[18px] font-semibold text-ink">{metric?.metricLabel}</h2>
          </div>
          {avg != null ? (
            <span className="font-mono text-[12px] text-ink-3">
              {t("tsl.leagueAvg")}: {formatMetric(avg, metric?.valueFormat ?? "count")}
            </span>
          ) : null}
        </div>
        <TslMetricNav catalog={catalog} metricKey={metricKey} />

        <div className="mt-4 space-y-1">
          {ranked.map((r, i) => {
            const val = r.total ?? 0;
            const pct = Math.max(3, Math.round((Math.abs(val) / maxV) * 100));
            const avgPct = avg != null ? Math.round((avg / maxV) * 100) : null;
            return (
              <div key={r.playerId} className="flex items-center gap-3 py-1">
                <span className="w-5 text-right font-mono text-[11px] font-bold text-ink-3">{i + 1}</span>
                <span className="w-36 shrink-0 truncate text-[13px] text-ink sm:w-44">{r.playerName}</span>
                <span className="hidden w-24 shrink-0 truncate text-[11px] text-ink-3 md:block">{r.teamName}</span>
                <div className="relative h-4 flex-1 overflow-hidden rounded bg-veil">
                  <div className="h-full rounded bg-accent/80" style={{ width: `${pct}%` }} />
                  {avgPct != null ? (
                    <div
                      className="absolute top-0 h-full w-px bg-ink-2"
                      style={{ left: `${Math.min(100, avgPct)}%` }}
                      title={String(avg)}
                    />
                  ) : null}
                </div>
                <span className="w-14 text-right font-mono text-[13px] font-bold tabular-nums text-ink">
                  {formatMetric(val, r.valueFormat)}
                </span>
                {r.vsAvgPct != null ? (
                  <span className={`hidden w-12 text-right font-mono text-[11px] tabular-nums sm:block ${r.vsAvgPct >= 0 ? "text-pos" : "text-neg"}`}>
                    {r.vsAvgPct >= 0 ? "+" : ""}
                    {Math.round(r.vsAvgPct)}%
                  </span>
                ) : (
                  <span className="hidden w-12 sm:block" />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-ink-3">
          <span className="mr-1 inline-block h-2.5 w-px bg-ink-2 align-middle" /> {t("tsl.leagueAvg")}
        </p>
      </div>
    </div>
  );
}
