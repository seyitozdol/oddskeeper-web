-- 2026-08-19: anon SELECT lockdown (mimari inceleme acik soru 2'nin karari)
--
-- KARAR (sahip, 2026-08-19): site tamamen giris arkasinda kalacak; anon'a acik
-- hicbir veri yuzeyi olmayacak. Tum okuma authenticated + service_role uzerinden.
-- Bundan sonra migration'larda "TO anon" YASAK; CI bekcisi:
-- .github/workflows/anon-guard.yml + scripts/check_no_anon_grants.sh.
-- Bilincli istisna gerekirse ilgili SQL satirina ANON-IZINLI yorumu ekle.
--
-- Envanter (2026-08-19, uygulama oncesi):
--   - 245 nesnede anon SELECT (analytics 206, basketball 8, euroleague 7,
--     volleyball 8, msm 10, ref 4, football 1, tracker 1)
--   - analytics.bb_pm_market_config'te MAINTAIN/REFERENCES/TRIGGER kalintisi
--   - public.pipeline_triggers_id_seq'te USAGE/UPDATE kalintisi
--   - postgres rolunun default privilege'lari yeni nesnelere OTOMATIK anon grant
--     veriyordu (public: tablo TUM yetkiler + sequence + fonksiyon; basketball/
--     euroleague/msm/volleyball: tablo SELECT). Asil sizinti kaynagi buydu.
--   - 6 analytics fonksiyonu PUBLIC-execute idi (refresh_* anon'dan cagrilabilir
--     yazma yuku demek; get_team_comparison_v1 frontend'in kullandigi tek RPC).
--
-- Kirilma analizi: anon SELECT'i olup authenticated SELECT'i olmayan nesne
-- sayisi 0 (uygulama oncesi dogrulandi); giris yapmis kullanici icin hicbir
-- yuzey degismez. Dev tarafinda DEV_AUTH_BYPASS artik server istekleri icin
-- SUPABASE_SECRET_KEY kullanir (frontend/lib/supabase/server.ts, ayni commit).
--
-- NOT: supabase_admin'in public/storage/graphql default ACL'lerindeki anon
-- girdilerine postgres dokunamaz; yalniz sistem nesnelerini etkiler, kabul
-- edilen kalinti. Trigger fonksiyonlari ve saf yardimcilar (derive_season_label,
-- norm_pos, set_updated_at) PUBLIC kaldi: PostgREST RPC olarak cagrilamazlar.

begin;

-- 1) Mevcut relation yetkileri: app semalarindaki tum tablo/view/matview + sequence
revoke all on all tables in schema
  public, analytics, football, ref, tracker, basketball, volleyball,
  euroleague, msm, map, mapping, etl, prediction, raw
from anon;

revoke all on all sequences in schema
  public, analytics, football, ref, tracker, basketball, volleyball,
  euroleague, msm, map, mapping, etl, prediction, raw
from anon;

-- 2) Schema USAGE (public haric: auth/RPC akislari icin kalir, icinde anon'a
--    SELECT'li nesne yok)
revoke usage on schema
  analytics, football, ref, tracker, basketball, volleyball,
  euroleague, msm, map, mapping, etl, prediction, raw
from anon;

-- 3) Default privilege temizligi: yeni nesneler artik otomatik anon grant almaz
alter default privileges for role postgres in schema public     revoke all on tables    from anon;
alter default privileges for role postgres in schema public     revoke all on sequences from anon;
alter default privileges for role postgres in schema public     revoke all on functions from anon;
alter default privileges for role postgres in schema basketball revoke all on tables    from anon;
alter default privileges for role postgres in schema euroleague revoke all on tables    from anon;
alter default privileges for role postgres in schema msm        revoke all on tables    from anon;
alter default privileges for role postgres in schema volleyball revoke all on tables    from anon;

-- 4) PUBLIC-execute analytics fonksiyonlari: RPC yuzeyini rol bazina indir
revoke all on function analytics.get_team_comparison_v1(p_team_slug_a text, p_team_slug_b text, p_split_key text, p_season_label text) from public, anon;
grant execute on function analytics.get_team_comparison_v1(p_team_slug_a text, p_team_slug_b text, p_split_key text, p_season_label text) to authenticated, service_role;

revoke all on function analytics.refresh_player_leaderboard_serving_v1() from public, anon;
grant execute on function analytics.refresh_player_leaderboard_serving_v1() to service_role;

revoke all on function analytics.refresh_team_leaderboard_serving_v1() from public, anon;
grant execute on function analytics.refresh_team_leaderboard_serving_v1() to service_role;

revoke all on function analytics.refresh_player_metric_leaderboard_v1_metric_scope(p_season_label text, p_competition text, p_metric_key text, p_batch_label text) from public, anon;
grant execute on function analytics.refresh_player_metric_leaderboard_v1_metric_scope(p_season_label text, p_competition text, p_metric_key text, p_batch_label text) to service_role;

revoke all on function analytics.refresh_player_metric_leaderboard_v1_scope(p_season_label text, p_competition text, p_batch_label text) from public, anon;
grant execute on function analytics.refresh_player_metric_leaderboard_v1_scope(p_season_label text, p_competition text, p_batch_label text) to service_role;

revoke all on function analytics.refresh_player_qualification_v1_scope(p_season_label text, p_competition text, p_batch_label text) from public, anon;
grant execute on function analytics.refresh_player_qualification_v1_scope(p_season_label text, p_competition text, p_batch_label text) to service_role;

commit;

-- PostgREST sema cache yenile
notify pgrst, 'reload schema';
