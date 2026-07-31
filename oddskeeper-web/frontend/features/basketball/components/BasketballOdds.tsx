"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { buildLadder } from "../odds";
import type { BktMarketModelRow } from "../types";

// Market gösterim sırası
const MARKET_ORDER = [
  "points", "rebounds", "assists", "threes", "twos", "fgm", "ftm",
  "steals", "blocks", "turnovers", "oreb", "dreb", "pra", "pa", "pr",
];

function NumInput({
  value,
  onChange,
  step = 0.1,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!Number.isNaN(v)) onChange(v);
      }}
      className="w-20 rounded-md border border-line bg-field px-2 py-1 text-right text-[13px] tabular-nums text-ink outline-none focus:border-line-strong"
    />
  );
}

export default function BasketballOdds({
  models,
  defaultPayback = 0.915,
}: {
  models: BktMarketModelRow[];
  defaultPayback?: number;
}) {
  const { t } = useI18n();

  const ordered = useMemo(() => {
    const byKey = new Map(models.map((m) => [m.market_key, m]));
    return MARKET_ORDER.filter((k) => byKey.has(k)).map((k) => byKey.get(k)!);
  }, [models]);

  const [marketKey, setMarketKey] = useState(ordered[0]?.market_key ?? "points");
  const active = ordered.find((m) => m.market_key === marketKey) ?? ordered[0];

  // düzenlenebilir parametreler (market değişince modelden yeniden yüklenir)
  const [override, setOverride] = useState<{ key: string; mean: number; std: number; payback: number } | null>(null);
  const mean = override?.key === marketKey ? override.mean : Number(active?.mean ?? 0);
  const std = override?.key === marketKey ? override.std : Number(active?.std ?? 0);
  const payback = override?.key === marketKey ? override.payback : defaultPayback;

  const setParam = (patch: Partial<{ mean: number; std: number; payback: number }>) => {
    setOverride({ key: marketKey, mean, std, payback, ...patch });
  };
  const reset = () => setOverride(null);

  const ladder = useMemo(() => buildLadder(mean, std, payback), [mean, std, payback]);

  if (!active) return <p className="text-sm text-ink-3">{t("basketball.noData")}</p>;

  return (
    <div>
      {/* market seçici */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {ordered.map((m) => (
          <button
            key={m.market_key}
            onClick={() => setMarketKey(m.market_key)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
              m.market_key === marketKey ? "bg-accent-soft text-accent-ink" : "bg-card-2 text-ink-3 hover:text-ink"
            }`}
          >
            {m.market_label}
          </button>
        ))}
      </div>

      {/* parametreler */}
      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-lg border border-line bg-veil px-4 py-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.oddsMean")}</span>
          <NumInput value={Math.round(mean * 100) / 100} onChange={(v) => setParam({ mean: v })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.oddsStd")}</span>
          <NumInput value={Math.round(std * 100) / 100} onChange={(v) => setParam({ std: v })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.oddsPayback")}</span>
          <NumInput value={payback} step={0.005} onChange={(v) => setParam({ payback: v })} />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("basketball.oddsSamples", { n: active.games })}</span>
          {override?.key === marketKey ? (
            <button onClick={reset} className="rounded-md border border-line px-2 py-1 text-[11px] text-ink-2 hover:text-ink">
              {t("basketball.oddsReset")}
            </button>
          ) : (
            <span className="px-2 py-1 text-[11px] text-ink-3">·</span>
          )}
        </div>
      </div>

      {/* ladder */}
      <div className="overflow-x-auto">
        <table className="min-w-full max-w-md border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
              <th className="px-3 py-2 text-left">{t("basketball.oddsLine")}</th>
              <th className="px-3 py-2 text-right">{t("basketball.oddsProb")}</th>
              <th className="px-3 py-2 text-right">{t("basketball.oddsOver")}</th>
              <th className="px-3 py-2 text-right">{t("basketball.oddsUnder")}</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((r) => (
              <tr
                key={r.line}
                className={`border-t border-line ${r.isMid ? "bg-accent-soft" : "hover:bg-veil"}`}
              >
                <td className={`px-3 py-1.5 tabular-nums ${r.isMid ? "font-semibold text-accent-ink" : "text-ink"}`}>{r.line.toFixed(1)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink-3">{(r.overProb * 100).toFixed(1)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{r.overPrice.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink-2">{r.underPrice.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 max-w-md text-[11px] leading-relaxed text-ink-3">{t("basketball.oddsNote")}</p>
    </div>
  );
}
