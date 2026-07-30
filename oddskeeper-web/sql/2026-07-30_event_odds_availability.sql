-- 2026-07-30: Bahis sitesi oran kontrolu (Upcoming Event Tracker eki)
-- Site basina bir satir: eventin 1x2 (voleybolda 1-2) orani listede var mi?
-- Simdilik tek seferlik manuel kontrol ile dolduruluyor; ileride otomatiklesecek.

create table if not exists tracker.event_odds_availability (
  event_id bigint not null,
  site text not null,                          -- bet365 | bets10
  has_odds boolean not null,
  checked_at timestamptz not null default now(),
  primary key (event_id, site)
);

-- View'a site kolonlari eklendi (null = henuz kontrol edilmedi).
create or replace view analytics.upcoming_events_v1 as
select
  u.event_id, u.sport, u.category_name, u.tournament_name, u.season_name, u.round_info,
  u.home_team_id, u.home_team_name, u.home_team_country, u.home_team_national,
  u.away_team_id, u.away_team_name, u.away_team_country, u.away_team_national,
  u.gender, u.start_ts, u.status_type, u.status_desc, u.home_score, u.away_score,
  u.event_slug, u.updated_at,
  b365.has_odds as bet365_has_odds,
  b10.has_odds as bets10_has_odds
from tracker.upcoming_events u
left join tracker.event_odds_availability b365
  on b365.event_id = u.event_id and b365.site = 'bet365'
left join tracker.event_odds_availability b10
  on b10.event_id = u.event_id and b10.site = 'bets10'
where u.status_type in ('notstarted', 'inprogress')
  and u.start_ts > now() - interval '6 hours';

grant select on analytics.upcoming_events_v1 to anon, authenticated, service_role;
