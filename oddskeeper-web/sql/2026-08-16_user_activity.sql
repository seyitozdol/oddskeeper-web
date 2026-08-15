-- Kullanici aktivite takibi: "Last Used" (son kullanim) + GitHub tarzi aktiflik.
-- last_sign_in_at yalniz LOGIN'de guncellenir; login olup logout olmayan kullanici
-- sitede gezinse de gorunmuyordu. Bu tablolar sayfa gezinme heartbeat'inden dolar.
--
-- Yazma YALNIZ service-role (admin client) uzerinden: /api/activity/ping route'u
-- oturumdan user_id'yi alir, kullanicinin KENDI satirini gunceller. RLS acik +
-- policy YOK -> anon/authenticated dogrudan erisemez (service_role bypass eder).

create table if not exists public.user_activity (
  user_id       uuid primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  total_hits    bigint      not null default 0
);

create table if not exists public.user_activity_daily (
  user_id uuid not null,
  day     date not null,
  hits    int  not null default 0,
  primary key (user_id, day)
);
create index if not exists user_activity_daily_day_idx on public.user_activity_daily (day);

alter table public.user_activity       enable row level security;
alter table public.user_activity_daily enable row level security;

-- Heartbeat: son gorulme + gunluk sayaci artir (tek cagri, upsert+increment).
create or replace function public.record_user_activity(p_user uuid)
returns void language plpgsql as $$
begin
  insert into public.user_activity (user_id, last_seen_at, total_hits)
    values (p_user, now(), 1)
  on conflict (user_id) do update
    set last_seen_at = now(), total_hits = public.user_activity.total_hits + 1;
  insert into public.user_activity_daily (user_id, day, hits)
    values (p_user, current_date, 1)
  on conflict (user_id, day) do update
    set hits = public.user_activity_daily.hits + 1;
end $$;

grant execute on function public.record_user_activity(uuid) to service_role;
