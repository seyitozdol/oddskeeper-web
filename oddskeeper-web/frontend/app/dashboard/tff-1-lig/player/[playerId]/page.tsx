import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMatchDate } from "@/features/tff1/lib";
import { Tff1PlayerShowcase } from "@/features/tff1/components/Tff1PlayerShowcase";
import {
  getTff1MarketValues,
  getTff1PlayerInfo,
  getTff1PlayerMatchLog,
  getTff1PlayerSeasonStats,
  getTff1TeamLogos,
  getTff1TeamSeasonStats,
} from "@/features/tff1/server/getTff1Stats";
import type { Tff1PlayerRow } from "@/features/tff1/types";
import { getLocale, getT } from "@/lib/i18n/server";

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

function fmt(v: number | string | null | undefined, digits = 0): string {
  const n = num(v);
  if (n === null) return "—";
  return digits > 0 ? n.toFixed(digits) : String(Math.round(n));
}

function perMatch(v: number | string | null | undefined, apps: number | null): string {
  const n = num(v);
  if (n === null || !apps) return "—";
  return (n / apps).toFixed(2);
}

type MetricLine = {
  label: string;
  value: string;
  perMatch: string;
};

function metricLines(row: Tff1PlayerRow, t: (k: string) => string): MetricLine[] {
  const apps = num(row.appearances);
  const line = (
    labelKey: string,
    v: number | string | null,
    opts: { digits?: number; pm?: boolean } = {}
  ): MetricLine => ({
    label: t(labelKey),
    value: fmt(v, opts.digits ?? 0),
    perMatch: opts.pm === false ? "—" : perMatch(v, apps),
  });

  const isKeeper = row.position_code === "G";
  const lines: MetricLine[] = [
    line("tff1.colGoals", row.goals),
    line("tff1.colXg", row.xg, { digits: 2 }),
    line("tff1.colXgot", row.xgot, { digits: 2 }),
    line("tff1.colAssists", row.assists),
    line("tff1.colXa", row.xa, { digits: 2 }),
    line("tff1.colShots", row.shots),
    line("tff1.colShotsOnTarget", row.shots_on_target),
    line("tff1.colBigChancesCreated", row.big_chances_created),
    line("tff1.colBigChancesMissed", row.big_chances_missed),
    line("tff1.colKeyPasses", row.key_passes),
    line("tff1.colPasses", row.total_passes),
    line("tff1.colAccuratePasses", row.accurate_passes),
    { label: t("tff1.colPassAccuracy"), value: row.pass_accuracy === null ? "—" : `${Number(row.pass_accuracy).toFixed(1)}%`, perMatch: "—" },
    line("tff1.colCrosses", row.crosses),
    line("tff1.colLongBalls", row.long_balls),
    line("tff1.colDribblesWon", row.dribbles_won),
    line("tff1.colTackles", row.tackles),
    line("tff1.colInterceptions", row.interceptions),
    line("tff1.colClearances", row.clearances),
    line("tff1.colBallRecoveries", row.ball_recoveries),
    line("tff1.colDuelsWon", row.duels_won),
    line("tff1.colAerialsWon", row.aerials_won),
    line("tff1.colFouls", row.fouls),
    line("tff1.colWasFouled", row.was_fouled),
    line("tff1.colYellowCards", row.yellow_cards),
    line("tff1.colRedCards", row.red_cards),
    line("tff1.colTouches", row.touches),
    line("tff1.colKmCovered", row.km_covered, { digits: 1 }),
    line("tff1.colSprints", row.sprints),
    { label: t("tff1.colTopSpeed"), value: row.top_speed === null ? "—" : `${Number(row.top_speed).toFixed(1)} km/s`, perMatch: "—" },
  ];
  if (isKeeper) {
    lines.unshift(
      line("tff1.colSaves", row.saves),
      line("tff1.colPenaltiesSaved", row.penalties_saved)
    );
  }
  return lines;
}

export default async function Tff1PlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const [players, teams, infoRows, mvRows, logos, matchLog, t, locale] =
    await Promise.all([
      getTff1PlayerSeasonStats(),
      getTff1TeamSeasonStats(),
      getTff1PlayerInfo(),
      getTff1MarketValues(),
      getTff1TeamLogos(),
      getTff1PlayerMatchLog(playerId),
      getT(),
      getLocale(),
    ]);

  const seasonRows = players
    .filter((p) => p.player_id === playerId)
    .sort((a, b) => b.season_label.localeCompare(a.season_label));
  if (seasonRows.length === 0) notFound();

  const latest = seasonRows[0];
  const info = infoRows.find((r) => r.player_id === playerId) ?? null;
  const mv = mvRows.find((r) => r.player_id === playerId) ?? null;
  const logoByTeam: Record<string, string> = {};
  for (const l of logos) if (l.logo_url) logoByTeam[l.team_id] = l.logo_url;

  const teamRow =
    teams.find(
      (tr) =>
        tr.season_label === latest.season_label && tr.team_id === latest.team_id
    ) ?? null;

  // Radar/güçlü yön yüzdelikleri için aynı sezonun lig havuzu.
  // Sezon başında (5 maç altı) örneklem gürültülü olacağından yeterli
  // maçı olan en güncel sezon esas alınır.
  const leagueRows = players.filter(
    (p) => p.season_label === latest.season_label
  );
  const radarRow =
    seasonRows.find((r) => (num(r.appearances) ?? 0) >= 5) ?? latest;
  const radarLeagueRows =
    radarRow.season_label === latest.season_label
      ? leagueRows
      : players.filter((p) => p.season_label === radarRow.season_label);

  const isKeeper = latest.position_code === "G";

  return (
    <div className="w-full space-y-3">
      <Tff1PlayerShowcase
        latest={latest}
        seasonRows={seasonRows}
        leagueRows={leagueRows}
        radarRow={radarRow}
        radarLeagueRows={radarLeagueRows}
        info={info}
        marketValue={mv}
        teamRow={teamRow}
        logoByTeam={logoByTeam}
        matchLog={matchLog}
        t={t}
        locale={locale}
      />

      {/* sezon bazlı ayrıntılı metrik tabloları + tam maç logu */}
      <section className="w-full">
        <div className="rounded-2xl border border-line bg-card p-6">
          {seasonRows.map((row) => (
            <div key={row.season_label}>
              <h2 className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3 first:mt-0">
                {t("tff1.drawerSeasonDetail", { season: row.season_label })}
              </h2>
              <div className="mb-6 mt-2 overflow-x-auto rounded-lg border border-line">
                <table className="min-w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                      <th className="px-3 py-2 font-medium">{t("tff1.metricCol")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.valueModeTotal")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.valueModePerMatch")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricLines(row, t).map((line) => (
                      <tr key={line.label} className="border-t border-line text-ink">
                        <td className="px-3 py-1.5 text-ink-2">{line.label}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{line.value}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{line.perMatch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {matchLog.length > 0 ? (
            <>
              <h2 className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                {t("tff1.matchLogSection")}
              </h2>
              <div className="mt-2 max-h-[560px] overflow-auto rounded-lg border border-line">
                <table className="min-w-full border-collapse text-[13px]">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                      <th className="px-3 py-2 font-medium">{t("tff1.colDate")}</th>
                      <th className="px-3 py-2 font-medium">{t("tff1.colOpponent")}</th>
                      <th className="px-3 py-2 font-medium">{t("tff1.colScore")}</th>
                      <th className="px-3 py-2 font-medium">{t("tff1.colResult")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.colMinutes")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.colRating")}</th>
                      {isKeeper ? (
                        <th className="px-3 py-2 text-right font-medium">{t("tff1.colSaves")}</th>
                      ) : (
                        <>
                          <th className="px-3 py-2 text-right font-medium">{t("tff1.colGoals")}</th>
                          <th className="px-3 py-2 text-right font-medium">{t("tff1.colAssists")}</th>
                          <th className="px-3 py-2 text-right font-medium">{t("tff1.colShots")}</th>
                          <th className="px-3 py-2 text-right font-medium">
                            {t("tff1.colShotsOnTarget")}
                          </th>
                        </>
                      )}
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.colPasses")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.colKeyPasses")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.colTackles")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.colFouls")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchLog.map((m) => {
                      const gf = m.is_home ? m.home_score : m.away_score;
                      const ga = m.is_home ? m.away_score : m.home_score;
                      const res =
                        gf === null || ga === null
                          ? null
                          : gf > ga
                            ? "G"
                            : gf < ga
                              ? "M"
                              : "B";
                      const resClass =
                        res === "G"
                          ? "bg-pos/15 text-pos"
                          : res === "M"
                            ? "bg-neg/15 text-neg"
                            : "bg-veil text-ink-2";
                      const played = num(m.minutes) !== null && num(m.minutes)! > 0;
                      return (
                        <tr
                          key={`${m.match_id}-${m.team_id}`}
                          className={`border-t border-line ${played ? "text-ink" : "text-ink-3"}`}
                        >
                          <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-ink-3">
                            {formatMatchDate(m.match_datetime, locale)}
                            {m.competition !== "Trendyol 1. Lig" ? (
                              <span className="ml-1.5 rounded bg-veil px-1 py-0.5 text-[10px] uppercase">
                                {m.competition.includes("Play-off") ? "PO" : m.competition}
                              </span>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5">
                            {m.competition.startsWith("Trendyol 1. Lig") ? (
                              <Link
                                href={`/dashboard/tff-1-lig/match/${m.match_id}`}
                                className="transition hover:text-accent-ink hover:underline"
                              >
                                <span className="mr-1 text-[11px] text-ink-3">
                                  {m.is_home ? t("tff1.homeShort") : t("tff1.awayShort")}
                                </span>
                                {m.opponent_name}
                              </Link>
                            ) : (
                              <>
                                <span className="mr-1 text-[11px] text-ink-3">
                                  {m.is_home ? t("tff1.homeShort") : t("tff1.awayShort")}
                                </span>
                                {m.opponent_name}
                              </>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                            {m.home_score ?? "-"}:{m.away_score ?? "-"}
                          </td>
                          <td className="px-3 py-1.5">
                            <span
                              className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold ${res ? resClass : "bg-veil text-ink-3"}`}
                            >
                              {res ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.minutes)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {m.rating === null || !played ? "—" : fmt(m.rating, 2)}
                          </td>
                          {isKeeper ? (
                            <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.saves)}</td>
                          ) : (
                            <>
                              <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.goals)}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.assists)}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.shots)}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">
                                {fmt(m.shots_on_target)}
                              </td>
                            </>
                          )}
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {fmt(m.total_passes)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.key_passes)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.tackles)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.fouls)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[12px] text-ink-3">{t("tff1.matchLogNote")}</p>
            </>
          ) : null}

          <p className="mt-4 text-[12px] text-ink-3">
            {t("tff1.playoffNote")} {t("tff1.fsNote")} {t("tff1.drawerValueNote")}
          </p>
        </div>
      </section>
    </div>
  );
}
