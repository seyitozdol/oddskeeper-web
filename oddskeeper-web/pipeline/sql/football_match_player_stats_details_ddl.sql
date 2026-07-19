create schema if not exists football;

create table if not exists football.match_player_stats_details (
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
    accurate_pass integer,
    hit_woodwork integer,
    attempts_ibox integer,
    attempts_obox integer,
    headed_shots integer,
    expected_goals numeric,
    goal_kicks integer,
    total_throws integer,
    out_of_box_goals integer,
    right_foot_goals integer,
    left_foot_goals integer,
    headed_goals integer,
    penalty_goals integer,
    freekick_goals integer,
    fantasy_assist integer,
    raw_stats jsonb,
    payload_last_seen_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_match_player_stats_details_key
    on football.match_player_stats_details (source, source_match_id, source_player_id);

create index if not exists ix_match_player_stats_details_match
    on football.match_player_stats_details (source_match_id);

create index if not exists ix_match_player_stats_details_team
    on football.match_player_stats_details (source_team_id);

create index if not exists ix_match_player_stats_details_player
    on football.match_player_stats_details (source_player_id);

grant usage on schema football to service_role;
grant select, insert, update, delete on all tables in schema football to service_role;
grant usage, select on all sequences in schema football to service_role;

alter default privileges in schema football
grant select, insert, update, delete on tables to service_role;

alter default privileges in schema football
grant usage, select on sequences to service_role;
