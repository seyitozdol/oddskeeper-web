-- 2026-07-30: "sitede listeleniyor ama oran yakalanamadi" durumu.
--
-- Neden: Bets10'da bazi mac satirlari DOM'a oran bileseni olmadan geliyor
-- (link adresinde eventId yok, metninde 'Maç Sonucu' ve oranlar yok). Ornek:
--   /tr/spor-bahisleri/futbol/konferans-ligi/konferans-ligi/fc-inter-turku-basaksehir-fk
--   "Konferans Ligi Bu Gece 18:00 FC Inter TurkuBaşakşehir FK"
-- Bu durumda macin sitede oldugunu biliyoruz ama oran teklif edilip
-- edilmedigini BILMIYORUZ. has_odds=false yazmak yanlis olurdu (o "site bu maca
-- oran vermiyor" demek); ayri bir 'listed' bayragi tutuyoruz.
--
-- Anlamlar:
--   has_odds = true            -> oran yakalandi (market_count > 0)
--   has_odds = false + listed  -> mac sitede goruldu, oran yakalanamadi
--   satir yok                  -> henuz kontrol edilmedi

alter table tracker.event_odds_availability
  add column if not exists listed boolean not null default false;

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
  coalesce(b10.listed, false) as bets10_listed
from tracker.upcoming_events u
left join tracker.event_odds_availability b365
  on b365.event_id = u.event_id and b365.site = 'bet365'
left join tracker.event_odds_availability b10
  on b10.event_id = u.event_id and b10.site = 'bets10'
where u.status_type in ('notstarted', 'inprogress')
  and u.start_ts > now() - interval '6 hours';

grant select on analytics.upcoming_events_v1 to anon, authenticated, service_role;

-- Oran yakalanan kayitlar geriye donuk olarak listed=true sayilir.
update tracker.event_odds_availability set listed = true where has_odds;
