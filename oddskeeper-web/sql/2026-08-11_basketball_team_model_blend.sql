-- 2026-08-11  Basketbol Team Model — Excel v38 hizalamasi
-- Team Metrics "L10 WTD" kolonu artik Excel TeamProps F ("Last 10 Weight") ile ayni:
--   sezon_ort*wall + son10_ort*w10 + son5_ort*w5 (varsayilan 50/20/30).
-- "Model" kolonu (points disi) = (trader sayi / sezon sayi ort) x bu karisim.
-- Ribaundlar Excel'in kacan-sut modeline gecti (OReb=kendi MissFG2*0.28*uplift,
-- DReb=rakip MissFG2*0.72*rakip uplift, TR=OReb+DReb) — agirlik kullanmazlar.
-- Eski team_model_wavg / team_model_wl10 anahtarlari kullanim disi, silinir.

insert into basketball.model_config (key, value, note) values
  ('team_model_wall', 50, 'Team Model karisimi: sezon ort agirlik %'),
  ('team_model_w10',  20, 'Team Model karisimi: son 10 mac ort agirlik %'),
  ('team_model_w5',   30, 'Team Model karisimi: son 5 mac ort agirlik %')
on conflict (key) do nothing;

delete from basketball.model_config where key in ('team_model_wavg', 'team_model_wl10');
