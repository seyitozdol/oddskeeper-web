-- 2026-07-21  Player Market Prediction kalici kayit tablolari
-- 1) analytics.pm_fixture_inputs: Fixture ID sekmesindeki mac basina girilen deger.
--    Model'deki Ekle akisi ileride bu tabloyu okuyacak.
-- 2) analytics.pm_markets: Market listesi kayitlari. Yeni butonuyla eklenen ozel
--    marketler (is_custom=true) + yerlesik marketlerin Market Template ID'leri
--    (is_custom=false, market_key koddaki key ile ayni).
-- Erisim: sayfa client-side Supabase (anon/authenticated) ile okuyup yazar;
-- kisisel proje oldugu icin permissive RLS politikasi yeterli.

CREATE TABLE IF NOT EXISTS analytics.pm_fixture_inputs (
  fixture_id  bigint PRIMARY KEY,
  input_value text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics.pm_markets (
  market_key  text PRIMARY KEY,
  label       text NOT NULL,
  template_id text,
  is_custom   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE analytics.pm_fixture_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.pm_markets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_fixture_inputs_all ON analytics.pm_fixture_inputs;
CREATE POLICY pm_fixture_inputs_all ON analytics.pm_fixture_inputs
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pm_markets_all ON analytics.pm_markets;
CREATE POLICY pm_markets_all ON analytics.pm_markets
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON analytics.pm_fixture_inputs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON analytics.pm_markets TO anon, authenticated;
GRANT ALL ON analytics.pm_fixture_inputs TO service_role;
GRANT ALL ON analytics.pm_markets TO service_role;
