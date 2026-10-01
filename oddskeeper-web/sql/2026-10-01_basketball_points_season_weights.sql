-- 2026-10-01: Basketbol sayi modeli - sezon agirligi (gecen sezon % / bu sezon %).
--
-- PM Pts Model (hub) 2026-2027 secildiginde takim basina 1 maclik ortalamayla hesap yapiyor,
-- Match-Player Tools ise 5 macin altinda onceki sezona dusuyordu; iki ekran ayni mac icin
-- farkli oran veriyordu (Besiktas - Trabzonspor: ML 11.84 / 0.99 ve 1.49 / 2.38).
-- Artik ikisi de ayni girdiyi kullanir: takimin attigi / yedigi sayi ortalamasi ve std'si
-- iki sezonun bu agirliklarla karisimidir (frontend features/basketball/seasonBlend.ts).
-- Bu sezon 100 = yalniz guncel sezon verisi. Tek sezonu olan takim o sezonla hesaplanir.
--
-- Ayarlar basketball.model_config'te durur, Config > Model > Sezon agirligi kutusundan
-- degistirilir. Yazma yolu yalniz MEVCUT anahtari gunceller (pm-write saveModelConfig),
-- bu yuzden anahtarlar burada eklenir. Varsayilan 100 / 0: Match-Player Tools'un bugunku
-- (sezon basi) davranisi korunur.

insert into basketball.model_config (key, value, note)
select v.key, v.value, v.note
from (values
  ('points_season_w_prev', 100::numeric, 'Sayi modeli: gecen sezonun agirligi %'),
  ('points_season_w_cur', 0::numeric, 'Sayi modeli: bu sezonun agirligi % (100 = yalniz guncel sezon)')
) as v(key, value, note)
where not exists (select 1 from basketball.model_config m where m.key = v.key);
