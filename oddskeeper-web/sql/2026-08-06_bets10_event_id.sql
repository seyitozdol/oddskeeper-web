-- 2026-08-06: Bets10 fixture (event) id'sini oranla birlikte sakla.
--
-- Bets10 mac linkinde eventId=f-XXXX gomulu, ornek:
--   .../futbol/turkiye?...&eventId=f-ZlibpK4pAU6sWyhQGTtmog&eti=0
-- Ag-yakalama JSON'inda ayni deger data.events[].id ve markets[].eventId olarak
-- geliyor (parse_bets10_network zaten row["site_event_id"] olarak cikariyor).
-- Simdiye kadar tabloya yazilmiyordu; bu goc kolonlari ekler, loader'in yeni
-- hali doldurur (load_site_odds.py).
--
-- Not: kolon site-bagimsiz text; yalnizca Bets10 loader'i doldurur. bet365
-- (API-Football) ve OddsPortal satirlarinda null kalir.

-- Ham katman: her satirda macin site event id'si (market/selection arasi sabit).
alter table tracker.site_event_odds
  add column if not exists site_event_id text;

-- Eslestirilmis katman: bizim event'e karsilik gelen Bets10 fixture id'si.
alter table tracker.event_odds_availability
  add column if not exists site_event_id text;

-- View'a bets10_event_id kolonu (frontend'de dogrudan Bets10 mac linki kurmak
-- icin). create or replace kolon ekleyemiyor (kolon sirasi degisir), once dusur.
drop view if exists analytics.upcoming_events_v1;

create view analytics.upcoming_events_v1 as
select
  u.event_id, u.sport, u.category_name, u.tournament_name, u.season_name, u.round_info,
  u.home_team_id, u.home_team_name, u.home_team_country, u.home_team_national,
  u.away_team_id, u.away_team_name, u.away_team_country, u.away_team_national,
  u.gender, u.start_ts, u.status_type, u.status_desc, u.home_score, u.away_score,
  u.event_slug, u.updated_at,
  b365.has_odds as bet365_has_odds,
  coalesce(b365.market_count, 0) as bet365_market_count,
  coalesce(b365.listed, false) as bet365_listed,
  b10.has_odds as bets10_has_odds,
  coalesce(b10.market_count, 0) as bets10_market_count,
  coalesce(b10.listed, false) as bets10_listed,
  b10.site_event_id as bets10_event_id,
  op.has_odds as oddsportal_has_odds,
  coalesce(op.market_count, 0) as oddsportal_market_count,
  coalesce(op.listed, false) as oddsportal_listed
from tracker.upcoming_events u
left join tracker.event_odds_availability b365
  on b365.event_id = u.event_id and b365.site = 'bet365'
left join tracker.event_odds_availability b10
  on b10.event_id = u.event_id and b10.site = 'bets10'
left join tracker.event_odds_availability op
  on op.event_id = u.event_id and op.site = 'oddsportal'
where u.status_type in ('notstarted', 'inprogress')
  and u.start_ts > now() - interval '6 hours';

grant select on analytics.upcoming_events_v1 to anon, authenticated, service_role;

-- Ham oran view'ina da site_event_id ekle (izlenebilirlik). Kolon sirasi
-- degistigi icin create or replace yetmiyor, once dusur.
drop view if exists analytics.upcoming_event_odds_v1;

create view analytics.upcoming_event_odds_v1 as
select
  a.event_id,
  o.site,
  o.site_event_id,
  o.market_name,
  o.selection,
  o.odds,
  o.captured_at
from tracker.event_odds_availability a
join tracker.site_event_odds o
  on o.site = a.site
 and o.home_team_name = a.site_home_name
 and o.away_team_name = a.site_away_name;

grant select on analytics.upcoming_event_odds_v1 to anon, authenticated, service_role;
