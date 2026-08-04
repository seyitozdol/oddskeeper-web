-- 2026-08-04  Player Market Prediction (Player Participant Tools) — Model config
-- Config sekmesindeki "Model" alt sekmesi: dagitim agirliklari (LY Avg / Last 5 / Avg
-- yuzde). Dagitim, oyuncu beklentisini bu uc metrigin agirlikli karisimina orantili
-- boler (compute.distributeExpectation). Sezon basinda gecen sezon (LY) agirlik 100
-- verilerek guncel-sezon-verisi-yok sorunu asilir.
-- Erisim: sayfa client-side Supabase (anon/authenticated) ile okuyup yazar (pm_* kalibi).

CREATE TABLE IF NOT EXISTS analytics.pm_model_config (
  league       text    NOT NULL DEFAULT 'tsl',
  config_key   text    NOT NULL,
  config_value numeric NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league, config_key)
);

ALTER TABLE analytics.pm_model_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_model_config_all ON analytics.pm_model_config;
CREATE POLICY pm_model_config_all ON analytics.pm_model_config
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON analytics.pm_model_config TO anon, authenticated;
GRANT ALL ON analytics.pm_model_config TO service_role;

-- Varsayilan agirliklar: LY Avg = 100 (gecen sezon), digerleri 0. Kullanici Config >
-- Model sekmesinden degistirip kaydeder. tsl + tff1 (1. Lig) icin ayni seed.
INSERT INTO analytics.pm_model_config (league, config_key, config_value)
VALUES
  ('tsl',  'dist_weight_ly',    100),
  ('tsl',  'dist_weight_last5', 0),
  ('tsl',  'dist_weight_avg',   0),
  ('tff1', 'dist_weight_ly',    100),
  ('tff1', 'dist_weight_last5', 0),
  ('tff1', 'dist_weight_avg',   0)
ON CONFLICT (league, config_key) DO NOTHING;
