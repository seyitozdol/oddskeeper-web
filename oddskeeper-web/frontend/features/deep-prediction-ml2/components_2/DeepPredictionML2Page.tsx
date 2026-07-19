"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, Search } from "lucide-react";
import {
  markets_2,
  type PredictionMatch_2,
} from "@/features/deep-prediction-ml2/data_2/mockMatches_2";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Translator } from "@/lib/i18n/messages";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const CONFIDENCE_LABEL_KEYS: Record<"High" | "Medium" | "Low", string> = {
  High: "deepPrediction.confidenceHigh",
  Medium: "deepPrediction.confidenceMedium",
  Low: "deepPrediction.confidenceLow",
};

function confidenceLabel(t: Translator, value: "High" | "Medium" | "Low") {
  return t(CONFIDENCE_LABEL_KEYS[value]);
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
  const { t } = useI18n();
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
      {confidenceLabel(t, normalizedConfidence)} · {score ?? 0}/100
    </div>
  );
}

function MatchListItem_2({
  match,
  isActive,
  onClick,
}: {
  match: PredictionMatch_2;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition",
        isActive
          ? "border-white/20 bg-white/10"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">
            {match.homeTeam ?? "-"} vs {match.awayTeam ?? "-"}
          </div>
          <div className="mt-1 text-xs text-white/45">
            {match.kickoff ?? "-"}
          </div>
        </div>
        <ConfidenceBadge_2
          confidence={match.confidence}
          score={match.confidenceScore}
        />
      </div>
    </button>
  );
}

function SelectedMatchCard_2({ match }: { match: PredictionMatch_2 }) {
  const { t } = useI18n();
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
                {t("common.home")}
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {formatNumber_2(match.homeShots)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                {t("common.away")}
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {formatNumber_2(match.awayShots)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                {t("deepPrediction.totalLabel")}
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
              {t("deepPrediction.edgeLabel")}
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
  const { t } = useI18n();
  const [activeMarket, setActiveMarket] = useState("shots");
  const [selectedConfidence, setSelectedConfidence] = useState<
    "All" | "High" | "Medium" | "Low"
  >("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");

  const normalizedMatches = useMemo(() => {
    return matches.map((match, index) => ({
      id: String(match.id ?? index + 1),
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
    const base =
      selectedConfidence === "All"
        ? normalizedMatches
        : normalizedMatches.filter(
            (match) => match.confidence === selectedConfidence
          );

    const term = searchTerm.trim().toLowerCase();
    if (!term) return base;

    return base.filter((match) => {
      const text = `${match.homeTeam} ${match.awayTeam} ${match.competition}`.toLowerCase();
      return text.includes(term);
    });
  }, [normalizedMatches, searchTerm, selectedConfidence]);

  useEffect(() => {
    if (filteredMatches.length === 0) {
      setSelectedMatchId("");
      return;
    }

    const stillExists = filteredMatches.some((match) => match.id === selectedMatchId);
    if (!stillExists) {
      setSelectedMatchId(filteredMatches[0].id ?? "");
    }
  }, [filteredMatches, selectedMatchId]);

  const selectedMatch =
    filteredMatches.find((match) => match.id === selectedMatchId) ??
    filteredMatches[0] ??
    null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(91,141,239,0.18),_transparent_28%),linear-gradient(180deg,#060b14_0%,#09111f_35%,#060b14_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[0.22em] text-white/35">
            {t("deepPrediction.kicker")}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {t("deepPrediction.title")}
          </h1>
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
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

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { label: t("common.all"), value: "All" as const },
                { label: t("deepPrediction.confidenceHigh"), value: "High" as const },
                { label: t("deepPrediction.confidenceMedium"), value: "Medium" as const },
                { label: t("deepPrediction.confidenceLow"), value: "Low" as const },
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

            <div className="relative w-full lg:w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("deepPrediction.searchPlaceholder")}
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/30"
              />
            </div>
          </div>
        </div>

        <div className="mb-4 lg:hidden">
          <select
            value={selectedMatchId}
            onChange={(e) => setSelectedMatchId(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          >
            {filteredMatches.map((match) => (
              <option key={match.id} value={match.id} className="bg-slate-900">
                {match.homeTeam} vs {match.awayTeam}
              </option>
            ))}
          </select>
        </div>

        {filteredMatches.length === 0 ? (
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-8 text-sm text-white/60">
            {t("deepPrediction.noFixturesMatch")}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="hidden lg:block">
              <div className="sticky top-6 space-y-3 rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
                {filteredMatches.map((match) => (
                  <MatchListItem_2
                    key={match.id}
                    match={match}
                    isActive={match.id === selectedMatchId}
                    onClick={() => setSelectedMatchId(match.id ?? "")}
                  />
                ))}
              </div>
            </div>

            <div>
              {selectedMatch ? (
                <SelectedMatchCard_2 match={selectedMatch} />
              ) : (
                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-8 text-sm text-white/60">
                  {t("deepPrediction.noSelectedFixture")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
