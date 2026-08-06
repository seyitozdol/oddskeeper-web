"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../../../../lib/i18n/LanguageProvider";
import {
  HIST_SEASONS,
  fetchRawModelConfig,
  fetchRawMarketConfigs,
  fetchTemplates,
  saveModelConfig,
  saveMarketConfig,
  type RawModelConfig,
  type RawMarketConfig,
  type TemplateRow,
} from "./queries";

const NO_SPINNER =
  "appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

// Equation 4x2 matrisi: satır HF/HA/AA/AF, kolon Home/Away → her hücre bir ağırlığa bağlı.
// (Home ve Away kolonları aynı 4 ağırlığın simetrik dizilişi; ayna hücreler senkron.)
type XKey =
  | "xmatrix_w_own_for"
  | "xmatrix_w_own_alt"
  | "xmatrix_w_opp_alt"
  | "xmatrix_w_opp_against";
const EQUATION_ROWS: Array<[string, XKey, XKey]> = [
  ["HF", "xmatrix_w_own_for", "xmatrix_w_own_alt"],
  ["HA", "xmatrix_w_opp_alt", "xmatrix_w_opp_against"],
  ["AA", "xmatrix_w_opp_against", "xmatrix_w_opp_alt"],
  ["AF", "xmatrix_w_own_alt", "xmatrix_w_own_for"],
];

// LVL örnek şablonu: sabit oranlar + 10/10 beklenti üzerinden supremacy etkisi.
const EX_ODDS = { h: 1.25, d: 5.85, a: 9.58 };
const EX_BASE = 10;

export default function ConfigTab({
  league,
  onSaved,
}: {
  league: string;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const [model, setModel] = useState<RawModelConfig | null>(null);
  const [markets, setMarkets] = useState<RawMarketConfig[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [status, setStatus] = useState<"" | "saving" | "ok" | "err">("");

  useEffect(() => {
    fetchRawModelConfig(league).then(setModel);
    fetchRawMarketConfigs(league).then(setMarkets);
    fetchTemplates(league).then(setTemplates);
  }, [league]);

  function setM<K extends keyof RawModelConfig>(k: K, v: RawModelConfig[K]) {
    setModel((m) => (m ? { ...m, [k]: v } : m));
  }
  function setMk(i: number, patch: Partial<RawMarketConfig>) {
    setMarkets((ms) => ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  async function saveAll() {
    if (!model) return;
    setStatus("saving");
    const okModel = await saveModelConfig(league, model);
    const results = await Promise.all(markets.map((m) => saveMarketConfig(league, m.market, m)));
    const ok = okModel && results.every(Boolean);
    setStatus(ok ? "ok" : "err");
    if (ok) onSaved?.();
    setTimeout(() => setStatus(""), 2500);
  }

  const inp = `rounded-md border border-line bg-field px-2 py-1 text-sm text-ink focus:outline-none focus:border-accent ${NO_SPINNER}`;
  const lbl = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-3";
  const numField = (
    value: number,
    onChange: (v: number) => void,
    step = "0.01",
    w = "w-full"
  ) => (
    <input
      type="number"
      step={step}
      className={`${inp} ${w}`}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  );

  if (!model) return <div className="py-10 text-center text-sm text-ink-3">…</div>;

  return (
    <div className="space-y-5">
      {/* Kaydet çubuğu */}
      <div className="flex items-center gap-3">
        <button
          onClick={saveAll}
          disabled={status === "saving"}
          className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
        >
          {t("msm.save")}
        </button>
        {status === "ok" && <span className="text-sm text-pos">{t("msm.saved")}</span>}
        {status === "err" && <span className="text-sm text-neg">{t("msm.saveFailed")}</span>}
      </div>

      {/* Model parametreleri */}
      <section className="rounded-xl border border-line bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">{t("msm.cfgModel")}</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div><label className={lbl}>{t("msm.margin")}</label>{numField(model.margin, (v) => setM("margin", v))}</div>
          <div><label className={lbl}>{t("msm.refereeWeight")}</label>{numField(model.referee_weight, (v) => setM("referee_weight", v))}</div>
          <div><label className={lbl}>{t("msm.suLow")}</label>{numField(model.su_low, (v) => setM("su_low", v))}</div>
          <div><label className={lbl}>{t("msm.suHigh")}</label>{numField(model.su_high, (v) => setM("su_high", v))}</div>
          <div>
            <label className={lbl}>{t("msm.engine")}</label>
            <select className={`${inp} w-full`} value={model.engine} onChange={(e) => setM("engine", e.target.value as "analytic" | "montecarlo")}>
              <option value="analytic" className="bg-field text-ink">{t("msm.analytic")}</option>
              <option value="montecarlo" className="bg-field text-ink">{t("msm.montecarlo")}</option>
            </select>
          </div>
          <div><label className={lbl}>{t("msm.samples")}</label>{numField(model.mc_samples, (v) => setM("mc_samples", Math.round(v)), "500")}</div>
        </div>
        <p className="mt-2 text-[11px] text-ink-3">{t("msm.suNote")}</p>
        <h4 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("msm.equation")}</h4>
        <table className="text-[12px]">
          <thead>
            <tr className="text-ink-3">
              <th className="px-2 py-1"></th>
              <th className="px-2 py-1 text-center font-medium">{t("msm.home")}</th>
              <th className="px-2 py-1 text-center font-medium">{t("msm.away")}</th>
            </tr>
          </thead>
          <tbody>
            {EQUATION_ROWS.map(([label, homeKey, awayKey]) => (
              <tr key={label}>
                <td className="px-2 py-1 font-semibold text-ink">{label}</td>
                <td className="px-1 py-1">{numField(model[homeKey], (v) => setM(homeKey, v), "0.01", "w-20")}</td>
                <td className="px-1 py-1">{numField(model[awayKey], (v) => setM(awayKey, v), "0.01", "w-20")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Ağırlıklandırma + LVL */}
      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">{t("msm.cfgWeighting")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>{HIST_SEASONS[0]}</label>{numField(model.weight_s1, (v) => setM("weight_s1", v))}</div>
            <div><label className={lbl}>{HIST_SEASONS[1]}</label>{numField(model.weight_s2, (v) => setM("weight_s2", v))}</div>
            <div><label className={lbl}>{HIST_SEASONS[2]}</label>{numField(model.weight_s3, (v) => setM("weight_s3", v))}</div>
            <div><label className={lbl}>{t("msm.defaultEtki")}</label>{numField(model.default_etki, (v) => setM("default_etki", v))}</div>
          </div>
          <p className="mt-2 text-[11px] text-ink-3">{t("msm.weightSumNote")}</p>
        </section>

        <section className="rounded-xl border border-line bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">{t("msm.cfgLvl")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>{t("msm.supremacyDivisor")}</label>{numField(model.supremacy_divisor, (v) => setM("supremacy_divisor", v), "0.1")}</div>
          </div>
          <p className="mt-2 text-[11px] text-ink-3">{t("msm.lvlNote")}</p>

          {/* Örnek şablon: sabit oranlar + 10/10 beklenti üzerinden supremacy etkisi (canlı) */}
          {(() => {
            const h = 1 / EX_ODDS.h, a = 1 / EX_ODDS.a, avg = (h + a) / 2;
            const div = model.supremacy_divisor || 5.5;
            const homeAdj = EX_BASE * ((h - avg) / div + 1);
            const awayAdj = EX_BASE * ((a - avg) / div + 1);
            const chip = (v: number) => {
              const d = v - EX_BASE;
              return (
                <span className={d >= 0 ? "text-pos" : "text-neg"}>
                  ({d >= 0 ? "+" : ""}{d.toFixed(2)})
                </span>
              );
            };
            return (
              <div className="mt-3 rounded-md border border-line bg-card-2 p-2 text-[12px]">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-3">{t("msm.lvlExample")}</div>
                <div className="text-ink-3">
                  Home {EX_ODDS.h} · X {EX_ODDS.d} · 2 {EX_ODDS.a} · {t("msm.homeExp")}/{t("msm.awayExp")} {EX_BASE} / {EX_BASE}
                </div>
                <div className="mt-1 flex gap-5 tabular-nums">
                  <span>{t("msm.home")}: <b className="text-ink">{homeAdj.toFixed(2)}</b> {chip(homeAdj)}</span>
                  <span>{t("msm.away")}: <b className="text-ink">{awayAdj.toFixed(2)}</b> {chip(awayAdj)}</span>
                </div>
              </div>
            );
          })()}
        </section>
      </div>

      {/* Marketler tablosu */}
      <section className="rounded-xl border border-line bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">{t("msm.cfgMarkets")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[11px] tabular-nums">
            <thead>
              <tr className="text-ink-3">
                <th className="px-1 py-1 font-medium">{t("msm.market")}</th>
                <th className="px-1 py-1 font-medium">split1H</th>
                <th className="px-1 py-1 font-medium">split2H</th>
                <th className="px-1 py-1 text-center font-medium">{t("msm.supremacyCol")}</th>
                <th className="px-1 py-1 text-center font-medium">{t("msm.refereeCol")}</th>
                <th className="px-1 py-1 text-center font-medium">{t("msm.lineCount")}</th>
                <th className="px-1 py-1 text-center font-medium">{t("msm.sendHalves")}</th>
                <th className="px-1 py-1 text-center font-medium">{t("msm.midOnly")}</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m, i) => {
                const cell = (v: number, on: (x: number) => void) => (
                  <td className="px-1 py-0.5">
                    <input type="number" step="0.0001" className={`${inp} w-16`} value={v}
                      onChange={(e) => on(parseFloat(e.target.value))} />
                  </td>
                );
                const chk = (v: boolean, on: (x: boolean) => void) => (
                  <td className="px-1 py-0.5 text-center">
                    <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[var(--color-accent)]" />
                  </td>
                );
                return (
                  <tr key={m.market} className="border-t border-line/60 text-ink-2">
                    <td className="px-1 py-0.5 font-medium text-ink">{m.market}</td>
                    {cell(m.split_1h, (x) => setMk(i, { split_1h: x }))}
                    {cell(m.split_2h, (x) => setMk(i, { split_2h: x }))}
                    {chk(m.supremacy_applies, (x) => setMk(i, { supremacy_applies: x }))}
                    {chk(m.referee_applies, (x) => setMk(i, { referee_applies: x }))}
                    <td className="px-1 py-0.5 text-center">
                      <input type="number" step="1" min="1" className={`${inp} w-12`} value={m.line_count}
                        onChange={(e) => setMk(i, { line_count: Math.max(1, parseInt(e.target.value) || 3) })} />
                    </td>
                    {chk(m.send_halves, (x) => setMk(i, { send_halves: x }))}
                    {chk(m.mid_only, (x) => setMk(i, { mid_only: x }))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Template listesi (salt-okunur) */}
      <section className="rounded-xl border border-line bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">{t("msm.cfgTemplates")}</h3>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {Array.from(new Set(templates.map((x) => x.market))).map((mk) => (
            <div key={mk} className="rounded-lg border border-line bg-card-2 p-2">
              <div className="mb-1 text-xs font-semibold text-ink">{mk}</div>
              <div className="flex flex-wrap gap-1">
                {templates.filter((x) => x.market === mk).map((x) => (
                  <span key={x.template_code} title={x.details ?? ""}
                    className="rounded bg-field px-1.5 py-0.5 text-[10px] text-ink-2">
                    {x.template_code}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
