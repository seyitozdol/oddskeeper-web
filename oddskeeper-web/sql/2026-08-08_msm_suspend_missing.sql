-- 2026-08-08: MSM "eksik line'lari SU'la" ayari.
--
-- Match Stats Model'de gecmisten restore ederek bir line duzeltmesi yapilinca,
-- onceki export'ta gonderilmis ama yeni export'ta bulunmayan line'lar yeni
-- tabloda Market Status = SU (suspended) ile yazilir. Bu davranis Config'ten
-- acilip kapanir (sadece MSM; Player'da yok). Ayar spor/lig bazinda tutulur.
--
-- model_history_config zaten (sport, league) anahtarli (bkz.
-- sql/2026-08-08_model_export_history.sql); buraya bir bayrak kolonu ekliyoruz.

alter table public.model_history_config
  add column if not exists msm_suspend_missing boolean not null default false;
