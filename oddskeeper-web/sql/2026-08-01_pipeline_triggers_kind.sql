-- 2026-08-01: pipeline_triggers'a 'kind' kolonu — manuel tetikleyicileri ayrıştır.
-- 'all' = mevcut futbol/oran zinciri (run_upcoming_events + 3 oran kaynağı).
-- 'tbf_basketball' = yalnız TBF basketbol scraper'ı (run_tbf_basketball.sh).
-- Böylece basketbol tetiği futbol butonunu (ve tersi) BLOKLAMAZ; worker kind'e
-- göre doğru wrapper'ı çalıştırır. Additive; mevcut satırlar 'all' olur.

alter table public.pipeline_triggers
  add column if not exists kind text not null default 'all';

update public.pipeline_triggers set kind = 'all' where kind is null or kind = '';

create index if not exists pipeline_triggers_kind_status_idx
  on public.pipeline_triggers (kind, status, requested_at);
