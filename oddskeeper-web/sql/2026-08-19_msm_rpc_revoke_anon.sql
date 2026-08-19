-- GUVENLIK (ARCHITECTURE_REVIEW A5 / ciddi hata 2.1): public.msm_* SECURITY DEFINER
-- yazma RPC'leri anon rolunden calistirilabiliyordu. Publishable/anon anahtar JS
-- paketinde herkese acik oldugundan, kimliksiz biri Super Lig model/market config'ini
-- degistirebiliyor, fixture girdilerini yazabiliyor, manuel maclari silebiliyordu.
--
-- KOK: PostgreSQL fonksiyonlari VARSAYILAN olarak PUBLIC'e EXECUTE verir; anon bunu
-- PUBLIC uzerinden aliyordu (ayrica explicit anon grant'i da vardi). Bu yuzden hem
-- PUBLIC hem anon explicit EXECUTE kaldirilir.
--
-- IC KULLANICILAR KORUNUR: authenticated (giris yapmis kullanicilar), service_role ve
-- postgres bu fonksiyonlara AYRI (explicit) grant'la sahip; PUBLIC/anon revoke onlari
-- ETKILEMEZ -> authenticated'in yetkisi aynen kalir. Uygulama giris-kapili oldugundan
-- mesru MSM kullanimi hep authenticated'tan gelir; revoke uygulamayi kirmaz, yalniz
-- anon disk erisimi kapatir. (pm_*/bb_pm_* anon-write 2026-08-11'de zaten kapanmisti.)
--
-- Geri alma: *_ROLLBACK.sql (acigi YENIDEN acar, yalniz acil durumda).

REVOKE EXECUTE ON FUNCTION public.msm_add_manual_fixture(text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.msm_delete_manual_fixture(uuid)                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.msm_log_import(text, jsonb)                            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.msm_set_manual_fixture_proxy(uuid, text, text)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.msm_update_market_config(text, text, jsonb)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.msm_update_model_config(text, jsonb)                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.msm_upsert_fixture_inputs(text, jsonb)                 FROM PUBLIC, anon;

-- PostgREST schema cache'ini tazele (grant degisikligi hemen gecerli olsun).
NOTIFY pgrst, 'reload schema';
