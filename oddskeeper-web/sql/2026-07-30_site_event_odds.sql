-- 2026-07-30: Bahis sitesi market bazli oranlar (Upcoming Event Tracker eki)
-- Kaynak: pipeline/browser/capture_odds_snippet.js ile alinan DOM snapshot'i,
-- pipeline/src/common/load_site_odds.py ile ayristirilip yuklenir.
--
-- Iki katman:
--   site_event_odds          : sitede gorulen HAM veri (site'nin kendi takim adlariyla)
--   event_odds_availability  : bizim tracker.upcoming_events kayitlariyla ESLESTIRILMIS sonuc

create table if not exists tracker.site_event_odds (
  site text not null,                      -- bet365 | bets10
  home_team_name text not null,            -- sitenin yazdigi ad (ornek: 'Besiktas')
  away_team_name text not null,
  market_name text not null,               -- 'Full Time Result', 'To Qualify', ...
  selection text not null default '',      -- 'Draw', 'Over 2.5', ...; '' = yalnizca market varligi
  odds numeric,                            -- null = market var ama oran guvenle okunamadi
  competition text,
  start_text text,                         -- sitede goruldugu haliyle saat (yerel dilim)
  page_kind text,                          -- list | detail
  snapshot_label text,
  captured_at timestamptz not null,
  primary key (site, home_team_name, away_team_name, market_name, selection)
);

create index if not exists site_event_odds_site_idx
  on tracker.site_event_odds (site, home_team_name, away_team_name);

-- Eslestirme sonucuna market sayisi ve izlenebilirlik kolonlari.
alter table tracker.event_odds_availability
  add column if not exists market_count int not null default 0,
  add column if not exists site_home_name text,
  add column if not exists site_away_name text,
  add column if not exists match_score numeric;

-- View: site basina hem varlik hem market sayisi.
-- create or replace ortaya kolon ekleyemiyor (kolon sirasi degisiyor), o yuzden
-- once dusurulur. Baska view/tablo buna bagli degil.
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
  b10.has_odds as bets10_has_odds,
  coalesce(b10.market_count, 0) as bets10_market_count
from tracker.upcoming_events u
left join tracker.event_odds_availability b365
  on b365.event_id = u.event_id and b365.site = 'bet365'
left join tracker.event_odds_availability b10
  on b10.event_id = u.event_id and b10.site = 'bets10'
where u.status_type in ('notstarted', 'inprogress')
  and u.start_ts > now() - interval '6 hours';

grant select on analytics.upcoming_events_v1 to anon, authenticated, service_role;

-- Ham oranlari da frontend'e acmak istersek hazir dursun.
create or replace view analytics.upcoming_event_odds_v1 as
select
  a.event_id,
  o.site,
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
