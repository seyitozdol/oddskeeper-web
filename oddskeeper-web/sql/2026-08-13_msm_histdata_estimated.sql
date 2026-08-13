-- MSM histdata'ya 'estimated' bayragi: gercek veriyle turetilmis tahmini ayirir.
-- Ilk kullanim: kupa Saves market'i. Takim-seviyesi kurtaris kupa feed'inde yok;
-- gercek veri sadece 7 derin-tur takiminda. Digerleri icin TSL+1.Lig'den cikan
-- "yedigi SOT -> kurtaris" orani (~0.68) ile takimin kupa SOT'undan tahmin edilir.
-- build_cup_msm_data.py INSERT_SAVES_ESTIMATE bu bayragi true yazar.
alter table msm.histdata add column if not exists estimated boolean not null default false;

-- View'a estimated'i ekle (frontend rozeti icin). CREATE OR REPLACE ortaya kolon
-- ekleyemez -> estimated sona konur.
create or replace view analytics.msm_histdata_v1 as
 select league, season, market, team_name, team_slug, hf, ha, af, aa, updated_at, estimated
 from msm.histdata;
grant select on analytics.msm_histdata_v1 to anon, authenticated;
