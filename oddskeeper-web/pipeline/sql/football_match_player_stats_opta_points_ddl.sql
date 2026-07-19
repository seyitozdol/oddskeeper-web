create schema if not exists football;

create table if not exists football.match_player_stats_opta_points (
    id bigserial primary key,
    source text not null,
    source_match_id text not null,
    source_team_id text not null,
    team_name text not null,
    source_player_id text not null,
    player_name text not null,
    player_side text,
    lineup_status text,
    position_code text,
    active_mode text,
    team_rank integer,
    points numeric,
    minutes_played integer,
    goals integer,
    shots_on_target integer,
    shots_off_target integer,
    shots_blocked integer,
    own_goals integer,
    assists integer,
    passes numeric,
    crosses numeric,
    tackles integer,
    interceptions integer,
    fouls_won integer,
    fouls_conceded integer,
    offsides integer,
    cards_yellow integer,
    cards_red integer,
    goals_conceded integer,
    penalties_won integer,
    saves_total integer,
    penalties_saved integer,
    raw_stats jsonb,
    payload_last_seen_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_match_player_stats_opta_points_key
    on football.match_player_stats_opta_points (source, source_match_id, source_player_id);

create index if not exists ix_match_player_stats_opta_points_match
    on football.match_player_stats_opta_points (source_match_id);

create index if not exists ix_match_player_stats_opta_points_team
    on football.match_player_stats_opta_points (source_team_id);

create index if not exists ix_match_player_stats_opta_points_player
    on football.match_player_stats_opta_points (source_player_id);

grant usage on schema football to service_role;
grant select, insert, update, delete on all tables in schema football to service_role;
grant usage, select on all sequences in schema football to service_role;

alter default privileges in schema football
grant select, insert, update, delete on tables to service_role;

alter default privileges in schema football
grant usage, select on sequences to service_role;
