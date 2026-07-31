import Link from "next/link";
import {
  getBasketballTeam,
  getBasketballTeamRoster,
  getBasketballTeamMatchLog,
} from "@/features/basketball/server/getBasketballStats";
import { TeamCrest, StatTile, FormBadge } from "@/features/basketball/components/ui";
import { fmt, formatMatchDate, homeAwayLabel, RESULT_BADGE_CLASS } from "@/features/basketball/lib";
import { getT, getLocale } from "@/lib/i18n/server";

export default async function BasketballTeamPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const [team, roster, log, t, locale] = await Promise.all([
    getBasketballTeam(teamSlug),
    getBasketballTeamRoster(teamSlug),
    getBasketballTeamMatchLog(teamSlug),
    getT(),
    getLocale(),
  ]);

  if (!team) {
    return (
      <section className="w-full">
        <div className="rounded-2xl border border-line bg-card p-8">
          <Link href="/dashboard/basketball" className="text-xs text-accent-ink hover:underline">
            ← {t("basketball.backToLeague")}
          </Link>
          <p className="mt-6 text-sm text-ink-3">{t("basketball.notFoundTeam")}</p>
        </div>
      </section>
    );
  }

  const last5 = log.slice(0, 5);

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <Link href="/dashboard/basketball" className="text-xs text-accent-ink hover:underline">
          ← {t("basketball.backToLeague")}
        </Link>

        {/* Header */}
        <div className="mt-4 flex items-center gap-4">
          <TeamCrest slug={team.team_slug} name={team.team_name} size={52} />
          <div>
            <h1 className="text-2xl font-semibold text-ink">{team.team_name}</h1>
            <p className="mt-0.5 text-sm text-ink-3">
              #{team.standings_rank} · {team.wins}-{team.losses} · {team.games} {t("basketball.games")}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {last5.slice().reverse().map((m) => (
              <FormBadge key={m.match_key + m.match_date} result={m.result} />
            ))}
          </div>
        </div>

        {/* Summary tiles */}
        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <StatTile label={t("basketball.ppg")} value={fmt(team.ppg)} />
          <StatTile label={t("basketball.oppg")} value={fmt(team.oppg)} />
          <StatTile label={t("basketball.diff")} value={`${(team.point_diff ?? 0) >= 0 ? "+" : ""}${fmt(team.point_diff)}`} tone={(team.point_diff ?? 0) >= 0 ? "pos" : "neg"} />
          <StatTile label={t("basketball.netRtg")} value={fmt(team.net_rtg)} tone={(team.net_rtg ?? 0) >= 0 ? "pos" : "neg"} />
          <StatTile label={t("basketball.offRtg")} value={fmt(team.off_rtg)} />
          <StatTile label={t("basketball.defRtg")} value={fmt(team.def_rtg)} />
          <StatTile label={t("basketball.pace")} value={fmt(team.pace)} />
          <StatTile label={t("basketball.rpg")} value={fmt(team.rpg)} />
          <StatTile label={t("basketball.apg")} value={fmt(team.apg)} />
          <StatTile label={t("basketball.fgPct")} value={fmt(team.fg_pct)} />
          <StatTile label={t("basketball.threePct")} value={fmt(team.fg3_pct)} />
          <StatTile label={t("basketball.efgPct")} value={fmt(team.efg_pct)} />
        </div>

        {/* Roster */}
        <h2 className="mt-8 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("basketball.roster")}
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
                <th className="px-2 py-2 text-left">{t("basketball.player")}</th>
                <th className="px-2 py-2 text-right">{t("basketball.games")}</th>
                <th className="px-2 py-2 text-right">{t("basketball.min")}</th>
                <th className="px-2 py-2 text-right">{t("basketball.ppg")}</th>
                <th className="px-2 py-2 text-right">{t("basketball.rpg")}</th>
                <th className="px-2 py-2 text-right">{t("basketball.apg")}</th>
                <th className="px-2 py-2 text-right">{t("basketball.spg")}</th>
                <th className="px-2 py-2 text-right">{t("basketball.bpg")}</th>
                <th className="px-2 py-2 text-right">{t("basketball.fgPct")}</th>
                <th className="px-2 py-2 text-right">{t("basketball.threePct")}</th>
                <th className="px-2 py-2 text-right">{t("basketball.tsPct")}</th>
                <th className="px-2 py-2 text-right">{t("basketball.usage")}</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.player_slug} className="border-t border-line hover:bg-veil">
                  <td className="px-2 py-2">
                    <Link href={`/dashboard/basketball/player/${p.player_slug}`} className="font-medium text-ink hover:text-accent-ink whitespace-nowrap">
                      {p.player_name}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{p.games}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.mpg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink">{fmt(p.ppg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.rpg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.apg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.spg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.bpg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.fg_pct)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.fg3_pct)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.ts_pct)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.usage_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Results */}
        <h2 className="mt-8 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("basketball.results")}
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
                <th className="px-2 py-2 text-left">{t("basketball.date")}</th>
                <th className="px-2 py-2 text-left"></th>
                <th className="px-2 py-2 text-left">{t("basketball.opponent")}</th>
                <th className="px-2 py-2 text-right">{t("basketball.score")}</th>
                <th className="px-2 py-2 text-center">{t("basketball.result")}</th>
              </tr>
            </thead>
            <tbody>
              {log.map((m) => (
                <tr key={m.match_key + m.match_date} className="border-t border-line hover:bg-veil">
                  <td className="px-2 py-2 text-ink-3 whitespace-nowrap">{formatMatchDate(m.match_date, locale)}</td>
                  <td className="px-2 py-2 text-ink-3">{homeAwayLabel(m.home_away, locale)}</td>
                  <td className="px-2 py-2">
                    {m.opponent_slug ? (
                      <Link href={`/dashboard/basketball/team/${m.opponent_slug}`} className="flex items-center gap-1.5 text-ink hover:text-accent-ink">
                        <TeamCrest slug={m.opponent_slug} name={m.opponent_name} size={16} />
                        <span className="whitespace-nowrap">{m.opponent_name}</span>
                      </Link>
                    ) : (
                      <span className="text-ink">{m.opponent_name}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink">{m.points}-{m.opp_points}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold ${RESULT_BADGE_CLASS[m.result ?? ""] ?? "bg-veil text-ink-2"}`}>
                      {m.result ?? "-"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
