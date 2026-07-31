"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMetric } from "@/features/tsl/lib";
import TeamCrest from "@/features/tsl/shared/TeamCrest";

export type CompareTeam = {
  id: string;
  name: string;
  logo: string | null;
  metrics: Record<string, { value: number | null; pct: number | null; format: string }>;
};

export default function PanelTeamCompare({
  teams,
  metricOrder,
  metricLabels,
  initialA,
  initialB,
}: {
  teams: CompareTeam[];
  metricOrder: string[];
  metricLabels: Record<string, string>;
  initialA: string;
  initialB: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);

  const teamA = teams.find((x) => x.id === a) ?? teams[0];
  const teamB = teams.find((x) => x.id === b) ?? teams[1];

  const sync = (key: "teamA" | "teamB", val: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, val);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <h2 className="mb-4 text-[15px] font-semibold text-ink">{t("tsl.compareTeams")}</h2>

      {/* Secim baslik */}
      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamSelect
          teams={teams}
          value={a}
          exclude={b}
          onChange={(v) => {
            setA(v);
            sync("teamA", v);
          }}
          align="left"
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">vs</span>
        <TeamSelect
          teams={teams}
          value={b}
          exclude={a}
          onChange={(v) => {
            setB(v);
            sync("teamB", v);
          }}
          align="right"
        />
      </div>

      {/* Metrik satirlari */}
      <div className="space-y-2.5">
        {metricOrder.map((mk) => {
          const ma = teamA?.metrics[mk];
          const mb = teamB?.metrics[mk];
          if (!ma && !mb) return null;
          const pa = ma?.pct ?? 0;
          const pb = mb?.pct ?? 0;
          const aWin = pa > pb;
          const bWin = pb > pa;
          const fmt = ma?.format ?? mb?.format ?? "count";
          return (
            <div key={mk} className="grid grid-cols-[1fr_120px_1fr] items-center gap-2">
              {/* A tarafi (saga hizali bar) */}
              <div className="flex items-center gap-2">
                <span className={`w-12 text-right font-mono text-[13px] font-bold tabular-nums ${aWin ? "text-accent-ink" : "text-ink-2"}`}>
                  {formatMetric(ma?.value ?? null, fmt)}
                </span>
                <div className="flex h-2.5 flex-1 justify-end overflow-hidden rounded-full bg-veil">
                  <div className={`h-full rounded-full ${aWin ? "bg-accent" : "bg-ink-3/60"}`} style={{ width: `${pa}%` }} />
                </div>
              </div>
              {/* metrik adi */}
              <div className="text-center text-[11px] text-ink-3">{metricLabels[mk] ?? mk}</div>
              {/* B tarafi (sola hizali bar) */}
              <div className="flex items-center gap-2">
                <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-veil">
                  <div className={`h-full rounded-full ${bWin ? "bg-pos" : "bg-ink-3/60"}`} style={{ width: `${pb}%` }} />
                </div>
                <span className={`w-12 font-mono text-[13px] font-bold tabular-nums ${bWin ? "text-pos" : "text-ink-2"}`}>
                  {formatMetric(mb?.value ?? null, fmt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] text-ink-3">{t("tsl.dataNote")}</p>
    </div>
  );
}

function TeamSelect({
  teams,
  value,
  exclude,
  onChange,
  align,
}: {
  teams: CompareTeam[];
  value: string;
  exclude: string;
  onChange: (v: string) => void;
  align: "left" | "right";
}) {
  const current = teams.find((x) => x.id === value);
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <TeamCrest logo={current?.logo} name={current?.name} size="md" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-line bg-field px-2 py-1.5 text-[13px] font-semibold text-ink outline-none focus:border-line-strong"
      >
        {teams.map((tm) => (
          <option key={tm.id} value={tm.id} disabled={tm.id === exclude}>
            {tm.name}
          </option>
        ))}
      </select>
    </div>
  );
}
