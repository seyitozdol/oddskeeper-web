create table if not exists football.match_incidents (
    id bigserial primary key,
    source text not null,
    source_match_id text not null,
    incident_key text not null,
    source_incident_id text,
    side text not null,
    event_type_code text,
    event_title text,
    minute_text text,
    minute_sort integer,
    player_texts jsonb not null default '[]'::jsonb,
    primary_player_text text,
    secondary_player_text text,
    raw_text text,
    payload_last_seen_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_match_incidents_source_match_incident
    on football.match_incidents (source, source_match_id, incident_key);
