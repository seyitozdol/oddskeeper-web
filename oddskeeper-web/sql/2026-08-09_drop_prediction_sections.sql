-- 2026-08-09: Smart Prediction / Deep Prediction ML / Match Predictions
-- bolumlerinin kalici kaldirilmasi (frontend ayni gun silindi).
--
-- prediction semasindaki 7 tablonun TAMAMI bostu (0 satir), repo'da yazicisi
-- yoktu ve hicbir view bunlara bagimli degildi (pg_views taramasiyla
-- dogrulandi): dc_predictions, ml_predictions, smart_predictions,
-- match_stats_historical, referee_stats, team_name_mapping, team_stats_cache.
-- NOT: MSM hakem verisi analytics.msm_referee_* tablolarindadir; buradaki
-- bos prediction.referee_stats ile ilgisi yok.

drop schema if exists prediction cascade;

-- !! OLAY KAYDI (ayni gun): prediction, Supabase Data API'nin "exposed
-- schemas" listesinde kayitliydi. Sema drop edilince PostgREST sema
-- cache'ini kuramadi ve TUM REST API 503 dondu (PGRST002); sign-in'deki
-- alias kontrolu dahil butun veri istekleri kirildi. Cozum: sema BOS olarak
-- geri olusturuldu (asagida) ve cache reload edildi. Semayi gercekten
-- silmek icin ONCE Dashboard > Settings > API > Exposed schemas'tan
-- 'prediction' cikarilmali, SONRA drop edilmeli. Bos sema zararsizdir;
-- listeden cikarilinca bu drop yeniden calistirilabilir.
create schema if not exists prediction;
grant usage on schema prediction to anon, authenticated, service_role;

-- Kaldirilan header izin anahtarlarini kullanici izin dizilerinden ayikla.
-- Bilinmeyen anahtar zaten hicbir seye izin vermiyordu; bu sadece temizlik.
update public.user_nav_permissions
set allowed_keys = (
  select coalesce(array_agg(k), '{}')
  from unnest(allowed_keys) as k
  where k not in ('smart-prediction', 'deep-prediction-ml', 'match-predictions')
)
where allowed_keys is not null
  and allowed_keys && array['smart-prediction', 'deep-prediction-ml', 'match-predictions'];
