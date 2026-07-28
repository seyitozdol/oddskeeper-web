"use client";

import { useI18n } from "../../../lib/i18n/LanguageProvider";
import {
  formatMarketValue,
  playerAge,
  positionLabel,
  ROLE_CHIP_CLASS,
  ROLE_LABEL_KEYS,
  squadRole,
} from "../lib";
import type { Tff1MarketValue, Tff1PlayerInfo, Tff1PlayerRow, Tff1TeamRow } from "../types";

type Tff1PlayerDrawerProps = {
  seasonRows: Tff1PlayerRow[]; // oyuncunun tum sezon satirlari (yeniden eskiye)
  info?: Tff1PlayerInfo;
  marketValue?: Tff1MarketValue;
  teams: Tff1TeamRow[];
  onClose: () => void;
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

function pct(acc: number | null, total: number | null): string {
  if (!total) return "—";
  return `${((100 * (acc ?? 0)) / total).toFixed(1)}%`;
}

export default function Tff1PlayerDrawer({
  seasonRows,
  info,
  marketValue,
  teams,
  onClose,
}: Tff1PlayerDrawerProps) {
  const { t, locale } = useI18n();
  const latest = seasonRows[0];
  if (!latest) return null;

  const teamRow = teams.find(
    (tr) => tr.season_label === latest.season_label && tr.team_id === latest.team_id
  );
  const role = squadRole(latest, teamRow?.played ?? 38);
  const age = playerAge(info?.birth_date);

  const facts: Array<[string, string]> = [
    [t("tff1.drawerAge"), age !== null ? String(age) : "—"],
    [t("tff1.drawerHeight"), info?.height_cm ? `${info.height_cm} cm` : "—"],
    [t("tff1.drawerCountry"), info?.country ?? "—"],
    [t("tff1.drawerMarketValue"), formatMarketValue(marketValue?.market_value_eur)],
  ];

  const detail: Array<[string, string]> = [
    [t("tff1.colShots"), fmt(latest.shots)],
    [t("tff1.colShotsOnTarget"), fmt(latest.shots_on_target)],
    [t("tff1.colXg"), latest.xg === null ? "—" : fmt(latest.xg, 2)],
    [t("tff1.colXa"), latest.xa === null ? "—" : fmt(latest.xa, 2)],
    [t("tff1.colPassAccuracy"), pct(num(latest.accurate_passes), num(latest.total_passes))],
    [t("tff1.colKeyPasses"), fmt(latest.key_passes)],
    [t("tff1.colBigChancesCreated"), fmt(latest.big_chances_created)],
    [t("tff1.colTackles"), fmt(latest.tackles)],
    [t("tff1.colInterceptions"), fmt(latest.interceptions)],
    [t("tff1.colDuelsWon"), fmt(latest.duels_won)],
    [t("tff1.colAerialsWon"), fmt(latest.aerials_won)],
    [t("tff1.colDribblesWon"), fmt(latest.dribbles_won)],
    [t("tff1.colYellowCards"), latest.yellow_cards === null ? "—" : fmt(latest.yellow_cards)],
    [t("tff1.colRedCards"), latest.red_cards === null ? "—" : fmt(latest.red_cards)],
    [t("tff1.colKmCovered"), latest.km_covered === null ? "—" : fmt(latest.km_covered, 1)],
    [t("tff1.colTopSpeed"), latest.top_speed === null ? "—" : `${fmt(latest.top_speed, 1)} km/s`],
  ];

  const isKeeper = latest.position_code === "G";

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-line bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">{latest.player_name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
              <span>{positionLabel(latest, locale)}</span>
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[11px] ${ROLE_CHIP_CLASS[role]}`}
              >
                {t(ROLE_LABEL_KEYS[role])}
              </span>
            </div>
            <p className="mt-1 text-[13px] text-ink-3">
              {latest.teams && latest.teams !== latest.team_name
                ? latest.teams
                : latest.team_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-veil px-2.5 py-1 text-[13px] text-ink-2 transition hover:border-line-strong hover:text-ink"
          >
            {t("tff1.drawerClose")}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {facts.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-veil px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{label}</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("tff1.drawerSeasons")}
        </h3>
        <div className="mt-2 overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                <th className="px-3 py-2 font-medium">{t("tff1.seasonLabel")}</th>
                <th className="px-3 py-2 font-medium">{t("tff1.colTeam")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colAppearances")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colMinutes")}</th>
                <th className="px-3 py-2 text-right font-medium">
                  {isKeeper ? t("tff1.colSaves") : t("tff1.colGoals")}
                </th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colAssists")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colRating")}</th>
              </tr>
            </thead>
            <tbody>
              {seasonRows.map((row) => (
                <tr key={row.season_label} className="border-t border-line text-ink">
                  <td className="px-3 py-2">{row.season_label}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-2">{row.team_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.appearances)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.minutes)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {isKeeper ? fmt(row.saves) : fmt(row.goals)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.assists)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.rating_avg === null ? "—" : fmt(row.rating_avg, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("tff1.drawerSeasonDetail", { season: latest.season_label })}
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-line bg-veil p-3">
          {detail.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-2 py-0.5">
              <span className="text-[12px] text-ink-3">{label}</span>
              <span className="text-[13px] font-medium tabular-nums text-ink">{value}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[11px] text-ink-3">{t("tff1.drawerValueNote")}</p>
      </aside>
    </div>
  );
}
