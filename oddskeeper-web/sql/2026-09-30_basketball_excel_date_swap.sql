-- 2026-09-30: BSL 2025-2026 excel_v38 mac tarihlerinde gun/ay yer degistirmesi duzeltildi.
--
-- Excel aktariminda 21. haftadan itibaren gunu 12 ve altinda olan tarihler ay/gun olarak okunmus
-- (or. 2 Haziran 2026 -> 2026-02-06; 6 Mart 2026 -> 2026-06-03). Haftalar 1-20 ve gunu 12'den buyuk
-- tarihler dogruydu; tbf_api / flashscore satirlari etkilenmedi.
-- Esleme (hafta, yanlis tarih) -> dogru tarih olarak sabit: ikinci kez kosarsa hicbir satir eslesmez.
-- Oyuncu ve takim tablolari BIRLIKTE guncellenir (view'lar match_key + match_date uzerinden baglar).

update basketball.player_match_stats t set match_date = m.fixed
from (values (21, date '2026-06-03', date '2026-03-06'), (21, date '2026-07-03', date '2026-03-07'), (21, date '2026-08-03', date '2026-03-08'), (21, date '2026-09-03', date '2026-03-09'), (25, date '2026-05-04', date '2026-04-05'), (25, date '2026-06-04', date '2026-04-06'), (26, date '2026-11-04', date '2026-04-11'), (26, date '2026-12-04', date '2026-04-12'), (29, date '2026-01-05', date '2026-05-01'), (29, date '2026-02-05', date '2026-05-02'), (29, date '2026-03-05', date '2026-05-03'), (30, date '2026-08-05', date '2026-05-08'), (30, date '2026-10-05', date '2026-05-10'), (32, date '2026-01-06', date '2026-06-01'), (32, date '2026-02-06', date '2026-06-02'), (32, date '2026-03-06', date '2026-06-03')) as m(week, wrong, fixed)
where t.source = 'excel_v38' and t.season_label = '2025-2026' and t.week = m.week and t.match_date = m.wrong;

update basketball.team_match_stats t set match_date = m.fixed
from (values (21, date '2026-06-03', date '2026-03-06'), (21, date '2026-07-03', date '2026-03-07'), (21, date '2026-08-03', date '2026-03-08'), (21, date '2026-09-03', date '2026-03-09'), (25, date '2026-05-04', date '2026-04-05'), (25, date '2026-06-04', date '2026-04-06'), (26, date '2026-11-04', date '2026-04-11'), (26, date '2026-12-04', date '2026-04-12'), (29, date '2026-01-05', date '2026-05-01'), (29, date '2026-02-05', date '2026-05-02'), (29, date '2026-03-05', date '2026-05-03'), (30, date '2026-08-05', date '2026-05-08'), (30, date '2026-10-05', date '2026-05-10'), (32, date '2026-01-06', date '2026-06-01'), (32, date '2026-02-06', date '2026-06-02'), (32, date '2026-03-06', date '2026-06-03')) as m(week, wrong, fixed)
where t.source = 'excel_v38' and t.season_label = '2025-2026' and t.week = m.week and t.match_date = m.wrong;

refresh materialized view analytics.bb_player_metric_window_v1;
refresh materialized view analytics.bb_player_metric_window_roster_v1;
