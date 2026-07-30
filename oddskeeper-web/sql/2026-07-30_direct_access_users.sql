-- 2026-07-30: Sifresiz giris (super kullanici) tablosu.
-- Bu tablodaki alias'a sahip kullanicilar giris ekranina sadece alias yazarak
-- girer; sifre kontrolu yapilmaz. Alias'in kendisi gizli bilgidir, tahmin
-- edilmesi zor secilmelidir.
--
-- Guvenlik modeli:
--   - Tabloya SADECE service role erisir (admin API + login route).
--   - RLS acik, hicbir policy yok; anon/authenticated grant'lari cekildi.
--   - Client bundle'inda bu tabloya dair hicbir referans yok; kontrol
--     tamamen server tarafinda /api/auth/login icinde yapilir.

create table if not exists public.direct_access_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alias text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint direct_access_alias_format
    check (alias = lower(alias) and alias ~ '^[a-z0-9][a-z0-9._-]{2,31}$')
);

alter table public.direct_access_users enable row level security;

-- Policy yok: RLS her istegi reddeder, sadece service role bypass eder.
revoke all on public.direct_access_users from anon, authenticated;
