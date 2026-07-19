create schema if not exists etl;

create table if not exists etl.load_runs (
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
    failed_steps integer not null default 0,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    run_summary jsonb not null default '{}'::jsonb,
    error_summary text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_etl_load_runs_pipeline_started_at
    on etl.load_runs (pipeline_name, started_at desc);

create index if not exists idx_etl_load_runs_status
    on etl.load_runs (status);

create index if not exists idx_etl_load_runs_source
    on etl.load_runs (source);

create index if not exists idx_etl_load_runs_started_at
    on etl.load_runs (started_at desc);

create or replace function etl.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_etl_load_runs_updated_at on etl.load_runs;
create trigger trg_etl_load_runs_updated_at
before update on etl.load_runs
for each row
execute function etl.set_updated_at();

grant usage on schema etl to service_role;
grant select, insert, update, delete on all tables in schema etl to service_role;
grant usage, select on all sequences in schema etl to service_role;

alter default privileges in schema etl
grant select, insert, update, delete on tables to service_role;

alter default privileges in schema etl
grant usage, select on sequences to service_role;
