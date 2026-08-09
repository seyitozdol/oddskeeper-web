-- 2026-08-09: Eski "TFF 1. Lig" header basligi kaldirildi (ana sayfa +
-- matches silindi; 1. Lig artik yalniz Resmi deneyiminden [league-1lig]
-- kullaniliyor; player/team/match/player-market alt sayfalari drill-down
-- hedefi olarak yasiyor). tff-1-lig izin anahtari NAV_KEYS'ten cikti;
-- kullanici izin dizilerinden de ayiklanir.

update public.user_nav_permissions
set allowed_keys = (
  select coalesce(array_agg(k), '{}')
  from unnest(allowed_keys) as k
  where k <> 'tff-1-lig'
)
where allowed_keys is not null
  and allowed_keys && array['tff-1-lig'];
