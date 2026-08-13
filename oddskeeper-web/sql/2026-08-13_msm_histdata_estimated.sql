-- MSM histdata'ya 'estimated' bayragi: gercek veriyle turetilmis tahmini ayirir.
-- Ilk kullanim: kupa Saves market'i. Takim-seviyesi kurtaris kupa feed'inde yok;
-- gercek veri sadece 7 derin-tur takiminda. Digerleri icin TSL+1.Lig'den cikan
-- "yedigi SOT -> kurtaris" orani (~0.68) ile takimin kupa SOT'undan tahmin edilir.
-- build_cup_msm_data.py INSERT_SAVES_ESTIMATE bu bayragi true yazar.
alter table msm.histdata add column if not exists estimated boolean not null default false;
