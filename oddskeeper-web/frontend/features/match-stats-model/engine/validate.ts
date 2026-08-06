// Motor doğrulama: Excel "Galatasaray - Corumspor / SOT" örneğini birebir üretir.
// Çalıştır: node --experimental-strip-types features/match-stats-model/engine/validate.ts
import { runModel } from './index';
import type { ModelInputs, MarketConfig, ModelConfig } from './types';

const mc: MarketConfig = {
  market: 'SOT',
  stdHomeFt: 2.5033726243017034, stdAwayFt: 2.4578226610702867,
  stdHome1h: 1.4777491062159056, stdAway1h: 1.4757642256386763,
  stdHome2h: 1.8993070392019562, stdAway2h: 1.8667193020349018,
  split1h: 0.4410436527847466, split2h: 0.5589563472152534,
  supremacyApplies: true, supremacySign: 'positive', refereeApplies: false,
};
const cfg: ModelConfig = {
  margin: 0.93, refereeWeight: 0.3, supremacyDivisor: 5.5,
  xmatrixWOwnFor: 0.65, xmatrixWOwnAlt: 0.05, xmatrixWOppAlt: 0.05, xmatrixWOppAgainst: 0.25,
  suLow: 1.17, suHigh: 4.51,
};
const inputs: ModelInputs = {
  market: 'SOT',
  homeSeasons: [
    { hf: 7.8125, ha: 2.5, af: 5.944444444444445, aa: 4.166666666666667, weight: 0.65 },      // 24-25
    { hf: 7.266666666666667, ha: 2.8666666666666667, af: 6.266666666666667, aa: 3.3157894736842106, weight: 0.35 }, // 23-24
  ],
  awaySeasons: [
    { hf: 5.029003267973857, ha: 3.8654970760233915, af: 3.8732370141038874, aa: 5.030787753697972, weight: 0.65 },
    { hf: 5.029003267973857, ha: 3.8654970760233915, af: 3.8732370141038874, aa: 5.030787753697972, weight: 0.35 },
  ],
  etki: 0, homeOdds: 1.25, drawOdds: 5.85, awayOdds: 9.58,
};

const EXP = { home: 7.131966162426129, away: 3.390686206342006, total: 10.522652368768135 };

function approx(a: number, b: number, tol = 1e-6) { return Math.abs(a - b) <= tol; }
function pct(a: number, b: number) { return ((a - b) / b * 100).toFixed(2) + '%'; }

const out = runModel(inputs, mc, cfg);
const e = out.expectancy;
console.log('=== EXPECTANCY (Excel ile birebir olmalı) ===');
console.log(`  home  = ${e.ft.homeMean.toFixed(6)}  (Excel ${EXP.home.toFixed(6)})  ${approx(e.ft.homeMean, EXP.home, 1e-6) ? 'OK' : 'FAIL'}`);
console.log(`  away  = ${e.ft.awayMean.toFixed(6)}  (Excel ${EXP.away.toFixed(6)})  ${approx(e.ft.awayMean, EXP.away, 1e-6) ? 'OK' : 'FAIL'}`);
console.log(`  total = ${e.ft.totalMean.toFixed(6)}  (Excel ${EXP.total.toFixed(6)})  ${approx(e.ft.totalMean, EXP.total, 1e-6) ? 'OK' : 'FAIL'}`);
console.log(`  supHome=${e.supremacyHome.toFixed(6)} (Excel 1.063238)  supAway=${e.supremacyAway.toFixed(6)} (Excel 0.936762)`);
console.log(`  1H home=${e.h1.homeMean.toFixed(4)} away=${e.h1.awayMean.toFixed(4)} | 2H home=${e.h2.homeMean.toFixed(4)} away=${e.h2.awayMean.toFixed(4)}`);

// Excel MC referans olasılıkları (FT).
const REF = {
  total: { balanced: 10.5, p: { 8.5: 0.72725, 9.5: 0.617, 10.5: 0.49725, 11.5: 0.38825, 12.5: 0.2875 } },
  home:  { balanced: 7.5,  p: { 5.5: 0.74975, 6.5: 0.591, 7.5: 0.4285, 8.5: 0.281, 9.5: 0.1705 } },
  away:  { balanced: 3.5,  p: { 1.5: 0.77475, 2.5: 0.6325, 3.5: 0.48525, 4.5: 0.32525, 5.5: 0.191 } },
};

function dumpEngine(label: string) {
  const o = runModel(inputs, mc, cfg);
  console.log(`\n=== ${label} — FT çizgileri (Excel MC ile karşılaştır) ===`);
  for (const sel of ['total', 'home', 'away'] as const) {
    const s = o.ft[sel];
    const ref = (REF as any)[sel];
    console.log(`  ${sel.toUpperCase()} balanced=${s.balancedLine} (Excel ${ref.balanced})`);
    for (const ln of s.lines) {
      const rp = ref.p[ln.line];
      const cmp = rp != null ? `Excel ${rp.toFixed(4)} (Δ${pct(ln.overProb, rp)})` : '';
      console.log(`     L${ln.line}: over=${ln.overProb.toFixed(4)} odds=${ln.overOdds.toFixed(3)}/${ln.underOdds.toFixed(3)} ${cmp}${ln.suspended ? ' [SU]' : ''}`);
    }
  }
}
dumpEngine('ANALYTIC');

// ===== Elle override doğrulama (Excel semantiği: total re-split, home/away direct) =====
console.log('\n=== ELLE OVERRIDE (SOT) ===');
const homeShare = EXP.home / EXP.total;
{
  const e = runModel({ ...inputs, manualTotal: 8 }, mc, cfg).expectancy;
  const okH = approx(e.ft.homeMean, homeShare * 8, 1e-6);
  const okT = approx(e.ft.totalMean, 8, 1e-9);
  const okS = approx(e.ft.homeMean + e.ft.awayMean, 8, 1e-6);
  console.log(`  manualTotal=8 → home=${e.ft.homeMean.toFixed(4)} (bek ${(homeShare * 8).toFixed(4)}) away=${e.ft.awayMean.toFixed(4)} total=${e.ft.totalMean.toFixed(4)} [re-split ${okH && okT && okS ? 'OK' : 'FAIL'}]`);
}
{
  const e = runModel({ ...inputs, manualHome: 5 }, mc, cfg).expectancy;
  const awayShare = EXP.away / EXP.total;
  const okH = approx(e.ft.homeMean, 5, 1e-9);
  const okT = approx(e.ft.totalMean, EXP.total, 1e-6);
  const okA = approx(e.ft.awayMean, awayShare * EXP.total, 1e-6);
  console.log(`  manualHome=5 → home=${e.ft.homeMean.toFixed(4)} (bek 5, direct) total=${e.ft.totalMean.toFixed(4)} (bek ${EXP.total.toFixed(4)}, değişmez) away=${e.ft.awayMean.toFixed(4)} [${okH && okT && okA ? 'OK' : 'FAIL'}]`);
}
{
  const e = runModel({ ...inputs, manualHome: 5, manualAway: 4 }, mc, cfg).expectancy;
  const ok = approx(e.ft.homeMean, 5, 1e-9) && approx(e.ft.awayMean, 4, 1e-9) && approx(e.ft.totalMean, 9, 1e-9);
  console.log(`  manualHome=5+manualAway=4 → total=${e.ft.totalMean.toFixed(4)} (bek 9 = toplam) [${ok ? 'OK' : 'FAIL'}]`);
}

// ===== Referee doğrulama (Card, DÜZELTİLMİŞ formül — Excel kolon-bug'ı hariç) =====
console.log('\n=== REFEREE (Card) ===');
const cardCfg: MarketConfig = {
  market: 'Card',
  stdHomeFt: 1.5040427469952558, stdAwayFt: 1.849377968742778,
  stdHome1h: 0.9643737873934948, stdAway1h: 0.9646862057121323,
  stdHome2h: 1.2151790370331064, stdAway2h: 1.388441742617337,
  split1h: 0.3505244755244755, split2h: 0.6494755244755245,
  supremacyApplies: true, supremacySign: 'negative', refereeApplies: true,
};
const cardInputs: ModelInputs = {
  market: 'Card',
  homeSeasons: [
    { hf: 2.0, ha: 2.3125, af: 2.9444444444444446, aa: 3.0, weight: 0.65 },
    { hf: 1.8, ha: 3.3333333333333335, af: 1.5333333333333334, aa: 2.1052631578947367, weight: 0.35 },
  ],
  awaySeasons: [
    { hf: 2.490712074303406, ha: 2.7169977640178886, af: 2.7217062263501894, aa: 2.495356037151703, weight: 0.65 },
    { hf: 2.490712074303406, ha: 2.7169977640178886, af: 2.7217062263501894, aa: 2.495356037151703, weight: 0.35 },
  ],
  etki: 0, homeOdds: 1.25, drawOdds: 5.85, awayOdds: 9.58,
  refereeCardsPg: 4.428571428571429,
};
const EXP_MODEL_TOTAL = 4.867489, EXP_REF_TOTAL = 4.735814, EXP_REF_HOME = 1.947437, EXP_REF_AWAY = 2.788377;
// Referee seçili ama ÖNERİ (auto girmez): total hâlâ modelTotal, refereeSuggestedTotal expose.
const eRef = runModel(cardInputs, cardCfg, cfg).expectancy;
console.log(`  modelTotal=${eRef.modelTotal.toFixed(6)} (bek ${EXP_MODEL_TOTAL})  ${approx(eRef.modelTotal, EXP_MODEL_TOTAL, 1e-4) ? 'OK' : 'FAIL'}`);
console.log(`  refSuggestedTotal=${(eRef.refereeSuggestedTotal ?? NaN).toFixed(6)} (bek ${EXP_REF_TOTAL})  ${approx(eRef.refereeSuggestedTotal ?? 0, EXP_REF_TOTAL, 1e-4) ? 'OK' : 'FAIL'}`);
console.log(`  öneri OTOMATİK girmiyor → total=${eRef.ft.totalMean.toFixed(6)} (bek ${EXP_MODEL_TOTAL}, modelTotal)  ${approx(eRef.ft.totalMean, EXP_MODEL_TOTAL, 1e-4) ? 'OK' : 'FAIL'}`);
// Kullanıcı öneriyi UYGULAR: manualTotal = refereeSuggestedTotal → re-split.
const eApplied = runModel({ ...cardInputs, manualTotal: eRef.refereeSuggestedTotal }, cardCfg, cfg).expectancy;
console.log(`  uygulanınca → total=${eApplied.ft.totalMean.toFixed(6)} home=${eApplied.ft.homeMean.toFixed(6)} (bek ${EXP_REF_HOME}) away=${eApplied.ft.awayMean.toFixed(6)} (bek ${EXP_REF_AWAY})  ${approx(eApplied.ft.homeMean, EXP_REF_HOME, 1e-4) && approx(eApplied.ft.awayMean, EXP_REF_AWAY, 1e-4) ? 'OK' : 'FAIL'}`);
