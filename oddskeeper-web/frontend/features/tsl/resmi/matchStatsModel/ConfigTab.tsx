"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "../../../../lib/i18n/LanguageProvider";
import { confirmPermanentSave } from "@/lib/confirm-save";
import {
  HIST_SEASONS,
  CURRENT_SEASON,
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

// Supremacy demo şablonu: sabit oranlar + 10/10 beklenti üzerinden bölen etkisi.
const EX_ODDS = { h: 1.25, d: 5.85, a: 9.58 };
const EX_BASE = 10;

type Section = "model" | "markets" | "stdHalves" | "export";

export default function ConfigTab({
  league,
  focus,
  onSaved,
  exportExtras,
}: {
  league: string;
  focus?: string | null;
  onSaved?: () => void;
  // Export sekmesinde gosterilecek parent kartlari (SU toggle + saklama suresi).
  exportExtras?: ReactNode;
}) {
  const { t } = useI18n();
  const [model, setModel] = useState<RawModelConfig | null>(null);
  const [markets, setMarkets] = useState<RawMarketConfig[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [status, setStatus] = useState<"" | "saving" | "ok" | "err">("");
  const [section, setSection] = useState<Section>("model");
  // Markets altındaki supremacy demosunun böleni (kaydedilmez, sadece deneme).
  const [demoDiv, setDemoDiv] = useState(5.5);

  useEffect(() => {
    fetchRawModelConfig(league).then(setModel);
    fetchRawMarketConfigs(league).then(setMarkets);
    fetchTemplates(league).then(setTemplates);
  }, [league]);

  // Model'deki dişliden gelen odak: ilgili sekmeye geç + karta kaydır + vurgula.
  useEffect(() => {
    if (!focus || !model) return;
    setSection(focus === "markets" ? "markets" : "model");
    const el = document.getElementById(`cfg-${focus}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("ring-2", "ring-accent");
    const tmr = setTimeout(() => el.classList.remove("ring-2", "ring-accent"), 1600);
    return () => clearTimeout(tmr);
  }, [focus, model]);

  function setM<K extends keyof RawModelConfig>(k: K, v: RawModelConfig[K]) {
    setModel((m) => (m ? { ...m, [k]: v } : m));
  }
  function setMk(i: number, patch: Partial<RawMarketConfig>) {
    setMarkets((ms) => ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  async function saveAll() {
    if (!model) return;
    if (!(await confirmPermanentSave())) return;
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

  // Ortak kart iskeleti: başlık + kısa açıklama + içerik. Tüm sekmeler bunu
  // kullanır; görsel dil tek tip kalır.
  function Card({
    id,
    title,
    hint,
    className = "",
    children,
  }: {
    id?: string;
    title: string;
    hint?: string;
    className?: string;
    children: ReactNode;
  }) {
    return (
      <section id={id} className={`scroll-mt-4 rounded-xl border border-line bg-card p-4 ${className}`}>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mb-3 mt-0.5 min-h-[1em] max-w-2xl text-[11px] leading-relaxed text-ink-3">
          {hint ?? ""}
        </p>
        {children}
      </section>
    );
  }

  if (!model) return <div className="py-10 text-center text-sm text-ink-3">…</div>;

  const SECTIONS: Array<[Section, string]> = [
    ["model", t("msm.cfgTabModel")],
    ["markets", t("msm.cfgMarkets")],
    ["stdHalves", t("msm.cfgStdHalves")],
    ["export", t("msm.cfgTabExport")],
  ];

  return (
    <div className="space-y-4">
      {/* Alt sekmeler + Kaydet çubuğu (Export sekmesinin kendi kaydetleri var) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-card-2 p-0.5">
          {SECTIONS.map(([s, label]) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`rounded-md px-3 py-1 text-sm ${
                section === s ? "bg-veil font-semibold text-ink" : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {section !== "export" && (
          <button
            onClick={saveAll}
            disabled={status === "saving"}
            className="ml-auto rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-on-accent hover:opacity-90 disabled:opacity-50"
          >
            {t("msm.save")}
          </button>
        )}
        {status === "ok" && <span className="text-sm text-pos">{t("msm.saved")}</span>}
        {status === "err" && <span className="text-sm text-neg">{t("msm.saveFailed")}</span>}
      </div>

      {/* ── MODEL: motor parametreleri, konu bazlı küçük kartlar ── */}
      {section === "model" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t("msm.cfgPricing")} hint={t("msm.suNote")}>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>{t("msm.margin")}</label>{numField(model.margin, (v) => setM("margin", v))}</div>
              <div><label className={lbl}>{t("msm.suLow")}</label>{numField(model.su_low, (v) => setM("su_low", v))}</div>
              <div><label className={lbl}>{t("msm.suHigh")}</label>{numField(model.su_high, (v) => setM("su_high", v))}</div>
            </div>
          </Card>

          <Card id="cfg-model" title={t("msm.cfgReferee")} hint={t("msm.refMinMatchesNote")}>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>{t("msm.refereeWeight")}</label>{numField(model.referee_weight, (v) => setM("referee_weight", v))}</div>
              <div><label className={lbl}>{t("msm.refMinMatches")}</label>{numField(model.referee_min_matches, (v) => setM("referee_min_matches", v), "1")}</div>
            </div>
          </Card>

          <Card id="cfg-weighting" title={t("msm.cfgWeighting")} hint={t("msm.weightSumNote")}>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>{HIST_SEASONS[0]}</label>{numField(model.weight_s1, (v) => setM("weight_s1", v))}</div>
              <div><label className={lbl}>{HIST_SEASONS[1]}</label>{numField(model.weight_s2, (v) => setM("weight_s2", v))}</div>
              <div><label className={lbl}>{HIST_SEASONS[2]}</label>{numField(model.weight_s3, (v) => setM("weight_s3", v))}</div>
              <div><label className={lbl}>{CURRENT_SEASON}</label>{numField(model.weight_s4, (v) => setM("weight_s4", v))}</div>
              <div><label className={lbl}>{t("msm.defaultEtki")}</label>{numField(model.default_etki, (v) => setM("default_etki", v))}</div>
            </div>
          </Card>

          <Card title={t("msm.equation")} hint={t("msm.equationHint")} className="lg:col-span-2">
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
          </Card>
        </div>
      )}

      {/* ── MARKETS: market başına bayraklar + FT/1H/2H derin kontrol + template listesi ── */}
      {section === "markets" && (
        <div className="space-y-4">
          <Card id="cfg-markets" title={t("msm.cfgMarkets")} hint={t("msm.marketsNote")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-[11px] tabular-nums">
                <thead>
                  <tr className="text-ink-3">
                    <th rowSpan={2} className="px-1 py-1 text-center align-bottom font-medium">{t("msm.showCol")}</th>
                    <th rowSpan={2} className="px-1 py-1 align-bottom font-medium">{t("msm.market")}</th>
                    <th colSpan={2} className="border-l border-line/60 px-1 py-1 text-center font-medium">{t("msm.halfShare")}</th>
                    <th rowSpan={2} className="border-l border-line/60 px-1 py-1 text-center align-bottom font-medium">{t("msm.refereeCol")}</th>
                    <th rowSpan={2} className="px-1 py-1 text-center align-bottom font-medium">{t("msm.sendHalves")}</th>
                    <th rowSpan={2} className="px-1 py-1 text-center align-bottom font-medium">{t("msm.midOnly")}</th>
                    <th colSpan={1} className="border-l border-line/60 px-1 py-1 text-center font-medium">FT</th>
                    <th colSpan={3} className="border-l border-line/60 px-1 py-1 text-center font-medium">{t("msm.firstHalf")}</th>
                    <th colSpan={3} className="border-l border-line/60 px-1 py-1 text-center font-medium">{t("msm.secondHalf")}</th>
                    <th rowSpan={2} className="border-l border-line/60 px-1 py-1 text-center align-bottom font-medium">{t("msm.lvlCol")}</th>
                    <th rowSpan={2} className="px-1 py-1 text-center align-bottom font-medium">{t("msm.supremacyCol")}</th>
                  </tr>
                  <tr className="text-ink-3">
                    <th className="border-l border-line/60 px-1 py-0.5 text-center font-normal">{t("msm.firstHalf")}</th>
                    <th className="px-1 py-0.5 text-center font-normal">{t("msm.secondHalf")}</th>
                    <th className="border-l border-line/60 px-1 py-0.5 text-center font-normal">{t("msm.lineCount")}</th>
                    <th className="border-l border-line/60 px-1 py-0.5 text-center font-normal">{t("msm.lineCount")}</th>
                    <th className="px-1 py-0.5 text-center font-normal">{t("msm.underCol")}</th>
                    <th className="px-1 py-0.5 text-center font-normal">{t("msm.payback")}</th>
                    <th className="border-l border-line/60 px-1 py-0.5 text-center font-normal">{t("msm.lineCount")}</th>
                    <th className="px-1 py-0.5 text-center font-normal">{t("msm.underCol")}</th>
                    <th className="px-1 py-0.5 text-center font-normal">{t("msm.payback")}</th>
                  </tr>
                </thead>
                <tbody>
                  {markets.map((m, i) => {
                    const cell = (v: number, on: (x: number) => void, left = false) => (
                      <td className={`px-1 py-0.5 ${left ? "border-l border-line/60" : ""}`}>
                        <input type="number" step="0.01" className={`${inp} w-16`}
                          value={Number.isFinite(v) ? Number(v.toFixed(2)) : ""}
                          onChange={(e) => on(parseFloat(e.target.value))} />
                      </td>
                    );
                    const chk = (v: boolean, on: (x: boolean) => void, left = false) => (
                      <td className={`px-1 py-0.5 text-center ${left ? "border-l border-line/60" : ""}`}>
                        <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)}
                          className="h-3.5 w-3.5 accent-[var(--color-accent)]" />
                      </td>
                    );
                    // Çizgi sayısı 1..5 (motor dengeli çizgi etrafında en çok 5 çizgi üretir).
                    const lines = (v: number, on: (x: number) => void, left = false) => (
                      <td className={`px-1 py-0.5 text-center ${left ? "border-l border-line/60" : ""}`}>
                        <input type="number" step="1" min="1" max="5" className={`${inp} w-12`} value={v}
                          onChange={(e) => on(Math.min(5, Math.max(1, parseInt(e.target.value) || 3)))} />
                      </td>
                    );
                    return (
                      <tr key={m.market} className="border-t border-line/60 text-ink-2 odd:bg-veil/30">
                        {chk(m.enabled, (x) => setMk(i, { enabled: x }))}
                        <td className="px-1 py-0.5 font-medium text-ink">{m.market}</td>
                        {cell(m.split_1h, (x) => setMk(i, { split_1h: x }), true)}
                        {cell(m.split_2h, (x) => setMk(i, { split_2h: x }))}
                        {chk(m.referee_applies, (x) => setMk(i, { referee_applies: x }), true)}
                        {chk(m.send_halves, (x) => setMk(i, { send_halves: x }))}
                        {chk(m.mid_only, (x) => setMk(i, { mid_only: x }))}
                        {lines(m.line_count, (x) => setMk(i, { line_count: x }), true)}
                        {lines(m.line_count_1h, (x) => setMk(i, { line_count_1h: x }), true)}
                        {chk(m.under_1h, (x) => setMk(i, { under_1h: x }))}
                        {cell(m.payback_1h, (x) => setMk(i, { payback_1h: x }))}
                        {lines(m.line_count_2h, (x) => setMk(i, { line_count_2h: x }), true)}
                        {chk(m.under_2h, (x) => setMk(i, { under_2h: x }))}
                        {cell(m.payback_2h, (x) => setMk(i, { payback_2h: x }))}
                        {cell(m.supremacy_divisor, (x) => setMk(i, { supremacy_divisor: x }), true)}
                        {chk(m.supremacy_applies, (x) => setMk(i, { supremacy_applies: x }))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Supremacy demo: bölen değerini dene, kaydedilen ayarı ETKİLEMEZ. */}
            {(() => {
              const h = 1 / EX_ODDS.h, a = 1 / EX_ODDS.a, avg = (h + a) / 2;
              const div = Number.isFinite(demoDiv) && demoDiv > 0 ? demoDiv : 5.5;
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
                <div className="mt-3 max-w-md rounded-md border border-line bg-card-2 p-2 text-[12px]">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-3">{t("msm.lvlExample")}</div>
                  <div className="mb-2 flex items-center gap-2">
                    <label className="text-[11px] text-ink-3">{t("msm.supremacyDivisor")}</label>
                    <input
                      type="number" step="0.1" className={`${inp} w-20`}
                      value={Number.isFinite(demoDiv) ? demoDiv : ""}
                      onChange={(e) => setDemoDiv(parseFloat(e.target.value))}
                    />
                    <span className="text-[10px] text-ink-3">{t("msm.lvlNote")}</span>
                  </div>
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
          </Card>

          <Card id="cfg-templates" title={t("msm.cfgTemplates")} hint={t("msm.templatesHint")}>
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
          </Card>
        </div>
      )}

      {/* ── STD & HALVES: market başına std + yarı payları ── */}
      {section === "stdHalves" && (
        <Card title={t("msm.cfgStdHalves")} hint={t("msm.stdHalvesNote")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[11px] tabular-nums">
              <thead>
                <tr className="text-ink-3">
                  <th rowSpan={2} className="px-1 py-1 align-bottom font-medium">{t("msm.market")}</th>
                  <th colSpan={2} className="border-l border-line/60 px-1 py-1 text-center font-medium">{t("msm.stdFt")}</th>
                  <th colSpan={2} className="border-l border-line/60 px-1 py-1 text-center font-medium">{t("msm.std1H")}</th>
                  <th colSpan={2} className="border-l border-line/60 px-1 py-1 text-center font-medium">{t("msm.std2H")}</th>
                  <th colSpan={2} className="border-l border-line/60 px-1 py-1 text-center font-medium">{t("msm.halveShares")}</th>
                </tr>
                <tr className="text-ink-3">
                  <th className="border-l border-line/60 px-1 py-0.5 text-center font-normal">{t("msm.home")}</th>
                  <th className="px-1 py-0.5 text-center font-normal">{t("msm.away")}</th>
                  <th className="border-l border-line/60 px-1 py-0.5 text-center font-normal">{t("msm.home")}</th>
                  <th className="px-1 py-0.5 text-center font-normal">{t("msm.away")}</th>
                  <th className="border-l border-line/60 px-1 py-0.5 text-center font-normal">{t("msm.home")}</th>
                  <th className="px-1 py-0.5 text-center font-normal">{t("msm.away")}</th>
                  <th className="border-l border-line/60 px-1 py-0.5 text-center font-normal">1H</th>
                  <th className="px-1 py-0.5 text-center font-normal">2H</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((m, i) => {
                  const cell = (v: number, on: (x: number) => void, left = false) => (
                    <td className={`px-1 py-0.5 ${left ? "border-l border-line/60" : ""}`}>
                      <input type="number" step="0.01" className={`${inp} w-16`}
                        value={Number.isFinite(v) ? Number(v.toFixed(2)) : ""}
                        onChange={(e) => on(parseFloat(e.target.value))} />
                    </td>
                  );
                  return (
                    <tr key={m.market} className="border-t border-line/60 text-ink-2 odd:bg-veil/30">
                      <td className="px-1 py-0.5 font-medium text-ink">{m.market}</td>
                      {cell(m.std_home_ft, (x) => setMk(i, { std_home_ft: x }), true)}
                      {cell(m.std_away_ft, (x) => setMk(i, { std_away_ft: x }))}
                      {cell(m.std_home_1h, (x) => setMk(i, { std_home_1h: x }), true)}
                      {cell(m.std_away_1h, (x) => setMk(i, { std_away_1h: x }))}
                      {cell(m.std_home_2h, (x) => setMk(i, { std_home_2h: x }), true)}
                      {cell(m.std_away_2h, (x) => setMk(i, { std_away_2h: x }))}
                      {cell(m.split_1h, (x) => setMk(i, { split_1h: x }), true)}
                      {cell(m.split_2h, (x) => setMk(i, { split_2h: x }))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── EXPORT: SU davranışı + export geçmişi saklama (kendi kaydetleri var) ── */}
      {section === "export" && <div className="space-y-4">{exportExtras}</div>}
    </div>
  );
}
