-- Basketbol (Türkiye Basketbol Süper Ligi) ham veri şeması — Faz 2 migrasyon
-- Kaynak: Basketbol Player Team_v38.xlsm (tblPlayer, tblTeam, Lists, Fixture, MarketTemplate, Criteria)
-- Futbol tarafı konvansiyonu: ham tablo (RLS off, grant select anon/authenticated) → analytics view → frontend.
-- Model/Monte-Carlo motoru bu fazda TAŞINMAZ (sonraki faz: analytics.bb_* view'ları / edge fn).

create schema if not exists basketball;

-- ============================================================
-- Boyut: takımlar
-- ============================================================
create table if not exists basketball.teams (
  team_slug     text primary key,
  team_name     text not null unique,
  season_label  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- Boyut: oyuncular (isim bazlı; market_participant_id Lists'ten)
-- ============================================================
create table if not exists basketball.players (
  player_slug            text primary key,
  player_name            text not null,
  team_slug              text references basketball.teams(team_slug),
  team_name              text,
  jersey_no              text,
  market_participant_id  text,
  season_label           text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists ix_bb_players_team on basketball.players(team_slug);

-- ============================================================
-- Fikstür (modellenecek maçlar)
-- ============================================================
create table if not exists basketball.fixtures (
  fixture_id      integer primary key,
  season_label    text,
  competition     text,
  week            integer,
  match_text      text,
  home_team_slug  text,
  home_team_name  text,
  away_team_slug  text,
  away_team_name  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- Market şablon haritası (market adı -> platform kodu)
-- ============================================================
create table if not exists basketball.market_templates (
  market_key    text primary key,
  template_code text,
  market_group  text,          -- 'player' | 'team'
  created_at    timestamptz not null default now()
);

-- ============================================================
-- Model konfig (Criteria: kalifikasyon eşikleri)
-- ============================================================
create table if not exists basketball.model_config (
  key   text primary key,
  value numeric,
  note  text
);

-- ============================================================
-- Takım-maç istatistikleri (tblTeam) — takım başına maç başına 1 satır
-- ============================================================
create table if not exists basketball.team_match_stats (
  id              bigint generated always as identity primary key,
  source          text not null default 'excel_v38',
  season_label    text,
  competition     text,
  match_key       text not null,          -- "Ev - Deplasman"
  match_date      date,
  week            integer,
  team_slug       text not null,
  team_name       text not null,
  home_away       text,                   -- 'Home' | 'Away'
  opponent_slug   text,
  opponent_name   text,
  points          integer,                -- Sayi
  fg2m integer, fg2a integer, fg2_pct numeric,   -- 2AG Basari / 2AG / 2AG %
  fg3m integer, fg3a integer, fg3_pct numeric,   -- 3AG Basari / 3AG / 3AG %
  ftm  integer, fta  integer, ft_pct  numeric,   -- SA Basari / SA AG / SA %
  oreb integer, dreb integer, treb integer,      -- HR / SR / TR
  assists integer,                               -- As
  turnovers integer,                             -- TK
  steals integer,                                -- Tc
  blocks integer,                                -- BLK
  blocks_against integer,                         -- YBLK
  fouls_drawn integer,                            -- FA
  fouls_committed integer,                        -- YFA
  opp_points integer,                             -- OppSayi
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- match_date dahil: playoff serisinde aynı eşleşme farklı günlerde tekrar eder
  constraint uq_bb_tms unique (source, season_label, match_key, match_date, team_name)
);
create index if not exists ix_bb_tms_team on basketball.team_match_stats(team_slug, season_label);
create index if not exists ix_bb_tms_date on basketball.team_match_stats(match_date);

-- ============================================================
-- Oyuncu-maç istatistikleri (tblPlayer) — oyuncu başına maç başına 1 satır
-- ============================================================
create table if not exists basketball.player_match_stats (
  id              bigint generated always as identity primary key,
  source          text not null default 'excel_v38',
  season_label    text,
  competition     text,
  match_key       text not null,
  match_date      date,
  week            integer,
  player_slug     text not null,
  player_name     text not null,
  team_slug       text,
  team_name       text not null,
  jersey_no       text,                   -- No
  seconds_played  integer,                -- Sure
  minutes         numeric,                -- Dakika (ondalık)
  points          integer,                -- Sayi
  fg2m integer, fg2a integer, fg2_pct numeric,
  fg3m integer, fg3a integer, fg3_pct numeric,
  ftm  integer, fta  integer, ft_pct  numeric,
  oreb integer, dreb integer, treb integer,
  assists integer,
  turnovers integer,
  steals integer,
  blocks integer,
  blocks_against integer,
  fouls_drawn integer,
  fouls_committed integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_bb_pms unique (source, season_label, match_key, match_date, player_name, team_name)
);
create index if not exists ix_bb_pms_player on basketball.player_match_stats(player_slug, season_label);
create index if not exists ix_bb_pms_team on basketball.player_match_stats(team_slug, season_label);
create index if not exists ix_bb_pms_date on basketball.player_match_stats(match_date);

-- ============================================================
-- Grants (futbol tarafıyla aynı: raw RLS off, select anon+authenticated, service_role full)
-- ============================================================
grant usage on schema basketball to anon, authenticated, service_role;
grant select on all tables in schema basketball to anon, authenticated;
grant all    on all tables in schema basketball to service_role;
alter default privileges in schema basketball grant select on tables to anon, authenticated;
alter default privileges in schema basketball grant all    on tables to service_role;
