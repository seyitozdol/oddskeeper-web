-- 2026-07-24: Admin kullanici paneli - header basliklari erisim izinleri
-- Kullanici basina bir satir. allowed_keys NULL ise tum basliklara erisim var
-- (varsayilan). Dizi ise sadece listelenen nav anahtarlarina erisebilir.
-- Nav anahtarlari (frontend/lib/nav-permissions.ts ile ayni olmali):
--   smart-prediction, deep-prediction-ml, match-predictions,
--   player-market, stats-analysis

create table if not exists public.user_nav_permissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  allowed_keys text[],
  updated_at timestamptz not null default now()
);

alter table public.user_nav_permissions enable row level security;

-- Herkes yalnizca kendi satirini okuyabilir (header filtreleme + middleware).
-- Yazma politikasi yok: yazma sadece service role uzerinden (admin API).
drop policy if exists user_nav_permissions_select_own on public.user_nav_permissions;
create policy user_nav_permissions_select_own
  on public.user_nav_permissions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Derinlemesine savunma: yazma yetkisini rol duzeyinde de kapat. RLS zaten
-- politikasiz INSERT/UPDATE/DELETE'i reddediyor ama Supabase public semasina
-- authenticated icin varsayilan ALL grant veriyor; ileride yanlislikla bir
-- yazma politikasi eklenirse eskalasyon kapisi acilmasin diye grant'i cekiyoruz.
-- Yazma yalnizca service_role (admin API) uzerinden yapilir.
revoke all on public.user_nav_permissions from anon, authenticated;
grant select on public.user_nav_permissions to authenticated;

-- Baslangic admin kullanicilari
insert into public.user_nav_permissions (user_id, email, is_admin)
select id, email, true
from auth.users
where lower(email) in ('seyitozdol@yahoo.com', 'test@test.com')
on conflict (user_id) do update
  set is_admin = true, updated_at = now();
