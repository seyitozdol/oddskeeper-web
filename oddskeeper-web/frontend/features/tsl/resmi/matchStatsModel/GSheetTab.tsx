"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../../../lib/i18n/LanguageProvider";
import { fetchFixtures, fetchGsheetRows, type FixtureRow, type GsheetRow } from "./queries";

type Cell = { sub: string; key: string };
type Group = { label: string; cells: Cell[] };

const HA = (base: string): Cell[] => [
  { sub: "Home", key: `${base}_home` },
  { sub: "Away", key: `${base}_away` },
];
const ONE = (key: string): Cell[] => [{ sub: "", key }];

// Kolon setleri (dis Google Sheet ile ayni sira). TSL'de Added Time + Possession fazla.
function buildGroups(league: string): Group[] {
  const g: Group[] = [{ label: "FT", cells: HA("ft") }];
  if (league === "tsl") {
    g.push({ label: "Added Time", cells: [
      { sub: "1st H", key: "added_time_1h" },
      { sub: "2nd H", key: "added_time_2h" },
    ] });
  }
  g.push(
    { label: "Card", cells: HA("card") },
    { label: "Corner", cells: HA("corner") },
    { label: "Shot", cells: HA("shot") },
    { label: "SOT", cells: HA("sot") },
    { label: "Foul", cells: HA("foul") },
    { label: "Offside", cells: HA("offside") },
    { label: "Saves", cells: HA("saves") },
    { label: "Throw-in", cells: HA("throwin") },
    { label: "Tackle", cells: HA("tackle") },
    { label: "Goal Kick", cells: HA("goalkick") },
  );
  if (league === "tsl") g.push({ label: "Possession", cells: HA("possession") });
  g.push(
    { label: "RC", cells: ONE("rc_total") },
    { label: "VAR", cells: ONE("var_total") },
    { label: "PEN", cells: ONE("pen_total") },
    { label: "Wood Work", cells: ONE("woodwork_total") },
    { label: "Own Goal", cells: ONE("owngoal_total") },
  );
  return g;
}

const norm = (s: string) =>
  (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function GSheetTab({ league }: { league: string }) {
  const { t } = useI18n();
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [rows, setRows] = useState<GsheetRow[]>([]);
  const [round, setRound] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setRound(null);
    fetchFixtures(league).then(setFixtures);
    fetchGsheetRows(league).then(setRows);
  }, [league]);

  const rounds = useMemo(
    () => Array.from(new Set(fixtures.map((f) => f.round))).sort((a, b) => a - b),
    [fixtures]
  );

  // Varsayilan hafta: tarihi gecmis en son round (oynanan hafta), yoksa ilk round.
  const currentRound = useMemo(() => {
    const now = Date.now();
    const played = fixtures
      .filter((f) => f.datetime && new Date(f.datetime).getTime() <= now)
      .map((f) => f.round);
    return played.length ? Math.max(...played) : rounds[0] ?? 1;
  }, [fixtures, rounds]);

  const activeRound = round ?? currentRound;

  const groups = useMemo(() => buildGroups(league), [league]);
  const flatKeys = useMemo(() => groups.flatMap((g) => g.cells.map((c) => c.key)), [groups]);

  // Eslesme onceligi: (1) fixtureId=source_match_id (tff1); (2) kanonik slug cifti
  // (tsl: fixture apifootball, gsheet sofascore; ikisi de ref.team_mapping slug'ina
  // gider); (3) son care takim adi (id uzayi + Turkce 'ı'/ek-farki yuzunden kirilgan).
  const byId = useMemo(() => {
    const m: Record<string, GsheetRow> = {};
    for (const r of rows) m[r.sourceMatchId] = r;
    return m;
  }, [rows]);
  const bySlug = useMemo(() => {
    const m: Record<string, GsheetRow> = {};
    for (const r of rows) if (r.homeSlug && r.awaySlug) m[`${r.homeSlug}|${r.awaySlug}`] = r;
    return m;
  }, [rows]);
  const byName = useMemo(() => {
    const m: Record<string, GsheetRow> = {};
    for (const r of rows) m[`${norm(r.homeTeamName)}|${norm(r.awayTeamName)}`] = r;
    return m;
  }, [rows]);

  const matchFor = (f: FixtureRow): GsheetRow | undefined =>
    byId[f.fixtureId] ??
    bySlug[`${f.homeSlug}|${f.awaySlug}`] ??
    byName[`${norm(f.homeName)}|${norm(f.awayName)}`];

  const fmt = (v: number | null | undefined) => (v == null ? "" : String(v));

  function copyRow(f: FixtureRow) {
    const gr = matchFor(f);
    const tsv = flatKeys.map((k) => fmt(gr?.vals[k])).join("\t");
    // execCommand once (user-gesture guvenli, senkron) + clipboard API fallback.
    try {
      const ta = document.createElement("textarea");
      ta.value = tsv;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {
      navigator.clipboard?.writeText(tsv).catch(() => {});
    }
    setCopied(f.fixtureId);
    setTimeout(() => setCopied(null), 1200);
  }

  const roundFixtures = fixtures.filter((f) => f.round === activeRound);
  const th = "px-1.5 py-1 text-center font-medium whitespace-nowrap";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-[11px] uppercase tracking-wide text-ink-3">{t("msm.week")}</label>
        <select
          className="rounded-md border border-line bg-field px-2 py-1 text-sm text-ink"
          value={activeRound}
          onChange={(e) => setRound(parseInt(e.target.value))}
        >
          {rounds.map((r) => (
            <option key={r} value={r} className="bg-field text-ink">{r}</option>
          ))}
        </select>
        <span className="text-[11px] text-ink-3">{t("msm.gsheetHint")}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="min-w-max text-[11px] tabular-nums">
          <thead className="bg-card-2 text-ink-3">
            <tr>
              <th className="px-1 py-1"></th>
              <th className="px-2 py-1 text-left font-medium">Home</th>
              <th className="px-2 py-1 text-left font-medium">Away</th>
              {groups.map((g) => (
                <th key={g.label} colSpan={g.cells.length}
                    className={`${th} border-l border-line/60`}>{g.label}</th>
              ))}
            </tr>
            <tr className="text-[10px] text-ink-3">
              <th className="px-1 py-0.5"></th>
              <th className="px-2 py-0.5"></th>
              <th className="px-2 py-0.5"></th>
              {groups.map((g) =>
                g.cells.map((c, i) => (
                  <th key={g.label + i}
                      className={`px-1.5 py-0.5 text-center font-normal ${i === 0 ? "border-l border-line/60" : ""}`}>
                    {c.sub}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {roundFixtures.map((f) => {
              const gr = matchFor(f);
              return (
                <tr key={f.fixtureId} className="border-t border-line/60 text-ink-2">
                  <td className="px-1 py-0.5">
                    <button
                      onClick={() => copyRow(f)}
                      title={t("msm.gsheetCopy")}
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${
                        copied === f.fixtureId
                          ? "border-pos/50 bg-pos/15 text-pos"
                          : "border-line bg-field text-ink-3 hover:text-ink"
                      }`}
                    >
                      {copied === f.fixtureId ? "✓" : "⧉"}
                    </button>
                  </td>
                  <td className="px-2 py-0.5 font-medium text-ink whitespace-nowrap">{f.homeName}</td>
                  <td className="px-2 py-0.5 font-medium text-ink whitespace-nowrap">{f.awayName}</td>
                  {groups.map((g) =>
                    g.cells.map((c, i) => (
                      <td key={g.label + i}
                          className={`px-1.5 py-0.5 text-center ${i === 0 ? "border-l border-line/60" : ""}`}>
                        {fmt(gr?.vals[c.key])}
                      </td>
                    ))
                  )}
                </tr>
              );
            })}
            {roundFixtures.length === 0 && (
              <tr><td colSpan={3 + flatKeys.length} className="px-3 py-6 text-center text-ink-3">—</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
