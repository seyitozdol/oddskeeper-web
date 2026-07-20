"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
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
    return "border-pos/20 bg-card";
  }

  if (tone === "negative") {
    return "border-neg/20 bg-card";
  }

  if (tone === "accent") {
    return "border-accent/20 bg-card";
  }

  if (tone === "warning") {
    return "border-amber-500/20 bg-card";
  }

  return "border-line bg-veil";
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
    <div className="rounded-2xl border border-line bg-veil px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-ink-3">
        {label}
      </div>
      <div className="mt-2 text-[16px] font-semibold leading-5 text-ink">
        {title}
      </div>
      <div className="mt-2 text-[12px] leading-5 text-ink-2">{reason}</div>
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
  const { t } = useI18n();

  return (
    <div className={`rounded-2xl border px-4 py-3 ${getToneClasses(tone)}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-ink-3">
        {eyebrow}
      </div>
      <div className="mt-2 text-[16px] font-semibold leading-5 text-ink">
        {label}
      </div>
      <div className="mt-2 text-[12px] leading-5 text-ink-2">{reason}</div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-ink-2">
        <div>
          {t("teamDetail.colRank")}{" "}
          <span className="font-medium text-ink">{rank ?? "—"}</span>
        </div>
        <div>
          {t("teamDetail.vsAvgLabel")}{" "}
          <span className="font-medium text-ink">{formatPct(vsAvg)}</span>
        </div>
      </div>
    </div>
  );
}

function TierCard({
  label,
  tier,
  score,
  reason,
}: {
  label: string;
  tier: string;
  score: number | null;
  reason: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-veil px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-ink-3">
        {label}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-[16px] font-semibold text-ink">{tier}</div>
        <div className="text-[24px] font-semibold leading-none text-ink">
          {score === null ? "—" : `${formatScore(score)}/100`}
        </div>
      </div>
      <div className="mt-2 text-[12px] leading-5 text-ink-2">{reason}</div>
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
    <div className="rounded-2xl border border-line bg-veil px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-ink-3">
        {label}
      </div>
      <div className="mt-2 text-[13px] leading-6 text-ink-2">{text}</div>
    </div>
  );
}

type TeamAdvancedSummaryViewProps = {
  summary: TeamAdvancedSummary | null;
};

export default function TeamAdvancedSummaryView({
  summary,
}: TeamAdvancedSummaryViewProps) {
  const { t } = useI18n();

  if (!summary) {
    return (
      <div className="rounded-2xl border border-line bg-veil px-4 py-3 text-sm text-ink-2">
        {t("teamDetail.noSummaryAvailable")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-4">
        <IdentityCard
          label={t("teamDetail.identityAttack")}
          title={summary.identity.attack.label}
          reason={summary.identity.attack.reason}
        />
        <IdentityCard
          label={t("teamDetail.identityDefence")}
          title={summary.identity.defence.label}
          reason={summary.identity.defence.reason}
        />
        <IdentityCard
          label={t("teamDetail.identityBuildUp")}
          title={summary.identity.build_up.label}
          reason={summary.identity.build_up.reason}
        />
        <IdentityCard
          label={t("teamDetail.identityForm")}
          title={summary.identity.form.label}
          reason={summary.identity.form.reason}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        <HighlightCard
          eyebrow={t("teamDetail.highlightStrength")}
          label={summary.highlights.strength.label}
          reason={summary.highlights.strength.reason}
          rank={summary.highlights.strength.rank}
          vsAvg={summary.highlights.strength.vs_avg_pct}
          tone={summary.highlights.strength.tone}
        />
        <HighlightCard
          eyebrow={t("teamDetail.highlightRisk")}
          label={summary.highlights.risk.label}
          reason={summary.highlights.risk.reason}
          rank={summary.highlights.risk.rank}
          vsAvg={summary.highlights.risk.vs_avg_pct}
          tone={summary.highlights.risk.tone}
        />
        <HighlightCard
          eyebrow={t("teamDetail.highlightTrend")}
          label={summary.highlights.trend.label}
          reason={summary.highlights.trend.reason}
          rank={summary.highlights.trend.rank}
          vsAvg={summary.highlights.trend.vs_avg_pct}
          tone={summary.highlights.trend.tone}
        />
        <HighlightCard
          eyebrow={t("teamDetail.highlightSplit")}
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
          reason={summary.positioning.attack.reason}
        />
        <TierCard
          label={summary.positioning.defence.label}
          tier={summary.positioning.defence.tier}
          score={summary.positioning.defence.score}
          reason={summary.positioning.defence.reason}
        />
        <TierCard
          label={summary.positioning.build_up.label}
          tier={summary.positioning.build_up.tier}
          score={summary.positioning.build_up.score}
          reason={summary.positioning.build_up.reason}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <TakeawayCard
          label={t("teamDetail.takeawayCoaching")}
          text={summary.takeaways.coaching}
        />
        <TakeawayCard
          label={t("teamDetail.takeawayOpponentPrep")}
          text={summary.takeaways.opponent_prep}
        />
        <TakeawayCard
          label={t("teamDetail.takeawayRecruitment")}
          text={summary.takeaways.recruitment}
        />
      </div>
    </div>
  );
}