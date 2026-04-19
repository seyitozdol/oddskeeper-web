"use client";

import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import {
  markets_2,
  type PredictionMatch_2,
} from "@/features/deep-prediction-ml2/data_2/mockMatches_2";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatNumber_2(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toFixed(1);
}

function MarketButton_2({
  label,
  enabled,
  active,
  onClick,
}: {
  label: string;
  enabled: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={enabled ? onClick : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm transition",
        enabled
          ? active
            ? "border-white/20 bg-white text-black"
            : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
          : "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35"
      )}
    >
      {!enabled && <Lock className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function ConfidenceBadge_2({
  confidence,
  score,
}: {
  confidence?: PredictionMatch_2["confidence"];
  score?: number | null;
}) {
  const normalizedConfidence =
    confidence === "High" || confidence === "Medium" || confidence === "Low"
      ? confidence
      : "Low";

  const tone =
    normalizedConfidence === "High"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : normalizedConfidence === "Medium"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
        : "border-white/10 bg-white/5 text-white/65";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        tone
      )}
    >
      {normalizedConfidence} · {score ?? 0}/100
    </div>
  );
}

function MatchCard_2({ match }: { match: PredictionMatch_2 }) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
            <span>{match.competition ?? "-"}</span>
            <span>•</span>
            <span>{match.kickoff ?? "-"}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-lg font-semibold text-white md:text-xl">
            <span>{match.homeTeam ?? "-"}</span>
            <span className="text-white/25">vs</span>
            <span>{match.awayTeam ?? "-"}</span>
          </div>

          <div className="mt-4 grid max-w-[520px] grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                Home
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {formatNumber_2(match.homeShots)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                Away
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {formatNumber_2(match.awayShots)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                Total
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {formatNumber_2(match.totalShots)}
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[240px]">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              Edge
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {match.edge ?? "-"}
            </div>
            <div className="mt-3">
              <ConfidenceBadge_2
                confidence={match.confidence}
                score={match.confidenceScore}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeepPredictionML2Page({
  matches,
}: {
  matches: PredictionMatch_2[];
}) {
  const [activeMarket, setActiveMarket] = useState("shots");
  const [selectedConfidence, setSelectedConfidence] = useState<
    "All" | "High" | "Medium" | "Low"
  >("All");

  const normalizedMatches = useMemo(() => {
    return matches.map((match, index) => ({
      id: match.id ?? index + 1,
      competition: match.competition ?? "-",
      kickoff: match.kickoff ?? "-",
      homeTeam: match.homeTeam ?? "-",
      awayTeam: match.awayTeam ?? "-",
      homeShots: match.homeShots ?? null,
      awayShots: match.awayShots ?? null,
      totalShots: match.totalShots ?? null,
      edge: match.edge ?? "-",
      confidence:
        match.confidence === "High" ||
        match.confidence === "Medium" ||
        match.confidence === "Low"
          ? match.confidence
          : "Low",
      confidenceScore: match.confidenceScore ?? 0,
    }));
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (selectedConfidence === "All") return normalizedMatches;
    return normalizedMatches.filter(
      (match) => match.confidence === selectedConfidence
    );
  }, [normalizedMatches, selectedConfidence]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(91,141,239,0.18),_transparent_28%),linear-gradient(180deg,#060b14_0%,#09111f_35%,#060b14_100%)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[0.22em] text-white/35">
            Deep Prediction ML2
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Match shot predictions
          </h1>
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {markets_2.map((market) => (
              <MarketButton_2
                key={market.key}
                label={market.label}
                enabled={market.enabled}
                active={activeMarket === market.key}
                onClick={() => setActiveMarket(market.key)}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: "All", value: "All" as const },
              { label: "High", value: "High" as const },
              { label: "Medium", value: "Medium" as const },
              { label: "Low", value: "Low" as const },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setSelectedConfidence(item.value)}
                className={cn(
                  "rounded-2xl border px-4 py-2 text-sm transition",
                  selectedConfidence === item.value
                    ? "border-white/20 bg-white text-black"
                    : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredMatches.map((match, index) => (
            <MatchCard_2
              key={
                match.id ??
                `${match.homeTeam ?? "home"}-${match.awayTeam ?? "away"}-${match.kickoff ?? index}`
              }
              match={match}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
