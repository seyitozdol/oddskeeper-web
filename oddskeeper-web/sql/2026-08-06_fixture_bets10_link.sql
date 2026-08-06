-- 2026-08-06: Fikstür <-> Bets10 maç bağı (Match/Player Stats Model Fixture ID
-- sekmeleri için). Her modelin fikstürü apifootball/SofaScore id uzayında;
-- Bets10 verisi (fixture id 'f-...' + 1X2 oran) SofaScore event'ine bağlı.
-- Bu tablo resolver (link_fixtures_bets10.py) tarafından doldurulur:
--   TSL  : league_fixtures_v1 (apifootball) <-> upcoming_events bulanık ad+tarih
--          eşleşmesi (tournament='Trendyol Süper Lig', U19 elenir).
--   TFF1 : tff1_fixtures_v1.fixture_id == SofaScore event_id (KESİN, aynı id uzayı).
-- Frontend analytics.fixture_bets10_link_v1'i okur; Fixture ID sekmesinde
-- "Bets10'dan doldur" önerisi olarak gösterir (otomatik yazmaz).

create table if not exists tracker.fixture_bets10_link (
  league          text not null,        -- 'tsl' | 'tff1'
  fixture_id      bigint not null,      -- league_fixtures_v1 / tff1_fixtures_v1 fixture_id
  event_id        bigint,               -- eşleşen SofaScore event_id (izlenebilirlik)
  bets10_event_id text,                 -- Bets10 fixture id 'f-...'
  home_odds numeric, draw_odds numeric, away_odds numeric,
  match_score     numeric,              -- eşleşme güveni (TSL bulanık; TFF1 = 1.0 kesin)
  updated_at      timestamptz not null default now(),
  primary key (league, fixture_id)
);

-- tracker PostgREST'e expose DEĞİL; frontend analytics wrapper'ından okur.
grant select on tracker.fixture_bets10_link to anon, authenticated, service_role;

create or replace view analytics.fixture_bets10_link_v1 as
select league, fixture_id, event_id, bets10_event_id,
       home_odds, draw_odds, away_odds, match_score, updated_at
from tracker.fixture_bets10_link;

grant select on analytics.fixture_bets10_link_v1 to anon, authenticated, service_role;
