import { getT } from "@/lib/i18n/server";
import type { TeamsBundle } from "@/features/tsl/server/loaders";
import TeamQuadrant from "./TeamQuadrant";
import PanelTeamCompare from "./PanelTeamCompare";
import type { CompareTeam } from "./PanelTeamCompare";

// Kiyasta gosterilecek metrikler (sirali).
const COMPARE_METRICS = [
  "team_goals_for",
  "team_expected_goals",
  "team_shots",
  "team_shots_on_target",
  "team_pass_accuracy_pct",
  "team_tackles",
  "team_interceptions",
  "team_goals_against",
  "team_saves",
];

export default async function PanelTeams({
  data,
  teamA,
  teamB,
}: {
  data: TeamsBundle;
  teamA?: string;
  teamB?: string;
}) {
  const t = await getT();
  const { standings, teamMetrics } = data;

  if (!standings.length) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  // Takim basina metrik haritasi
  const metricLabels: Record<string, string> = {};
  const perTeam = new Map<string, Record<string, { value: number | null; pct: number | null; format: string }>>();
  for (const m of teamMetrics) {
    if (!COMPARE_METRICS.includes(m.metricKey)) continue;
    metricLabels[m.metricKey] = m.metricLabel;
    if (!perTeam.has(m.teamId)) perTeam.set(m.teamId, {});
    perTeam.get(m.teamId)![m.metricKey] = {
      value: m.total,
      pct: m.leaguePct,
      format: m.valueFormat,
    };
  }

  const teams: CompareTeam[] = standings.map((s) => ({
    id: s.teamId,
    name: s.teamName,
    logo: s.logo,
    metrics: perTeam.get(s.teamId) ?? {},
  }));

  const idA = teams.find((x) => x.id === teamA)?.id ?? teams[0]?.id;
  const idB = teams.find((x) => x.id === teamB)?.id ?? teams[1]?.id;

  return (
    <div className="space-y-5">
      {/* Lig haritasi: hucum vs savunma */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-ink">{t("tsl.xgMap")}</h2>
        </div>
        <p className="mb-3 text-[11px] text-ink-3">
          → {t("tsl.goalsFor")} · ↑ {t("tsl.bestDefence")}
        </p>
        <TeamQuadrant
          teams={standings.map((s) => ({
            id: s.teamId,
            name: s.teamName,
            logo: s.logo,
            gf: s.goalsFor,
            ga: s.goalsAgainst,
          }))}
          labels={{ x: t("tsl.goalsFor"), y: t("tsl.goalsAgainst") }}
        />
      </div>

      {/* Kiyaslama */}
      <PanelTeamCompare
        teams={teams}
        metricOrder={COMPARE_METRICS}
        metricLabels={metricLabels}
        initialA={idA}
        initialB={idB}
      />
    </div>
  );
}
