-- 2026-07-30: TSL SofaScore-native profil/kadro — Süper Lig takım logoları.
-- ref.sofascore_team_logos'a 15 eksik Süper Lig takımını ekler. FlashScore'dan
-- scrape ETMEK YERİNE sitenin mevcut yerel logolarını (/images/football_logos/*.png,
-- ref.team_mapping'te zaten var) sofascore team id'lerine curated eşler.
-- (antalyaspor + kayserispor arşivden ana dizine kopyalandı.)
-- Eslesme: football.matches sofascore Süper Lig takım id'leri <-> team_mapping logo dosyalari.

delete from ref.sofascore_team_logos where sofascore_team_id in
  ('6362','3056','3086','3050','3064','7040','3052','3061','5138','3054','6063','3072','3085','3053','3051');

insert into ref.sofascore_team_logos (sofascore_team_id, team_name, logo_url, updated_at) values
  ('6362','Alanyaspor',       '/images/football_logos/alanyaspor.png',  now()),
  ('3056','Antalyaspor',      '/images/football_logos/antalyaspor.png', now()),
  ('3086','Başakşehir FK',    '/images/football_logos/basaksehir.png',  now()),
  ('3050','Beşiktaş JK',      '/images/football_logos/besiktas.png',    now()),
  ('3064','Çaykur Rizespor',  '/images/football_logos/rizespor.png',    now()),
  ('7040','Eyüpspor',         '/images/football_logos/eyupspor.png',    now()),
  ('3052','Fenerbahçe',       '/images/football_logos/fenerbahce.png',  now()),
  ('3061','Galatasaray',      '/images/football_logos/galatasaray.png', now()),
  ('5138','Gaziantep FK',     '/images/football_logos/gaziantep.png',   now()),
  ('3054','Göztepe',          '/images/football_logos/goztepe.png',     now()),
  ('6063','Kasımpaşa',        '/images/football_logos/kasimpasa.png',   now()),
  ('3072','Kayserispor',      '/images/football_logos/kayserispor.png', now()),
  ('3085','Konyaspor',        '/images/football_logos/konyaspor.png',   now()),
  ('3053','Samsunspor',       '/images/football_logos/samsunspor.png',  now()),
  ('3051','Trabzonspor',      '/images/football_logos/trabzonspor.png', now());
