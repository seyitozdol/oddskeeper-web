-- 2026-10-01: MSM manuel fiksturleri Player Stats Model'de (PSM) de gorunur.
--
-- Manuel fikstur MSM > Fixture sekmesinde olusturulur (analytics.msm_manual_fixtures);
-- PSM yalniz resmi fikstur view'larini okudugundan bu maclar PSM'de secilemiyordu.
-- Bu view manuel fiksturu PSM'in bekledigi bicime cevirir; uc PSM kopyasi (TSL, 1. Lig,
-- Avrupa kupalari + milli takim) ayni view'i okur. Yeni tablo / yazma yolu yok.
--
--   fixture_id   PSM'de fikstur anahtari sayisal (state, input satirlari, export gecmisi).
--                uuid'nin ilk 12 hex hanesinden turetilen SABIT NEGATIF sayi: gercek
--                fikstur id'leri pozitif oldugundan cakismaz, 2^48 altinda kaldigindan
--                JS'te tam sayi olarak tasinir.
--   *_team_key   PSM kadro anahtari (lig basina farkli kimlik uzayi):
--                  tsl   -> apifootball team_source_id (team_current_squad_profile_v1)
--                  tff1  -> sofascore team_id (msm slug -> id, fikstur koprusunden)
--                  eurocl / euel / euecl / trnat -> slug zaten sofascore team_id
--                Ligde olmayan takim (serbest metin, 'manual-...' slug) -> null: o tarafin
--                kadrosu bos gelir. MSM'deki "benzer takim" (proxy) burada KULLANILMAZ;
--                baska takimin oyunculari listelenmesin.
--   external_fixture_id  MSM Fixture sekmesinde girilen fixture id (tek kaynak);
--                PSM Input satirlari bu degeri kullanir.

create or replace view analytics.pm_manual_fixtures_v1 as
select
  -(('x' || substr(replace(m.id::text, '-', ''), 1, 12))::bit(48)::bigint) - 1 as fixture_id,
  m.id as manual_id,
  m.league,
  m.home_name,
  m.away_name,
  m.home_slug,
  m.away_slug,
  case
    when m.league = 'tsl' then (
      select min(s.team_source_id) from analytics.team_current_squad_profile_v1 s
      where s.team_slug = m.home_slug)
    when m.league = 'tff1' then (
      select min(f.home_team_id)
      from analytics.msm_fixtures_tff1_v1 x
      join analytics.tff1_fixtures_v1 f on f.fixture_id = x.fixture_id
      where x.home_team_slug = m.home_slug)
    when m.home_slug ~ '^[0-9]+$' then m.home_slug
  end as home_team_key,
  case
    when m.league = 'tsl' then (
      select min(s.team_source_id) from analytics.team_current_squad_profile_v1 s
      where s.team_slug = m.away_slug)
    when m.league = 'tff1' then (
      select min(f.home_team_id)
      from analytics.msm_fixtures_tff1_v1 x
      join analytics.tff1_fixtures_v1 f on f.fixture_id = x.fixture_id
      where x.home_team_slug = m.away_slug)
    when m.away_slug ~ '^[0-9]+$' then m.away_slug
  end as away_team_key,
  (select nullif(max(i.external_fixture_id), '')
     from analytics.msm_fixture_inputs_v1 i
    where i.league = m.league and i.fixture_id = m.id::text) as external_fixture_id,
  m.created_at
from analytics.msm_manual_fixtures m;

-- anon'a HICBIR sey yok (anon lockdown).
grant select on analytics.pm_manual_fixtures_v1 to authenticated, service_role;

notify pgrst, 'reload schema';
