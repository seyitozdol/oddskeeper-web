-- 2026-07-27: Player Market - Market Listesi'nde tick/x ile marketi Model
-- ekranindaki market dropdown'ina ekleme/cikarma (Excel'deki "Model" kolonu
-- davranisi). Varsayilan true: kayitli satiri olmayan yerlesik marketler de
-- dahil (Excel'deki "bossa hepsi" kurali).

alter table analytics.pm_markets
  add column if not exists in_model boolean not null default true;
