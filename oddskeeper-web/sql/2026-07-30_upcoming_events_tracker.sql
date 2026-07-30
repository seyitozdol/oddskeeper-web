-- 2026-07-30: Upcoming Event Tracker
-- SofaScore'dan periyodik cekilen yaklasan maclar: Turkiye ligleri (futbol,
-- basketbol, voleybol, alt ligler dahil) + Avrupa/Dunya/Uluslararasi
-- kategorilerinde Turk takimlarinin ve milli takimlarin maclari.
-- Yazan: pipeline/src/common/fetch_upcoming_events.py (Task Scheduler ile periyodik).
-- Okuyan: analytics.upcoming_events_v1 uzerinden /dashboard/upcoming-events sayfasi.

create schema if not exists tracker;

create table if not exists tracker.upcoming_events (
  event_id bigint primary key,                       -- sofascore event id
  sport text not null,                               -- football | basketball | volleyball
  category_name text,                                -- Turkey, Europe, International, World
  tournament_name text not null,
  season_name text,
  round_info text,
  home_team_id bigint,
  home_team_name text not null,
  home_team_country text,                            -- ISO alpha2 (TR, AT, ...)
  home_team_national boolean not null default false,
  away_team_id bigint,
  away_team_name text not null,
  away_team_country text,
  away_team_national boolean not null default false,
  gender text,                                       -- M | F (sofascore takim cinsiyeti)
  start_ts timestamptz not null,
  status_type text not null,                         -- notstarted | inprogress | finished | postponed | canceled
  status_desc text,
  home_score int,
  away_score int,
  event_slug text,
  last_seen_at timestamptz not null default now(),   -- son sweep'te gorulme; gorulmeyen notstarted kayitlar silinir
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists upcoming_events_start_ts_idx
  on tracker.upcoming_events (start_ts);
create index if not exists upcoming_events_sport_start_idx
  on tracker.upcoming_events (sport, start_ts);

-- Frontend view: baslamamis ve canli maclar. Baslangici 6 saatten eski
-- kayitlar (statusu guncellenmemis olsa da) listeden duser.
create or replace view analytics.upcoming_events_v1 as
select
  event_id, sport, category_name, tournament_name, season_name, round_info,
  home_team_id, home_team_name, home_team_country, home_team_national,
  away_team_id, away_team_name, away_team_country, away_team_national,
  gender, start_ts, status_type, status_desc, home_score, away_score,
  event_slug, updated_at
from tracker.upcoming_events
where status_type in ('notstarted', 'inprogress')
  and start_ts > now() - interval '6 hours';

grant select on analytics.upcoming_events_v1 to anon, authenticated, service_role;
