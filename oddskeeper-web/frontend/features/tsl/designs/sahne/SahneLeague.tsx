import { getLocale, getT } from "@/lib/i18n/server";
import type { LeagueBundle } from "@/features/tsl/server/loaders";
import { standingsZone } from "@/features/tsl/constants";
import { formatDate, formatMetric } from "@/features/tsl/lib";
import TeamCrest from "@/features/tsl/shared/TeamCrest";
import FormPills from "@/features/tsl/shared/FormPills";

export default async function SahneLeague({ data }: { data: LeagueBundle }) {
  const t = await getT();
  const locale = await getLocale();
  const { standings, summary, leaders, matches } = data;

  if (!standings.length) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  const total = standings.length;
  const kpis = [
    { label: t("tsl.matches"), value: summary.matchesPlayed.toString() },
    { label: t("tsl.goals"), value: summary.totalGoals.toLocaleString("tr-TR") },
    { label: t("tsl.goalsPerMatch"), value: summary.goalsPerMatch.toFixed(2) },
    { label: t("tsl.homeWin"), value: `${summary.homeWinPct}%` },
    { label: t("tsl.draw"), value: `${summary.drawPct}%` },
    { label: t("tsl.awayWin"), value: `${summary.awayWinPct}%` },
  ];

  const recent = matches.slice(0, 12);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {/* Ana kolon: ozet + puan durumu */}
      <div className="space-y-5">
        {/* Ozet seridi */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-line bg-card px-3 py-2.5">
              <div className="text-[16px] font-bold tabular-nums text-ink">{k.value}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-ink-3">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Puan durumu tablosu */}
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
              {t("tsl.standings")}
            </h2>
            <div className="flex items-center gap-3 text-[10px] text-ink-3">
              <Legend color="bg-accent" label={t("tsl.champion")} />
              <Legend color="bg-accent/40" label={t("tsl.europe")} />
              <Legend color="bg-neg" label={t("tsl.relegation")} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.08em] text-ink-3">
                  <th className="py-2 pl-3 pr-1 text-left font-medium">{t("tsl.rank")}</th>
                  <th className="px-1 py-2 text-left font-medium">{t("tsl.team")}</th>
                  <Th>{t("tsl.played")}</Th>
                  <Th>{t("tsl.won")}</Th>
                  <Th>{t("tsl.drawn")}</Th>
                  <Th>{t("tsl.lost")}</Th>
                  <Th>{t("tsl.goalsFor")}</Th>
                  <Th>{t("tsl.goalsAgainst")}</Th>
                  <Th>{t("tsl.goalDiff")}</Th>
                  <th className="hidden px-2 py-2 text-left font-medium md:table-cell">{t("tsl.form")}</th>
                  <th className="px-2 py-2 text-right font-semibold text-ink-2">{t("tsl.points")}</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((r, i) => {
                  const zone = standingsZone(r.rank, total);
                  const band =
                    zone === "champion"
                      ? "border-l-2 border-l-accent"
                      : zone === "europe"
                        ? "border-l-2 border-l-accent/40"
                        : zone === "relegation"
                          ? "border-l-2 border-l-neg"
                          : "border-l-2 border-l-transparent";
                  return (
                    <tr
                      key={r.teamId}
                      className={`${band} ${i % 2 ? "bg-veil/40" : ""} border-b border-line/60 last:border-0`}
                    >
                      <td className="py-2 pl-3 pr-1 text-left text-[12px] font-bold tabular-nums text-ink-2">
                        {r.rank}
                      </td>
                      <td className="px-1 py-2">
                        <div className="flex items-center gap-2">
                          <TeamCrest logo={r.logo} name={r.teamName} size="sm" />
                          <span className="truncate font-medium text-ink">{r.teamName}</span>
                        </div>
                      </td>
                      <Td>{r.played}</Td>
                      <Td className="text-pos">{r.wins}</Td>
                      <Td>{r.draws}</Td>
                      <Td className="text-neg">{r.losses}</Td>
                      <Td>{r.goalsFor}</Td>
                      <Td>{r.goalsAgainst}</Td>
                      <Td className={r.goalDiff > 0 ? "text-pos" : r.goalDiff < 0 ? "text-neg" : ""}>
                        {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                      </Td>
                      <td className="hidden px-2 py-2 md:table-cell">
                        <FormPills form={r.form} />
                      </td>
                      <td className="px-2 py-2 text-right text-[14px] font-bold tabular-nums text-ink">
                        {r.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Yan kolon: gol krallari + son sonuclar */}
      <div className="space-y-5">
        <MiniLeaders
          title={t("tsl.topScorer")}
          rows={leaders.goals.slice(0, 6)}
        />
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <h3 className="border-b border-line px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
            {t("tsl.recentResults")}
          </h3>
          <div className="divide-y divide-line/60">
            {recent.map((m) => (
              <div key={m.matchId} className="flex items-center gap-2 px-4 py-2 text-[12px]">
                <span className="w-10 shrink-0 text-[10px] text-ink-3">{formatDate(m.datetime, locale)}</span>
                <div className="flex flex-1 items-center gap-1.5 truncate">
                  <TeamCrest logo={m.homeLogo} name={m.homeName} size="xs" />
                  <span className="truncate text-ink-2">{m.homeName}</span>
                </div>
                <span className="shrink-0 rounded-md bg-veil px-2 py-0.5 font-bold tabular-nums text-ink">
                  {m.homeScore}-{m.awayScore}
                </span>
                <div className="flex flex-1 items-center justify-end gap-1.5 truncate">
                  <span className="truncate text-right text-ink-2">{m.awayName}</span>
                  <TeamCrest logo={m.awayLogo} name={m.awayName} size="xs" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  function MiniLeaders({
    title,
    rows,
  }: {
    title: string;
    rows: LeagueBundle["leaders"]["goals"];
  }) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <h3 className="border-b border-line px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
          {title}
        </h3>
        <div className="divide-y divide-line/60">
          {rows.map((p, i) => (
            <div key={p.playerId} className="flex items-center gap-2.5 px-4 py-2">
              <span className="w-4 text-center text-[12px] font-bold tabular-nums text-ink-3">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-ink">{p.playerName}</div>
                <div className="truncate text-[11px] text-ink-3">{p.teamName}</div>
              </div>
              <span className="text-[15px] font-bold tabular-nums text-ink">
                {formatMetric(p.total, p.valueFormat)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-2 text-center font-medium">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-2 text-center tabular-nums text-ink-2 ${className}`}>{children}</td>;
}
