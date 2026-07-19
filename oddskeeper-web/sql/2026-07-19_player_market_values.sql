-- 2026-07-19: Transfermarkt oyuncu piyasa degerleri
--
-- football.player_market_values: pipeline/src/football/fetch_transfermarkt_values.py
-- tarafindan doldurulur (TR1 ligi 18 takimin kadro sayfalari; dogum tarihi +
-- soyad eslesmesiyle apifootball oyuncusuna baglanir).
-- analytics.player_market_value_v1: frontend'in slug ile okudugu view.
--
-- UYGULANDI: 2026-07-19

CREATE TABLE IF NOT EXISTS football.player_market_values (
  id bigserial PRIMARY KEY,
  apifootball_player_id text NOT NULL UNIQUE,
  player_slug text,
  tm_player_id text,
  tm_player_name text,
  market_value_eur bigint,
  team_slug text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW analytics.player_market_value_v1 AS
SELECT
  ci.player_slug,
  mv.apifootball_player_id,
  mv.tm_player_id,
  mv.tm_player_name,
  mv.market_value_eur,
  mv.team_slug,
  mv.fetched_at
FROM football.player_market_values mv
JOIN analytics.player_current_info_v1 ci
  ON ci.apifootball_player_id = mv.apifootball_player_id;

GRANT SELECT ON analytics.player_market_value_v1 TO anon, authenticated;
GRANT SELECT ON analytics.player_market_value_v1 TO service_role;
