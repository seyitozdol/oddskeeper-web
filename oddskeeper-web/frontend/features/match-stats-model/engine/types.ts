// Match Stats Model motoru tipleri.

// Bir takımın bir market için HF/HA/AF/AA değerleri (ev-for/ev-against/dep-for/dep-against).
export interface HFAA {
  hf: number;
  ha: number;
  af: number;
  aa: number;
}

// Bir sezonun değerleri + o sezona verilen ağırlık (yıl-ağırlıklı harman için).
export interface SeasonWeighted extends HFAA {
  weight: number; // 0..1; toplamları 1 olmalı (motor normalize etmez, Excel'e sadık)
}

// Market-bazlı sabitler (msm.market_config).
export interface MarketConfig {
  market: string;
  stdHomeFt: number;
  stdAwayFt: number;
  stdHome1h: number;
  stdAway1h: number;
  stdHome2h: number;
  stdAway2h: number;
  split1h: number;
  split2h: number;
  supremacyApplies: boolean;
  // 'positive' (Shot/SOT/Corner: favori DAHA ÇOK) | 'negative' (Foul/Card/Saves/GoalKick: favori DAHA AZ) | 'none'
  supremacySign: 'positive' | 'negative' | 'none';
  refereeApplies: boolean; // Card/Foul
  // Yarı-bazlı derin kontrol (Config Markets sekmesi). Boşsa FT davranışı:
  // payback = global margin, under dahil.
  payback1h?: number; // 1H over/under fiyat marjı (yoksa modelCfg.margin)
  payback2h?: number;
  under1h?: boolean; // false → 1H'de Under açılmaz (SU kontrolü de yalnız Over'a bakar)
  under2h?: boolean;
}

// Model global sabitleri (msm.model_config).
export interface ModelConfig {
  margin: number; // 0.93
  refereeWeight: number; // 0.30
  supremacyDivisor: number; // 5.5
  xmatrixWOwnFor: number; // 0.65
  xmatrixWOwnAlt: number; // 0.05
  xmatrixWOppAlt: number; // 0.05
  xmatrixWOppAgainst: number; // 0.25
  suLow: number; // 1.17
  suHigh: number; // 4.51
  refereeMinMatches?: number; // X: hakem güncel-sezon eşiği (motor kullanmaz, UI lookup için)
}

// Bir fikstür + market için tüm model girdileri.
export interface ModelInputs {
  market: string;
  // Yıl-ağırlıklı GEÇMİŞ harman (3 sezon: 25-26 / 24-25 / 23-24), her biri kendi ağırlığıyla.
  homeSeasons: SeasonWeighted[];
  awaySeasons: SeasonWeighted[];
  // Güncel sezon (26-27) son-x-hafta penceresi (Excel R10). Yoksa null → sadece weighted kullanılır.
  homeCurrent?: HFAA | null;
  awayCurrent?: HFAA | null;
  // "Etki Yüzdesi" W6: calculated = etki*current + (1-etki)*weighted (0..1).
  etki: number;
  // 1x2 oranları (supremacy için).
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  // Elle override (boşsa modelden). Excel C8/H8/M8.
  manualHome?: number | null;
  manualAway?: number | null;
  manualTotal?: number | null;
  // Hakem (Card/Foul), opsiyonel.
  refereeCardsPg?: number | null;
  refereeFoulsPg?: number | null;
}

// Bir segment (FT/1H/2H) için ev/dep/toplam beklenti + std.
export interface SegmentExpectancy {
  homeMean: number;
  awayMean: number;
  totalMean: number;
  stdHome: number;
  stdAway: number;
}

export interface Expectancy {
  ft: SegmentExpectancy;
  h1: SegmentExpectancy;
  h2: SegmentExpectancy;
  // Ara değerler (Excel Sim R22 "Calculated x" alanı — şeffaflık/UI için).
  homeWeighted: HFAA; // yıl-ağırlıklı geçmiş (etki öncesi)
  awayWeighted: HFAA;
  homeLastX: HFAA | null; // güncel sezon son-x-hafta penceresi (Excel R10); yoksa null
  awayLastX: HFAA | null;
  homeStats: HFAA; // NİHAİ calculated ev HF/HA/AF/AA (weighted↔lastX etki harmanı, U23-26)
  awayStats: HFAA; // NİHAİ calculated dep (W23-26)
  homeEq: number; // çapraz matris sonucu, supremacy ÖNCESİ (U27)
  awayEq: number; // (W27)
  homeXs: number; // supremacy SONRASI (U28)
  awayXs: number; // (W28)
  supremacyHome: number;
  supremacyAway: number;
  modelTotal: number; // supremacy sonrası ham model toplamı (elle/referee öncesi)
  // Hakem (Card/Foul) için önerilen düzeltilmiş toplam (uygulanmış olabilir); yoksa null.
  refereeSuggestedTotal: number | null;
}

// Tek bir çizgi için over/under olasılık + oran.
export interface LineOdds {
  line: number;
  overProb: number;
  underProb: number;
  overOdds: number;
  underOdds: number;
  suspended: boolean; // fiyat suLow altı / suHigh üstü
}

// Bir seçim (home/away/total) için dengeli çizgi + etrafındaki 5 çizgi.
export interface SelectionLines {
  balancedLine: number;
  lines: LineOdds[]; // mid-2 .. mid+2 (5 çizgi)
}

// Bir segment için 3 seçim.
export interface SegmentLines {
  home: SelectionLines;
  away: SelectionLines;
  total: SelectionLines;
}

export interface ModelOutput {
  expectancy: Expectancy;
  ft: SegmentLines;
  h1: SegmentLines;
  h2: SegmentLines;
}
