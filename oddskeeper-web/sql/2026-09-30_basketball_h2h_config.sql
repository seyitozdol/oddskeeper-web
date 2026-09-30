-- 2026-09-30: Basketbol H2H (oyuncu - oyuncu) ayarlari.
--
-- Match-Player Tools > Model > H2H sekmesi: iki oyuncunun Input'a gonderilen sayi /
-- ribaund / asist beklentileri simule edilir (features/basketball/h2h.ts). Ayarlar
-- basketball.model_config'te (anahtar/deger; BSL + EuroLeague + EuroCup ortak) durur ve
-- Config > Model > H2H kutusundan degistirilir. Yazma yolu yalniz MEVCUT anahtari
-- gunceller (pm-write saveModelConfig), bu yuzden anahtarlar burada eklenir.

insert into basketball.model_config (key, value, note)
select v.key, v.value, v.note
from (values
  ('h2h_payback', 0.915::numeric, 'H2H: payback (oran = payback / olasilik)'),
  ('h2h_sims', 1000::numeric, 'H2H: simule edilen mac sayisi (0 = kesin hesap)'),
  ('h2h_tie_void', 0::numeric, 'H2H: beraberlik 1 = iade (olasilik beraberlik disi maclardan), 0 = iki secenek de kaybeder')
) as v(key, value, note)
where not exists (select 1 from basketball.model_config m where m.key = v.key);
