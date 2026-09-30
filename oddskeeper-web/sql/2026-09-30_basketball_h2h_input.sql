-- 2026-09-30: Basketbol H2H -> Input / MMI.
--
-- 1) Beraberlikte bahis iade edilir (sahip karari 2026-09-30): H2H olasiliklari
--    beraberlik disindaki maclara gore alinir -> h2h_tie_void = 1.
-- 2) H2H marketleri Config > Market Templates > H2H'de duzenlenir: import sablonu
--    (H2HPTSN / H2HRBN / H2HAN), std (bos = oyuncu marketinin std'si), payback (bos =
--    model_config.h2h_payback), model tiki. bb_pm_market_config'e market_group = 'h2h'
--    satirlari (line kolonlari H2H'de kullanilmaz, varsayilanlarinda kalir).

update basketball.model_config set value = 1 where key = 'h2h_tie_void';

insert into analytics.bb_pm_market_config (league, market_group, market_key, label, base_metric, template_id, in_model, sort_order)
select l.league, 'h2h', m.market_key, m.label, m.base_metric, m.template_id, true, m.sort_order
from (values ('basketball'), ('euroleague'), ('eurocup')) as l(league)
cross join (values
  ('h2h_points', 'H2H Points', 'points', 'H2HPTSN', 1),
  ('h2h_rebounds', 'H2H Rebounds', 'rebounds', 'H2HRBN', 2),
  ('h2h_assists', 'H2H Assists', 'assists', 'H2HAN', 3)
) as m(market_key, label, base_metric, template_id, sort_order)
on conflict (league, market_group, market_key) do nothing;
