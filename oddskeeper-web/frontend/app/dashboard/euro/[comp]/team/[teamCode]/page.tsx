import Link from "next/link";
import { notFound } from "next/navigation";
import { getEuroTeam, getEuroTeamRoster, getEuroTeamLog } from "@/features/euroleague/server";
import { resolveEuroComp, normalizeSeason, seasonCodeFor } from "@/features/euroleague/config";
import { StatTile } from "@/features/basketball/components/ui";
import { fmt, formatMatchDate, homeAwayLabel } from "@/features/basketball/lib";
import { getT, getLocale } from "@/lib/i18n/server";

export default async function EuroTeamPage({
  params, searchParams,
}: {
  params: Promise<{ comp: string; teamCode: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ comp, teamCode }, { season }, t, locale] = await Promise.all([params, searchParams, getT(), getLocale()]);
  const cfg = resolveEuroComp(comp);
  if (!cfg) notFound();
  const seasonLabel = normalizeSeason(season);
  const seasonCode = seasonCodeFor(cfg.code, seasonLabel);
  const [team, roster, log] = await Promise.all([
    getEuroTeam(cfg.code, seasonCode, teamCode),
    getEuroTeamRoster(cfg.code, seasonCode, teamCode),
    getEuroTeamLog(cfg.code, seasonCode, teamCode),
  ]);
  const base = `/dashboard/euro/${cfg.key}`;
  if (!team) {
    return (
      <section className="w-full"><div className="rounded-2xl border border-line bg-card p-8">
        <Link href={base} className="text-xs text-accent-ink hover:underline">← {cfg.name}</Link>
        <p className="mt-6 text-sm text-ink-3">{t("basketball.notFoundTeam")}</p>
      </div></section>
    );
  }
  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <Link href={base} className="text-xs text-accent-ink hover:underline">← {cfg.name}</Link>
        <div className="mt-4 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {team.crest_url ? <img src={team.crest_url} alt={team.team_name} width={56} height={56} className="h-14 w-14 object-contain" /> : null}
          <div>
            <h1 className="text-2xl font-semibold text-ink">{team.team_name}</h1>
            <p className="mt-0.5 text-sm text-ink-3">{cfg.name} · {seasonLabel} · {team.wins}-{team.losses}</p>
          </div>
        </div>

        <h2 className="mt-6 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.seasonAverages")}</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          <StatTile label={t("basketball.played")} value={String(team.games)} />
          <StatTile label={t("basketball.ppg")} value={fmt(team.ppg)} tone="accent" />
          <StatTile label={t("basketball.oppg")} value={fmt(team.oppg)} />
          <StatTile label={t("basketball.rpg")} value={fmt(team.rpg)} />
          <StatTile label={t("basketball.apg")} value={fmt(team.apg)} />
          <StatTile label={t("basketball.netRtg")} value={fmt(team.net_rtg)} />
          <StatTile label={t("basketball.offRtg")} value={fmt(team.off_rtg)} />
          <StatTile label={t("basketball.defRtg")} value={fmt(team.def_rtg)} />
          <StatTile label={t("basketball.pace")} value={fmt(team.pace)} />
          <StatTile label={t("basketball.threePct")} value={fmt(team.fg3_pct)} />
          <StatTile label={t("basketball.efgPct")} value={fmt(team.efg_pct)} />
          <StatTile label={t("basketball.fgPct")} value={fmt(team.fg_pct)} />
        </div>

        <h2 className="mt-8 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.roster")}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[13px]">
            <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
              <th className="px-2 py-2 text-left">{t("basketball.player")}</th>
              <th className="px-2 py-2 text-right">{t("basketball.games")}</th><th className="px-2 py-2 text-right">{t("basketball.min")}</th>
              <th className="px-2 py-2 text-right">{t("basketball.ppg")}</th><th className="px-2 py-2 text-right">{t("basketball.rpg")}</th>
              <th className="px-2 py-2 text-right">{t("basketball.apg")}</th><th className="px-2 py-2 text-right">{t("basketball.valuation")}</th>
            </tr></thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.person_code} className="border-t border-line hover:bg-veil">
                  <td className="px-2 py-2"><Link href={`${base}/player/${p.person_code}`} className="font-medium text-ink hover:text-accent-ink whitespace-nowrap">{p.player_name}</Link></td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{p.games}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.mpg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink">{fmt(p.ppg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.rpg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.apg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-accent-ink">{fmt(p.val_pg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.results")}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[12px]">
            <thead><tr className="text-[9px] uppercase tracking-[0.1em] text-ink-3">
              <th className="px-2 py-1 text-left">{t("basketball.date")}</th><th className="px-2 py-1 text-left"></th>
              <th className="px-2 py-1 text-left">{t("basketball.opponent")}</th><th className="px-2 py-1 text-right">{t("basketball.result")}</th>
              <th className="px-2 py-1 text-right">{t("basketball.score")}</th>
            </tr></thead>
            <tbody>
              {log.map((m) => (
                <tr key={m.game_code} className="border-t border-line">
                  <td className="px-2 py-1 text-ink-3 whitespace-nowrap">{formatMatchDate(m.game_date ?? "", locale)}</td>
                  <td className="px-2 py-1 text-ink-3">{homeAwayLabel(m.home_away, locale)}</td>
                  <td className="px-2 py-1 text-ink-2 whitespace-nowrap">{m.opponent_name}</td>
                  <td className={`px-2 py-1 text-right font-semibold ${m.result === "W" ? "text-pos" : m.result === "L" ? "text-neg" : "text-ink-3"}`}>{m.result}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink">{m.points}-{m.opp_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
