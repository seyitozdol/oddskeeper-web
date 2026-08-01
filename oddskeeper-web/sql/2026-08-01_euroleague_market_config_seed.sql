-- EL/EC Match-Player Tools için market config seed (bb_pm_market_config paylaşımlı;
-- league='euroleague'/'eurocup'). Player template'leri BSL ile aynı başlangıç (generic
-- oyuncu-prop kodları, kullanıcı değiştirebilir); TAKIM template'leri NULL (platform
-- kodu ligden ligeye değişir, Config'den doldurulur). 14 oyuncu + 33 takım × 2 lig.

-- ---- OYUNCU marketleri (14 × 2 lig) ----
insert into analytics.bb_pm_market_config
  (league, market_group, market_key, label, base_metric, side, template_id, std, sort_order)
select lg.league, 'player', pm.key, pm.label, pm.key, null, pm.tpl, pm.std, pm.ord
from (values ('euroleague'), ('eurocup')) lg(league)
cross join (values
  ('points',   'Sayı',           'PPOINTS',   5.79, 1),
  ('rebounds', 'Ribaund',        'PREB',      3.25, 2),
  ('assists',  'Asist',          'PAST',      3.28, 3),
  ('threes',   '3 Sayı',         'P3PTM',     1.75, 4),
  ('twos',     '2 Sayı',         'P2PTSM',    3.25, 5),
  ('ftm',      'Serbest Atış',   'PFTRWM',    2.75, 6),
  ('steals',   'Top Çalma',      'PSTL',      1.75, 7),
  ('blocks',   'Blok',           'PBLCK',     1.75, 8),
  ('turnovers','Top Kaybı',      'PTURNOVR',  1.75, 9),
  ('pr',       'Sayı+Ribaund',   'PPTSREB',   8,    10),
  ('pa',       'Sayı+Asist',     'PPTSAST',   8,    11),
  ('pra',      'Sayı+Rib+Asist', 'PPTSRBAST', 8,    12),
  ('fgmadepct','İsabet %',       'PFGLSM',    7,    13),
  ('ftpct',    'Serbest %',      'PTFTRWM',   11.3, 14)
) pm(key, label, tpl, std, ord)
on conflict (league, market_group, market_key) do nothing;

-- ---- TAKIM marketleri (33 × 2 lig; template NULL, kullanıcı doldurur) ----
insert into analytics.bb_pm_market_config
  (league, market_group, market_key, label, base_metric, side, template_id, std, sort_order)
select lg.league, 'team', s.side || '_' || m.metric, s.pfx || ' ' || m.label,
       m.metric, s.side, null, m.std, m.ord * 10 + s.ord
from (values ('euroleague'), ('eurocup')) lg(league)
cross join (values ('home','Ev',1), ('away','Dep',2), ('total','Toplam',3)) s(side, pfx, ord)
cross join (values
  ('points',    'Sayı',            8.78, 1),
  ('rebounds',  'Toplam Ribaund',  5.84, 2),
  ('oreb',      'Hücum Ribaund',   3,    3),
  ('dreb',      'Savunma Ribaund', 4.1,  4),
  ('assists',   'Asist',           4.34, 5),
  ('threes',    '3 Sayı',          3.16, 6),
  ('twos',      '2 Sayı',          3.8,  7),
  ('ftm',       'Serbest Atış',    3.5,  8),
  ('steals',    'Top Çalma',       0.9,  9),
  ('blocks',    'Blok',            2,    10),
  ('turnovers', 'Top Kaybı',       1.1,  11)
) m(metric, label, std, ord)
on conflict (league, market_group, market_key) do nothing;
