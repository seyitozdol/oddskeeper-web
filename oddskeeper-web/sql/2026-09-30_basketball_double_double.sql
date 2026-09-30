-- 2026-09-30: Basketbol double-double / triple-double oyuncu marketleri.
--
-- Player Distribution'da sayi / ribaund / asist beklentilerinden simule edilen Yes
-- marketleri (features/basketball/doubles.ts). Market satirlari Config > Market Templates
-- (Player) listesinin sonuna eklenir: sablon PDBDB (double-double) ve PTDB (triple-double);
-- line kolonlari bu marketlerde kullanilmaz. Simulasyon mac sayisi model_config.dd_sims.

insert into basketball.model_config (key, value, note)
select 'dd_sims', 10000, 'Double-double / triple-double: simule edilen mac sayisi (0 = kesin hesap)'
where not exists (select 1 from basketball.model_config where key = 'dd_sims');

insert into analytics.bb_pm_market_config (league, market_group, market_key, label, base_metric, template_id, in_model, sort_order)
select l.league, 'player', m.market_key, m.label, m.base_metric, m.template_id, true, m.sort_order
from (values ('basketball'), ('euroleague'), ('eurocup')) as l(league)
cross join (values
  ('dd', 'Double-Double', 'dd', 'PDBDB', 900),
  ('td', 'Triple-Double', 'td', 'PTDB', 901)
) as m(market_key, label, base_metric, template_id, sort_order)
on conflict (league, market_group, market_key) do nothing;
