-- GERI ALMA: msm_* RPC'lerine EXECUTE'u PUBLIC + anon'a GERI VERIR (revoke oncesi
-- hal). DIKKAT: guvenlik acigini (anon'un Super Lig model config'ini yazabilmesi)
-- YENIDEN ACAR. Yalniz revoke bir seyi kirdiysa ve gecici geri almak gerekiyorsa.
GRANT EXECUTE ON FUNCTION public.msm_add_manual_fixture(text, text, text, text, text) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.msm_delete_manual_fixture(uuid)                        TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.msm_log_import(text, jsonb)                            TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.msm_set_manual_fixture_proxy(uuid, text, text)         TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.msm_update_market_config(text, text, jsonb)            TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.msm_update_model_config(text, jsonb)                   TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.msm_upsert_fixture_inputs(text, jsonb)                 TO PUBLIC, anon;
NOTIFY pgrst, 'reload schema';
