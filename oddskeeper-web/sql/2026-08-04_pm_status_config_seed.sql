-- 2026-08-04  Player Participant Tools — Status kurallari config seed
-- Config > Model'deki "Status Kurallari": Model ekranindaki oyuncu durumu
-- (Pos. Starter / Pos. Sub / Out) cikarimi bu esiklere gore yapilir.
-- Takimin son N fikstur? uzerinden; oncelik Out > Starter > Sub.
--   status_out_n / _k:      son N macin >= K'sinde oynamadi -> Out
--   status_starter_n / _k:  son N macin >= K'sinde ilk 11 -> Starter
--   status_sub_n / _k:      son N macin >= K'sinde oynadi (yedek dahil) -> Sub
--   status_last_only:       1 ise sadece son maca gore (digerlerini ezer)
-- Tablo (analytics.pm_model_config) 2026-08-04_pm_model_config.sql'de olusturuldu.

INSERT INTO analytics.pm_model_config (league, config_key, config_value)
VALUES
  ('tsl',  'status_out_n',     3),
  ('tsl',  'status_out_k',     3),
  ('tsl',  'status_starter_n', 3),
  ('tsl',  'status_starter_k', 2),
  ('tsl',  'status_sub_n',     3),
  ('tsl',  'status_sub_k',     1),
  ('tsl',  'status_last_only', 0),
  ('tff1', 'status_out_n',     3),
  ('tff1', 'status_out_k',     3),
  ('tff1', 'status_starter_n', 3),
  ('tff1', 'status_starter_k', 2),
  ('tff1', 'status_sub_n',     3),
  ('tff1', 'status_sub_k',     1),
  ('tff1', 'status_last_only', 0)
ON CONFLICT (league, config_key) DO NOTHING;
