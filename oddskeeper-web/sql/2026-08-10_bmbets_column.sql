-- 2026-08-10: 4. bahis kaynagi BMBets (bmbets.com, oran karsilastirma).
-- Sema zaten site-bagimsiz (tracker.site_event_odds /
-- event_odds_availability.site = text), yalnizca analytics.upcoming_events_v1'e
-- bmbets kolonlari eklenir. Loader: pipeline/src/common/fetch_bmbets.py.
-- create or replace kolon ekleyemiyor (kolon sirasi degisir), once dusur.

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
  coalesce(op.listed, false) as oddsportal_listed,
  bm.has_odds as bmbets_has_odds,
  coalesce(bm.market_count, 0) as bmbets_market_count,
  coalesce(bm.listed, false) as bmbets_listed
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

grant select on analytics.upcoming_events_v1 to anon, authenticated, service_role;
