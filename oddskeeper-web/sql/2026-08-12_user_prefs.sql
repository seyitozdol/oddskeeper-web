-- 2026-08-12: Kullanici bazli arayuz tercihleri (ilk kullanim: Upcoming Events
-- "Hide low profile" toggle'i). Tercih GLOBAL degil kullanici basinadir;
-- yazma/okuma yalniz service-role uzerinden /api/user-prefs route'u ile
-- (kullanici kimligi sunucuda dogrulanir, anon dogrudan erisemez).
-- user_id text: Supabase auth uuid'si; lokal dev bypass 'dev-bypass' yazar.

create table if not exists analytics.user_prefs (
  user_id text not null,
  pref_key text not null,
  pref_value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, pref_key)
);

grant select, insert, update, delete on analytics.user_prefs to service_role;

notify pgrst, 'reload schema';
