"use client";

import { useMemo, useState } from "react";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import type { Tff1PlayerRow, Tff1TeamRow } from "../types";

type Tff1ExplorerProps = {
  players: Tff1PlayerRow[];
  teams: Tff1TeamRow[];
};

type ViewMode = "players" | "teams";

type MetricGroup =
  | "general"
  | "attack"
  | "passing"
  | "defense"
  | "physical"
  | "keeper";

type NumFormat = "int" | "dec1" | "dec2" | "pct";

type ColumnDef<Row> = {
  key: keyof Row & string;
  labelKey: string;
  format?: NumFormat;
};

const PLAYER_GROUP_COLUMNS: Record<MetricGroup, ColumnDef<Tff1PlayerRow>[]> = {
  general: [
    { key: "appearances", labelKey: "tff1.colAppearances" },
    { key: "starts", labelKey: "tff1.colStarts" },
    { key: "minutes", labelKey: "tff1.colMinutes" },
    { key: "goals", labelKey: "tff1.colGoals" },
    { key: "assists", labelKey: "tff1.colAssists" },
    { key: "xg", labelKey: "tff1.colXg", format: "dec2" },
    { key: "yellow_cards", labelKey: "tff1.colYellowCards" },
    { key: "red_cards", labelKey: "tff1.colRedCards" },
    { key: "rating_avg", labelKey: "tff1.colRating", format: "dec2" },
  ],
  attack: [
    { key: "goals", labelKey: "tff1.colGoals" },
    { key: "xg", labelKey: "tff1.colXg", format: "dec2" },
    { key: "xgot", labelKey: "tff1.colXgot", format: "dec2" },
    { key: "assists", labelKey: "tff1.colAssists" },
    { key: "xa", labelKey: "tff1.colXa", format: "dec2" },
    { key: "shots", labelKey: "tff1.colShots" },
    { key: "shots_on_target", labelKey: "tff1.colShotsOnTarget" },
    { key: "big_chances_missed", labelKey: "tff1.colBigChancesMissed" },
    { key: "hit_woodwork", labelKey: "tff1.colHitWoodwork" },
    { key: "dribbles_won", labelKey: "tff1.colDribblesWon" },
    { key: "dribbles_attempted", labelKey: "tff1.colDribblesAttempted" },
    { key: "was_fouled", labelKey: "tff1.colWasFouled" },
    { key: "offsides", labelKey: "tff1.colOffsides" },
  ],
  passing: [
    { key: "total_passes", labelKey: "tff1.colPasses" },
    { key: "accurate_passes", labelKey: "tff1.colAccuratePasses" },
    { key: "pass_accuracy", labelKey: "tff1.colPassAccuracy", format: "pct" },
    { key: "key_passes", labelKey: "tff1.colKeyPasses" },
    { key: "big_chances_created", labelKey: "tff1.colBigChancesCreated" },
    { key: "crosses", labelKey: "tff1.colCrosses" },
    { key: "accurate_crosses", labelKey: "tff1.colAccurateCrosses" },
    { key: "long_balls", labelKey: "tff1.colLongBalls" },
    { key: "accurate_long_balls", labelKey: "tff1.colAccurateLongBalls" },
  ],
  defense: [
    { key: "tackles", labelKey: "tff1.colTackles" },
    { key: "tackles_won", labelKey: "tff1.colTacklesWon" },
    { key: "interceptions", labelKey: "tff1.colInterceptions" },
    { key: "clearances", labelKey: "tff1.colClearances" },
    { key: "blocks", labelKey: "tff1.colBlocks" },
    { key: "ball_recoveries", labelKey: "tff1.colBallRecoveries" },
    { key: "duels_won", labelKey: "tff1.colDuelsWon" },
    { key: "duels_lost", labelKey: "tff1.colDuelsLost" },
    { key: "aerials_won", labelKey: "tff1.colAerialsWon" },
    { key: "fouls", labelKey: "tff1.colFouls" },
  ],
  physical: [
    { key: "appearances", labelKey: "tff1.colAppearances" },
    { key: "minutes", labelKey: "tff1.colMinutes" },
    { key: "km_covered", labelKey: "tff1.colKmCovered", format: "dec1" },
    { key: "sprints", labelKey: "tff1.colSprints" },
    { key: "top_speed", labelKey: "tff1.colTopSpeed", format: "dec1" },
  ],
  keeper: [
    { key: "appearances", labelKey: "tff1.colAppearances" },
    { key: "minutes", labelKey: "tff1.colMinutes" },
    { key: "saves", labelKey: "tff1.colSaves" },
    { key: "penalties_saved", labelKey: "tff1.colPenaltiesSaved" },
    { key: "errors_leading_to_shot", labelKey: "tff1.colErrorsToShot" },
    { key: "errors_leading_to_goal", labelKey: "tff1.colErrorsToGoal" },
    { key: "rating_avg", labelKey: "tff1.colRating", format: "dec2" },
  ],
};

const GROUP_DEFAULT_SORT: Record<MetricGroup, keyof Tff1PlayerRow & string> = {
  general: "minutes",
  attack: "goals",
  passing: "total_passes",
  defense: "tackles",
  physical: "km_covered",
  keeper: "saves",
};

const GROUP_LABEL_KEYS: Record<MetricGroup, string> = {
  general: "tff1.groupGeneral",
  attack: "tff1.groupAttack",
  passing: "tff1.groupPassing",
  defense: "tff1.groupDefense",
  physical: "tff1.groupPhysical",
  keeper: "tff1.groupKeeper",
};

const TEAM_COLUMNS: ColumnDef<Tff1TeamRow>[] = [
  { key: "played", labelKey: "tff1.colPlayed" },
  { key: "wins", labelKey: "tff1.colWins" },
  { key: "draws", labelKey: "tff1.colDraws" },
  { key: "losses", labelKey: "tff1.colLosses" },
  { key: "goals_for", labelKey: "tff1.colGoalsFor" },
  { key: "goals_against", labelKey: "tff1.colGoalsAgainst" },
  { key: "goal_diff", labelKey: "tff1.colGoalDiff" },
  { key: "points", labelKey: "tff1.colPoints" },
  { key: "clean_sheets", labelKey: "tff1.colCleanSheets" },
  { key: "win_pct", labelKey: "tff1.colWinPct", format: "pct" },
  { key: "shots", labelKey: "tff1.colShots" },
  { key: "shots_on_target", labelKey: "tff1.colShotsOnTarget" },
  { key: "pass_accuracy", labelKey: "tff1.colPassAccuracy", format: "pct" },
  { key: "key_passes", labelKey: "tff1.colKeyPasses" },
  { key: "big_chances_created", labelKey: "tff1.colBigChancesCreated" },
  { key: "tackles", labelKey: "tff1.colTackles" },
  { key: "interceptions", labelKey: "tff1.colInterceptions" },
  { key: "fouls", labelKey: "tff1.colFouls" },
  { key: "rating_avg", labelKey: "tff1.colRating", format: "dec2" },
  { key: "km_per_match", labelKey: "tff1.colKmPerMatch", format: "dec1" },
];

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

function formatValue(
  value: number | string | null | undefined,
  format: NumFormat = "int"
): string {
  const num = toNumber(value);
  if (num === null) return "—";
  switch (format) {
    case "dec1":
      return num.toFixed(1);
    case "dec2":
      return num.toFixed(2);
    case "pct":
      return `${num.toFixed(1)}%`;
    default:
      return String(Math.round(num));
  }
}

const headerCellClass =
  "cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium transition hover:text-ink-2";

export default function Tff1Explorer({ players, teams }: Tff1ExplorerProps) {
  const { t } = useI18n();

  const seasons = useMemo(() => {
    const set = new Set<string>();
    for (const row of players) set.add(row.season_label);
    for (const row of teams) set.add(row.season_label);
    return Array.from(set).sort().reverse();
  }, [players, teams]);

  const [view, setView] = useState<ViewMode>("players");
  const [season, setSeason] = useState<string>(seasons[0] ?? "2025/2026");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<MetricGroup>("general");
  const [sortKey, setSortKey] = useState<string>(GROUP_DEFAULT_SORT.general);
  const [sortAsc, setSortAsc] = useState(false);

  function handleGroupChange(next: MetricGroup) {
    setGroup(next);
    setSortKey(GROUP_DEFAULT_SORT[next]);
    setSortAsc(false);
  }

  function handleViewChange(next: ViewMode) {
    setView(next);
    setSearch("");
    if (next === "teams") {
      setSortKey("points");
    } else {
      setSortKey(GROUP_DEFAULT_SORT[group]);
    }
    setSortAsc(false);
  }

  function handleSort(key: string, textColumn = false) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(textColumn);
    }
  }

  const sortIndicator = (key: string) =>
    sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  const compare = (
    a: Record<string, unknown>,
    b: Record<string, unknown>
  ): number => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const an = toNumber(av as number | string | null);
    const bn = toNumber(bv as number | string | null);
    let result: number;
    if (an !== null || bn !== null) {
      result = (an ?? -Infinity) - (bn ?? -Infinity);
    } else {
      result = String(av ?? "").localeCompare(String(bv ?? ""), "tr");
    }
    return sortAsc ? result : -result;
  };

  const playerColumns = PLAYER_GROUP_COLUMNS[group];

  const visiblePlayers = useMemo(() => {
    const needle = normalizeSearchText(search.trim());
    let rows = players.filter((row) => row.season_label === season);
    if (group === "keeper") {
      rows = rows.filter((row) => row.position_code === "G");
    }
    if (needle) {
      rows = rows.filter((row) =>
        normalizeSearchText(
          `${row.player_name ?? ""} ${row.teams ?? row.team_name ?? ""}`
        ).includes(needle)
      );
    }
    return [...rows].sort((a, b) =>
      compare(a as Record<string, unknown>, b as Record<string, unknown>)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, season, search, group, sortKey, sortAsc]);

  const visibleTeams = useMemo(() => {
    const needle = normalizeSearchText(search.trim());
    let rows = teams.filter((row) => row.season_label === season);
    if (needle) {
      rows = rows.filter((row) =>
        normalizeSearchText(row.team_name ?? "").includes(needle)
      );
    }
    return [...rows].sort((a, b) =>
      compare(a as Record<string, unknown>, b as Record<string, unknown>)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, season, search, sortKey, sortAsc]);

  const segmentClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
      active ? "bg-card-2 text-ink" : "text-ink-2 hover:bg-veil hover:text-ink"
    }`;

  const chipClass = (active: boolean) =>
    `rounded-md border px-2.5 py-1 text-[12px] transition ${
      active
        ? "border-line-strong bg-card-2 text-ink"
        : "border-line bg-veil text-ink-2 hover:border-line-strong hover:text-ink"
    }`;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-line bg-veil p-1">
          <button
            type="button"
            onClick={() => handleViewChange("players")}
            className={segmentClass(view === "players")}
          >
            {t("tff1.playersTab")}
          </button>
          <button
            type="button"
            onClick={() => handleViewChange("teams")}
            className={segmentClass(view === "teams")}
          >
            {t("tff1.teamsTab")}
          </button>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <span>{t("tff1.seasonLabel")}</span>
          <select
            value={season}
            onChange={(event) => setSeason(event.target.value)}
            className="rounded-lg border border-line bg-field px-2.5 py-1.5 text-[13px] text-ink focus:border-line-strong"
          >
            {seasons.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("tff1.searchPlaceholder")}
          className="min-w-[220px] flex-1 rounded-xl border border-line bg-veil px-4 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-line-strong focus:bg-card-2 md:max-w-sm"
        />

        <span className="text-[12px] text-ink-3">
          {view === "players"
            ? t("tff1.playersCount", { count: visiblePlayers.length })
            : t("tff1.teamsCount", { count: visibleTeams.length })}
        </span>
      </div>

      {view === "players" ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(Object.keys(GROUP_LABEL_KEYS) as MetricGroup[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleGroupChange(option)}
              className={chipClass(group === option)}
            >
              {t(GROUP_LABEL_KEYS[option])}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-line">
        <div className="overflow-x-auto">
          {view === "players" ? (
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
                  <th className="whitespace-nowrap px-3 py-2 font-medium">#</th>
                  <th
                    className={headerCellClass}
                    onClick={() => handleSort("player_name", true)}
                  >
                    {t("tff1.colPlayer")}
                    {sortIndicator("player_name")}
                  </th>
                  <th
                    className={headerCellClass}
                    onClick={() => handleSort("team_name", true)}
                  >
                    {t("tff1.colTeam")}
                    {sortIndicator("team_name")}
                  </th>
                  <th
                    className={headerCellClass}
                    onClick={() => handleSort("position_code", true)}
                  >
                    {t("tff1.colPosition")}
                    {sortIndicator("position_code")}
                  </th>
                  {playerColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`${headerCellClass} text-right`}
                      onClick={() => handleSort(col.key)}
                    >
                      {t(col.labelKey)}
                      {sortIndicator(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.map((row, index) => (
                  <tr
                    key={`${row.season_label}-${row.player_id}`}
                    className="border-t border-line text-[13px] text-ink transition hover:bg-veil"
                  >
                    <td className="px-3 py-2 text-ink-3">{index + 1}</td>
                    <td
                      className="whitespace-nowrap px-3 py-2 font-medium"
                      title={
                        row.teams && row.teams.includes(",")
                          ? t("tff1.multiTeamHint", { teams: row.teams })
                          : undefined
                      }
                    >
                      {row.player_name ?? "—"}
                      {row.teams && row.teams.includes(",") ? (
                        <span className="ml-1 text-ink-3">*</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-2">
                      {row.team_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-ink-2">
                      {row.position_code ?? "—"}
                    </td>
                    {playerColumns.map((col) => (
                      <td
                        key={col.key}
                        className="whitespace-nowrap px-3 py-2 text-right tabular-nums"
                      >
                        {formatValue(
                          row[col.key] as number | string | null,
                          col.format
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
                  <th className="whitespace-nowrap px-3 py-2 font-medium">#</th>
                  <th
                    className={headerCellClass}
                    onClick={() => handleSort("team_name", true)}
                  >
                    {t("tff1.colTeam")}
                    {sortIndicator("team_name")}
                  </th>
                  {TEAM_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`${headerCellClass} text-right`}
                      onClick={() => handleSort(col.key)}
                    >
                      {t(col.labelKey)}
                      {sortIndicator(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleTeams.map((row, index) => (
                  <tr
                    key={`${row.season_label}-${row.team_id}`}
                    className="border-t border-line text-[13px] text-ink transition hover:bg-veil"
                  >
                    <td className="px-3 py-2 text-ink-3">{index + 1}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">
                      {row.team_name ?? "—"}
                    </td>
                    {TEAM_COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className="whitespace-nowrap px-3 py-2 text-right tabular-nums"
                      >
                        {formatValue(
                          row[col.key] as number | string | null,
                          col.format
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {(view === "players" ? visiblePlayers : visibleTeams).length === 0 ? (
          <div className="border-t border-line p-6 text-sm text-ink-2">
            {t("tff1.noRows")}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-[12px] text-ink-3">
        {t("tff1.playoffNote")} {t("tff1.fsNote")}
      </p>
    </div>
  );
}
