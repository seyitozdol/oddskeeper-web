import { getT } from "@/lib/i18n/server";
import type { LeagueBundle } from "@/features/tsl/server/loaders";
import { formatSigned } from "@/features/tsl/lib";
import TeamCrest from "@/features/tsl/shared/TeamCrest";

export default async function PanelLeague({ data }: { data: LeagueBundle }) {
  const t = await getT();
  const { standings, summary, teamMetrics } = data;

  if (!standings.length) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  // xG (attigi) haritasi
  const xgFor = new Map<string, number>();
  for (const m of teamMetrics) {
    if (m.metricKey === "team_expected_goals") xgFor.set(m.teamId, m.total ?? 0);
  }

  const kpis = [
    { label: t("tsl.team"), value: summary.teams.toString() },
    { label: t("tsl.matches"), value: summary.matchesPlayed.toString() },
    { label: t("tsl.goals"), value: summary.totalGoals.toString() },
    { label: t("tsl.goalsPerMatch"), value: summary.goalsPerMatch.toFixed(2) },
    { label: t("tsl.homeWin"), value: `${summary.homeWinPct}%` },
    { label: t("tsl.awayWin"), value: `${summary.awayWinPct}%` },
  ];

  const maxPts = Math.max(...standings.map((s) => s.points), 1);

  // En iyi bitiriciler (gol - xG)
  const finishing = standings
    .map((s) => ({ s, over: s.goalsFor - (xgFor.get(s.teamId) ?? s.goalsFor) }))
    .sort((a, b) => b.over - a.over)
    .slice(0, 5);

  return (
    <div className="space-y-5">
      {/* KPI seridi */}
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-line bg-card px-4 py-3">
            <div className="font-mono text-[22px] font-bold tabular-nums text-ink">{k.value}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-ink-3">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Analitik puan tablosu */}
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] font-mono text-[12px]">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.06em] text-ink-3">
                  <th className="py-2 pl-3 text-left font-medium">{t("tsl.rank")}</th>
                  <th className="px-1 py-2 text-left font-medium">{t("tsl.team")}</th>
                  <Th>{t("tsl.played")}</Th>
                  <Th>{t("tsl.goalsFor")}</Th>
                  <Th>{t("tsl.goalsAgainst")}</Th>
                  <Th>xG</Th>
                  <Th>xG±</Th>
                  <Th>{t("tsl.ppg")}</Th>
                  <th className="px-2 py-2 text-right font-semibold text-ink-2">{t("tsl.points")}</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((r, i) => {
                  const xg = xgFor.get(r.teamId);
                  const over = xg != null ? r.goalsFor - xg : null;
                  return (
                    <tr key={r.teamId} className={`${i % 2 ? "bg-veil/40" : ""} border-b border-line/50 last:border-0`}>
                      <td className="py-1.5 pl-3 text-left font-bold text-ink-3">{r.rank}</td>
                      <td className="px-1 py-1.5">
                        <div className="flex items-center gap-2">
                          <TeamCrest logo={r.logo} name={r.teamName} size="xs" />
                          <span className="truncate font-sans text-[12px] font-medium text-ink">{r.teamName}</span>
                        </div>
                      </td>
                      <Td>{r.played}</Td>
                      <Td>{r.goalsFor}</Td>
                      <Td>{r.goalsAgainst}</Td>
                      <Td>{xg != null ? xg.toFixed(1) : "—"}</Td>
                      <td className={`px-2 py-1.5 text-center tabular-nums ${over == null ? "text-ink-3" : over >= 0 ? "text-pos" : "text-neg"}`}>
                        {over == null ? "—" : formatSigned(over)}
                      </td>
                      <Td>{r.ppg.toFixed(2)}</Td>
                      <td className="px-2 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-veil sm:block">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${(r.points / maxPts) * 100}%` }} />
                          </div>
                          <span className="w-6 text-right font-bold text-ink">{r.points}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Yan panel: sonuc dagilimi + en iyi bitiriciler */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-card p-4">
            <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3">
              {t("tsl.homeWin")} · {t("tsl.draw")} · {t("tsl.awayWin")}
            </h3>
            <OutcomeDonut home={summary.homeWinPct} draw={summary.drawPct} away={summary.awayWinPct} t={t} />
          </div>

          <div className="rounded-2xl border border-line bg-card p-4">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3">xG±</h3>
            <div className="space-y-1.5">
              {finishing.map(({ s, over }) => (
                <div key={s.teamId} className="flex items-center gap-2 text-[12px]">
                  <TeamCrest logo={s.logo} name={s.teamName} size="xs" />
                  <span className="flex-1 truncate text-ink-2">{s.teamName}</span>
                  <span className="font-mono font-bold tabular-nums text-pos">{formatSigned(over)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-2 text-center font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5 text-center tabular-nums text-ink-2">{children}</td>;
}

function OutcomeDonut({
  home,
  draw,
  away,
  t,
}: {
  home: number;
  draw: number;
  away: number;
  t: (k: string) => string;
}) {
  const total = home + draw + away || 1;
  const segs = [
    { v: home, color: "var(--accent)", label: t("tsl.home") },
    { v: draw, color: "var(--ink-3)", label: t("tsl.draw") },
    { v: away, color: "var(--pos)", label: t("tsl.away") },
  ];
  const C = 2 * Math.PI * 15.5;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 40 40" className="h-24 w-24 -rotate-90">
        {segs.map((s, i) => {
          const frac = s.v / total;
          const dash = frac * C;
          const el = (
            <circle
              key={i}
              cx="20" cy="20" r="15.5"
              fill="none"
              stroke={s.color}
              strokeWidth="7"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="space-y-1.5">
        {segs.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-ink-2">{s.label}</span>
            <span className="font-mono font-bold tabular-nums text-ink">{s.v}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
