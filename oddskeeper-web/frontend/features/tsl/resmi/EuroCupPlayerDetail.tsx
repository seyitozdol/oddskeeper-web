import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Gauge, LayoutDashboard, Table2 } from "lucide-react";
import { getLocale, getT } from "@/lib/i18n/server";
import { formatMatchDate } from "@/features/tff1/lib";
import { SideTabMenu } from "@/components/nav/SideTabMenu";
import { CupCrossLeagueToggle } from "@/features/tsl/resmi/CupCrossLeagueToggle";
import {
  Tff1PlayerShowcase,
  type PlayerShowcaseChrome,
} from "@/features/tff1/components/Tff1PlayerShowcase";
import type { Tff1MatchLogRow, Tff1PlayerRow } from "@/features/tff1/types";
import type { Translator } from "@/lib/i18n/messages";
import {
  getTff1PlayerInfo,
  getTff1TeamLogos,
} from "@/features/tff1/server/getTff1Stats";
import {
  getCupPlayerCrossLinks,
  getCupPlayerMatchLog,
  getCupPlayerSeasonStats,
  getCupTeamSeasonStats,
} from "@/features/tsl/server/cupPlayerProfile";

// Avrupa kupasi oyuncu profili — Super Lig profiliyle ayni SOL-MENU layout'u
// (route-bazli ?tab=; ayni 4 sekme) + capraz-lig toggle. tff1 Showcase kupa
// verisiyle (parite kolonlar) yeniden kullanilir. Kimlik SofaScore player_id.

// Super Lig oyuncu profiliyle AYNI sekme seti (overview/detailed-stats/advanced/
// match-log) -> sol menu tutarli.
const TABS = ["overview", "detailed-stats", "advanced", "match-log"] as const;
type CupTab = (typeof TABS)[number];
const TAB_LABEL_KEYS: Record<CupTab, string> = {
  overview: "playerDetail.tabOverview",
  "detailed-stats": "playerDetail.tabDetailedStats",
  advanced: "playerDetail.tabAdvanced",
  "match-log": "playerDetail.tabMatchLog",
};
const TAB_ICON: Record<CupTab, React.ReactNode> = {
  overview: <LayoutDashboard />,
  "detailed-stats": <Table2 />,
  advanced: <Gauge />,
  "match-log": <CalendarDays />,
};
// viewPrefix -> lig ad i18n anahtari (competition badge/label lokalize).
const PREFIX_NAME_KEY: Record<string, string> = {
  ucl: "tsl.uclName",
  uel: "tsl.uelName",
  uecl: "tsl.ueclName",
};

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
function perMatch(v: number | string | null, apps: number | null): string {
  const n = num(v);
  if (n === null || !apps) return "—";
  return (n / apps).toFixed(2);
}

// tff1 oyuncu sayfasindaki metrik listesi (kupada da ayni kolonlar).
function metricLines(row: Tff1PlayerRow, t: Translator) {
  const apps = num(row.appearances);
  const line = (
    labelKey: string,
    v: number | string | null,
    opts: { digits?: number; pm?: boolean } = {}
  ) => ({
    label: t(labelKey),
    value: fmt(v, opts.digits ?? 0),
    perMatch: opts.pm === false ? "—" : perMatch(v, apps),
  });
  const isKeeper = row.position_code === "G";
  const lines = [
    line("tff1.colGoals", row.goals),
    line("tff1.colXg", row.xg, { digits: 2 }),
    line("tff1.colXgot", row.xgot, { digits: 2 }),
    line("tff1.colAssists", row.assists),
    line("tff1.colXa", row.xa, { digits: 2 }),
    line("tff1.colShots", row.shots),
    line("tff1.colShotsOnTarget", row.shots_on_target),
    line("tff1.colBigChancesCreated", row.big_chances_created),
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
  ];
  if (isKeeper) {
    lines.unshift(line("tff1.colSaves", row.saves), line("tff1.colPenaltiesSaved", row.penalties_saved));
  }
  return lines;
}

function isValidTab(v: string | undefined): v is CupTab {
  return TABS.includes(v as CupTab);
}

export default async function EuroCupPlayerDetail({
  playerId,
  viewPrefix,
  competition,
  matchBase,
  playerBase,
  backBase,
  tab,
}: {
  playerId: string;
  viewPrefix: string;
  competition: string;
  matchBase: string;
  playerBase: string;
  backBase: string;
  tab?: string;
}) {
  const activeTab: CupTab = isValidTab(tab) ? tab : "overview";
  const [players, teams, infoRows, logos, matchLog, crossLinks, t, locale] =
    await Promise.all([
      getCupPlayerSeasonStats(viewPrefix),
      getCupTeamSeasonStats(viewPrefix),
      getTff1PlayerInfo(),
      getTff1TeamLogos(),
      getCupPlayerMatchLog(playerId, competition),
      getCupPlayerCrossLinks(playerId, viewPrefix),
      getT(),
      getLocale(),
    ]);

  const seasonRows = players
    .filter((p) => p.player_id === playerId)
    .sort((a, b) => b.season_label.localeCompare(a.season_label));
  if (seasonRows.length === 0) notFound();

  const latest = seasonRows[0];
  const info = infoRows.find((r) => r.player_id === playerId) ?? null;
  const logoByTeam: Record<string, string> = {};
  for (const l of logos) if (l.logo_url) logoByTeam[l.team_id] = l.logo_url;
  const teamRow =
    teams.find(
      (tr) => tr.season_label === latest.season_label && tr.team_id === latest.team_id
    ) ?? null;
  const leagueRows = players.filter((p) => p.season_label === latest.season_label);
  const radarRow = seasonRows.find((r) => (num(r.appearances) ?? 0) >= 5) ?? latest;
  const radarLeagueRows =
    radarRow.season_label === latest.season_label
      ? leagueRows
      : players.filter((p) => p.season_label === radarRow.season_label);

  // Lig adi lokalize (competition badge/label EN/TR); competition prop DB degeri
  // olarak sorgu icin kalir.
  const compLabel = t(PREFIX_NAME_KEY[viewPrefix] ?? "tsl.uclName");

  const chrome: PlayerShowcaseChrome = {
    backHref: backBase,
    backLabel: compLabel,
    competitionLabel: compLabel,
    teamHref: null,
    matchHref: (m: Tff1MatchLogRow) => `${matchBase}/${encodeURIComponent(m.match_id)}`,
    showMarketValue: false,
    showBackBar: false, // sol menü nav olduğundan üst geri-çubuğu gizli
  };

  const base = `${playerBase}/${encodeURIComponent(playerId)}`;
  const sideItems = TABS.map((tb) => ({
    key: tb,
    href: `${base}?tab=${tb}`,
    label: t(TAB_LABEL_KEYS[tb]),
    icon: TAB_ICON[tb],
  }));

  const isKeeper = latest.position_code === "G";
  const playedLog = matchLog.filter((m) => (num(m.minutes) ?? 0) > 0);
  // Advanced sekmesi: per-90 ileri metrikler (latest sezon).
  const lm = num(latest.minutes) ?? 0;
  const p90 = (v: number | string | null): string =>
    lm > 0 ? (((num(v) ?? 0) / lm) * 90).toFixed(2) : "—";
  const advancedRows: { label: string; total: string; per90: string }[] = [
    { label: t("tff1.colXg"), total: latest.xg === null ? "—" : Number(latest.xg).toFixed(2), per90: p90(latest.xg) },
    { label: t("tff1.colXgot"), total: latest.xgot === null ? "—" : Number(latest.xgot).toFixed(2), per90: p90(latest.xgot) },
    { label: t("tff1.colXa"), total: latest.xa === null ? "—" : Number(latest.xa).toFixed(2), per90: p90(latest.xa) },
    { label: t("tff1.colShots"), total: String(num(latest.shots) ?? 0), per90: p90(latest.shots) },
    { label: t("tff1.colKeyPasses"), total: String(num(latest.key_passes) ?? 0), per90: p90(latest.key_passes) },
    { label: t("tff1.colBigChancesCreated"), total: String(num(latest.big_chances_created) ?? 0), per90: p90(latest.big_chances_created) },
    { label: t("tff1.colDribblesWon"), total: String(num(latest.dribbles_won) ?? 0), per90: p90(latest.dribbles_won) },
    { label: t("tff1.colTackles"), total: String(num(latest.tackles) ?? 0), per90: p90(latest.tackles) },
    { label: t("tff1.colInterceptions"), total: String(num(latest.interceptions) ?? 0), per90: p90(latest.interceptions) },
    { label: t("tff1.colDuelsWon"), total: String(num(latest.duels_won) ?? 0), per90: p90(latest.duels_won) },
    { label: t("tff1.colAerialsWon"), total: String(num(latest.aerials_won) ?? 0), per90: p90(latest.aerials_won) },
    { label: t("tff1.colBallRecoveries"), total: String(num(latest.ball_recoveries) ?? 0), per90: p90(latest.ball_recoveries) },
    { label: t("tff1.colTouches"), total: String(num(latest.touches) ?? 0), per90: p90(latest.touches) },
  ];

  return (
    <div className="w-full">
      <div className="grid items-start gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
        <SideTabMenu
          items={sideItems}
          activeKey={activeTab}
          teamName={latest.player_name ?? playerId}
          teamLogo={info?.photo_url ?? null}
        />

        <div className="min-w-0 space-y-3">
          {/* Capraz-lig toggle: sag-ust, buyuk gorselin ustunde */}
          <CupCrossLeagueToggle links={crossLinks} t={t} />

          {activeTab === "overview" ? (
            <Tff1PlayerShowcase
              latest={latest}
              seasonRows={seasonRows}
              leagueRows={leagueRows}
              radarRow={radarRow}
              radarLeagueRows={radarLeagueRows}
              info={info}
              marketValue={null}
              teamRow={teamRow}
              logoByTeam={logoByTeam}
              matchLog={matchLog}
              t={t}
              locale={locale}
              chrome={chrome}
            />
          ) : activeTab === "detailed-stats" ? (
            <div className="rounded-2xl border border-line bg-card p-6">
              <h2 className="text-sm font-semibold text-ink">
                {latest.player_name} · {compLabel}
              </h2>
              {seasonRows.map((row) => (
                <div key={row.season_label}>
                  <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                    {t("tff1.drawerSeasonDetail", { season: row.season_label })}
                  </h3>
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
                        {metricLines(row, t).map((l) => (
                          <tr key={l.label} className="border-t border-line text-ink">
                            <td className="px-3 py-1.5 text-ink-2">{l.label}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{l.value}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{l.perMatch}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === "advanced" ? (
            <div className="rounded-2xl border border-line bg-card p-6">
              <h2 className="text-sm font-semibold text-ink">
                {latest.player_name} · {compLabel}
              </h2>
              <div className="mt-3 overflow-x-auto rounded-lg border border-line">
                <table className="min-w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                      <th className="px-3 py-2 font-medium">{t("tff1.metricCol")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.valueModeTotal")}</th>
                      <th className="px-3 py-2 text-right font-medium">/90</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advancedRows.map((r) => (
                      <tr key={r.label} className="border-t border-line text-ink">
                        <td className="px-3 py-1.5 text-ink-2">{r.label}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.total}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.per90}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[12px] text-ink-3">{latest.season_label}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-card p-6">
              <h2 className="text-sm font-semibold text-ink">
                {latest.player_name} · {compLabel}
              </h2>
              {playedLog.length === 0 ? (
                <div className="mt-3 rounded-lg border border-line bg-veil p-4 text-sm text-ink-2">
                  {t("playerDetail.noRecentMatchData")}
                </div>
              ) : (
                <div className="mt-3 max-h-[620px] overflow-auto rounded-lg border border-line">
                  <table className="min-w-full border-collapse text-[13px]">
                    <thead className="sticky top-0 bg-card">
                      <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                        <th className="px-3 py-2 font-medium">{t("tff1.colDate")}</th>
                        <th className="px-3 py-2 font-medium">{t("tff1.colOpponent")}</th>
                        <th className="px-3 py-2 font-medium">{t("tff1.colScore")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("tff1.colMinutes")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("tff1.colRating")}</th>
                        {isKeeper ? (
                          <th className="px-3 py-2 text-right font-medium">{t("tff1.colSaves")}</th>
                        ) : (
                          <>
                            <th className="px-3 py-2 text-right font-medium">{t("tff1.colGoals")}</th>
                            <th className="px-3 py-2 text-right font-medium">{t("tff1.colAssists")}</th>
                            <th className="px-3 py-2 text-right font-medium">{t("tff1.colShots")}</th>
                          </>
                        )}
                        <th className="px-3 py-2 text-right font-medium">{t("tff1.colPasses")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("tff1.colKeyPasses")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("tff1.colTackles")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchLog.map((m) => {
                        const gf = m.is_home ? m.home_score : m.away_score;
                        const ga = m.is_home ? m.away_score : m.home_score;
                        const res =
                          gf === null || ga === null ? null : gf > ga ? "G" : gf < ga ? "M" : "B";
                        const resClass =
                          res === "G" ? "bg-pos/15 text-pos" : res === "M" ? "bg-neg/15 text-neg" : "bg-veil text-ink-2";
                        const played = (num(m.minutes) ?? 0) > 0;
                        return (
                          <tr
                            key={`${m.match_id}-${m.team_id}`}
                            className={`border-t border-line ${played ? "text-ink" : "text-ink-3"}`}
                          >
                            <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-ink-3">
                              <Link
                                href={`${matchBase}/${encodeURIComponent(m.match_id)}`}
                                className="transition hover:text-accent-ink hover:underline"
                              >
                                {formatMatchDate(m.match_datetime, locale)}
                              </Link>
                            </td>
                            <td className="whitespace-nowrap px-3 py-1.5">
                              <span className="mr-1 text-[11px] text-ink-3">
                                {m.is_home ? t("tff1.homeShort") : t("tff1.awayShort")}
                              </span>
                              {m.opponent_name}
                            </td>
                            <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                              {m.home_score ?? "-"}:{m.away_score ?? "-"}
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
                              </>
                            )}
                            <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.total_passes)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.key_passes)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.tackles)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
