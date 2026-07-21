-- 2026-07-21  analytics.pm_markets: market_type kolonu
-- Market Listesi'ndeki Static/Dynamic dropdown'i icin. Model'de Ekle'ye
-- basilinca satirlar secili marketin turune gore Input sekmesindeki
-- Static Input veya Dynamic Input segmentine duser.

ALTER TABLE analytics.pm_markets
  ADD COLUMN IF NOT EXISTS market_type text NOT NULL DEFAULT 'static';
