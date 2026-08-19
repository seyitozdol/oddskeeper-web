-- 2026-08-19 olu katalog arsivi: tablo DDL (information_schema'dan uretildi;
-- index/constraint detayi asagida yorum olarak). Veri: ayni klasordeki CSV'ler.

CREATE SCHEMA IF NOT EXISTS etl;
CREATE TABLE etl.load_runs (
  id bigint DEFAULT nextval('etl.load_runs_id_seq'::regclass) NOT NULL,
  pipeline_name text NOT NULL,
  pipeline_version text NOT NULL,
  source text,
  batch_label text,
  input_path text,
  parse_enabled boolean DEFAULT false NOT NULL,
  status text NOT NULL,
  total_steps integer DEFAULT 0 NOT NULL,
  completed_steps integer DEFAULT 0 NOT NULL,
  failed_steps integer DEFAULT 0 NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  run_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
  error_summary text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX load_runs_pkey ON etl.load_runs USING btree (id)
-- CREATE INDEX idx_etl_load_runs_pipeline_started_at ON etl.load_runs USING btree (pipeline_name, started_at DESC)
-- CREATE INDEX idx_etl_load_runs_status ON etl.load_runs USING btree (status)
-- CREATE INDEX idx_etl_load_runs_source ON etl.load_runs USING btree (source)
-- CREATE INDEX idx_etl_load_runs_started_at ON etl.load_runs USING btree (started_at DESC)

CREATE SCHEMA IF NOT EXISTS map;
CREATE TABLE map.source_competitions (
  id bigint DEFAULT nextval('map.source_competitions_id_seq'::regclass) NOT NULL,
  source_id bigint NOT NULL,
  competition_id bigint NOT NULL,
  source_competition_id text NOT NULL,
  source_competition_name text,
  source_country text,
  source_payload jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX source_competitions_pkey ON map.source_competitions USING btree (id)
-- CREATE UNIQUE INDEX source_competitions_source_id_source_competition_id_key ON map.source_competitions USING btree (source_id, source_competition_id)
-- CREATE UNIQUE INDEX source_competitions_source_id_competition_id_key ON map.source_competitions USING btree (source_id, competition_id)
-- CREATE INDEX idx_map_source_competitions_source_id ON map.source_competitions USING btree (source_id)
-- CREATE INDEX idx_map_source_competitions_competition_id ON map.source_competitions USING btree (competition_id)

CREATE SCHEMA IF NOT EXISTS map;
CREATE TABLE map.source_matches (
  id bigint DEFAULT nextval('map.source_matches_id_seq'::regclass) NOT NULL,
  source_id bigint NOT NULL,
  canonical_match_id bigint,
  source_match_id text NOT NULL,
  source_competition_id text,
  source_season_id text,
  source_home_team_id text,
  source_away_team_id text,
  source_match_date_utc timestamp with time zone,
  source_payload jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX source_matches_pkey ON map.source_matches USING btree (id)
-- CREATE UNIQUE INDEX source_matches_source_id_source_match_id_key ON map.source_matches USING btree (source_id, source_match_id)
-- CREATE UNIQUE INDEX source_matches_source_id_canonical_match_id_key ON map.source_matches USING btree (source_id, canonical_match_id)
-- CREATE INDEX idx_map_source_matches_source_id ON map.source_matches USING btree (source_id)
-- CREATE INDEX idx_map_source_matches_canonical_match_id ON map.source_matches USING btree (canonical_match_id)
-- CREATE INDEX idx_map_source_matches_source_match_id ON map.source_matches USING btree (source_match_id)

CREATE SCHEMA IF NOT EXISTS map;
CREATE TABLE map.source_players (
  id bigint DEFAULT nextval('map.source_players_id_seq'::regclass) NOT NULL,
  source_id bigint NOT NULL,
  player_id bigint NOT NULL,
  source_player_id text NOT NULL,
  source_player_name text,
  source_payload jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX source_players_pkey ON map.source_players USING btree (id)
-- CREATE UNIQUE INDEX source_players_source_id_source_player_id_key ON map.source_players USING btree (source_id, source_player_id)
-- CREATE UNIQUE INDEX source_players_source_id_player_id_key ON map.source_players USING btree (source_id, player_id)
-- CREATE INDEX idx_map_source_players_source_id ON map.source_players USING btree (source_id)
-- CREATE INDEX idx_map_source_players_player_id ON map.source_players USING btree (player_id)

CREATE SCHEMA IF NOT EXISTS map;
CREATE TABLE map.source_referees (
  id bigint DEFAULT nextval('map.source_referees_id_seq'::regclass) NOT NULL,
  source_id bigint NOT NULL,
  referee_id bigint NOT NULL,
  source_referee_id text NOT NULL,
  source_referee_name text,
  source_payload jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX source_referees_pkey ON map.source_referees USING btree (id)
-- CREATE UNIQUE INDEX source_referees_source_id_source_referee_id_key ON map.source_referees USING btree (source_id, source_referee_id)
-- CREATE UNIQUE INDEX source_referees_source_id_referee_id_key ON map.source_referees USING btree (source_id, referee_id)
-- CREATE INDEX idx_map_source_referees_source_id ON map.source_referees USING btree (source_id)
-- CREATE INDEX idx_map_source_referees_referee_id ON map.source_referees USING btree (referee_id)

CREATE SCHEMA IF NOT EXISTS map;
CREATE TABLE map.source_seasons (
  id bigint DEFAULT nextval('map.source_seasons_id_seq'::regclass) NOT NULL,
  source_id bigint NOT NULL,
  season_id bigint NOT NULL,
  source_season_id text NOT NULL,
  source_season_name text,
  source_payload jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX source_seasons_pkey ON map.source_seasons USING btree (id)
-- CREATE UNIQUE INDEX source_seasons_source_id_source_season_id_key ON map.source_seasons USING btree (source_id, source_season_id)
-- CREATE UNIQUE INDEX source_seasons_source_id_season_id_key ON map.source_seasons USING btree (source_id, season_id)
-- CREATE INDEX idx_map_source_seasons_source_id ON map.source_seasons USING btree (source_id)
-- CREATE INDEX idx_map_source_seasons_season_id ON map.source_seasons USING btree (season_id)

CREATE SCHEMA IF NOT EXISTS map;
CREATE TABLE map.source_teams (
  id bigint DEFAULT nextval('map.source_teams_id_seq'::regclass) NOT NULL,
  source_id bigint NOT NULL,
  team_id bigint NOT NULL,
  source_team_id text NOT NULL,
  source_team_name text,
  source_payload jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX source_teams_pkey ON map.source_teams USING btree (id)
-- CREATE UNIQUE INDEX source_teams_source_id_source_team_id_key ON map.source_teams USING btree (source_id, source_team_id)
-- CREATE UNIQUE INDEX source_teams_source_id_team_id_key ON map.source_teams USING btree (source_id, team_id)
-- CREATE INDEX idx_map_source_teams_source_id ON map.source_teams USING btree (source_id)
-- CREATE INDEX idx_map_source_teams_team_id ON map.source_teams USING btree (team_id)

CREATE SCHEMA IF NOT EXISTS map;
CREATE TABLE map.source_venues (
  id bigint DEFAULT nextval('map.source_venues_id_seq'::regclass) NOT NULL,
  source_id bigint NOT NULL,
  venue_id bigint NOT NULL,
  source_venue_id text NOT NULL,
  source_venue_name text,
  source_payload jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX source_venues_pkey ON map.source_venues USING btree (id)
-- CREATE UNIQUE INDEX source_venues_source_id_source_venue_id_key ON map.source_venues USING btree (source_id, source_venue_id)
-- CREATE UNIQUE INDEX source_venues_source_id_venue_id_key ON map.source_venues USING btree (source_id, venue_id)
-- CREATE INDEX idx_map_source_venues_source_id ON map.source_venues USING btree (source_id)
-- CREATE INDEX idx_map_source_venues_venue_id ON map.source_venues USING btree (venue_id)

CREATE SCHEMA IF NOT EXISTS mapping;
CREATE TABLE mapping.map_competition (
  source text NOT NULL,
  competition_norm text NOT NULL,
  canonical_competition_name text NOT NULL,
  latest_observed_competition text,
  first_seen_match_datetime timestamp with time zone,
  last_seen_match_datetime timestamp with time zone,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX map_competition_pkey ON mapping.map_competition USING btree (source, competition_norm)

CREATE SCHEMA IF NOT EXISTS mapping;
CREATE TABLE mapping.map_incident_subtype (
  source text NOT NULL,
  event_type_code text NOT NULL,
  event_title_norm text NOT NULL,
  canonical_incident_type text NOT NULL,
  canonical_incident_group text NOT NULL,
  observed_row_count bigint,
  first_seen_match_datetime timestamp with time zone,
  last_seen_match_datetime timestamp with time zone,
  latest_observed_event_title text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX map_incident_subtype_pkey ON mapping.map_incident_subtype USING btree (source, event_type_code, event_title_norm)

CREATE SCHEMA IF NOT EXISTS mapping;
CREATE TABLE mapping.map_incident_type (
  source text NOT NULL,
  raw_incident_type text NOT NULL,
  canonical_incident_type text NOT NULL,
  canonical_incident_group text,
  latest_observed_event_type_code text,
  latest_observed_event_title text,
  observed_row_count bigint,
  first_seen_match_datetime timestamp with time zone,
  last_seen_match_datetime timestamp with time zone,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX map_incident_type_pkey ON mapping.map_incident_type USING btree (source, raw_incident_type)

CREATE SCHEMA IF NOT EXISTS mapping;
CREATE TABLE mapping.map_player (
  source text NOT NULL,
  source_player_id text NOT NULL,
  canonical_player_name text NOT NULL,
  latest_observed_player_name text,
  latest_source_team_id text,
  latest_team_name text,
  latest_position_code text,
  latest_position_group text,
  first_seen_match_datetime timestamp with time zone,
  last_seen_match_datetime timestamp with time zone,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX map_player_pkey ON mapping.map_player USING btree (source, source_player_id)

CREATE SCHEMA IF NOT EXISTS mapping;
CREATE TABLE mapping.map_position (
  source text NOT NULL,
  raw_position_code text NOT NULL,
  canonical_position_code text NOT NULL,
  canonical_position_group text,
  latest_observed_position_code text,
  observed_row_count bigint,
  first_seen_match_datetime timestamp with time zone,
  last_seen_match_datetime timestamp with time zone,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX map_position_pkey ON mapping.map_position USING btree (source, raw_position_code)

CREATE SCHEMA IF NOT EXISTS mapping;
CREATE TABLE mapping.map_team (
  source text NOT NULL,
  source_team_id text NOT NULL,
  canonical_team_name text NOT NULL,
  latest_observed_team_name text,
  first_seen_match_datetime timestamp with time zone,
  last_seen_match_datetime timestamp with time zone,
  latest_competition text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- CREATE UNIQUE INDEX map_team_pkey ON mapping.map_team USING btree (source, source_team_id)

