create schema if not exists football;

create table if not exists football.load_runs (
    id bigserial primary key,
    pipeline_name text not null,
    pipeline_version text not null,
    source text,
    batch_label text,
    input_path text,
    parse_enabled boolean not null default false,
    status text not null check (status in ('running', 'success', 'failed', 'partial')),
    total_steps integer not null default 0,
    completed_steps integer not null default 0,
    warning_steps integer not null default 0,
    failed_steps integer not null default 0,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    run_summary jsonb not null default '{}'::jsonb,
    error_summary text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_football_load_runs_pipeline_started_at
    on football.load_runs (pipeline_name, started_at desc);

create index if not exists idx_football_load_runs_status
    on football.load_runs (status);

create index if not exists idx_football_load_runs_source
    on football.load_runs (source);

create or replace function football.set_load_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_football_load_runs_updated_at on football.load_runs;
create trigger trg_football_load_runs_updated_at
before update on football.load_runs
for each row
execute function football.set_load_runs_updated_at();

grant usage on schema football to service_role;
grant select, insert, update, delete on football.load_runs to service_role;
grant usage, select on sequence football.load_runs_id_seq to service_role;
