"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { exportFileName } from "@/lib/model-history";
import AddToMmiButton, { type MmiFile } from "@/components/AddToMmiButton";
import TeamCrest from "@/features/tsl/shared/TeamCrest";
import { getTeamLogoPath } from "@/features/player-detail/utils/getTeamLogoPath";
import {
  completedRoundSet,
  fetchBets10Links,
  fetchFixtureInputs,
  fetchFixtures,
  fetchManualFixtures,
  fetchTeamLogos,
  fixtureStarted,
  type Bets10Link,
  type FixtureInput,
  type FixtureRow,
} from "@/features/tsl/resmi/matchStatsModel/queries";
import {
  DEFAULT_EXTRA_CONFIG,
  DYNAMIC_HEADERS,
  STATIC_HEADERS,
  buildExtraMarketRows,
  defaultProfile,
  isSpecialTemplate,
  type ExtraCell,
  type ExtraConfig,
  type ExtraMarket,
  type ExtraSelection,
  type GoalTypeConfig,
} from "./engine";
import {
  fetchExtraConfig,
  fetchExtraFixtureChoices,
  saveExtraConfig,
  saveExtraFixtureChoices,
  type ExtraFixtureChoice,
} from "./queries";

// Extra Markets (futbol Extras sekmesi): "Extra_Markets_v3.xlsm" makrosunun web hali.
// Fikstur: mac + profil + No Goal; Profiller: Excel Profiles tablosu (ligler arasi
// ortak); Input: uretilen Dynamic ve Static dosyalari (Export + Add to MMI).

export type ExtrasLeague = "tsl" | "tff1" | "cup" | "trnat";

const LEAGUE_TAG: Record<ExtrasLeague, string> = { tsl: "TSL", tff1: "1Lig", cup: "Cup", trnat: "TR" };
const TABS = ["fixtures", "input", "profiles"] as const;
type Tab = (typeof TABS)[number];
const TAB_KEY: Record<Tab, string> = {
  fixtures: "extras.tabFixtures",
  input: "extras.tabInput",
  profiles: "extras.tabProfiles",
};
type SaveStatus = "" | "saving" | "ok" | "err";

const NO_SPINNER =
  "appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const inp = `rounded border border-line bg-field px-1.5 py-0.5 text-[11px] text-ink focus:outline-none focus:border-accent ${NO_SPINNER}`;
const btnPrimary =
  "rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:opacity-90 disabled:opacity-50";
const btnGhost =
  "rounded-md border border-line bg-field px-3 py-1.5 text-xs text-ink-2 hover:bg-veil disabled:opacity-50";

const numOrNull = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export default function ExtraMarkets({ league }: { league: ExtrasLeague }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("fixtures");

  const [config, setConfig] = useState<ExtraConfig>(DEFAULT_EXTRA_CONFIG);
  const [configDirty, setConfigDirty] = useState(false);
  const [configStatus, setConfigStatus] = useState<SaveStatus>("");

  const [allFixtures, setAllFixtures] = useState<FixtureRow[]>([]);
  const [manuals, setManuals] = useState<FixtureRow[]>([]);
  const [inputs, setInputs] = useState<Record<string, FixtureInput>>({});
  const [links, setLinks] = useState<Record<string, Bets10Link>>({});
  const [teamLogos, setTeamLogos] = useState<Record<string, string> | null>(null);
  const [roundSel, setRoundSel] = useState<number | null>(null);
  // Mac basina profil + No Goal: kayitli degerler + bu oturumdaki duzenlemeler.
  const [choices, setChoices] = useState<Record<string, ExtraFixtureChoice>>({});
  // Dosyaya girecek maclar; isaretlenmemisse varsayilan: ID'si olan ve baslamamis mac.
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [fixtureStatus, setFixtureStatus] = useState<SaveStatus>("");

  useEffect(() => {
    fetchExtraConfig().then(setConfig);
  }, []);
  useEffect(() => {
    fetchFixtures(league).then(setAllFixtures);
    fetchManualFixtures(league).then(setManuals);
    fetchFixtureInputs(league).then(setInputs);
    fetchBets10Links(league).then(setLinks);
    fetchTeamLogos(league).then(setTeamLogos);
  }, [league]);

  // Hafta listesi: aktif haftalar ustte, tamamlananlar altta (MSM Fixture sekmesiyle ayni).
  const completedRounds = useMemo(() => completedRoundSet(allFixtures), [allFixtures]);
  const roundOptions = useMemo(() => {
    const rounds = [...new Set(allFixtures.map((f) => f.round))].sort((a, b) => a - b);
    return [...rounds.filter((r) => !completedRounds.has(r)), ...rounds.filter((r) => completedRounds.has(r))];
  }, [allFixtures, completedRounds]);
  const round = roundSel ?? roundOptions[0] ?? null;

  // Manuel fiksturler her zaman ustte ve haftadan bagimsiz (kupada yalniz bunlar var).
  const rows = useMemo(
    () => [...manuals, ...allFixtures.filter((f) => f.round === round)],
    [manuals, allFixtures, round]
  );

  const rowIds = useMemo(() => rows.map((f) => f.fixtureId).join(","), [rows]);
  useEffect(() => {
    if (!rowIds) return;
    let alive = true;
    fetchExtraFixtureChoices(league, rowIds.split(",")).then((loaded) => {
      // Bu oturumda duzenlenen deger kayitli degerin onune gecer.
      if (alive) setChoices((prev) => ({ ...loaded, ...prev }));
    });
    return () => {
      alive = false;
    };
  }, [league, rowIds]);

  const logoFor = (slug: string): string | null => (teamLogos ? (teamLogos[slug] ?? null) : getTeamLogoPath(slug));

  // Dosyaya yazilan Fixture ID: MSM Fixture sekmesinde kaydedilen, yoksa Bets10 onerisi.
  const extId = (f: FixtureRow): string =>
    inputs[f.fixtureId]?.externalFixtureId?.trim() || links[f.fixtureId]?.bets10EventId || "";

  const choiceOf = (f: FixtureRow): ExtraFixtureChoice => {
    const saved = choices[f.fixtureId];
    const fallback = defaultProfile(
      league,
      { slug: f.homeSlug, name: f.homeName },
      { slug: f.awaySlug, name: f.awayName }
    );
    const profile = saved && config.profiles.includes(saved.profile) ? saved.profile : fallback;
    return { profile, noGoal: saved?.noGoal ?? null };
  };
  const editChoice = (f: FixtureRow, patch: Partial<ExtraFixtureChoice>) =>
    setChoices((prev) => ({ ...prev, [f.fixtureId]: { ...choiceOf(f), ...patch } }));

  const isIncluded = (f: FixtureRow): boolean =>
    !!extId(f) && (included[f.fixtureId] ?? !fixtureStarted(f));
  const eligible = rows.filter((f) => !!extId(f));
  const selected = rows.filter(isIncluded);
  const allOn = eligible.length > 0 && selected.length === eligible.length;
  const toggleAll = () =>
    setIncluded((prev) => ({ ...prev, ...Object.fromEntries(eligible.map((f) => [f.fixtureId, !allOn])) }));

  const noExtra = (profile: string) => config.noExtraProfiles.includes(profile);

  async function saveFixtures() {
    setFixtureStatus("saving");
    const ok = await saveExtraFixtureChoices(
      league,
      rows.map((f) => {
        const c = choiceOf(f);
        return { fixture_id: f.fixtureId, profile: c.profile, no_goal: c.noGoal };
      })
    );
    setFixtureStatus(ok ? "ok" : "err");
    setTimeout(() => setFixtureStatus(""), 2500);
  }

  async function saveConfig() {
    setConfigStatus("saving");
    const ok = await saveExtraConfig(config);
    setConfigStatus(ok ? "ok" : "err");
    if (ok) setConfigDirty(false);
    setTimeout(() => setConfigStatus(""), 2500);
  }
  const patchConfig = (patch: Partial<ExtraConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
    setConfigDirty(true);
  };

  // Secili maclardan uretilen satirlar (kaydedilmemis profil duzenlemeleri de dahil).
  const result = buildExtraMarketRows(
    config,
    selected.map((f) => {
      const c = choiceOf(f);
      return { fixtureId: extId(f), label: f.label, profile: c.profile, noGoal: c.noGoal };
    })
  );

  const statusNote = (s: SaveStatus) =>
    s === "ok" ? (
      <span className="text-xs text-pos">{t("extras.saved")}</span>
    ) : s === "err" ? (
      <span className="text-xs text-neg">{t("extras.saveFailed")}</span>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-line">
        {TABS.map((tb) => (
          <button
            key={tb}
            type="button"
            onClick={() => setTab(tb)}
            className={`rounded-t-md px-3 py-1.5 text-sm ${
              tab === tb ? "bg-veil font-semibold text-ink" : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {t(TAB_KEY[tb])}
            {tb === "input" && selected.length > 0 ? ` (${result.dynamic.length + result.static.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "fixtures" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {roundOptions.length > 0 && (
              <>
                <label className="text-[11px] uppercase tracking-wide text-ink-3">{t("extras.round")}</label>
                <select
                  className="rounded-md border border-line bg-field px-2 py-1 text-sm text-ink"
                  value={round ?? ""}
                  onChange={(e) => setRoundSel(parseInt(e.target.value))}
                >
                  {roundOptions.map((r) => (
                    <option key={r} value={r} className="bg-field text-ink">
                      {r}
                    </option>
                  ))}
                </select>
              </>
            )}
            <span className="text-xs text-ink-3">{t("extras.selectedCount", { n: selected.length })}</span>
            <div className="ml-auto flex items-center gap-2">
              {statusNote(fixtureStatus)}
              <button onClick={saveFixtures} disabled={fixtureStatus === "saving" || rows.length === 0} className={btnPrimary}>
                {t("extras.save")}
              </button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-line bg-card px-5 py-10 text-center text-sm text-ink-3">
              {t("extras.noFixtures")}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-card">
              <table className="text-left text-[12px]">
                <thead className="bg-card-2 text-[10px] uppercase tracking-wide text-ink-3">
                  <tr>
                    <th className="px-2 py-2">
                      <input type="checkbox" checked={allOn} disabled={eligible.length === 0} onChange={toggleAll} />
                    </th>
                    <th className="px-2 py-2">{t("extras.colMatch")}</th>
                    <th className="px-2 py-2">{t("extras.colFixtureId")}</th>
                    <th className="px-2 py-2">{t("extras.colProfile")}</th>
                    <th className="px-2 py-2" title={t("extras.noGoalHint")}>
                      {t("extras.colNoGoal")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((f) => {
                    const id = extId(f);
                    const c = choiceOf(f);
                    const skip = noExtra(c.profile);
                    return (
                      <tr key={f.fixtureId} className="border-t border-line/60 hover:bg-veil">
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={isIncluded(f)}
                            disabled={!id}
                            onChange={(e) => setIncluded((prev) => ({ ...prev, [f.fixtureId]: e.target.checked }))}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-ink">
                          <span className="flex items-center gap-1.5">
                            <TeamCrest logo={logoFor(f.homeSlug)} name={f.homeName} size="xs" />
                            <span>{f.homeName}</span>
                            <span className="text-ink-3">-</span>
                            <TeamCrest logo={logoFor(f.awaySlug)} name={f.awayName} size="xs" />
                            <span>{f.awayName}</span>
                            {fixtureStarted(f) && (
                              <span className="ml-1 rounded bg-veil px-1 py-0.5 text-[9px] font-semibold uppercase text-ink-3">
                                {t("extras.started")}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-ink-2">
                          {id || (
                            <span
                              title={t("extras.noIdHint")}
                              className="rounded border border-warn/40 bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold text-warn"
                            >
                              {t("extras.noId")}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            className="rounded border border-line bg-field px-1.5 py-0.5 text-[12px] text-ink"
                            value={c.profile}
                            onChange={(e) => editChoice(f, { profile: e.target.value })}
                          >
                            {config.profiles.map((p) => (
                              <option key={p} value={p} className="bg-field text-ink">
                                {p}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            disabled={skip}
                            title={skip ? t("extras.noGoalNotUsed") : t("extras.noGoalHint")}
                            className={`${inp} w-16 disabled:opacity-40`}
                            value={skip ? "" : (c.noGoal ?? "")}
                            onChange={(e) => editChoice(f, { noGoal: numOrNull(e.target.value) })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === "input" ? (
        <div className="space-y-4">
          {result.warnings.length > 0 && (
            <div className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-[12px] text-warn">
              <div className="font-semibold">{t("extras.warnTitle")}</div>
              <ul className="mt-1 list-disc pl-4">
                {result.warnings.map((w, i) => (
                  <li key={i}>
                    {w.kind === "profileMissing"
                      ? t("extras.warnProfileMissing", { match: w.label })
                      : w.kind === "noGoalMissing"
                        ? t("extras.warnNoGoalMissing", { match: w.label, tpl: w.template ?? "" })
                        : t("extras.warnNoGoalTooLow", { match: w.label, tpl: w.template ?? "" })}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <OutputPanel
            title={t("extras.dynamicTitle")}
            fileLabel={`Extra Markets_${LEAGUE_TAG[league]}_Dynamic`}
            headers={DYNAMIC_HEADERS}
            rows={result.dynamic}
          />
          <OutputPanel
            title={t("extras.staticTitle")}
            fileLabel={`Extra Markets_${LEAGUE_TAG[league]}_Static`}
            headers={STATIC_HEADERS}
            rows={result.static}
          />
        </div>
      ) : (
        <ProfilesTab
          config={config}
          dirty={configDirty}
          status={configStatus}
          statusNote={statusNote(configStatus)}
          onPatch={patchConfig}
          onSave={saveConfig}
        />
      )}
    </div>
  );
}

// Uretilen dosyalardan biri: onizleme + Export .xlsx + Add to MMI. Iki dosya ayri gonderilir.
function OutputPanel({
  title,
  fileLabel,
  headers,
  rows,
}: {
  title: string;
  fileLabel: string;
  headers: string[];
  rows: ExtraCell[][];
}) {
  const { t } = useI18n();

  // Excel makrosundaki gibi tek sayfa "Input"; Fixture ID metin olarak yazilir.
  async function buildBook() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Input");
    return { XLSX, wb, filename: `${exportFileName(fileLabel)}.xlsx` };
  }
  async function exportXlsx() {
    const { XLSX, wb, filename } = await buildBook();
    XLSX.writeFile(wb, filename);
  }
  async function buildMmiFile(): Promise<MmiFile> {
    const { XLSX, wb, filename } = await buildBook();
    return { filename, data: XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer };
  }

  return (
    <div className="rounded-xl border border-line bg-card">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="text-xs text-ink-3">
          {rows.length} {t("extras.rows")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={exportXlsx} disabled={rows.length === 0} className={btnPrimary}>
            {t("extras.export")}
          </button>
          <AddToMmiButton build={buildMmiFile} disabled={rows.length === 0} className={btnPrimary} />
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="border-t border-line px-5 py-8 text-center text-sm text-ink-3">{t("extras.emptyOutput")}</div>
      ) : (
        <div className="max-h-[40vh] overflow-auto border-t border-line">
          <table className="min-w-full border-collapse text-left text-[11px] tabular-nums">
            <thead className="sticky top-0 bg-card-2 text-[10px] uppercase tracking-wide text-ink-3">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-1.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line/60 hover:bg-veil">
                  {headers.map((h, j) => (
                    <td key={h} className="whitespace-nowrap px-2 py-1 text-ink-2">
                      {r[j] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProfilesTab({
  config,
  dirty,
  status,
  statusNote,
  onPatch,
  onSave,
}: {
  config: ExtraConfig;
  dirty: boolean;
  status: SaveStatus;
  statusNote: React.ReactNode;
  onPatch: (patch: Partial<ExtraConfig>) => void;
  onSave: () => void;
}) {
  const { t } = useI18n();

  const patchMarket = (i: number, patch: Partial<ExtraMarket>) =>
    onPatch({ markets: config.markets.map((m, k) => (k === i ? { ...m, ...patch } : m)) });
  const patchSelection = (key: "extraTime1h" | "extraTime2h", i: number, patch: Partial<ExtraSelection>) =>
    onPatch({ [key]: config[key].map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const patchGoal = (patch: Partial<GoalTypeConfig>) => onPatch({ goalType: { ...config.goalType, ...patch } });
  const toggleExtras = (profile: string, on: boolean) =>
    onPatch({
      noExtraProfiles: on
        ? config.noExtraProfiles.filter((p) => p !== profile)
        : [...config.noExtraProfiles.filter((p) => p !== profile), profile],
    });

  const th = "whitespace-nowrap px-2 py-2";
  const td = "px-2 py-1";
  const goalNums: Array<[keyof GoalTypeConfig, string, string]> = [
    ["payback", "extras.gtPayback", "0.01"],
    ["kickPrice", "extras.gtKick", "0.01"],
    ["wHeader", "extras.gtWHeader", "0.005"],
    ["wFreeKick", "extras.gtWFreeKick", "0.005"],
    ["wPenalty", "extras.gtWPenalty", "0.005"],
    ["wOwnGoal", "extras.gtWOwnGoal", "0.005"],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[11px] uppercase tracking-wide text-ink-3">{t("extras.payback")}</label>
        <input
          type="number"
          step="0.01"
          className={`${inp} w-16`}
          value={config.payback}
          onChange={(e) => {
            const v = numOrNull(e.target.value);
            if (v != null) onPatch({ payback: v });
          }}
        />
        <span className="text-xs text-ink-3">
          {t("extras.sharedNote")} {t("extras.zeroNote")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {dirty && !status && <span className="text-xs text-warn">{t("extras.unsaved")}</span>}
          {statusNote}
          <button onClick={() => onPatch(DEFAULT_EXTRA_CONFIG)} className={btnGhost}>
            {t("extras.resetDefaults")}
          </button>
          <button onClick={onSave} disabled={status === "saving"} className={btnPrimary}>
            {t("extras.save")}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="text-left text-[12px]">
          <thead className="bg-card-2 text-[10px] uppercase tracking-wide text-ink-3">
            <tr>
              <th className={th} title={t("extras.sendHint")}></th>
              <th className={th}>{t("extras.colTemplate")}</th>
              <th className={th}>{t("extras.colMarket")}</th>
              <th className={th}>{t("extras.colType")}</th>
              <th className={th}>{t("extras.colLine")}</th>
              <th className={th}>{t("extras.colUnder")}</th>
              {config.profiles.map((p) => (
                <th key={p} className={th}>
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.markets.map((m, i) => {
              const special = isSpecialTemplate(m.template);
              const on = m.enabled !== false;
              return (
                <tr key={i} className={`border-t border-line/60 hover:bg-veil ${on ? "" : "opacity-50"}`}>
                  <td className={`${td} text-center`} title={t("extras.sendHint")}>
                    <input type="checkbox" checked={on} onChange={(e) => patchMarket(i, { enabled: e.target.checked })} />
                  </td>
                  <td className={`${td} whitespace-nowrap font-medium text-ink`}>{m.template}</td>
                  <td className={`${td} whitespace-nowrap text-ink-2`}>{m.name}</td>
                  <td className={`${td} text-ink-3`}>{m.type}</td>
                  {special ? (
                    <td className={`${td} text-[11px] text-ink-3`} colSpan={2 + config.profiles.length}>
                      {t("extras.specialRow")}
                    </td>
                  ) : (
                    <>
                      <td className={td}>
                        {m.type === "Dynamic" ? (
                          <input
                            type="number"
                            step="0.5"
                            className={`${inp} w-14`}
                            value={m.line}
                            onChange={(e) => {
                              const v = numOrNull(e.target.value);
                              if (v != null) patchMarket(i, { line: v });
                            }}
                          />
                        ) : (
                          <input
                            type="text"
                            className={`${inp} w-14`}
                            value={m.line}
                            onChange={(e) => patchMarket(i, { line: e.target.value })}
                          />
                        )}
                      </td>
                      <td className={`${td} text-center`}>
                        {m.type === "Dynamic" ? (
                          <input type="checkbox" checked={m.under} onChange={(e) => patchMarket(i, { under: e.target.checked })} />
                        ) : (
                          <span className="text-ink-3">-</span>
                        )}
                      </td>
                      {config.profiles.map((p) => (
                        <td key={p} className={td}>
                          <input
                            type="number"
                            step="0.01"
                            className={`${inp} w-14`}
                            value={m.prices[p] ?? ""}
                            onChange={(e) => patchMarket(i, { prices: { ...m.prices, [p]: numOrNull(e.target.value) } })}
                          />
                        </td>
                      ))}
                    </>
                  )}
                </tr>
              );
            })}
            <tr className="border-t border-line bg-card-2/40">
              <td className={`${td} whitespace-nowrap text-[11px] font-medium text-ink-2`} colSpan={6} title={t("extras.extrasRowHint")}>
                {t("extras.extrasRow")}
              </td>
              {config.profiles.map((p) => (
                <td key={p} className={`${td} text-center`} title={t("extras.extrasRowHint")}>
                  <input
                    type="checkbox"
                    checked={!config.noExtraProfiles.includes(p)}
                    onChange={(e) => toggleExtras(p, e.target.checked)}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        {(["extraTime1h", "extraTime2h"] as const).map((key) => (
          <div key={key} className="rounded-xl border border-line bg-card">
            <div className="px-3 py-2 text-xs font-semibold text-ink">{t(`extras.${key}`)}</div>
            <table className="text-left text-[12px]">
              <thead className="bg-card-2 text-[10px] uppercase tracking-wide text-ink-3">
                <tr>
                  <th className={th}>{t("extras.selection")}</th>
                  <th className={th}>{t("extras.price")}</th>
                </tr>
              </thead>
              <tbody>
                {config[key].map((s, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className={td}>
                      <input
                        type="text"
                        className={`${inp} w-28`}
                        value={s.name}
                        onChange={(e) => patchSelection(key, i, { name: e.target.value })}
                      />
                    </td>
                    <td className={td}>
                      <input
                        type="number"
                        step="0.01"
                        className={`${inp} w-14`}
                        value={s.price ?? ""}
                        onChange={(e) => patchSelection(key, i, { price: numOrNull(e.target.value) })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="max-w-xl rounded-xl border border-line bg-card">
          <div className="px-3 py-2 text-xs font-semibold text-ink">{t("extras.goalTypeTitle")}</div>
          <div className="space-y-3 border-t border-line px-3 py-2">
            <p className="text-[11px] text-ink-3">{t("extras.goalTypeNote")}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {goalNums.map(([field, labelKey, step]) => (
                <label key={field} className="flex items-center gap-1.5 text-[11px] text-ink-2">
                  {t(labelKey)}
                  <input
                    type="number"
                    step={step}
                    className={`${inp} w-16`}
                    value={config.goalType[field] as number}
                    onChange={(e) => {
                      const v = numOrNull(e.target.value);
                      if (v != null) patchGoal({ [field]: v });
                    }}
                  />
                </label>
              ))}
            </div>
            <div>
              <div className="mb-1 text-[11px] text-ink-2">{t("extras.gtNames")}</div>
              <div className="flex flex-wrap gap-1.5">
                {config.goalType.names.map((name, i) => (
                  <input
                    key={i}
                    type="text"
                    className={`${inp} w-24`}
                    value={name}
                    onChange={(e) => patchGoal({ names: config.goalType.names.map((n, k) => (k === i ? e.target.value : n)) })}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
