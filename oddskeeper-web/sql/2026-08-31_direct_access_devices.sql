-- 2026-08-31: Sifresiz giriste cihaz kilidi ("ilk giris sahiplenir").
-- Alias'la ilk basarili giriste server rastgele bir cihaz token'i uretir,
-- httpOnly cookie olarak tarayiciya yazar ve SHA-256 hash'ini buraya kaydeder.
-- Sonraki girislerde kural:
--   - Hesabin kaydi varsa yalnizca eslesen cookie'yi tasiyan tarayici girebilir.
--   - Bir cihaz (token) yalnizca tek hesaba bagli olabilir; ayni tarayicidan
--     baska alias denemesi reddedilir.
--   - user_id PRIMARY KEY oldugu icin hesap basina tek cihaz kurali DB
--     seviyesinde garantidir (es zamanli claim yarisini da tek kazanana indirir).
-- Admin panelden "cihazi sifirla" = satiri silmek; bir sonraki giris yeniden
-- sahiplenir. Alias kaldirilinca FK cascade ile cihaz bagi da duser.
--
-- Guvenlik modeli direct_access_users ile ayni:
--   - Tabloya SADECE service role erisir (login route + admin API).
--   - RLS acik, hicbir policy yok; anon/authenticated grant'lari cekildi.

create table if not exists public.direct_access_devices (
  user_id uuid primary key
    references public.direct_access_users(user_id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.direct_access_devices enable row level security;

-- Policy yok: RLS her istegi reddeder, sadece service role bypass eder.
revoke all on public.direct_access_devices from anon, authenticated;
