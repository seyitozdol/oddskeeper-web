-- 2026-08-19: MSM yazma RPC'leri yalniz service-role (mimari inceleme 2.1 Faz 2)
--
-- Faz 1'de (38a28ba) anon EXECUTE geri alinmisti; yazma yolu yine de tarayicidan
-- dogrudan PostgREST /rpc uzerindeydi. Faz 2'de yazma tek kapiya alindi:
-- app/api/msm/write (service-role, once oturum dogrulanir) -- pm_* deseniyle ayni.
-- Bu migration authenticated'in DOGRUDAN EXECUTE yetkisini kaldirir; boylece
-- publishable anahtarla giris yapmis bir kullanicinin bile model konfigurasyonunu
-- endpoint'i atlayarak degistirmesi mumkun olmaz.
--
-- ONKOSUL: frontend'in route'a gectigi commit CANLI olmali (Vercel deploy bitmis).
-- Aksi halde MSM yazma islemleri 403 doner (okuma etkilenmez).
--
-- Geri alma: asagidaki revoke'lari grant'a cevir (ROLLBACK dosyasi yok, tek satir).

revoke execute on function public.msm_upsert_fixture_inputs(text, jsonb) from authenticated;
revoke execute on function public.msm_log_import(text, jsonb) from authenticated;
revoke execute on function public.msm_add_manual_fixture(text, text, text, text, text) from authenticated;
revoke execute on function public.msm_delete_manual_fixture(uuid) from authenticated;
revoke execute on function public.msm_set_manual_fixture_proxy(uuid, text, text) from authenticated;
revoke execute on function public.msm_update_model_config(text, jsonb) from authenticated;
revoke execute on function public.msm_update_market_config(text, text, jsonb) from authenticated;

-- service_role zaten EXECUTE'a sahip; acikca teyit (ileride default privilege
-- degisirse route kirilmasin).
grant execute on function public.msm_upsert_fixture_inputs(text, jsonb) to service_role;
grant execute on function public.msm_log_import(text, jsonb) to service_role;
grant execute on function public.msm_add_manual_fixture(text, text, text, text, text) to service_role;
grant execute on function public.msm_delete_manual_fixture(uuid) to service_role;
grant execute on function public.msm_set_manual_fixture_proxy(uuid, text, text) to service_role;
grant execute on function public.msm_update_model_config(text, jsonb) to service_role;
grant execute on function public.msm_update_market_config(text, text, jsonb) to service_role;

notify pgrst, 'reload schema';

-- Dogrulama: anon=f, auth=f, svc=t bekleniyor
-- select p.proname,
--        has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
--        has_function_privilege('service_role', p.oid, 'EXECUTE') as svc
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname like 'msm!_%' escape '!' order by 1;
