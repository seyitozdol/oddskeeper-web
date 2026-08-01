import Link from "next/link";
import { notFound } from "next/navigation";
import { getEuroPlayer, getEuroPlayerLog } from "@/features/euroleague/server";
import { resolveEuroComp, normalizeSeason, seasonCodeFor } from "@/features/euroleague/config";
import { StatTile } from "@/features/basketball/components/ui";
import { fmt, formatMatchDate, homeAwayLabel } from "@/features/basketball/lib";
import { getT, getLocale } from "@/lib/i18n/server";

export default async function EuroPlayerPage({
  params, searchParams,
}: {
  params: Promise<{ comp: string; personCode: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ comp, personCode }, { season }, t, locale] = await Promise.all([params, searchParams, getT(), getLocale()]);
  const cfg = resolveEuroComp(comp);
  if (!cfg) notFound();
  const seasonLabel = normalizeSeason(season);
  const seasonCode = seasonCodeFor(cfg.code, seasonLabel);
  const [player, log] = await Promise.all([
    getEuroPlayer(cfg.code, seasonCode, personCode),
    getEuroPlayerLog(cfg.code, seasonCode, personCode),
  ]);
  const base = `/dashboard/euro/${cfg.key}`;
  if (!player) {
    return (
      <section className="w-full"><div className="rounded-2xl border border-line bg-card p-8">
        <Link href={base} className="text-xs text-accent-ink hover:underline">← {cfg.name}</Link>
        <p className="mt-6 text-sm text-ink-3">{t("basketball.notFoundPlayer")}</p>
      </div></section>
    );
  }
  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <Link href={base} className="text-xs text-accent-ink hover:underline">← {cfg.name}</Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{player.player_name}</h1>
            <p className="mt-0.5 text-sm text-ink-3">
              {cfg.name} · {seasonLabel} ·{" "}
              <Link href={`${base}/team/${player.team_code}`} className="hover:text-accent-ink">{player.team_name}</Link>
            </p>
          </div>
          {player.bsl_player_slug ? (
            <Link href={`/dashboard/basketball/player/${player.bsl_player_slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-veil px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:text-ink">
              {t("basketball.viewBslProfile")} →
            </Link>
          ) : null}
        </div>

        <h2 className="mt-6 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.perGame")}</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          <StatTile label={t("basketball.games")} value={String(player.games)} />
          <StatTile label={t("basketball.min")} value={fmt(player.mpg)} />
          <StatTile label={t("basketball.ppg")} value={fmt(player.ppg)} tone="accent" />
          <StatTile label={t("basketball.rpg")} value={fmt(player.rpg)} />
          <StatTile label={t("basketball.apg")} value={fmt(player.apg)} />
          <StatTile label={t("basketball.spg")} value={fmt(player.spg)} />
          <StatTile label={t("basketball.bpg")} value={fmt(player.bpg)} />
          <StatTile label={t("basketball.threePg")} value={fmt(player.fg3m_pg)} />
          <StatTile label={t("basketball.valuation")} value={fmt(player.val_pg)} tone="accent" />
          <StatTile label={t("basketball.threePct")} value={fmt(player.fg3_pct)} />
          <StatTile label={t("basketball.ftPct")} value={fmt(player.ft_pct)} />
          <StatTile label={t("basketball.tsPct")} value={fmt(player.ts_pct)} />
        </div>

        <h2 className="mt-8 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.gameLog")}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[13px]">
            <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
              <th className="px-2 py-2 text-left">{t("basketball.date")}</th><th className="px-2 py-2 text-left"></th>
              <th className="px-2 py-2 text-left">{t("basketball.opponent")}</th>
              <th className="px-2 py-2 text-right">{t("basketball.min")}</th><th className="px-2 py-2 text-right">PTS</th>
              <th className="px-2 py-2 text-right">REB</th><th className="px-2 py-2 text-right">AST</th><th className="px-2 py-2 text-right">3PM</th>
              <th className="px-2 py-2 text-right">STL</th><th className="px-2 py-2 text-right">BLK</th><th className="px-2 py-2 text-right">{t("basketball.valuation")}</th>
            </tr></thead>
            <tbody>
              {log.map((m) => (
                <tr key={m.game_code} className="border-t border-line hover:bg-veil">
                  <td className="px-2 py-2 text-ink-3 whitespace-nowrap">{formatMatchDate(m.game_date ?? "", locale)}</td>
                  <td className="px-2 py-2 text-ink-3">{homeAwayLabel(m.home_away, locale)}</td>
                  <td className="px-2 py-2 text-ink whitespace-nowrap">{m.opponent_name}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(m.minutes)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold text-ink">{m.points}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.treb}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.assists}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.fg3m}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.steals}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.blocks}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-accent-ink">{m.valuation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
