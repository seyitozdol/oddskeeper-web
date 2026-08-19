// Beklenti (expectancy) katmanı: Excel Sim sayfasının mantığı.
// weighted (yıl-ağırlıklı geçmiş) + lastX (güncel son-x-hafta) -> Etki% harman (W6)
// -> çapraz matris -> supremacy -> 1H/2H bölüşüm.
import type {
  HFAA,
  SeasonWeighted,
  MarketConfig,
  ModelConfig,
  ModelInputs,
  Expectancy,
} from './types';

// Σ weight_i · season_i (yıl-ağırlıklı geçmiş harman; 25-26 / 24-25 / 23-24).
function yearWeighted(seasons: SeasonWeighted[]): HFAA {
  const acc: HFAA = { hf: 0, ha: 0, af: 0, aa: 0 };
  for (const s of seasons) {
    acc.hf += s.weight * s.hf;
    acc.ha += s.weight * s.ha;
    acc.af += s.weight * s.af;
    acc.aa += s.weight * s.aa;
  }
  return acc;
}

// Excel W6: calculated = etki*current + (1-etki)*weighted (alan bazında).
// etki=0 → tamamen weighted; etki=1 → tamamen current (weighted bypass).
// etki>0 AMA son-x (current) verisi yoksa → o oranda BOŞ tabloyu harmanlamış oluruz:
// calculated NaN döner (UI'da "—"). Yani %100'de son-x boşsa tüm sonuç boşalır.
function blendCurrent(weighted: HFAA, current: HFAA | null | undefined, etki: number): HFAA {
  const e = Math.min(1, Math.max(0, etki));
  if (e <= 0) return weighted;
  if (!current) return { hf: NaN, ha: NaN, af: NaN, aa: NaN };
  const mix = (c: number, w: number) => e * c + (1 - e) * w;
  return {
    hf: mix(current.hf, weighted.hf),
    ha: mix(current.ha, weighted.ha),
    af: mix(current.af, weighted.af),
    aa: mix(current.aa, weighted.aa),
  };
}

export function computeExpectancy(
  inputs: ModelInputs,
  mc: MarketConfig,
  cfg: ModelConfig
): Expectancy {
  // 1) weighted (geçmiş) → lastX (güncel) ile Etki% harmanı = calculated, iki takım.
  const homeW = yearWeighted(inputs.homeSeasons);
  const awayW = yearWeighted(inputs.awaySeasons);
  const home = blendCurrent(homeW, inputs.homeCurrent, inputs.etki);
  const away = blendCurrent(awayW, inputs.awayCurrent, inputs.etki);

  // 2) Çapraz matris. Ev sahibi evde oynar (HF birincil), rakip deplasmanda (AA birincil-against).
  const { xmatrixWOwnFor: w1, xmatrixWOwnAlt: w2, xmatrixWOppAlt: w3, xmatrixWOppAgainst: w4 } = cfg;
  // "Against" ağırlığı (w4=0.25) daima rakibin OYNANAN VENUE'daki against'ine gider:
  // ev sahibi evde oynar -> rakibin dep-against (aa)*0.25; dep oynar -> rakibin ev-against (ha)*0.25.
  // homeEq/awayEq = çapraz matris (supremacy ÖNCESİ, Excel Eq/U27).
  const homeEq = w1 * home.hf + w2 * home.af + w3 * away.ha + w4 * away.aa;
  const awayEq = w1 * away.af + w2 * away.hf + w4 * home.ha + w3 * home.aa;
  let homeXs = homeEq;
  let awayXs = awayEq;

  // 3) Supremacy (1x2 oranından). Pozitif markette favori artar, negatifte azalır.
  const h = 1 / inputs.homeOdds;
  const a = 1 / inputs.awayOdds;
  const avg = (h + a) / 2;
  const supDivisor = mc.supremacyDivisor ?? cfg.supremacyDivisor; // market bazlı, yoksa global
  const cxHome = (h - avg) / supDivisor + 1; // ev favori faktörü
  const cxAway = (a - avg) / supDivisor + 1; // dep favori faktörü
  let supHome = 1;
  let supAway = 1;
  if (mc.supremacyApplies && mc.supremacySign !== 'none') {
    if (mc.supremacySign === 'positive') {
      supHome = cxHome;
      supAway = cxAway;
    } else {
      // negatif: favori DAHA AZ -> ev sahibi dep faktörünü (cxAway<1), dep ev faktörünü alır
      supHome = cxAway;
      supAway = cxHome;
    }
  }
  homeXs = homeXs * supHome;
  awayXs = awayXs * supAway;

  // 4) Ham model toplamı + ev payı (supremacy sonrası).
  const modelTotal = homeXs + awayXs;
  const homeShare = modelTotal > 0 ? homeXs / modelTotal : 0.5;

  // 5) Hakem (Card/Foul): ÖNERİLEN düzeltilmiş toplam N29 = refW*ref_stat + (1-refW)*modelTotal.
  //    NOT: Excel'in kendi formülü Ref_Table'da col 7/8'i okuyor (BOŞ) → orada referee daima
  //    0.7*total yapar (kolon-indeksi bug'ı). Burada DOĞRU kolonu (cards_pg/fouls_pg) kullanıyoruz.
  //    Bu SADECE bir öneridir; motora otomatik girmez. UI kullanıcı "uygula" deyince elle
  //    toplam olarak yazar (Excel'de M8'e N29 kopyalamaya karşılık).
  let refereeSuggestedTotal: number | null = null;
  if (mc.refereeApplies) {
    const refStat =
      mc.market === 'Card' ? inputs.refereeCardsPg
      : mc.market === 'Foul' ? inputs.refereeFoulsPg
      : null;
    if (refStat != null) {
      refereeSuggestedTotal = cfg.refereeWeight * refStat + (1 - cfg.refereeWeight) * modelTotal;
    }
  }

  // 6) Etkin toplam:
  //    - Elle TOPLAM verildiyse o (bu durumda home/away model payına göre revize edilir).
  //    - Elle home VE away ikisi de verildiyse ikisinin TOPLAMI.
  //    - Yoksa ham model toplamı.
  //    Referee önerisi effTotal'a OTOMATİK girmez; kullanıcı elle toplam olarak uygular.
  const effTotal =
    inputs.manualTotal != null
      ? inputs.manualTotal
      : inputs.manualHome != null && inputs.manualAway != null
        ? inputs.manualHome + inputs.manualAway
        : modelTotal;

  // 7) Ev/dep: elle verildiyse doğrudan, yoksa etkin toplamı model payına göre böl.
  const homeExp = inputs.manualHome != null ? inputs.manualHome : homeShare * effTotal;
  const awayExp = inputs.manualAway != null ? inputs.manualAway : (1 - homeShare) * effTotal;
  const totalExp = effTotal;

  // 6) 1H/2H bölüşüm: 1H = FT*split_1h, 2H = FT - 1H.
  const home1h = homeExp * mc.split1h;
  const away1h = awayExp * mc.split1h;
  const home2h = homeExp - home1h;
  const away2h = awayExp - away1h;

  return {
    homeWeighted: homeW,
    awayWeighted: awayW,
    homeLastX: inputs.homeCurrent ?? null,
    awayLastX: inputs.awayCurrent ?? null,
    homeStats: home,
    awayStats: away,
    homeEq,
    awayEq,
    homeXs,
    awayXs,
    supremacyHome: supHome,
    supremacyAway: supAway,
    modelTotal,
    refereeSuggestedTotal,
    ft: {
      homeMean: homeExp,
      awayMean: awayExp,
      totalMean: totalExp,
      stdHome: mc.stdHomeFt,
      stdAway: mc.stdAwayFt,
    },
    h1: {
      homeMean: home1h,
      awayMean: away1h,
      totalMean: home1h + away1h,
      stdHome: mc.stdHome1h,
      stdAway: mc.stdAway1h,
    },
    h2: {
      homeMean: home2h,
      awayMean: away2h,
      totalMean: home2h + away2h,
      stdHome: mc.stdHome2h,
      stdAway: mc.stdAway2h,
    },
  };
}
