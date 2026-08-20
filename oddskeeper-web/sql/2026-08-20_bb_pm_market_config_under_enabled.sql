-- Voleybol Match-Player Tools Config: market bazinda Under tarafini kapatma
-- tiki (sahip istegi 2026-08-20). Kolon paylasimli bb_pm_market_config
-- tablosuna eklenir (league kolonlu; basketbol/euroleague satirlari default
-- true kalir, o UI'larda kolon gosterilmez). Frontend: under_enabled=false ->
-- line motoruna under_lines=0 gecer (tum satirlarda underPrice=null; Input'ta
-- Under bos, XLSX'te bos hucre).
-- UYGULANDI: 2026-08-20 (autocommit + notify pgrst 'reload schema').

alter table analytics.bb_pm_market_config
  add column if not exists under_enabled boolean not null default true;

notify pgrst, 'reload schema';
