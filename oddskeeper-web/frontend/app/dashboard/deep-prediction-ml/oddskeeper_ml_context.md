# OddsKeeper — ML Prediction Layer Context

## Proje Özeti

**OddsKeeper Prediction Workspace** — Türkiye Süper Lig için bahis analiz ve tahmin sistemi.

**Stack:**
- Frontend: Next.js 15 (App Router), TypeScript, Tailwind CSS
- Backend: Supabase (PostgreSQL)
- ML/Model: Python scripts (lokal çalışır, Supabase'e yazar)
- Repo: `C:\Users\zygom\GitRepos\oddskeeper`

---

## Supabase Schema & Kritik Tablolar

### Schemas: `analytics`, `football`, `prediction`

**Maç verisi:**
```
analytics.fact_team_match          — takım bazlı maç istatistikleri (518 satır = 259 maç)
  competition_norm = 'superlig'    — Süper Lig filtresi
  is_home / is_away (boolean)
  score_for, score_against
  details_expected_goals           — xG (%99.6 coverage)
  summary_shots, summary_shots_on_target, summary_corners_won
  details_attempts_ibox, details_attempts_obox
  match_datetime
```

**Oyuncu verisi:**
```
analytics.fact_player_match        — oyuncu bazlı maç istatistikleri
analytics.player_match_log_v1      — oyuncu maç logu (lineup_status: starter/substitute)
analytics.player_profile_v1        — oyuncu profili (season_label = '2025/2026')
analytics.player_metric_leaderboard_current — oyuncu metrik sıralamaları
analytics.dim_player               — oyuncu master (is_active boolean)
```

**Fixture & Prediction:**
```
analytics.league_fixtures_v1       — gelecek maçlar (fixture_id, fixture_date, home/away team)
prediction.dc_predictions          — DC model tahminleri
prediction.smart_predictions       — Smart prediction sonuçları
prediction.team_stats_cache        — takım istatistik cache (HF/HA/AF/AA)
prediction.match_stats_historical  — geçmiş maç istatistikleri
```

---

## Mevcut Model: Dixon-Coles v3

### Dosya: `src/football/prediction/dc_prediction_model_v3.py`

**Model parametreleri:**
- `competition_norm = 'superlig'`
- `TIME_DECAY_ALPHA = 0.003` — zaman ağırlığı (30 gün → %75 ağırlık)
- `FORM_MATCHES = 5` — son 5 maç form adjustment
- `FORM_WEIGHT = 0.15`
- `HOME_ADV_LAMBDA = 0.5` — L2 shrinkage
- `AWAY_DRAW_WEIGHT = 0.12` — deplasman draw tendency düzeltmesi

**Model bileşenleri:**
1. Dixon-Coles + xG hybrid (takım bazlı home_adv parametresi)
2. Isotonic calibration (backtest_results.csv ile)
3. Form adjustment (son 5 maç xG karşılaştırması)
4. Away draw tendency (Alanyaspor gibi draw machine takımlar için)
5. Adaptif xG/gol karışımı (sadece ev maçlarında, gol > xG*1.3 ise)

**Backtest sonuçları (219 maç, walk-forward):**
- Accuracy: 47.4%
- Log-loss: 0.9857 (uniform baseline: 1.0986)
- Brier: 0.1986
- RPS: 0.1853
- RPS skill score: +0.333

**Output:** `prediction.dc_predictions` tablosu
```sql
model_version TEXT  — 'dc_xg_v3'
home_win_prob, draw_prob, away_win_prob NUMERIC
home_xg, away_xg NUMERIC
fixture_date, source_match_id
```

---

## Frontend Sayfaları

### `/dashboard/smart-prediction`
Dixon-Coles tabanlı Smart Prediction UI. Fixture seç, parametreleri ayarla, tahmin al.

**Dosyalar:**
```
app/dashboard/smart-prediction/
├── SmartPredictionPage.tsx
├── queries.ts
└── compute.ts
```

### `/dashboard/match-predictions` ⭐ YENİ
DC v3 model tahminlerini gösteren sayfa. Whitelist korumalı.

**Dosyalar:**
```
app/dashboard/match-predictions/
├── page.tsx                    — server component, whitelist check
├── MatchPredictionsPage.tsx    — ana UI
└── queries.ts                  — dc_xg_v3 filtreli, capAndNorm uygulamalı
```

**Kart formatı:** Takımlar sol üst üste, oranlar sağda (1 X 2 | Üst Alt), bar üstte.

### `/dashboard/player-market-prediction` ⭐ YENİ
Oyuncu bazlı market prediction. Poisson ile over/under hesabı.

**Dosyalar:**
```
app/dashboard/player-market-prediction/
├── page.tsx
├── PlayerMarketPredictionPage.tsx
├── queries.ts
├── compute.ts
└── access.ts                   — email whitelist
```

### `/dashboard/stats-analysis`
League stats, player/team leaders, standings, fixtures.

---

## Whitelist Sistemi

```typescript
// app/dashboard/player-market-prediction/access.ts
export const PLAYER_MARKET_ALLOWED_EMAILS = [
  "admin@pixellious.com",
  // ...
];
```

Hem `player-market-prediction` hem `match-predictions` bu whitelist'i kullanıyor.
Access denied sayfasında Brevo ile `support@pixellious.com`'a mail gönderiliyor.

**Env variable:** `BREVO_API_KEY`

---

## Python Scripts

```
src/football/prediction/
├── dc_prediction_model_v3.py    — ana tahmin modeli (haftalık çalıştır)
├── dc_backtest_v2.py            — walk-forward backtest
├── backtest_results.csv         — v1 backtest sonuçları (kalibrasyon için)
└── backtest_results_v2.csv      — v2 backtest sonuçları
```

**Çalıştırma:**
```bash
python dc_prediction_model_v3.py
# .env dosyasından SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY okur
```

---

## Veri Gerçekleri

- **Sezon:** 2025/2026, 29 hafta oynandı (259 maç)
- **xG coverage:** %99.6
- **18 takım**, `competition_norm = 'superlig'`
- Geçmiş sezon verisi yok (sadece 2025/2026)
- `team_match_unified` boş — veri `fact_team_match`'te

---

## Bilinen Model Sorunları

1. **Zayıf ev sahibi takımlar undervalued:** Kocaelispor, Kasımpaşa, Antalyaspor gibi ev sahibi zayıf takımların ev galibiyeti düşük çıkıyor. Piyasa bu takımlara daha yüksek ev galibiyeti veriyor.

2. **Extreme probability:** Fenerbahçe-Eyüpspor gibi büyük fark maçlarında 0.95+ çıkıyor. Frontend'de capAndNorm ile max %85 sınırlıyoruz.

3. **Away draw tendency çok agresif:** Alanyaspor gibi draw machine takımlar için %49 draw çıkabiliyor. `away_draw_weight=0.12` ile hafifletildi.

4. **Tek sezon limiti:** 259 maç bazı parametreler için yetersiz. Yeni sezon verisiyle model daha stabil olacak.

---

## Bir Sonraki Adım: ML Prediction Layer

### Hedef
DC v3'ün üzerine bir ML katmanı eklemek:
- XGBoost / LightGBM ile 1X2 classification
- Feature set: DC parametreleri + rolling features + form + head-to-head
- Confidence intervals
- DC tahminini feature olarak kullan (stacking)
- Model versiyonlama: `ml_v1`

### Mevcut Feature Adayları (`analytics.fact_team_match`'ten türetilebilir)
```
- home/away xG son 5 maç rolling avg
- home/away shots on target ratio
- home/away possession (varsa)
- home/away form points (son 5 maç)
- head-to-head son 2 karşılaşma (az veri)
- DC model tahminleri (home_win_prob, draw_prob, away_win_prob)
- home_adv parametresi
- attack / defense strength
```

### Output Tablosu (oluşturulacak)
```sql
CREATE TABLE prediction.ml_predictions (
  source_match_id    TEXT,
  fixture_date       DATE,
  home_team_name     TEXT,
  away_team_name     TEXT,
  ml_home_win_prob   NUMERIC,
  ml_draw_prob       NUMERIC,
  ml_away_win_prob   NUMERIC,
  confidence         NUMERIC,  -- model confidence score
  feature_importance JSONB,    -- hangi feature en çok katkı yaptı
  model_version      TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);
```

---

## Supabase Bağlantı Notları

```python
# .env dosyasında:
SUPABASE_URL = "https://xxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJ..."

# Python'da:
from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Schema belirtmek gerekiyor:
supabase.schema("analytics").from_("fact_team_match")...
supabase.schema("prediction").from_("dc_predictions")...
```

**Önemli:** `competition_norm = 'superlig'` (alt çizgi yok, süper**lig**)

---

## Header Navigasyon

```typescript
// app/components/app-header.tsx
// Butonlar: Smart Prediction | Deep Prediction ML | Match Predictions | Player Market | Stats & Analysis
```
