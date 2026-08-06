"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../../../../lib/i18n/LanguageProvider";
import {
  fetchFixtures,
  fetchFixtureInputs,
  saveFixtureInputs,
  type FixtureRow,
  type FixtureInput,
} from "./queries";
import TeamCrest from "@/features/tsl/shared/TeamCrest";
import { getTeamLogoPath } from "@/features/player-detail/utils/getTeamLogoPath";

const NO_SPINNER =
  "appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const ROUNDS = Array.from({ length: 34 }, (_, i) => i + 1);

export default function FixtureIdTab({
  league,
  onSaved,
}: {
  league: string;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const [round, setRound] = useState(1);
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [inputs, setInputs] = useState<Record<string, FixtureInput>>({});
  const [status, setStatus] = useState<"" | "saving" | "ok" | "err">("");

  useEffect(() => {
    fetchFixtureInputs(league).then(setInputs);
  }, [league]);
  useEffect(() => {
    fetchFixtures(league, round).then(setFixtures);
  }, [league, round]);

  function edit(fid: string, patch: Partial<FixtureInput>) {
    setInputs((prev) => {
      const base: FixtureInput = prev[fid] ?? {
        externalFixtureId: "",
        homeOdds: null,
        drawOdds: null,
        awayOdds: null,
      };
      return { ...prev, [fid]: { ...base, ...patch } };
    });
  }

  async function save() {
    setStatus("saving");
    const rows = Object.entries(inputs).map(([fixture_id, v]) => ({
      fixture_id,
      external_fixture_id: v.externalFixtureId ?? "",
      home_odds: v.homeOdds, draw_odds: v.drawOdds, away_odds: v.awayOdds,
    }));
    const ok = await saveFixtureInputs(league, rows);
    setStatus(ok ? "ok" : "err");
    if (ok) onSaved?.();
    setTimeout(() => setStatus(""), 2500);
  }

  const inp = `rounded border border-line bg-field px-1.5 py-0.5 text-[11px] text-ink focus:outline-none focus:border-accent ${NO_SPINNER}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-[11px] uppercase tracking-wide text-ink-3">Round</label>
        <select
          className="rounded-md border border-line bg-field px-2 py-1 text-sm text-ink"
          value={round}
          onChange={(e) => setRound(parseInt(e.target.value))}
        >
          {ROUNDS.map((r) => (
            <option key={r} value={r} className="bg-field text-ink">{r}</option>
          ))}
        </select>
        <button
          onClick={save}
          disabled={status === "saving"}
          className="ml-auto rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
        >
          {t("msm.save")}
        </button>
        {status === "ok" && <span className="text-sm text-pos">{t("msm.saved")}</span>}
        {status === "err" && <span className="text-sm text-neg">{t("msm.saveFailed")}</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="min-w-[640px] w-full text-left text-[12px]">
          <thead className="bg-card-2 text-[10px] uppercase tracking-wide text-ink-3">
            <tr>
              <th className="px-2 py-2">Maç</th>
              <th className="px-2 py-2 w-20">{t("msm.oddsHome")}</th>
              <th className="px-2 py-2 w-20">{t("msm.oddsDraw")}</th>
              <th className="px-2 py-2 w-20">{t("msm.oddsAway")}</th>
              <th className="px-2 py-2 w-44">{t("msm.tab_fixtures")}</th>
            </tr>
          </thead>
          <tbody>
            {fixtures.map((f) => {
              const v = inputs[f.fixtureId];
              return (
                <tr key={f.fixtureId} className="border-t border-line/60 hover:bg-veil">
                  <td className="px-2 py-1.5 whitespace-nowrap text-ink">
                    <span className="flex items-center gap-1.5">
                      <TeamCrest logo={getTeamLogoPath(f.homeSlug)} name={f.homeName} size="xs" />
                      <span>{f.homeName}</span>
                      <span className="text-ink-3">-</span>
                      <TeamCrest logo={getTeamLogoPath(f.awaySlug)} name={f.awayName} size="xs" />
                      <span>{f.awayName}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" step="0.01" className={`${inp} w-16`} value={v?.homeOdds ?? ""}
                      onChange={(e) => edit(f.fixtureId, { homeOdds: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" step="0.01" className={`${inp} w-16`} value={v?.drawOdds ?? ""}
                      onChange={(e) => edit(f.fixtureId, { drawOdds: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" step="0.01" className={`${inp} w-16`} value={v?.awayOdds ?? ""}
                      onChange={(e) => edit(f.fixtureId, { awayOdds: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="text" className={`${inp} w-40`} value={v?.externalFixtureId ?? ""}
                      placeholder="fixture id"
                      onChange={(e) => edit(f.fixtureId, { externalFixtureId: e.target.value })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
