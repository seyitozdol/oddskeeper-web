-- 2026-09-19: Upcoming Events marka rozetleri tiklanabilir -> sitenin MAC SAYFASI.
--
-- Her loader eslestirdigi macin site-ici sayfa adresini site_event_url'e yazar:
--   bets10 : <aktif adres>/tr/spor-bahisleri?eventId=<site_event_id>
--            (load_site_odds; adres dump'in cekildigi guncel numarali alan adi,
--            eski adresler yolu+sorguyu koruyarak guncele yonleniyor)
--   bmbets : https://bmbets.com<mac satirindaki href> (fetch_bmbets)
--   bet365 / oddsportal: simdilik null (bet365 orani API-Football'dan geliyor,
--            bet365 mac id'si yok; loader doldurursa rozet kendiliginden linklenir)
-- Kolon site-bagimsiz; frontend yalniz dolu URL'i linkler.

alter table tracker.event_odds_availability
  add column if not exists site_event_url text;

-- Yeni kolonlar SONA eklendigi icin create or replace yeterli (kolon sirasi
-- korunur, mevcut yetkiler dusmez).
create or replace view analytics.upcoming_events_v1 as
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
  coalesce(op.listed, false) as oddsportal_listed,
  bm.has_odds as bmbets_has_odds,
  coalesce(bm.market_count, 0) as bmbets_market_count,
  coalesce(bm.listed, false) as bmbets_listed,
  b365.site_event_url as bet365_event_url,
  b10.site_event_url as bets10_event_url,
  op.site_event_url as oddsportal_event_url,
  bm.site_event_url as bmbets_event_url
from tracker.upcoming_events u
left join tracker.event_odds_availability b365
  on b365.event_id = u.event_id and b365.site = 'bet365'
left join tracker.event_odds_availability b10
  on b10.event_id = u.event_id and b10.site = 'bets10'
left join tracker.event_odds_availability op
  on op.event_id = u.event_id and op.site = 'oddsportal'
left join tracker.event_odds_availability bm
  on bm.event_id = u.event_id and bm.site = 'bmbets'
where u.status_type in ('notstarted', 'inprogress')
  and u.start_ts > now() - interval '6 hours';

-- Tek seferlik geri doldurma: mevcut Bets10 eslesmeleri (site_event_id zaten
-- dolu). Sonraki capture kosulari adresi guncel alan adiyla tazeler. BMBets
-- satirlari bir sonraki fetch_bmbets kosusunda dolar.
update tracker.event_odds_availability
set site_event_url = 'https://www.10031bets10.com/tr/spor-bahisleri?eventId=' || site_event_id
where site = 'bets10' and site_event_id is not null and site_event_url is null;
