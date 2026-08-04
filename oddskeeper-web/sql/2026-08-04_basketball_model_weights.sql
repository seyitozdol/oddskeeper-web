-- 2026-08-04  Basketbol Match-Player Tools — Config > Model agirliklari
-- Config sekmesine "Model" alt sekmesi (Team Models + Player Models kutulari).
-- Model ekranindaki hesaplar bu agirliklari kullanir (BasketballTools):
--   Player Dist "Model" kolonu = son10*w10 + son5*w5 + sezon*wall (saf karisim, %).
--   Team Metrics "Model" kolonu = (AVG*wavg + L10WTD*wl10)/100 * pace-carpani.
-- bb_model_config view'i basketball.model_config uzerinde (sadece UPDATE grant'li),
-- yeni anahtarlar base tabloya buradan eklenir; UI degeri gunceller.

insert into basketball.model_config (key, value, note) values
  ('player_model_w10',  20, 'Player Model: son 10 mac ort agirlik %'),
  ('player_model_w5',   30, 'Player Model: son 5 mac ort agirlik %'),
  ('player_model_wall', 50, 'Player Model: sezon ort agirlik %'),
  ('team_model_wavg',   50, 'Team Model: AVG (sezon) agirlik %'),
  ('team_model_wl10',   50, 'Team Model: L10 WTD agirlik %')
on conflict (key) do nothing;
