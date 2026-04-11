"use client";

import type { TeamAdvancedSummary } from "../types";

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return `${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function getToneClasses(
  tone: "positive" | "negative" | "neutral" | "accent" | "warning"
) {
  if (tone === "positive") {
    return "border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.02))]";
  }

  if (tone === "negative") {
    return "border-rose-500/20 bg-[linear-gradient(180deg,rgba(244,63,94,0.08),rgba(255,255,255,0.02))]";
  }

  if (tone === "accent") {
    return "border-sky-500/20 bg-[linear-gradient(180deg,rgba(59,130,246,0.08),rgba(255,255,255,0.02))]";
  }

  if (tone === "warning") {
    return "border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.02))]";
  }

  return "border-white/10 bg-white/[0.03]";
}

function IdentityCard({
  label,
  title,
  reason,
}: {
  label: string;
  title: string;
  reason: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-[16px] font-semibold leading-5 text-white">
        {title}
      </div>
      <div className="mt-2 text-[12px] leading-5 text-white/60">{reason}</div>
    </div>
  );
}

function HighlightCard({
  eyebrow,
  label,
  reason,
  rank,
  vsAvg,
  tone,
}: {
  eyebrow: string;
  label: string;
  reason: string;
  rank: number | null;
  vsAvg: number | null;
  tone: "positive" | "negative" | "neutral" | "accent" | "warning";
}) {
  return (
    <div className={`rounded-2xl border px-4 py-4 ${getToneClasses(tone)}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/38">
        {eyebrow}
      </div>
      <div className="mt-2 text-[16px] font-semibold leading-5 text-white">
        {label}
      </div>
      <div className="mt-2 text-[12px] leading-5 text-white/60">{reason}</div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-white/65">
        <div>
          Rank <span className="font-medium text-white">{rank ?? "—"}</span>
        </div>
        <div>
          Vs Avg{" "}
          <span className="font-medium text-white">{formatPct(vsAvg)}</span>
        </div>
      </div>
    </div>
  );
}

function TierCard({
  label,
  tier,
  score,
}: {
  label: string;
  tier: string;
  score: number | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/38">
        {label}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-[16px] font-semibold text-white">{tier}</div>
        <div className="text-[24px] font-semibold leading-none text-white">
          {formatScore(score)}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-white/50">Composite score</div>
    </div>
  );
}

function TakeawayCard({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-[13px] leading-6 text-white/72">{text}</div>
    </div>
  );
}

type TeamAdvancedSummaryViewProps = {
  summary: TeamAdvancedSummary | null;
};

export default function TeamAdvancedSummaryView({
  summary,
}: TeamAdvancedSummaryViewProps) {
  if (!summary) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/60">
        Advanced summary could not be generated for this team.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-4">
        <IdentityCard
          label="Attack Identity"
          title={summary.identity.attack.label}
          reason={summary.identity.attack.reason}
        />
        <IdentityCard
          label="Defensive Identity"
          title={summary.identity.defence.label}
          reason={summary.identity.defence.reason}
        />
        <IdentityCard
          label="Build-up Identity"
          title={summary.identity.build_up.label}
          reason={summary.identity.build_up.reason}
        />
        <IdentityCard
          label="Current Form State"
          title={summary.identity.form.label}
          reason={summary.identity.form.reason}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        <HighlightCard
          eyebrow="Primary Strength"
          label={summary.highlights.strength.label}
          reason={summary.highlights.strength.reason}
          rank={summary.highlights.strength.rank}
          vsAvg={summary.highlights.strength.vs_avg_pct}
          tone={summary.highlights.strength.tone}
        />
        <HighlightCard
          eyebrow="Primary Risk"
          label={summary.highlights.risk.label}
          reason={summary.highlights.risk.reason}
          rank={summary.highlights.risk.rank}
          vsAvg={summary.highlights.risk.vs_avg_pct}
          tone={summary.highlights.risk.tone}
        />
        <HighlightCard
          eyebrow="Biggest Positive Trend"
          label={summary.highlights.trend.label}
          reason={summary.highlights.trend.reason}
          rank={summary.highlights.trend.rank}
          vsAvg={summary.highlights.trend.vs_avg_pct}
          tone={summary.highlights.trend.tone}
        />
        <HighlightCard
          eyebrow="Biggest Split Signal"
          label={summary.highlights.split.label}
          reason={summary.highlights.split.reason}
          rank={summary.highlights.split.rank}
          vsAvg={summary.highlights.split.vs_avg_pct}
          tone={summary.highlights.split.tone}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <TierCard
          label={summary.positioning.attack.label}
          tier={summary.positioning.attack.tier}
          score={summary.positioning.attack.score}
        />
        <TierCard
          label={summary.positioning.defence.label}
          tier={summary.positioning.defence.tier}
          score={summary.positioning.defence.score}
        />
        <TierCard
          label={summary.positioning.build_up.label}
          tier={summary.positioning.build_up.tier}
          score={summary.positioning.build_up.score}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <TakeawayCard
          label="Coaching Takeaway"
          text={summary.takeaways.coaching}
        />
        <TakeawayCard
          label="Opponent Prep Note"
          text={summary.takeaways.opponent_prep}
        />
        <TakeawayCard
          label="Recruitment Implication"
          text={summary.takeaways.recruitment}
        />
      </div>
    </div>
  );
}