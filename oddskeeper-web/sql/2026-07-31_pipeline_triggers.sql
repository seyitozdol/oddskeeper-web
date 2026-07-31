-- 2026-07-31: Manuel pipeline tetikleme kuyrugu (admin butonu).
-- Admin butonu (frontend, service-role) buraya 'pending' satir yazar; VPS'te
-- dakikada bir calisan trigger_worker.py bunu gorup pipeline'i (upcoming events
-- + 3 oran kaynagi) BIR KEZ calistirir. Scheduled cron'lar KENDI sabit
-- saatlerinde bagimsiz devam eder; manuel tetikleme yalnizca ek out-of-band kosu.
-- public semasinda: frontend admin client (PostgREST) public'e erisir.

create table if not exists public.pipeline_triggers (
  id bigserial primary key,
  requested_at timestamptz not null default now(),
  requested_by text,                       -- admin e-postasi
  status text not null default 'pending',  -- pending | running | done | error
  started_at timestamptz,
  finished_at timestamptz,
  note text
);

create index if not exists pipeline_triggers_status_idx
  on public.pipeline_triggers (status, requested_at);

-- Yalnizca service_role (admin API + VPS). RLS ile anon/authenticated kapali.
alter table public.pipeline_triggers enable row level security;
revoke all on public.pipeline_triggers from anon, authenticated;
grant all on public.pipeline_triggers to service_role;
grant usage, select on sequence public.pipeline_triggers_id_seq to service_role;
