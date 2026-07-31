import { getT } from "@/lib/i18n/server";
import type { TeamsBundle } from "@/features/tsl/server/loaders";
import type { TslStandingRow } from "@/features/tsl/types";
import TeamCrest from "@/features/tsl/shared/TeamCrest";
import FormPills from "@/features/tsl/shared/FormPills";
import PercentBar from "@/features/tsl/shared/PercentBar";

export default async function RadarTeams({ data }: { data: TeamsBundle }) {
  const t = await getT();
  const { standings } = data;

  if (!standings.length) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {standings.map((r) => (
        <TeamCard
          key={r.teamId}
          r={r}
          labels={{
            attack: t("tsl.attackProfile"),
            defence: t("tsl.defenceProfile"),
            strongest: t("tsl.strongest"),
            weakest: t("tsl.weakest"),
            pts: t("tsl.points"),
          }}
        />
      ))}
    </div>
  );
}

function TeamCard({
  r,
  labels,
}: {
  r: TslStandingRow;
  labels: { attack: string; defence: string; strongest: string; weakest: string; pts: string };
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-card p-4">
      {/* Baslik */}
      <div className="flex items-center gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-veil text-[11px] font-bold tabular-nums text-ink-2">
          {r.rank}
        </span>
        <TeamCrest logo={r.logo} name={r.teamName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-ink">{r.teamName}</div>
          <div className="text-[11px] text-ink-3">
            {r.wins}-{r.draws}-{r.losses} · {r.goalsFor}:{r.goalsAgainst}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[20px] font-black tabular-nums text-ink">{r.points}</div>
          <div className="text-[9px] uppercase tracking-[0.1em] text-ink-3">{labels.pts}</div>
        </div>
      </div>

      {/* Profil cipleri */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.attackLabel ? (
          <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink">
            {labels.attack}: {r.attackLabel}
          </span>
        ) : null}
        {r.defenceLabel ? (
          <span className="rounded-md bg-pos/12 px-2 py-0.5 text-[11px] font-medium text-pos">
            {labels.defence}: {r.defenceLabel}
          </span>
        ) : null}
      </div>

      {/* Form */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-ink-3">Form</span>
        <FormPills form={r.form} />
      </div>

      {/* En guclu / en zayif */}
      <div className="mt-3 space-y-2 border-t border-line pt-3">
        <MetricLine label={labels.strongest} name={r.strongestLabel} pct={r.strongestPct} tone="pos" />
        <MetricLine label={labels.weakest} name={r.weakestLabel} pct={r.weakestPct} tone="neg" />
      </div>
    </div>
  );
}

function MetricLine({
  label,
  name,
  pct,
  tone,
}: {
  label: string;
  name: string | null;
  pct: number | null;
  tone: "pos" | "neg";
}) {
  if (!name) return null;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-ink-3">
          <span className={tone === "pos" ? "text-pos" : "text-neg"}>{label}</span> · {name}
        </span>
        <span className="tabular-nums text-ink-2">{pct ?? "—"}%</span>
      </div>
      <PercentBar pct={pct} tone={tone} />
    </div>
  );
}
