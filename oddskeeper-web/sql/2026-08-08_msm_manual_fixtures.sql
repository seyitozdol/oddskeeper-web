-- 2026-08-08: MSM manuel fikstürler.
--
-- Match Stats Model Fixture sekmesinde kullanicinin elle olusturdugu fikstürler.
-- Resmi fikstür listesinde olmayan maclar (ör. kupa, hazirlik) icin. Takim adi
-- yazarken oneri cikar ama serbest metin de yazilabilir (slug bos kalir; o zaman
-- model istatistik uretemez ama fixture id/oran atanabilir). Manuel fikstürler
-- listenin en ustunde durur ve round filtresinden bagimsizdir.
--
-- Erisim: okuma analytics'ten dogrudan (sb() = analytics), select grant'i ile.
-- Yazma yalnizca SECURITY DEFINER RPC'lerle (msm_fixture_inputs deseni).

create table if not exists analytics.msm_manual_fixtures (
  id uuid primary key default gen_random_uuid(),
  league text not null,
  home_slug text not null default '',
  home_name text not null,
  away_slug text not null default '',
  away_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists msm_manual_fixtures_league_idx
  on analytics.msm_manual_fixtures (league, created_at desc);

grant select on analytics.msm_manual_fixtures to anon, authenticated;
grant all on analytics.msm_manual_fixtures to service_role;

create or replace function public.msm_add_manual_fixture(
  p_league text, p_home_slug text, p_home_name text, p_away_slug text, p_away_name text
) returns uuid language plpgsql security definer set search_path = analytics, public as $$
declare v_id uuid;
begin
  insert into analytics.msm_manual_fixtures (league, home_slug, home_name, away_slug, away_name)
  values (p_league, coalesce(p_home_slug, ''), p_home_name, coalesce(p_away_slug, ''), p_away_name)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.msm_delete_manual_fixture(p_id uuid)
returns void language plpgsql security definer set search_path = analytics, public as $$
begin
  delete from analytics.msm_manual_fixtures where id = p_id;
end $$;

grant execute on function public.msm_add_manual_fixture(text, text, text, text, text) to anon, authenticated;
grant execute on function public.msm_delete_manual_fixture(uuid) to anon, authenticated;
