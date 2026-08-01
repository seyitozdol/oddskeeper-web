import Link from "next/link";
import {
  getBasketballPlayer,
  getBasketballPlayerMatchLog,
  getBasketballPlayerEuroSeasons,
} from "@/features/basketball/server/getBasketballStats";
import { TeamCrest, StatTile } from "@/features/basketball/components/ui";
import { fmt, formatMatchDate, homeAwayLabel } from "@/features/basketball/lib";
import { getT, getLocale } from "@/lib/i18n/server";

export default async function BasketballPlayerPage({
  params,
}: {
  params: Promise<{ playerSlug: string }>;
}) {
  const { playerSlug } = await params;
  const [player, log, euroSeasons, t, locale] = await Promise.all([
    getBasketballPlayer(playerSlug),
    getBasketballPlayerMatchLog(playerSlug),
    getBasketballPlayerEuroSeasons(playerSlug),
    getT(),
    getLocale(),
  ]);

  if (!player) {
    return (
      <section className="w-full">
        <div className="rounded-2xl border border-line bg-card p-8">
          <Link href="/dashboard/basketball" className="text-xs text-accent-ink hover:underline">
            ← {t("basketball.backToLeague")}
          </Link>
          <p className="mt-6 text-sm text-ink-3">{t("basketball.notFoundPlayer")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <Link href="/dashboard/basketball" className="text-xs text-accent-ink hover:underline">
          ← {t("basketball.backToLeague")}
        </Link>

        {/* Header */}
        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center justify-center rounded-full bg-veil text-lg font-bold text-ink-2" style={{ width: 52, height: 52 }}>
            {player.jersey_no ? `#${player.jersey_no}` : player.player_name.slice(0, 1)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-ink">{player.player_name}</h1>
            {player.team_slug ? (
              <Link href={`/dashboard/basketball/team/${player.team_slug}`} className="mt-1 flex items-center gap-1.5 text-sm text-ink-2 hover:text-accent-ink">
                <TeamCrest slug={player.team_slug} name={player.team_name} size={22} />
                <span>{player.team_name}</span>
              </Link>
            ) : (
              <p className="mt-0.5 text-sm text-ink-3">{player.team_name}</p>
            )}
          </div>
        </div>

        {/* Per-game */}
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
        </div>

        {/* Shooting */}
        <h2 className="mt-6 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.shooting")}</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          <StatTile label={t("basketball.fgPct")} value={fmt(player.fg_pct)} />
          <StatTile label="2P%" value={fmt(player.fg2_pct)} />
          <StatTile label={t("basketball.threePct")} value={fmt(player.fg3_pct)} />
          <StatTile label={t("basketball.ftPct")} value={fmt(player.ft_pct)} />
          <StatTile label={t("basketball.efgPct")} value={fmt(player.efg_pct)} />
          <StatTile label={t("basketball.tsPct")} value={fmt(player.ts_pct)} tone="accent" />
        </div>

        {/* Advanced */}
        <h2 className="mt-6 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.advanced")}</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          <StatTile label={t("basketball.usage")} value={fmt(player.usage_pct)} />
          <StatTile label="PTS/36" value={fmt(player.pts_per36)} />
          <StatTile label="REB/36" value={fmt(player.reb_per36)} />
          <StatTile label="AST/36" value={fmt(player.ast_per36)} />
          <StatTile label={t("basketball.pra")} value={fmt(player.pra_pg)} />
          <StatTile label="P+A" value={fmt(player.pa_pg)} />
        </div>

        {/* European competitions (EuroLeague / EuroCup) — only if the player has data */}
        {euroSeasons.length > 0 ? (
          <>
            <h2 className="mt-8 mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.euroTitle")}</h2>
            <p className="mb-3 text-[11px] text-ink-3">{t("basketball.euroHint")}</p>
            <div className="space-y-4">
              {euroSeasons.map((e) => (
                <div key={`${e.competition}-${e.season_code}`} className="rounded-xl border border-line bg-veil/40 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.competition === "E" ? "/images/leagues/euroleague.svg" : "/images/leagues/eurocup.svg"}
                      alt={e.competition_name}
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0"
                    />
                    <span className="text-ink">{e.competition_name}</span>
                    <span className="text-ink-3">{e.season_label}</span>
                    {e.team_name ? <span className="text-[12px] text-ink-3">· {e.team_name}</span> : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                    <StatTile label={t("basketball.games")} value={String(e.games)} />
                    <StatTile label={t("basketball.min")} value={fmt(e.mpg)} />
                    <StatTile label={t("basketball.ppg")} value={fmt(e.ppg)} tone="accent" />
                    <StatTile label={t("basketball.rpg")} value={fmt(e.rpg)} />
                    <StatTile label={t("basketball.apg")} value={fmt(e.apg)} />
                    <StatTile label={t("basketball.spg")} value={fmt(e.spg)} />
                    <StatTile label={t("basketball.bpg")} value={fmt(e.bpg)} />
                    <StatTile label={t("basketball.threePg")} value={fmt(e.fg3m_pg)} />
                    <StatTile label={t("basketball.valuation")} value={fmt(e.val_pg)} tone="accent" />
                    <StatTile label={t("basketball.threePct")} value={fmt(e.fg3_pct)} />
                    <StatTile label={t("basketball.ftPct")} value={fmt(e.ft_pct)} />
                    <StatTile label={t("basketball.fgPct")} value={fmt(e.fg_pct)} />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/* Game log */}
        <h2 className="mt-8 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.gameLog")}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
                <th className="px-2 py-2 text-left">{t("basketball.date")}</th>
                <th className="px-2 py-2 text-left"></th>
                <th className="px-2 py-2 text-left">{t("basketball.opponent")}</th>
                <th className="px-2 py-2 text-right">{t("basketball.min")}</th>
                <th className="px-2 py-2 text-right">PTS</th>
                <th className="px-2 py-2 text-right">REB</th>
                <th className="px-2 py-2 text-right">AST</th>
                <th className="px-2 py-2 text-right">3PM</th>
                <th className="px-2 py-2 text-right">STL</th>
                <th className="px-2 py-2 text-right">BLK</th>
                <th className="px-2 py-2 text-right">{t("basketball.tsPct")}</th>
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
                        <TeamCrest slug={m.opponent_slug} name={m.opponent_name} size={22} />
                        <span className="whitespace-nowrap">{m.opponent_name}</span>
                      </Link>
                    ) : (
                      <span className="text-ink">{m.opponent_name}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(m.minutes)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold text-ink">{m.points}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.treb}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.assists}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.fg3m}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.steals}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.blocks}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(m.ts_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
