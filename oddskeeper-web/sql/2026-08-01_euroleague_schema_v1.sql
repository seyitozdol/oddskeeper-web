-- EuroLeague + EuroCup ham veri şeması (api-live.euroleague.net v2).
-- BSL'den TAMAMEN AYRI (basketball.* / bb_* model+analytics'e GİRMEZ). Aynı tablolar
-- competition kolonuyla iki turnuvayı tutar: 'E'=EuroLeague, 'U'=EuroCup.
-- Kimlik EL person.code (stabil) + club.code üzerinden → fuzzy-match yok.
-- Kaynak açık API (Cloudflare/geo/proxy YOK); backfill lokalden bile çalışır.

create schema if not exists euroleague;

-- ============================================================
-- Boyut: takımlar (competition+season+team_code)
-- ============================================================
create table if not exists euroleague.teams (
  competition   text not null,             -- E | U
  season_code   text not null,             -- E2025 | U2025
  season_label  text,                      -- 2025-2026
  team_code     text not null,             -- club.code (BAS, ULK, IST...)
  team_name     text,
  abbr_name     text,
  editorial_name text,
  crest_url     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (competition, season_code, team_code)
);

-- ============================================================
-- Boyut: oyuncular (competition+season+person_code)
-- ============================================================
create table if not exists euroleague.players (
  competition      text not null,
  season_code      text not null,
  season_label     text,
  person_code      text not null,          -- stabil EL person code (kimlik anahtarı)
  name             text,                   -- "DIAKITE, MAMADI"
  passport_name    text,                   -- MAMADI
  passport_surname text,                   -- DIAKITE
  country_code     text,
  birth_date       date,
  height           integer,
  position_name    text,
  team_code        text,
  team_name        text,
  dorsal           text,
  image_url        text,
  external_id      bigint,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (competition, season_code, person_code)
);
create index if not exists ix_el_players_team on euroleague.players(competition, season_code, team_code);

-- ============================================================
-- Maçlar (competition+season+game_code)
-- ============================================================
create table if not exists euroleague.games (
  competition    text not null,
  season_code    text not null,
  season_label   text,
  game_code      integer not null,         -- 47
  identifier     text,                     -- E2025_47
  round          integer,
  phase_code     text,                     -- RS | PO | FF ...
  phase_name     text,
  game_date      timestamptz,
  played         boolean,
  home_team_code text,
  home_team_name text,
  away_team_code text,
  away_team_name text,
  home_score     integer,
  away_score     integer,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (competition, season_code, game_code)
);
create index if not exists ix_el_games_date on euroleague.games(competition, season_code, game_date);

-- ============================================================
-- Oyuncu-maç box-score (oyuncu başına maç başına 1 satır)
-- ============================================================
create table if not exists euroleague.player_match_stats (
  id             bigint generated always as identity primary key,
  competition    text not null,
  season_code    text not null,
  season_label   text,
  game_code      integer not null,
  identifier     text,
  round          integer,
  phase_code     text,
  game_date      timestamptz,
  person_code    text not null,
  player_name    text,
  team_code      text,
  team_name      text,
  home_away      text,                     -- Home | Away
  opponent_code  text,
  opponent_name  text,
  dorsal         text,
  is_starter     boolean,
  seconds_played integer,
  minutes        numeric,
  points         integer,
  fg2m integer, fg2a integer,
  fg3m integer, fg3a integer,
  ftm  integer, fta  integer,
  oreb integer, dreb integer, treb integer,
  assists integer, steals integer, turnovers integer,
  blocks integer, blocks_against integer,
  fouls_committed integer, fouls_drawn integer,
  valuation integer,
  plus_minus integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition, season_code, game_code, person_code)
);
create index if not exists ix_el_pms_person on euroleague.player_match_stats(competition, season_code, person_code);
create index if not exists ix_el_pms_team on euroleague.player_match_stats(competition, season_code, team_code);

-- ============================================================
-- Takım-maç box-score
-- ============================================================
create table if not exists euroleague.team_match_stats (
  id            bigint generated always as identity primary key,
  competition   text not null,
  season_code   text not null,
  season_label  text,
  game_code     integer not null,
  round         integer,
  phase_code    text,
  game_date     timestamptz,
  team_code     text not null,
  team_name     text,
  home_away     text,
  opponent_code text,
  opponent_name text,
  points integer, opp_points integer,
  fg2m integer, fg2a integer, fg3m integer, fg3a integer, ftm integer, fta integer,
  oreb integer, dreb integer, treb integer,
  assists integer, steals integer, turnovers integer,
  blocks integer, blocks_against integer,
  fouls_committed integer, fouls_drawn integer, valuation integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition, season_code, game_code, team_code)
);

-- ============================================================
-- BSL eşleşme köprüleri (Türk takım/oyuncuları BSL'ye bağla; Part 4)
-- ============================================================
create table if not exists euroleague.player_bsl_link (
  person_code     text primary key,        -- EL person code
  bsl_player_slug text not null,           -- basketball.players.player_slug
  match_source    text,                    -- auto | manual
  created_at      timestamptz not null default now()
);
create table if not exists euroleague.team_bsl_link (
  team_code     text primary key,          -- EL club code
  bsl_team_slug text not null,             -- basketball.teams.team_slug
  created_at    timestamptz not null default now()
);

-- ============================================================
-- Grants (basketball.* kalıbı: raw RLS off, select anon+authenticated, service_role full)
-- ============================================================
grant usage on schema euroleague to anon, authenticated, service_role;
grant select on all tables in schema euroleague to anon, authenticated;
grant all    on all tables in schema euroleague to service_role;
alter default privileges in schema euroleague grant select on tables to anon, authenticated;
alter default privileges in schema euroleague grant all    on tables to service_role;
