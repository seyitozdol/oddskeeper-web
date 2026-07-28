import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatMarketValue,
  playerAge,
  positionLabel,
  ROLE_CHIP_CLASS,
  ROLE_LABEL_KEYS,
  squadRole,
} from "@/features/tff1/lib";
import {
  getTff1MarketValues,
  getTff1PlayerInfo,
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
  const [players, teams, infoRows, mvRows, logos, t, locale] = await Promise.all([
    getTff1PlayerSeasonStats(),
    getTff1TeamSeasonStats(),
    getTff1PlayerInfo(),
    getTff1MarketValues(),
    getTff1TeamLogos(),
    getT(),
    getLocale(),
  ]);

  const seasonRows = players
    .filter((p) => p.player_id === playerId)
    .sort((a, b) => b.season_label.localeCompare(a.season_label));
  if (seasonRows.length === 0) notFound();

  const latest = seasonRows[0];
  const info = infoRows.find((r) => r.player_id === playerId);
  const mv = mvRows.find((r) => r.player_id === playerId);
  const logoByTeam: Record<string, string> = {};
  for (const l of logos) if (l.logo_url) logoByTeam[l.team_id] = l.logo_url;

  const teamRow = teams.find(
    (tr) => tr.season_label === latest.season_label && tr.team_id === latest.team_id
  );
  const role = squadRole(latest, num(teamRow?.played) ?? 38);
  const age = playerAge(info?.birth_date);
  const isKeeper = latest.position_code === "G";

  const facts: Array<[string, string]> = [
    [t("tff1.drawerAge"), age !== null ? String(age) : "—"],
    [t("tff1.drawerHeight"), info?.height_cm ? `${info.height_cm} cm` : "—"],
    [t("tff1.drawerCountry"), info?.country ?? "—"],
    [t("tff1.drawerMarketValue"), formatMarketValue(mv?.market_value_eur)],
  ];

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <Link
          href="/dashboard/tff-1-lig"
          className="text-[13px] text-ink-3 transition hover:text-ink"
        >
          ← {t("tff1.backToLeague")}
        </Link>

        <div className="mt-4 flex flex-wrap items-start gap-5">
          {info?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={info.photo_url}
              alt={latest.player_name ?? ""}
              className="h-20 w-20 rounded-2xl border border-line bg-veil object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-veil text-2xl font-semibold text-ink-3">
              {(latest.player_name ?? "?").slice(0, 1)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-ink lg:text-3xl">
              {latest.player_name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              <span>{positionLabel(latest, locale)}</span>
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[11px] ${ROLE_CHIP_CLASS[role]}`}
              >
                {t(ROLE_LABEL_KEYS[role])}
              </span>
              <Link
                href={`/dashboard/tff-1-lig/team/${latest.team_id}?season=${encodeURIComponent(latest.season_label)}`}
                className="flex items-center gap-1.5 transition hover:text-accent-ink hover:underline"
              >
                {latest.team_id && logoByTeam[latest.team_id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoByTeam[latest.team_id]}
                    alt=""
                    style={{ width: 16, height: 16 }}
                    className="object-contain"
                  />
                ) : null}
                {latest.teams && latest.teams !== latest.team_name
                  ? latest.teams
                  : latest.team_name}
              </Link>
            </div>

            <div className="mt-4 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
              {facts.map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line bg-veil px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("tff1.drawerSeasons")}
        </h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                <th className="px-3 py-2 font-medium">{t("tff1.seasonLabel")}</th>
                <th className="px-3 py-2 font-medium">{t("tff1.colTeam")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colAppearances")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colStarts")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colMinutes")}</th>
                <th className="px-3 py-2 text-right font-medium">
                  {isKeeper ? t("tff1.colSaves") : t("tff1.colGoals")}
                </th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colAssists")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colXg")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colRating")}</th>
              </tr>
            </thead>
            <tbody>
              {seasonRows.map((row) => (
                <tr key={row.season_label} className="border-t border-line text-ink">
                  <td className="px-3 py-2">{row.season_label}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-2">
                    {row.teams && row.teams !== row.team_name ? row.teams : row.team_name}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.appearances)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.starts)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.minutes)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {isKeeper ? fmt(row.saves) : fmt(row.goals)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.assists)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.xg === null ? "—" : fmt(row.xg, 2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.rating_avg === null ? "—" : fmt(row.rating_avg, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {seasonRows.map((row) => (
          <div key={row.season_label}>
            <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {t("tff1.drawerSeasonDetail", { season: row.season_label })}
            </h2>
            <div className="mt-2 overflow-x-auto rounded-lg border border-line">
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

        <p className="mt-4 text-[12px] text-ink-3">
          {t("tff1.playoffNote")} {t("tff1.fsNote")} {t("tff1.drawerValueNote")}
        </p>
      </div>
    </section>
  );
}
